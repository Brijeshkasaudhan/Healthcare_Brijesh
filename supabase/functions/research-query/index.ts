// Curalink — research-query orchestrator
// Steps: query expansion -> parallel deep retrieval (PubMed + OpenAlex + ClinicalTrials.gov)
// -> rerank -> LLM reasoning (Groq, llama-3.3-70b-versatile) -> persist -> return.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_FAST_MODEL = "llama-3.1-8b-instant";

type Pub = {
  id: string;
  source: "pubmed" | "openalex";
  title: string;
  abstract: string;
  authors: string[];
  year: number | null;
  url: string;
  score?: number;
};

type Trial = {
  id: string;
  source: "clinicaltrials";
  title: string;
  status: string;
  conditions: string[];
  eligibility: string;
  locations: { facility?: string; city?: string; country?: string }[];
  contact: { name?: string; email?: string; phone?: string } | null;
  url: string;
  startYear: number | null;
  score?: number;
};

// ---------- Groq helpers ----------
async function groq(messages: any[], opts: { model?: string; json?: boolean; max_tokens?: number } = {}) {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY not configured");
  const body: any = {
    model: opts.model ?? GROQ_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: opts.max_tokens ?? 2000,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`Groq error ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content as string;
}

// ---------- Step A: query expansion ----------
async function expandQuery(input: {
  disease?: string | null;
  query: string;
  history: { role: string; content: string }[];
}) {
  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const sys = `You are a medical research query planner. Given a user's question and patient context, produce JSON:
{
  "primary_condition": "the dominant medical condition (string)",
  "intent": "short label like 'treatment', 'clinical trial lookup', 'drug interaction', 'overview', 'epidemiology'",
  "search_queries": ["3 to 5 distinct, well-formed search strings combining condition + intent + relevant medical terminology"],
  "needs_retrieval": true
}
Rules:
- Always merge the disease context into queries (e.g. for "Vitamin D" with prior "lung cancer" => "vitamin D supplementation lung cancer outcomes").
- Prefer specific medical terms over colloquial ones.
- Set needs_retrieval=false ONLY for pure greetings/meta questions with no medical content.
Return ONLY the JSON.`;

  const user = `Patient context disease: ${input.disease || "(not specified)"}
Recent conversation:
${historyText || "(none)"}

Latest user question: ${input.query}`;

  const raw = await groq(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { model: GROQ_FAST_MODEL, json: true, max_tokens: 500 },
  );
  try {
    const parsed = JSON.parse(raw);
    return {
      primary_condition: String(parsed.primary_condition || input.disease || input.query).slice(0, 200),
      intent: String(parsed.intent || "overview").slice(0, 100),
      search_queries: Array.isArray(parsed.search_queries)
        ? parsed.search_queries.slice(0, 5).map((s: any) => String(s).slice(0, 250))
        : [input.query],
      needs_retrieval: parsed.needs_retrieval !== false,
    };
  } catch {
    return {
      primary_condition: input.disease || input.query,
      intent: "overview",
      search_queries: [input.query],
      needs_retrieval: true,
    };
  }
}

// ---------- Step B: retrieval ----------
async function fetchPubmed(query: string, retmax = 40): Promise<Pub[]> {
  try {
    const search = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
        query,
      )}&retmax=${retmax}&sort=pub+date&retmode=json`,
    );
    if (!search.ok) return [];
    const sj = await search.json();
    const ids: string[] = sj?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const fetchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`,
    );
    const xml = await fetchRes.text();
    return parsePubmedXml(xml);
  } catch (e) {
    console.error("pubmed fetch failed", e);
    return [];
  }
}

function parsePubmedXml(xml: string): Pub[] {
  const articles: Pub[] = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let m;
  while ((m = articleRegex.exec(xml)) !== null) {
    const block = m[1];
    const pmid = (block.match(/<PMID[^>]*>(\d+)<\/PMID>/) || [, ""])[1];
    const title = decodeXml((block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/) || [, ""])[1]);
    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((x) =>
      decodeXml(x[1]),
    );
    const abstract = abstractParts.join(" ").trim();
    const year = parseInt((block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) || [, ""])[1]) || null;
    const authors = [...block.matchAll(/<Author[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?(?:<Initials>([^<]+)<\/Initials>)?[\s\S]*?<\/Author>/g)]
      .map((a) => `${a[1]}${a[2] ? " " + a[2] : ""}`)
      .slice(0, 6);
    if (!pmid || !title) continue;
    articles.push({
      id: `pmid:${pmid}`,
      source: "pubmed",
      title: stripTags(title),
      abstract: stripTags(abstract).slice(0, 1500),
      authors,
      year,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }
  return articles;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function fetchOpenAlex(query: string, perPage = 40): Promise<Pub[]> {
  try {
    const today = new Date();
    const fromYear = today.getFullYear() - 8;
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query,
    )}&per-page=${perPage}&page=1&sort=relevance_score:desc&filter=from_publication_date:${fromYear}-01-01,has_abstract:true`;
    const r = await fetch(url, { headers: { "User-Agent": "Curalink/1.0 (research-assistant)" } });
    if (!r.ok) return [];
    const j = await r.json();
    const results = j?.results ?? [];
    return results.map((w: any) => {
      const abstractIdx = w.abstract_inverted_index;
      let abstract = "";
      if (abstractIdx && typeof abstractIdx === "object") {
        const positions: { word: string; pos: number }[] = [];
        for (const [word, posList] of Object.entries(abstractIdx)) {
          for (const p of posList as number[]) positions.push({ word, pos: p });
        }
        positions.sort((a, b) => a.pos - b.pos);
        abstract = positions.map((p) => p.word).join(" ").slice(0, 1500);
      }
      return {
        id: `openalex:${w.id?.split("/").pop()}`,
        source: "openalex" as const,
        title: w.title || w.display_name || "Untitled",
        abstract,
        authors: (w.authorships || [])
          .slice(0, 6)
          .map((a: any) => a?.author?.display_name)
          .filter(Boolean),
        year: w.publication_year || null,
        url: w.doi ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//, "")}` : (w.id || ""),
      };
    });
  } catch (e) {
    console.error("openalex fetch failed", e);
    return [];
  }
}

