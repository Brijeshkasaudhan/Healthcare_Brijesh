import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

export type ConversationSummary = {
  id: string;
  title: string;
  disease: string | null;
  patient_name: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structured_payload: ResearchPayload | null;
  created_at: string;
};

export type Publication = {
  n: number;
  id: string;
  source: "pubmed" | "openalex";
  title: string;
  abstract: string;
  authors: string[];
  year: number | null;
  url: string;
};

export type ClinicalTrial = {
  n: number;
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
};

export type ResearchPayload = {
  condition_overview: string;
  research_insights: { heading: string; body: string }[];
  clinical_trials_summary: string;
  personalized_note: string;
  follow_up_suggestions: string[];
  meta: {
    primary_condition: string;
    intent: string;
    search_queries: string[];
    candidates: { publications: number; trials: number };
    kept: { publications: number; trials: number };
  };
  sources: {
    publications: Publication[];
    trials: ClinicalTrial[];
  };
};

async function callFn<T>(name: string, body?: any, query?: Record<string, string>): Promise<T> {
  if (query) {
    // Edge functions also support invoking via fetch with query string for GET-style endpoints
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}?${new URLSearchParams(query).toString()}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || `Function ${name} failed`);
    return json as T;
  }
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

export async function listConversations() {
  return callFn<{ conversations: ConversationSummary[] }>("list-conversations", undefined, {
    sessionId: getSessionId(),
  });
}

export async function getConversation(conversationId: string) {
  return callFn<{ conversation: ConversationSummary; messages: StoredMessage[] }>(
    "list-conversations",
    undefined,
    { sessionId: getSessionId(), conversationId },
  );
}

export async function createConversation(input: {
  patientName?: string;
  disease?: string;
  location?: string;
  title?: string;
}) {
  return callFn<{ conversation: ConversationSummary }>("new-conversation", {
    sessionId: getSessionId(),
    ...input,
  });
}

export async function askResearch(input: { conversationId: string; query: string }) {
  return callFn<{ message: StoredMessage; payload: ResearchPayload }>("research-query", {
    sessionId: getSessionId(),
    ...input,
  });
}
