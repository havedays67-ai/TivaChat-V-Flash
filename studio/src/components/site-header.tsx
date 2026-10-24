"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "نمای کلی" },
  { href: "/engine", label: "موتور دستور" },
  { href: "/model", label: "مدل ۱۰M" },
  { href: "/dataset", label: "دیتاست" },
  { href: "/tests", label: "آزمون‌ها" },
  { href: "/apps", label: "برنامه‌ها" },
  { href: "/release", label: "انتشار ۱.۰.۲" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05080c]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-lg font-bold text-[#04110d] shadow-[0_10px_30px_-10px_rgba(16,185,129,0.8)]">
            T
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold text-slate-100">استودیوی تیواچت</span>
            <span className="hash block text-[10px] text-slate-500">TivaChat V Flash · 1.0.2</span>
          </span>
        </Link>
        <nav className="scroll-thin -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-emerald-400/12 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
