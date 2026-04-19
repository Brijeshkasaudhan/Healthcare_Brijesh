import { ExternalLink, MapPin, Mail, Phone, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClinicalTrial } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  RECRUITING: "bg-success/15 text-success border-success/30",
  NOT_YET_RECRUITING: "bg-info/15 text-info border-info/30",
  ACTIVE_NOT_RECRUITING: "bg-info/15 text-info border-info/30",
  ENROLLING_BY_INVITATION: "bg-info/15 text-info border-info/30",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  TERMINATED: "bg-destructive/15 text-destructive border-destructive/30",
  WITHDRAWN: "bg-destructive/15 text-destructive border-destructive/30",
};

export function TrialCard({ trial }: { trial: ClinicalTrial }) {
  const statusClass = STATUS_STYLES[trial.status] ?? "bg-muted text-muted-foreground border-border";
  const primaryLoc = trial.locations[0];
  return (
    <Card className="p-4 hover:shadow-elevated transition-shadow group border-l-4 border-l-trial">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            [{trial.n}]
          </span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-trial/10 text-trial border-trial/20">
            <FlaskConical className="h-2.5 w-2.5 mr-1" />
            Clinical trial
          </Badge>
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${statusClass}`}>
            {trial.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <a href={trial.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <a href={trial.url} target="_blank" rel="noopener noreferrer" className="block">
        <h4 className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {trial.title}
        </h4>
      </a>
      {trial.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {trial.conditions.slice(0, 4).map((c, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {c}
            </span>
          ))}
        </div>
      )}
      {trial.eligibility && (
        <details className="mt-2 group/elig">
          <summary className="cursor-pointer text-xs font-medium text-foreground/80 hover:text-primary">
            Eligibility criteria
          </summary>
          <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line leading-relaxed line-clamp-[10]">
            {trial.eligibility}
          </p>
        </details>
      )}
      <div className="mt-2.5 flex flex-col gap-1 text-xs text-muted-foreground">
        {primaryLoc && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {[primaryLoc.facility, primaryLoc.city, primaryLoc.country].filter(Boolean).join(", ")}
              {trial.locations.length > 1 && ` (+${trial.locations.length - 1} more)`}
            </span>
          </div>
        )}
        {trial.contact?.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <a href={`mailto:${trial.contact.email}`} className="hover:text-primary truncate">
              {trial.contact.email}
            </a>
          </div>
        )}
        {trial.contact?.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{trial.contact.phone}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
