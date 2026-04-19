import { useEffect, useState } from "react";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { PatientContextForm } from "@/components/PatientContextForm";
import { ChatPane } from "@/components/ChatPane";
import { getConversation, type ConversationSummary } from "@/lib/api";
import { Activity, BookOpen, FlaskConical, ShieldCheck } from "lucide-react";

const Index = () => {
  const [active, setActive] = useState<ConversationSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Update document title for SEO
  useEffect(() => {
    document.title = "Curalink — AI Medical Research Assistant";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Curalink is an AI medical research companion. Ask any health question and get structured, source-backed answers from PubMed, OpenAlex, and ClinicalTrials.gov.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  const handleSelect = async (id: string) => {
    try {
      const r = await getConversation(id);
      setActive(r.conversation);
    } catch {}
  };

  const handleNew = () => setActive(null);

  const handleCreated = (c: ConversationSummary) => {
    setActive(c);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      <ConversationSidebar
        activeId={active?.id ?? null}
        onSelect={handleSelect}
        onNew={handleNew}
        refreshKey={refreshKey}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        {active ? (
          <ChatPane conversation={active} key={active.id} />
        ) : (
          <Landing onCreated={handleCreated} />
        )}
      </main>
    </div>
  );
};

function Landing({ onCreated }: { onCreated: (c: ConversationSummary) => void }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-primary items-center justify-center shadow-glow mb-5">
            <Activity className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-foreground tracking-tight">
            Your AI medical research companion
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
            Curalink reads thousands of publications and active clinical trials to give you
            structured, source-backed answers — personalized to your context.
          </p>
        </div>

        <PatientContextForm onCreated={onCreated} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
          <FeatureChip icon={<BookOpen className="h-4 w-4" />} title="Deep retrieval" desc="Pulls 100+ candidates from PubMed & OpenAlex, then ranks by relevance + recency." />
          <FeatureChip icon={<FlaskConical className="h-4 w-4" />} title="Live trials" desc="Active studies from ClinicalTrials.gov filtered by your condition and location." />
          <FeatureChip icon={<ShieldCheck className="h-4 w-4" />} title="Cited reasoning" desc="Every claim is grounded in a numbered source you can click through." />
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> Curalink is a research aid, not medical advice. Always consult a qualified clinician.
        </div>
      </div>
    </div>
  );
}

function FeatureChip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

export default Index;
