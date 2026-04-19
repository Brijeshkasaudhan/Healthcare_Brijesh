import { BookOpen, FlaskConical, Lightbulb, User, Sparkles } from "lucide-react";
import type { ResearchPayload } from "@/lib/api";
import { SourceCard } from "./SourceCard";
import { TrialCard } from "./TrialCard";
import { Card } from "@/components/ui/card";

interface Props {
  payload: ResearchPayload;
  onFollowUp?: (q: string) => void;
}

// Render text with [n] citation markers as small clickable chips that scroll to the source.
function withCitations(text: string) {
  if (!text) return null;
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = m[1];
      return (
        <a
          key={i}
          href={`#source-${n}`}
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById(`source-${n}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.classList.add("ring-2", "ring-primary");
            setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1600);
          }}
          className="inline-flex items-center justify-center align-baseline mx-0.5 px-1.5 h-4 text-[10px] font-mono font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded transition-colors no-underline"
        >
          {n}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function StructuredAnswer({ payload, onFollowUp }: Props) {
  const { meta, sources } = payload;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Meta strip */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
          {meta.primary_condition}
        </span>
        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
          intent: {meta.intent}
        </span>
        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
          retrieved {meta.candidates.publications} pubs · {meta.candidates.trials} trials → kept top {meta.kept.publications}+{meta.kept.trials}
        </span>
      </div>

      {/* Condition overview */}
      {payload.condition_overview && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-display text-lg text-foreground">Condition overview</h3>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {withCitations(payload.condition_overview)}
          </p>
        </Card>
      )}

      {/* Research insights */}
      {payload.research_insights?.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-display text-lg text-foreground">Research insights</h3>
          </div>
          <ul className="space-y-3">
            {payload.research_insights.map((ins, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-3">
                <div className="text-sm font-semibold text-foreground">{ins.heading}</div>
                <div className="text-sm text-foreground/85 mt-0.5 leading-relaxed">
                  {withCitations(ins.body)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Trials summary */}
      {payload.clinical_trials_summary && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-md bg-trial/10 flex items-center justify-center">
              <FlaskConical className="h-3.5 w-3.5 text-trial" />
            </div>
            <h3 className="font-display text-lg text-foreground">Clinical trials</h3>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {withCitations(payload.clinical_trials_summary)}
          </p>
        </Card>
      )}

      {/* Personalized note */}
      {payload.personalized_note && (
        <Card className="p-5 bg-accent/30 border-accent">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-display text-lg text-foreground">For you</h3>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {withCitations(payload.personalized_note)}
          </p>
        </Card>
      )}

      {/* Sources grid */}
      {(sources.publications.length > 0 || sources.trials.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sources
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources.publications.map((p) => (
              <div key={p.id} id={`source-${p.n}`} className="rounded-xl transition-shadow">
                <SourceCard pub={p} />
              </div>
            ))}
            {sources.trials.map((t) => (
              <div key={t.id} id={`source-${t.n}`} className="rounded-xl transition-shadow">
                <TrialCard trial={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up suggestions */}
      {payload.follow_up_suggestions?.length > 0 && onFollowUp && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Suggested follow-ups</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {payload.follow_up_suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
