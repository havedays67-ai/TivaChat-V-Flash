import Link from "next/link";
import { getDatasetPage, getDatasetStats, getStaticBundle } from "@/lib/dashboard";
import { formatNumber, formatPercent } from "@/lib/format";
import { Badge, Bar, Card, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DatasetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cls?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const classKey = params.cls?.trim() ?? "";

  const [stats, bundle, page] = await Promise.all([
    getDatasetStats(),
    getStaticBundle(),
    getDatasetPage({ query, classKey, limit: 40 }),
  ]);

  const classes = bundle.classes;
  const labelOf = new Map(classes.map((intent) => [intent.key, intent.labelFa]));
  const descriptionOf = new Map(classes.map((intent) => [intent.key, intent.summary]));
  const riskOf = new Map(classes.map((intent) => [intent.key, intent.risk]));
  const sortedClasses = [...classes].sort((a, b) => (stats.perClass.get(b.key) ?? 0) - (stats.perClass.get(a.key) ?? 0));
  const avg = stats.classCount > 0 ? stats.total / stats.classCount : 0;
  const negatives = stats.perClass.get("negative") ?? 0;

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="دادهٔ آموزش"
          title="دیتاست متوازن و بازتولیدپذیر ۱.۰.۲"
          description="دیتاست قبلی ۲۵٬۶۰۳ نمونه داشت اما نامتوازن بود (compose_message حدود ۷٬۳۷۰ و timer حدود ۳۰۹). این نسخه دوباره ساخته شد: هر کلاس در بازهٔ هدف، تکراری‌ها حذف، و اجرای دوباره با seed ثابت همان داده را می‌دهد."
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{formatNumber(stats.classCount)} کلاس</Badge>
          <Badge tone="sky">{formatNumber(stats.total)} نمونهٔ یکتا</Badge>
          <Badge tone="violet">{formatNumber(stats.perClass.get("compose_message") ?? 0)} نمونه برای compose_message</Badge>
          <Badge tone="amber">{formatNumber(negatives)} نمونهٔ منفی</Badge>
          <Badge tone="neutral">{formatNumber(bundle.apps.length)} برنامه در راهنمای نام</Badge>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل نمونه‌ها" value={formatNumber(stats.total)} hint={`میانگین ${formatNumber(Math.round(avg))} در هر کلاس`} />
        <StatCard label="آموزش / آزمون" value={`${formatNumber(stats.train)} / ${formatNumber(stats.test)}`} hint={`${formatPercent(stats.test / Math.max(1, stats.total))} برای ارزیابی`} tone="sky" />
        <StatCard label="کمینه / بیشینهٔ کلاس" value={`${formatNumber(stats.min)} / ${formatNumber(stats.max)}`} hint="همه در بازهٔ ۳۰۰ تا ۸۰۰" tone="violet" />
        <StatCard label="یکتایی" value={`${formatNumber(stats.uniqueNormalized)}`} hint="بدون نمونهٔ تکراری پس از نرمال‌سازی" tone="amber" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <SectionHeading
            eyebrow="توزیع"
            title="نمونه به تفکیک کلاس"
            description="نوارها نسبت به بزرگ‌ترین کلاس‌اند. توازن، دلیل اصلی بالاتر رفتن دقت کلاس‌های کم‌نمونه مثل timer است."
          />
          <div className="scroll-thin max-h-[30rem] space-y-1.5 overflow-y-auto pe-1">
            {sortedClasses.map((intent) => {
              const count = stats.perClass.get(intent.key) ?? 0;
              return (
                <Link
                  key={intent.key}
                  href={`/dataset?cls=${encodeURIComponent(intent.key)}#samples`}
                  className="block rounded-lg border border-white/[0.06] bg-black/20 p-2 transition hover:border-sky-400/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] text-slate-200">{intent.labelFa}</span>
                    <span className="flex items-center gap-2">
                      <code className="hash text-[9.5px] text-slate-500">{intent.key}</code>
                      <span className="text-[10.5px] text-slate-300">{formatNumber(count)}</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar value={count} max={stats.max} tone={intent.kind === "negative" ? "rose" : intent.risk === "confirm" ? "amber" : "emerald"} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading eyebrow="دستور ساخت" title="چرا این داده تمیز است" />
            <ul className="space-y-2 text-[11.5px] leading-6 text-slate-300">
              <li>• تولید قطعی با seed ثابت؛ اجرای دوباره دقیقاً همان دیتاست را می‌سازد.</li>
              <li>• سه خانوادهٔ زبانی در هر کلاس: فارسی رسمی، محاوره‌ای و فینگلیش.</li>
              <li>• عبارت‌های مودبانه و کوتاه‌نویسی در پوسته، بدون ساختن جملهٔ بی‌معنی روی دستور.</li>
              <li>• نمونه‌های منفی متنوع: دانش عمومی، هوا، غذا، پزشکی، کد، مالی و جمله‌های مبهم.</li>
              <li>• تکراری‌ها پس از نرمال‌سازی حذف می‌شوند و تقسیم آموزش/آزمون بر پایهٔ هش متن است، نه تصادف ساده.</li>
              <li>• هیچ داده‌ای از گوشی شما خوانده نشده است؛ همه‌چیز ساختگی و قابل بازبینی است.</li>
            </ul>
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-2 text-[10.5px] leading-6 text-amber-100">
              محدودیت صادقانه: داده با الگو ساخته شده است. برای رسیدن به رفتار واقعی، باید جمله‌های خودتان هم اضافه شود؛
              ساختار برای افزودن آن‌ها آماده است.
            </p>
          </Card>

          <Card>
            <SectionHeading eyebrow="منفی‌ها" title="چه چیزهایی هیچ کاری نمی‌کنند" />
            <p className="text-[11px] leading-6 text-slate-400">{descriptionOf.get("negative")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["کشور ایران کجاست", "کرم ضدآفتاب", "گرم شدن هوا", "فرمت", "قیمت دلار", "یه جوک بگو", "بله", "خسته ام"].map((sample) => (
                <span key={sample} className="rounded-full border border-rose-400/20 bg-rose-500/[0.06] px-2 py-0.5 text-[10px] text-rose-200">
                  {sample}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-6 text-slate-500">
              هدف این کلاس: هیچ ACTIONی اجرا نشود. «آلارم» و «کرم» هم به‌خاطر مرز کلمه به رم نمی‌روند.
            </p>
          </Card>
        </div>
      </section>

      <section id="samples">
        <Card>
          <SectionHeading
            eyebrow="نمونه‌ها"
            title={classKey ? `نمونه‌های ${labelOf.get(classKey) ?? classKey}` : "جست‌وجو در دیتاست"}
            description="هر ردیف دقیقاً همان متنی است که به آموزش رفته یا برای آزمون کنار گذاشته شده است."
          />
          <form className="mb-3 flex flex-col gap-2 sm:flex-row" action="/dataset#samples">
            <input
              name="q"
              defaultValue={query}
              placeholder="جست‌وجو: مثلاً ظهر، تلگرام، تایمر…"
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
            />
            <select
              name="cls"
              defaultValue={classKey}
              className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-slate-100 focus:border-sky-400/50 focus:outline-none"
            >
              <option value="">همهٔ کلاس‌ها</option>
              {classes.map((intent) => (
                <option key={intent.key} value={intent.key}>
                  {intent.labelFa}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-xl bg-sky-400/90 px-4 py-2 text-[12px] font-bold text-[#04121c] transition hover:bg-sky-300">
              فیلتر
            </button>
            {query || classKey ? (
              <Link href="/dataset" className="rounded-xl border border-white/12 px-3 py-2 text-center text-[12px] text-slate-300 hover:bg-white/5">
                پاک کردن
              </Link>
            ) : null}
          </form>

          <p className="mb-2 text-[10.5px] text-slate-500">نمایش {formatNumber(page.rows.length)} از {formatNumber(page.total)} نمونه</p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[620px] text-start">
              <thead className="text-[10px] text-slate-500">
                <tr>
                  <th className="py-2 text-start font-medium">متن</th>
                  <th className="py-2 text-start font-medium">کلاس</th>
                  <th className="py-2 text-start font-medium">برچسب</th>
                  <th className="py-2 text-start font-medium">تقسیم</th>
                  <th className="py-2 text-start font-medium">ریسک</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pe-2 text-[11.5px] text-slate-200">{row.text}</td>
                    <td className="py-1.5 pe-2"><code className="hash text-[9.5px] text-slate-500">{row.classKey}</code></td>
                    <td className="py-1.5 pe-2 text-[10.5px] text-slate-400">{labelOf.get(row.classKey) ?? "—"}</td>
                    <td className="py-1.5 pe-2">
                      <Badge tone={row.split === "train" ? "emerald" : "sky"}>{row.split === "train" ? "آموزش" : "آزمون"}</Badge>
                    </td>
                    <td className="py-1.5">
                      <Badge tone={riskOf.get(row.classKey) === "confirm" ? "amber" : "neutral"}>
                        {riskOf.get(row.classKey) === "confirm" ? "تأیید" : "امن"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {page.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[11.5px] text-slate-400">نمونه‌ای با این فیلتر پیدا نشد.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
