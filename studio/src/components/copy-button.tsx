"use client";

import { useState } from "react";

export function CopyButton({ value, label = "کپی" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
      aria-label={label}
    >
      {copied ? "کپی شد ✓" : label}
    </button>
  );
}