async function fetchTrials(query: string, location?: string | null, pageSize = 40): Promise<Trial[]> {
  try {
    const params = new URLSearchParams({
      "query.cond": query,
      pageSize: String(pageSize),
      format: "json",
    });
    if (location) params.set("query.locn", location);
    const r = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params.toString()}`);
    if (!r.ok) return [];
    const j = await r.json();
    const studies = j?.studies ?? [];
    return studies.map((s: any) => {
      const proto = s.protocolSection || {};
      const id = proto.identificationModule?.nctId || "";
      const title = proto.identificationModule?.briefTitle || proto.identificationModule?.officialTitle || "Untitled trial";
      const status = proto.statusModule?.overallStatus || "UNKNOWN";
      const conditions = proto.conditionsModule?.conditions || [];
      const eligibility = (proto.eligibilityModule?.eligibilityCriteria || "").slice(0, 1200);
      const locs = (proto.contactsLocationsModule?.locations || []).slice(0, 5).map((l: any) => ({
        facility: l.facility,
        city: l.city,
        country: l.country,
      }));
      const contactList = proto.contactsLocationsModule?.centralContacts || [];
      const contact = contactList[0]
        ? { name: contactList[0].name, email: contactList[0].email, phone: contactList[0].phone }
        : null;
      const startDate = proto.statusModule?.startDateStruct?.date || "";
      const startYear = parseInt(startDate.slice(0, 4)) || null;
      return {
        id: `nct:${id}`,
        source: "clinicaltrials" as const,
        title,
        status,
        conditions,
        eligibility,
        locations: locs,
        contact,
        url: `https://clinicaltrials.gov/study/${id}`,
        startYear,
      };
    });
  } catch (e) {
    console.error("trials fetch failed", e);
    return [];
  }
}

// ---------- Step C: rerank ----------
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function rerankPubs(pubs: Pub[], queries: string[], primaryCondition: string): Pub[] {
  const queryTokens = tokenize([primaryCondition, ...queries].join(" "));
  const currentYear = new Date().getFullYear();
  // dedupe by title
  const seen = new Set<string>();
  const uniq: Pub[] = [];
  for (const p of pubs) {
    const key = p.title.toLowerCase().slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(p);
  }
  for (const p of uniq) {
    const text = tokenize(`${p.title} ${p.abstract}`);
    const overlap = jaccard(queryTokens, text);
    const recency = p.year ? Math.max(0, 1 - (currentYear - p.year) / 10) : 0.2;
    const credibility = p.source === "pubmed" ? 1 : 0.85;
    const hasAbstract = p.abstract.length > 100 ? 1 : 0.4;
    p.score = overlap * 0.45 + recency * 0.3 + credibility * 0.15 + hasAbstract * 0.1;
  }
  return uniq.sort((a, b) => (b.score! - a.score!));
}

