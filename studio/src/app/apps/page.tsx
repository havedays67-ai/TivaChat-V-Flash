import Link from "next/link";
import { getStaticBundle } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { Badge, Card, SectionHeading, StatCard } from "@/components/ui";
import { CATEGORY_FA, type AppCategory } from "@/lib/engine/apps";

export const dynamic = "force-dynamic";

const CATEGORY_TONE: Record<string, "emerald" | "sky" | "amber" | "rose" | "violet" | "neutral"> = {
  messaging: "emerald",
  system: "neutral",
  google: "sky",
  browser: "sky",
  store: "amber",
  ai: "violet",
  "iran-service": "rose",
  entertainment: "violet",
  vpn: "rose",
  tools: "neutral",
};

export default async function AppsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const category = params.cat?.trim() ?? "";
  const { apps } = await getStaticBundle();

  const filtered = apps.filter((app) => {
    const matchesCategory = !category || app.category === category;
    const haystack = [app.nameFa, app.nameEn, app.key, ...app.aliases].join(" ").toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  const grouped = new Map<string, typeof filtered>();
  for (const app of filtered) grouped.set(app.category, [...(grouped.get(app.category) ?? []), app]);

  const dualCount = apps.filter((app) => app.dualApp).length;
  const verifiedCount = apps.filter((app) => app.packageSource === "project-kb").length;
  const aliasTotal = apps.reduce((sum, app) => sum + app.aliases.length, 0);

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="راهنمای نام برنامه‌ها"
          title={`${formatNumber(apps.length)} برنامه با نام فارسی، محاوره‌ای و فینگلیش`}
          description="همهٔ نام‌ها از فهرست گوشی خودتان (Redmi Note 8 Pro) گرفته شده‌اند. پکیج حدس زده نمی‌شود: هر برنامه در زمان اجرا با PackageManager یا LauncherApps پیدا می‌شود و فقط چهار مورد از پایگاه دانش خود پروژه پکیج تأییدشده دارند."
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">تست «باز کن» برای همهٔ نام‌ها</Badge>
          <Badge tone="amber">{formatNumber(dualCount)} نسخهٔ دوگانهٔ MIUI</Badge>
          <Badge tone="sky">{formatNumber(aliasTotal)} alias ثبت‌شده</Badge>
          <Badge tone="violet">{formatNumber(verifiedCount)} پکیج تأییدشده</Badge>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل برنامه‌ها" value={formatNumber(apps.length)} hint="بدون نام ساختگی" />
        <StatCard label="aliasها" value={formatNumber(aliasTotal)} hint="انگلیسی، فارسی، محاوره‌ای" tone="sky" />
        <StatCard label="دوگانه‌ها" value={formatNumber(dualCount)} hint="تلگرام · بله · بلو · بلد" tone="amber" />
        <StatCard label="پکیج تأییدشده" value={formatNumber(verifiedCount)} hint="بقیه زمان اجرا حل می‌شوند" tone="violet" />
      </section>

      <Card>
        <form className="flex flex-col gap-2 sm:flex-row" action="/apps">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="جست‌وجو: تلگرام، مایکت، vpn…"
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
          />
          <select
            name="cat"
            defaultValue={category}
            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-slate-100 focus:border-violet-400/50 focus:outline-none"
          >
            <option value="">همهٔ دسته‌ها</option>
            {(Object.keys(CATEGORY_FA) as AppCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_FA[key]}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-violet-400/90 px-4 py-2 text-[12px] font-bold text-[#140a1f] transition hover:bg-violet-300">
            فیلتر
          </button>
          {query || category ? (
            <Link href="/apps" className="rounded-xl border border-white/12 px-3 py-2 text-center text-[12px] text-slate-300 hover:bg-white/5">
              پاک کردن
            </Link>
          ) : null}
        </form>
        <p className="mt-2 text-[10.5px] text-slate-500">نمایش {formatNumber(filtered.length)} برنامه</p>
      </Card>

      {[...grouped.entries()].map(([cat, items]) => (
        <section key={cat}>
          <SectionHeading eyebrow={formatNumber(items.length) + " برنامه"} title={CATEGORY_FA[cat as AppCategory] ?? cat} />
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((app) => (
              <div key={app.id} className="card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-bold text-slate-100">{app.nameFa}</p>
                    <p className="hash mt-0.5 text-[10px] text-slate-500">{app.nameEn}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={CATEGORY_TONE[app.category] ?? "neutral"}>{CATEGORY_FA[app.category as AppCategory] ?? app.category}</Badge>
                    {app.dualApp ? <Badge tone="amber">دوگانه</Badge> : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {app.aliases.slice(0, 6).map((alias) => (
                    <span key={alias} className="rounded-md border border-white/[0.08] bg-black/25 px-1.5 py-0.5 text-[9.5px] text-slate-400">
                      {alias}
                    </span>
                  ))}
                  {app.aliases.length > 6 ? (
                    <span className="rounded-md px-1.5 py-0.5 text-[9.5px] text-slate-600">+{app.aliases.length - 6}</span>
                  ) : null}
                </div>
                <p className="mt-2 border-t border-white/[0.06] pt-1.5 text-[9.5px] leading-5 text-slate-500">
                  {app.packageSource === "project-kb" ? (
                    <>
                      پکیج از پایگاه دانش پروژه: <code className="hash text-emerald-300">{app.packageHint}</code>
                    </>
                  ) : (
                    <>پکیج در زمان اجرا با PackageManager خوانده می‌شود (بدون حدس)</>
                  )}
                </p>
                {app.note ? <p className="mt-1 text-[9.5px] leading-5 text-amber-200/80">{app.note}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-[12px] text-slate-400">برنامه‌ای با این فیلتر پیدا نشد.</p>
        </Card>
      ) : null}
    </div>
  );
}
