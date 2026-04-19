import { useEffect, useState } from "react";
import { Plus, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listConversations, type ConversationSummary } from "@/lib/api";
import { CuralinkLogo } from "./CuralinkLogo";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
}

export function ConversationSidebar({ activeId, onSelect, onNew, refreshKey }: Props) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listConversations()
      .then((r) => alive && setItems(r.conversations))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <aside className="w-72 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <CuralinkLogo />
      </div>
      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" />
          New research chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet.
            <br />
            Start your first one above.
          </div>
        ) : (
          <ul className="space-y-1 pb-4">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group",
                    activeId === c.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.title}</div>
                      {c.disease && (
                        <div className="text-[11px] text-muted-foreground truncate">{c.disease}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground leading-relaxed">
        Curalink is a research assistant. Always consult a qualified clinician for medical decisions.
      </div>
    </aside>
  );
}
