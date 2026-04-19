import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, User, Activity, MapPin, Sparkles } from "lucide-react";
import { createConversation, type ConversationSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCreated: (c: ConversationSummary) => void;
}

export function PatientContextForm({ onCreated }: Props) {
  const [open, setOpen] = useState(true);
  const [patientName, setPatientName] = useState("");
  const [disease, setDisease] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!disease.trim()) {
      toast({ title: "Disease required", description: "Enter a condition to focus the research.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await createConversation({
        patientName: patientName.trim() || undefined,
        disease: disease.trim(),
        location: location.trim() || undefined,
        title: disease.trim(),
      });
      onCreated(r.conversation);
    } catch (e: any) {
      toast({ title: "Couldn't start chat", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-gradient-subtle border-border shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">Patient context</div>
            <div className="text-xs text-muted-foreground">Optional but improves personalization</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up">
          <div>
            <Label htmlFor="pn" className="text-xs flex items-center gap-1.5 mb-1.5"><User className="h-3 w-3" /> Patient name</Label>
            <Input id="pn" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div>
            <Label htmlFor="ds" className="text-xs flex items-center gap-1.5 mb-1.5"><Activity className="h-3 w-3" /> Disease / condition *</Label>
            <Input id="ds" value={disease} onChange={(e) => setDisease(e.target.value)} placeholder="e.g. Parkinson's disease" />
          </div>
          <div>
            <Label htmlFor="lc" className="text-xs flex items-center gap-1.5 mb-1.5"><MapPin className="h-3 w-3" /> Location</Label>
            <Input id="lc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Toronto, Canada" />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              {busy ? "Starting…" : "Start research chat"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