function rerankTrials(trials: Trial[], queries: string[], primaryCondition: string, location?: string | null): Trial[] {
  const queryTokens = tokenize([primaryCondition, ...queries].join(" "));
  const seen = new Set<string>();
  const uniq: Trial[] = [];
  for (const t of trials) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    uniq.push(t);
  }
  const statusWeight: Record<string, number> = {
    RECRUITING: 1,
    NOT_YET_RECRUITING: 0.85,
    ACTIVE_NOT_RECRUITING: 0.7,
    ENROLLING_BY_INVITATION: 0.7,
    COMPLETED: 0.5,
    TERMINATED: 0.2,
    WITHDRAWN: 0.1,
  };
  const locTokens = location ? tokenize(location) : null;
  for (const t of uniq) {
    const text = tokenize(`${t.title} ${t.conditions.join(" ")} ${t.eligibility}`);
    const overlap = jaccard(queryTokens, text);
    const status = statusWeight[t.status] ?? 0.4;
    let locMatch = 0;
    if (locTokens) {
      const allLoc = t.locations.map((l) => `${l.city || ""} ${l.country || ""}`).join(" ");
      locMatch = jaccard(locTokens, tokenize(allLoc));
    }
    t.score = overlap * 0.5 + status * 0.3 + locMatch * 0.2;
  }
  return uniq.sort((a, b) => (b.score! - a.score!));
}

