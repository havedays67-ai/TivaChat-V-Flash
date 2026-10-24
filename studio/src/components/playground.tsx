"use client";

import { useState } from "react";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { formatNumber, formatPercent } from "@/lib/format";

type ParseResult = {
  intent: string;
  labelFa: string;
  confidence: number;
  matchedBy: string;
  action: string;
  risk: string;
  needsConfirmation: boolean;
  shouldAsk: boolean;
  question: string | null;
  reply: string;
  honestLimit: string;
  normalized: string;
  slots: {
    app?: { nameFa: string; key: string; dual: boolean; packageHint: string | null };
    clock?: { hour: number; minute: number; period: string | null; ambiguous: boolean };
    duration?: { seconds: number; human: string };
    query?: string;
    contact?: string;
    message?: string;
    level?: number;
    mediaKind?: string;
    mode?: string;
  };
  alternatives: { intent: string; labelFa: string; confidence: number }[];
  plan: { step: string; detail: string }[];
  trace: { step: string; detail: string }[];
};

type ApiResponse = {
  input: string;
  rules: ParseResult;
  model: {
    predictions: { classKey: string; probability: number; labelFa: string }[];
    params: number;
    error: string | null;
  };
  gate: {
    execute: boolean;
    ask: boolean;
    needsConfirmation: boolean;
    reason: string;
    authority: string;
    modelAgrees: boolean;
    modelConfident: boolean;
    modelLabel: string | null;
  };
};

const PRESETS = [
  "ساعت ۲ ظهر بیدارم کن",
  "آلارم ۱۲ ظهر بذار",
  "آلارم ساعت 6:30",
  "نیم ساعت تایمر بذار",
  "یه عکس بگیر",
  "عکس‌ها رو پاک کن",
  "تلگرام رو حذف کن",
  "تلگرام دوگانه رو باز کن",
  "بله رو باز کن",
  "telegram ro baz kon",
  "گوگل فوتوز رو باز کن",
  "کروم رو باز کن و قیمت دلار رو سرچ کن",
  "به مامان زنگ بزن",
  "گوشی کند شده",
  "رم رو آزاد کن",
  "گوشی گرمه",
  "گرم شدن هوا",
  "کرم ضدآفتاب",
  "کشور ایران کجاست",
  "کش‌ها رو پاک کن و فضا رو بهینه کن",
  "تلگرام را ببند",
  "مرسی",
  "یه کاری کن",
];

