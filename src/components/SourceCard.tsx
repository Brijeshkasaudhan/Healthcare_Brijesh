import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Publication } from "@/lib/api";

export function SourceCard({ pub }: { pub: Publication }) {
  const sourceColor = pub.source === "pubmed" ? "bg-pubmed/10 text-pubmed border-pubmed/20" : "bg-openalex/10 text-openalex border-openalex/20";
  return (
    <Card className="p-4 hover:shadow-elevated transition-shadow group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            [{pub.n}]
          </span>
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${sourceColor}`}>
            {pub.source}
          </Badge>
          {pub.year && <span className="text-xs text-muted-foreground">{pub.year}</span>}
        </div>
        <a
          href={pub.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Open source"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <a href={pub.url} target="_blank" rel="noopener noreferrer" className="block">
        <h4 className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {pub.title}
        </h4>
      </a>
      {pub.authors.length > 0 && (
        <div className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
          {pub.authors.slice(0, 4).join(", ")}
          {pub.authors.length > 4 && " et al."}
        </div>
      )}
      {pub.abstract && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{pub.abstract}</p>
      )}
    </Card>
  );
}
