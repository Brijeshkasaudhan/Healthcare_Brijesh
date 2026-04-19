import { Stethoscope, FlaskConical, Activity } from "lucide-react";

export function CuralinkLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
        <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-xl text-foreground">Curalink</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">
          AI Medical Research
        </span>
      </div>
    </div>
  );
}

export const SourceBadgeIcons = { Stethoscope, FlaskConical };
