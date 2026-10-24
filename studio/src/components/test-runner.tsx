"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TestRunner() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  async function run() {
    setLoading(true);
    setMessage(null);
    setFailures([]);
    try {
      const response = await fetch("/api/tests/run", { method: "POST" });
      const data = (await response.json()) as {
        passed?: number;
        total?: number;
        failed?: number;
        durationMs?: number;
        failures?: { key: string; prompt: string; detail: string }[];
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "اجرای آزمون ناموفق بود.");
        return;
      }
      setMessage(`اجرا شد: ${data.passed}/${data.total} قبول · ${data.durationMs} میلی‌ثانیه`);
      setFailures((data.failures ?? []).map((failure) => `${failure.key} — ${failure.prompt} — ${failure.detail}`));
      router.refresh();
    } catch {
      setMessage("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-4 py-2 text-[12.5px] font-bold text-[#04110d] transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "در حال اجرای ۵۱ آزمون…" : "اجرای دوبارهٔ کل آزمون‌ها"}
      </button>
      {message ? <p className="text-[11px] text-emerald-300">{message}</p> : null}
      {failures.length > 0 ? (
        <ul className="space-y-1">
          {failures.map((failure) => (
            <li key={failure} className="text-[10.5px] leading-5 text-rose-300">{failure}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
