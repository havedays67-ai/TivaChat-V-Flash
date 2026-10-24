import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import type { ReactNode as _ReactNode } from "react";
import { CopyButton } from "./copy-button";

export type Tone = "emerald" | "sky" | "amber" | "rose" | "violet" | "neutral";

const TONES: Record<Tone, string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  sky: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  violet: "border-violet-400/30 bg-violet-500/10 text-violet-300",
  neutral: "border-white/12 bg-white/[0.04] text-slate-300",
};

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`card ${padded ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400/80">{eyebrow}</p> : null}
        <h2 className="text-lg font-bold text-slate-100 md:text-xl">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-[13px] leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "emerald",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  const glow: Record<string, string> = {
    emerald: "from-emerald-400/70",
    sky: "from-sky-400/70",
    amber: "from-amber-400/70",
    rose: "from-rose-400/70",
    violet: "from-violet-400/70",
    neutral: "from-slate-400/60",
  };
  return (
    <div className="card relative overflow-hidden p-4">
      <span className={`absolute inset-x-0 top-0 h-px bg-gradient-to-l ${glow[tone]} to-transparent`} />
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Bar({ value, max, tone = "emerald" }: { value: number; max: number; tone?: Tone }) {
  const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const colors: Record<Tone, string> = {
    emerald: "bg-emerald-400/70",
    sky: "bg-sky-400/70",
    amber: "bg-amber-400/70",
    rose: "bg-rose-400/70",
    violet: "bg-violet-400/70",
    neutral: "bg-slate-400/50",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const tone: Tone = value >= 0.9 ? "emerald" : value >= 0.75 ? "amber" : "rose";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label ?? "دقت"}</span>
        <span className={TONES[tone]} style={{ background: "transparent", border: 0, padding: 0 }}>
          {formatPercent(value)}
        </span>
      </div>
      <Bar value={value * 100} max={100} tone={tone} />
    </div>
  );
}

export function HashRow({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-[12px] text-slate-400">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="hash text-[11px] text-slate-200">{value}</code>
        {copy ? <CopyButton value={value} /> : null}
      </div>
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span className="text-[12.5px] font-medium text-slate-200">{children}</span>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-4">
      <p className="text-[13px] font-bold text-amber-200">{title}</p>
      <p className="mt-1 text-[11.5px] leading-6 text-slate-300">{body}</p>
    </div>
  );
}