// ---------- Step D: reasoning ----------
async function reason(input: {
  primaryCondition: string;
  intent: string;
  query: string;
  patientName?: string | null;
  location?: string | null;
  history: { role: string; content: string }[];
  pubs: Pub[];
  trials: Trial[];
}) {
  // Build numbered source list for citations
  const allSources = [
    ...input.pubs.map((p, i) => ({
      n: i + 1,
      type: "pub" as const,
      title: p.title,
      year: p.year,
      authors: p.authors.slice(0, 3).join(", "),
      source: p.source,
      snippet: p.abstract.slice(0, 600),
    })),
    ...input.trials.map((t, i) => ({
      n: input.pubs.length + i + 1,
      type: "trial" as const,
      title: t.title,
      status: t.status,
      conditions: t.conditions.slice(0, 3),
      eligibility: t.eligibility.slice(0, 400),
    })),
  ];

  const sourceBlock = allSources
    .map((s) =>
      s.type === "pub"
        ? `[${s.n}] PUB (${s.source}, ${s.year ?? "n.d."}) "${s.title}" by ${s.authors}\n   Abstract: ${s.snippet}`
        : `[${s.n}] TRIAL (${(s as any).status}) "${s.title}" — Conditions: ${(s as any).conditions.join(", ")}\n   Eligibility: ${(s as any).eligibility}`,
    )
    .join("\n\n");

  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const sys = `You are Curalink, a medical research assistant. You synthesize evidence from publications and clinical trials into structured, source-backed answers. NEVER invent facts. Cite every claim using [n] markers that map to the numbered source list. If sources are insufficient, say so.

Return ONLY valid JSON in this exact shape:
{
  "condition_overview": "1-2 paragraph plain-language summary of the condition / topic in this question's context. Include 1-3 inline [n] citations.",
  "research_insights": [
    { "heading": "Short heading", "body": "1-2 sentence finding with inline [n] citations." }
  ],
  "clinical_trials_summary": "Short paragraph summarizing relevant trials (status, eligibility highlights, geography). Use [n] citations. If no trials, say 'No directly relevant trials found.'",
  "personalized_note": "1-3 sentences tailored to the patient context (name, location, prior conversation). Cite if relevant. Always include a short safety reminder to consult a clinician.",
  "follow_up_suggestions": ["3 short suggested follow-up questions"]
}`;

  const user = `Patient: ${input.patientName || "(unspecified)"} | Location: ${input.location || "(unspecified)"}
Primary condition: ${input.primaryCondition}
Intent: ${input.intent}

Recent conversation:
${historyText || "(none)"}

Current question: ${input.query}

NUMBERED SOURCES (use [n] to cite):
${sourceBlock || "(no sources retrieved)"}`;

  const raw = await groq(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { model: GROQ_MODEL, json: true, max_tokens: 2400 },
  );
  try {
    return JSON.parse(raw);
  } catch {
    return {
      condition_overview: raw.slice(0, 1000),
      research_insights: [],
      clinical_trials_summary: "",
      personalized_note: "Always consult a qualified clinician for personal medical decisions.",
      follow_up_suggestions: [],
    };
  }
}

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 128);
    const conversationId = String(body.conversationId || "");
    const query = String(body.query || "").slice(0, 2000).trim();
    if (!sessionId || !conversationId || !query) {
      return new Response(JSON.stringify({ error: "sessionId, conversationId, query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify ownership + load conversation + history
    const { data: convo } = await sb
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!convo) {
      return new Response(JSON.stringify({ error: "conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: priorMessages } = await sb
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = (priorMessages || []).map((m) => ({ role: m.role, content: m.content }));

    // Save user message immediately
    await sb.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: query,
    });

    // Step A — expand
    const expanded = await expandQuery({ disease: convo.disease, query, history });

    let pubsTop: Pub[] = [];
    let trialsTop: Trial[] = [];
    let candidatePubCount = 0;
    let candidateTrialCount = 0;

    if (expanded.needs_retrieval) {
      // Step B — parallel retrieval across all expanded queries
      const queries = expanded.search_queries.length ? expanded.search_queries : [query];
      const pubmedPromises = queries.slice(0, 3).map((q) => fetchPubmed(q, 30));
      const openalexPromises = queries.slice(0, 3).map((q) => fetchOpenAlex(q, 30));
      const trialPromises = queries.slice(0, 2).map((q) => fetchTrials(q, convo.location, 30));

      const [pubmedAll, openalexAll, trialsAll] = await Promise.all([
        Promise.all(pubmedPromises).then((arrs) => arrs.flat()),
        Promise.all(openalexPromises).then((arrs) => arrs.flat()),
        Promise.all(trialPromises).then((arrs) => arrs.flat()),
      ]);

      const allPubs = [...pubmedAll, ...openalexAll];
      candidatePubCount = allPubs.length;
      candidateTrialCount = trialsAll.length;

      // Step C — rerank, keep top 8 pubs, top 6 trials
      pubsTop = rerankPubs(allPubs, queries, expanded.primary_condition).slice(0, 8);
      trialsTop = rerankTrials(trialsAll, queries, expanded.primary_condition, convo.location).slice(0, 6);
    }

    // Step D — reasoning
    const structured = await reason({
      primaryCondition: expanded.primary_condition,
      intent: expanded.intent,
      query,
      patientName: convo.patient_name,
      location: convo.location,
      history,
      pubs: pubsTop,
      trials: trialsTop,
    });

    // Build final payload (sources separately so frontend can render cards + click through)
    const payload = {
      ...structured,
      meta: {
        primary_condition: expanded.primary_condition,
        intent: expanded.intent,
        search_queries: expanded.search_queries,
        candidates: { publications: candidatePubCount, trials: candidateTrialCount },
        kept: { publications: pubsTop.length, trials: trialsTop.length },
      },
      sources: {
        publications: pubsTop.map((p, i) => ({
          n: i + 1,
          ...p,
        })),
        trials: trialsTop.map((t, i) => ({
          n: pubsTop.length + i + 1,
          ...t,
        })),
      },
    };

    // Persist assistant message
    const summaryText = structured.condition_overview || "Response generated.";
    const { data: saved } = await sb
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: summaryText.slice(0, 4000),
        structured_payload: payload,
      })
      .select()
      .single();

    // Auto-title from first user message if still default
    if (convo.title === "New conversation") {
      const newTitle = query.slice(0, 80);
      await sb.from("conversations").update({ title: newTitle }).eq("id", conversationId);
    }

    return new Response(JSON.stringify({ message: saved, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("research-query error", e);
    const msg = e instanceof Error ? e.message : "unknown";
    const status = msg === "RATE_LIMIT" ? 429 : 500;
    return new Response(
      JSON.stringify({
        error: msg === "RATE_LIMIT" ? "Rate limited by LLM. Please retry shortly." : msg,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
