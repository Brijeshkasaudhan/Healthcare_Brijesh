import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const STAGES = [
  "Expanding query with medical context…",
  "Searching PubMed, OpenAlex & ClinicalTrials.gov…",
  "Reranking 100+ candidates by relevance & recency…",
  "Synthesizing structured response with citations…",
];

export function ThinkingIndicator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 2500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border shadow-card animate-fade-in-up">
      <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shrink-0">
        <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">Curalink is researching</div>
        <ul className="mt-2 space-y-1">
          {STAGES.map((s, idx) => (
            <li
              key={s}
              className={`text-xs flex items-center gap-2 transition-opacity ${
                idx <= i ? "opacity-100 text-foreground" : "opacity-40 text-muted-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${idx === i ? "bg-primary animate-pulse-dot" : idx < i ? "bg-success" : "bg-muted-foreground/40"}`} />
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