export function Playground() {
  const [text, setText] = useState("ساعت ۲ ظهر بیدارم کن");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(value?: string) {
    const input = (value ?? text).trim();
    if (!input) return;
    setText(input);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/engine/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const payload = (await response.json()) as ApiResponse | { error?: string };
      if (!response.ok || !("rules" in payload)) {
        setError(("error" in payload && payload.error) || "تحلیل ناموفق بود.");
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeading
          eyebrow="آزمایش زنده"
          title="یک دستور فارسی بنویسید"
          description="همان موتور واقعی نسخهٔ ۱.۰.۲ و همان مدل آموزش‌دیده اجرا می‌شوند: قصد، اسلات‌ها، اطمینان، تصمیم ایمنی و پیش‌بینی مدل."
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
            maxLength={300}
            placeholder="مثلاً: آلارم ۷ صبح بذار"
            className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-5 py-2.5 text-[12.5px] font-bold text-[#04110d] transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "در حال تحلیل…" : "تحلیل دستور"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => void run(preset)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              {preset}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-[11.5px] text-rose-200">{error}</p>
        ) : null}
      </Card>

      {data ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={data.gate.execute ? "emerald" : data.gate.needsConfirmation ? "amber" : "rose"}>
                {data.gate.execute ? "اجرا مجاز" : data.gate.needsConfirmation ? "نیازمند تأیید" : "اجرا نشد"}
              </Badge>
              <Badge tone="sky">{data.rules.labelFa}</Badge>
              <Badge tone="neutral">اطمینان {formatPercent(data.rules.confidence, 0)}</Badge>
              <Badge tone="violet">{data.rules.action}</Badge>
              {data.rules.needsConfirmation ? <Badge tone="amber">تأیید صریح لازم</Badge> : null}
            </div>

            <p className="rounded-xl border border-white/[0.08] bg-black/25 p-3 text-[12px] leading-6 text-slate-300">
              {data.rules.reply || "بدون پاسخ متنی."}
            </p>

            {data.rules.shouldAsk ? (
              <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] p-3 text-[12px] font-medium leading-6 text-amber-100">
                ⚠ {data.rules.question ?? "منظورتان این بود؟"}
              </p>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <SlotBox label="قصد" value={`${data.rules.intent} · ${data.rules.labelFa}`} />
              <SlotBox label="تطبیق" value={data.rules.matchedBy} />
              <SlotBox label="نرمال‌شده" value={data.rules.normalized} mono />
              {data.rules.slots.app ? (
                <SlotBox
                  label="برنامه"
                  value={`${data.rules.slots.app.nameFa} (${data.rules.slots.app.key})${data.rules.slots.app.dual ? " · دوگانه" : ""}`}
                />
              ) : null}
              {data.rules.slots.clock ? (
                <SlotBox
                  label="ساعت"
                  value={`${String(data.rules.slots.clock.hour).padStart(2, "0")}:${String(data.rules.slots.clock.minute).padStart(2, "0")}${data.rules.slots.clock.period ? ` · ${data.rules.slots.clock.period}` : ""}`}
                />
              ) : null}
              {data.rules.slots.duration ? <SlotBox label="مدت" value={`${data.rules.slots.duration.human} (${data.rules.slots.duration.seconds} ثانیه)`} /> : null}
              {data.rules.slots.query ? <SlotBox label="عبارت جست‌وجو" value={data.rules.slots.query} /> : null}
              {data.rules.slots.contact ? <SlotBox label="مخاطب" value={data.rules.slots.contact} /> : null}
              {data.rules.slots.mediaKind ? <SlotBox label="نوع رسانه" value={data.rules.slots.mediaKind} /> : null}
              {data.rules.slots.level !== undefined ? <SlotBox label="مقدار" value={`${data.rules.slots.level}٪`} /> : null}
            </div>

            {data.rules.honestLimit ? (
              <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-[11.5px] leading-6 text-rose-100">
                محدودیت صادقانه: {data.rules.honestLimit}
              </p>
            ) : null}

            {data.rules.plan.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-bold text-slate-300">اجرای پیشنهادی روی اندروید</p>
                <div className="space-y-1.5">
                  {data.rules.plan.map((step) => (
                    <div key={step.step} className="rounded-lg border border-white/[0.07] bg-black/25 p-2.5">
                      <p className="text-[11.5px] font-bold text-emerald-300">{step.step}</p>
                      <p className="hash mt-0.5 text-[10.5px] leading-5 text-slate-400">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <div className="space-y-4">
            <Card className={data.gate.ask ? "border-amber-400/30" : "border-emerald-400/25"}>
              <SectionHeading eyebrow="دروازهٔ ایمنی" title="تصمیم نهایی" />
              <p className="text-[12px] leading-6 text-slate-300">{data.gate.reason}</p>
              <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                <p>مرجع اجرا: <span className="text-slate-200">{data.gate.authority}</span></p>
                <p>تشخیص مدل: <span className="text-slate-200">{data.gate.modelLabel ?? "—"}</span></p>
                <p>
                  توافق مدل و قواعد:{" "}
                  <span className={data.gate.modelAgrees ? "text-emerald-300" : "text-amber-300"}>
                    {data.gate.modelAgrees ? "هم‌راستا" : "متفاوت"}
                  </span>
                </p>
              </div>
            </Card>

            <Card>
              <SectionHeading eyebrow="مدل طبقه‌بند" title="سه احتمال اول" />
              {data.model.error ? (
                <p className="text-[11.5px] leading-6 text-amber-200">{data.model.error}</p>
              ) : (
                <div className="space-y-2">
                  {data.model.predictions.map((prediction) => (
                    <div key={prediction.classKey}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">{prediction.labelFa}</span>
                        <span className="hash text-slate-500">{formatPercent(prediction.probability)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full ${prediction.classKey === data.rules.intent ? "bg-emerald-400/80" : "bg-slate-400/50"}`}
                          style={{ width: `${Math.max(2, prediction.probability * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-[10px] text-slate-500">
                    {formatNumber(data.model.params)} پارامتر · int8 · هر پیش‌بینی چند میلی‌ثانیه
                  </p>
                </div>
              )}
            </Card>

            <Card>
              <SectionHeading eyebrow="مسیر تصمیم" title="ردپای موتور" />
              <ol className="space-y-1.5">
                {data.rules.trace.map((step, index) => (
                  <li key={`${step.step}-${index}`} className="flex gap-2 text-[10.5px] leading-5 text-slate-400">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-emerald-400/15 text-[9px] text-emerald-300">
                      {index + 1}
                    </span>
                    <span>
                      <span className="text-slate-300">{step.step}: </span>
                      {step.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlotBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-[11.5px] leading-5 text-slate-200 ${mono ? "hash" : ""}`}>{value || "—"}</p>
    </div>
  );
}
