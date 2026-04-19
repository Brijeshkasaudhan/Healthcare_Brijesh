import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askResearch, getConversation, type StoredMessage, type ConversationSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { StructuredAnswer } from "./StructuredAnswer";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { Activity, MapPin, User } from "lucide-react";

interface Props {
  conversation: ConversationSummary;
}

export function ChatPane({ conversation }: Props) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessages([]);
    getConversation(conversation.id)
      .then((r) => alive && setMessages(r.messages))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [conversation.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      // optimistic user message
      const optimistic: StoredMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversation.id,
        role: "user",
        content: q,
        structured_payload: null,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);
      setBusy(true);
      try {
        const r = await askResearch({ conversationId: conversation.id, query: q });
        setMessages((m) => [...m, r.message]);
      } catch (e: any) {
        toast({
          title: "Research failed",
          description: e.message ?? "Unknown error",
          variant: "destructive",
        });
        // keep optimistic user msg so they can retry
      } finally {
        setBusy(false);
      }
    },
    [busy, conversation.id, toast],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-foreground truncate">{conversation.title}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {conversation.patient_name && (
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{conversation.patient_name}</span>
            )}
            {conversation.disease && (
              <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{conversation.disease}</span>
            )}
            {conversation.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{conversation.location}</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div ref={scrollRef as any} className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onPick={send} disease={conversation.disease} />
          ) : (
            messages.map((m) => (
              <div key={m.id} className="space-y-2">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-2xl bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-card">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {m.structured_payload ? (
                      <StructuredAnswer payload={m.structured_payload} onFollowUp={send} />
                    ) : (
                      <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {busy && <ThinkingIndicator />}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 bg-background border border-input rounded-2xl shadow-card focus-within:border-primary focus-within:shadow-glow transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Ask about ${conversation.disease || "the condition"}…  (e.g. "Latest treatments", "Active trials nearby")`}
              rows={1}
              className="resize-none border-0 bg-transparent focus-visible:ring-0 min-h-[48px] max-h-40 py-3"
              disabled={busy}
            />
            <Button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              size="icon"
              className="m-1.5 h-9 w-9 shrink-0 bg-gradient-primary hover:opacity-90 text-primary-foreground"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Powered by Llama 3.3 (Groq) • PubMed • OpenAlex • ClinicalTrials.gov · Information only — not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick, disease }: { onPick: (q: string) => void; disease: string | null }) {
  const suggestions = disease
    ? [
        `Latest treatments for ${disease}`,
        `Active clinical trials for ${disease}`,
        `Recent research breakthroughs in ${disease}`,
        `Lifestyle factors affecting ${disease}`,
      ]
    : [
        "Latest treatment for lung cancer",
        "Clinical trials for diabetes",
        "Top recent studies on Alzheimer's disease",
        "New research on heart disease",
      ];
  return (
    <div className="text-center py-10">
      <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-primary items-center justify-center shadow-glow mb-4">
        <Activity className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="font-display text-2xl text-foreground">Ask anything about {disease || "your topic"}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Curalink retrieves from PubMed, OpenAlex, and ClinicalTrials.gov, then reasons over the evidence to give you a structured, source-backed answer.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-sm px-4 py-2 rounded-full bg-card border border-border hover:border-primary hover:text-primary hover:shadow-card transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
