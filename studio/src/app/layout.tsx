import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "استودیوی تیواچت | نسخهٔ ۱.۰.۲",
  description:
    "موتور دستور فارسی، دیتاست متوازن ۱۹٬۷۴۹ نمونه، مدل ۱۰ میلیون پارامتری و آزمون‌های پذیرش TivaChat V Flash 1.0.2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-7 md:px-6 md:py-10">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
          <div className="card flex flex-col gap-2 p-4 text-[11.5px] leading-6 text-slate-400 md:flex-row md:items-center md:justify-between">
            <p className="m-0">
              ساخته‌شده برای پروژهٔ <code className="hash text-slate-300">havedays67-ai/TivaChat-V-Flash</code> — هیچ فایلی در مخزن یا APK تغییر داده نشد.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/engine" className="text-emerald-300 hover:underline">
                امتحان موتور
              </Link>
              <span className="text-slate-600">·</span>
              <Link href="/release" className="text-emerald-300 hover:underline">
                وضعیت انتشار
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
