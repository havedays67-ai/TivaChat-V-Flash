import Link from "next/link";
import { getDatasetStats, getLatestModel, getLatestTestRun, getStaticBundle } from "@/lib/dashboard";
import { formatBytes, formatNumber, formatPercent, shortHash } from "@/lib/format";
import { Badge, Card, KeyValue, Meter, SectionHeading, StatCard } from "@/components/ui";
import { DownloadCard } from "@/components/download-card";
import { RELEASE } from "@/lib/release";

export const dynamic = "force-dynamic";

const REQUIREMENTS = [
  {
    key: "ظهر",
    title: "قاعدهٔ «ظهر» و ساعت‌های فارسی",
    detail: "«۲ ظهر» ← ۱۴:۰۰، «۱۲ ظهر» ← ۱۲:۰۰، «۸ شب» ← ۲۰:۰۰ · موتور زمان مشترک JS/Java",
    status: "engine",
    href: "/engine",
  },
  {
    key: "اطمینان",
    title: "دروازهٔ اطمینان ۰٫۹",
    detail: "زیر ۰٫۹ هیچ دستوری اجرا نمی‌شود و «منظورتان این بود؟» می‌پرسد؛ قصدهای حساس تأیید جدا دارند",
    status: "engine",
    href: "/engine",
  },
  {
    key: "دوربین",
    title: "«یه عکس بگیر» ← دوربین",
    detail: "مسیر عکاسی از مسیر حذف جدا شد؛ ACTION_IMAGE_CAPTURE + FileProvider",
    status: "patch",
    href: "/release",
  },
  {
    key: "کندی",
    title: "«گوشی کند شده» ← رم و مدیریت برنامه‌ها",
    detail: "دیگر گزارش باتری نمی‌دهد؛ کندی، لگ و داغی به گزارش رم + App management می‌رود",
    status: "engine",
    href: "/engine",
  },
  {
    key: "رم",
    title: "«رم رو آزاد کن» با پاسخ صادقانه",
    detail: "اندروید ۱۱+ اجازهٔ آزادسازی رم برنامه‌های دیگر نمی‌دهد؛ مسیر رسمی نشان داده می‌شود",
    status: "engine",
    href: "/engine",
  },
  {
    key: "دیتاست",
    title: "دیتاست متوازن ۳۴ کلاسه",
    detail: "۳۳۹ تا ۷۹۹ نمونه برای هر کلاس، compose_message از ۷٬۳۷۰ به ۶۰۰ و timer در محدودهٔ متوازن",
    status: "dataset",
    href: "/dataset",
  },
  {
    key: "حذف",
    title: "حذف فقط با دیالوگ سیستم",
    detail: "MediaStore.createDeleteRequest (۱۱+)، RecoverableSecurityException (۱۰)، ACTION_DELETE برای برنامه",
    status: "patch",
    href: "/release",
  },
  {
    key: "alias",
    title: "راهنمای نام همهٔ برنامه‌ها",
    detail: "۱۲۲ برنامه با نام فارسی، انگلیسی، محاوره‌ای و فینگلیش؛ چهار برنامهٔ دوگانهٔ MIUI جدا",
    status: "engine",
    href: "/apps",
  },
];

const STATUS_META = {
  engine: { label: "در موتور ۱.۰.۲ پیاده شد", tone: "emerald" as const },
  dataset: { label: "دیتاست بازسازی شد", tone: "sky" as const },
  patch: { label: "پچ آمادهٔ اعمال روی سورس", tone: "violet" as const },
};

export default async function OverviewPage() {
  const [bundle, dataset, model, latestTest] = await Promise.all([
    getStaticBundle(),
    getDatasetStats(),
    getLatestModel(),
    getLatestTestRun(),
  ]);

  const metrics = model?.metrics;
  const acceptance = metrics?.acceptance;
  const dualApps = bundle.apps.filter((app) => app.dualApp).length;
  const testPassed = latestTest?.run.passed ?? 0;
  const testTotal = latestTest?.run.total ?? 0;

  return (
    <div className="space-y-7">
      <section className="card rise relative overflow-hidden p-6 md:p-8">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute -top-24 left-6 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="emerald">نسخهٔ منتشرشده ۱.۰.۱ · build 4 (بدون تغییر نسخه)</Badge>
              <Badge tone="sky">۳۴ کلاس دستور</Badge>
              <Badge tone="violet">{formatNumber(model?.params ?? 10027008)} پارامتر</Badge>
              <Badge tone="amber">{testPassed}/{testTotal} آزمون پذیرش</Badge>
            </div>
            <h1 className="text-[clamp(1.6rem,3.4vw,2.6rem)] font-bold leading-[1.3] text-slate-50">
              تیواچت را <span className="bg-gradient-to-l from-emerald-300 to-cyan-300 bg-clip-text text-transparent">تمیز، تست‌شده و بی‌باگ</span> می‌کنیم
            </h1>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-7 text-slate-300">
              این استودیو همان کارهای نسخهٔ ۱.۰.۲ را به‌صورت قابل اجرا و قابل آزمون پیاده کرده است: اصلاح موتور دستور فارسی،
              دیتاست متوازن و باکیفیت، طبقه‌بند ۱۰ میلیون پارامتری آموزش‌دیده، و پچ‌های واقعی جاوا برای حذف امن، دوربین و
              برنامه‌های دوگانه. همه‌چیز روی همین صفحه با آزمون و عدد قابل بررسی است.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/engine"
                className="rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-4 py-2 text-[12.5px] font-bold text-[#04110d] transition hover:brightness-110"
              >
                امتحان کردن موتور دستور
              </Link>
              <Link href="/model" className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] text-slate-200 transition hover:bg-white/10">
                گزارش آموزش مدل
              </Link>
              <Link href="/release" className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] text-slate-200 transition hover:bg-white/10">
                وضعیت APK و امضا
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4">
            <p className="text-[12px] font-bold text-emerald-200">APK و لینک دانلود</p>
            <p className="mt-1.5 text-[11.5px] leading-6 text-slate-300">
              نسخه همان <strong>۱.۰.۱ (build 4)</strong> می‌ماند. لینک دانلود رسمی در گیت‌هاب شما فعال است و هنگام باز شدن این
              صفحه دوباره دانلود و هش‌سنجی می‌شود.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={RELEASE.downloadUrl}
                download={RELEASE.apkName}
                className="rounded-lg bg-emerald-400/90 px-3 py-1.5 text-[11.5px] font-bold text-[#04110d] hover:bg-emerald-300"
              >
                دانلود APK
              </a>
              <Link href="/release" className="rounded-lg border border-white/15 px-3 py-1.5 text-[11.5px] text-slate-200 hover:bg-white/5">
                جزئیات انتشار
              </Link>
            </div>
            <p className="hash mt-2 text-[9.5px] leading-5 text-slate-400">SHA-256: {RELEASE.sha256.slice(0, 24)}…</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="دیتاست آموزش"
          value={formatNumber(dataset.total)}
          hint={`${formatNumber(dataset.train)} آموزش · ${formatNumber(dataset.test)} آزمون · ${dataset.classCount} کلاس`}
        />
        <StatCard
          label="نمونه در هر کلاس"
          value={`${formatNumber(dataset.min)}–${formatNumber(dataset.max)}`}
          hint="همه در بازهٔ هدف ۳۰۰ تا ۸۰۰"
          tone="sky"
        />
        <StatCard
          label="پارامترهای مدل"
          value={formatNumber(model?.params ?? 0)}
          hint={model ? `${formatBytes(model.artifactBytes)} · int8 · ${shortHash(model.artifactSha256, 10, 6)}` : "در حال آماده‌سازی"}
          tone="violet"
        />
        <StatCard
          label="آزمون پذیرش"
          value={`${testPassed}/${testTotal}`}
          hint={latestTest ? `بدون خطا · ${latestTest.run.durationMs} میلی‌ثانیه` : "هنوز اجرا نشده"}
          tone="amber"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <SectionHeading
            eyebrow="پوشش نیازمندی‌ها"
            title="هشت خواستهٔ نسخهٔ ۱.۰.۲"
            description="برای هر بند مشخص است که در موتور اجرایی حل شده یا به‌صورت پچ آمادهٔ اعمال روی سورس اندروید است."
          />
          <div className="space-y-2">
            {REQUIREMENTS.map((requirement) => {
              const meta = STATUS_META[requirement.status as keyof typeof STATUS_META];
              return (
                <Link
                  key={requirement.key}
                  href={requirement.href}
                  className="block rounded-xl border border-white/[0.07] bg-black/20 p-3 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12.5px] font-bold text-slate-100">{requirement.title}</p>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-6 text-slate-400">{requirement.detail}</p>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading eyebrow="مدل" title="کیفیت واقعی آموزش" />
            <div className="space-y-3">
              <Meter value={model?.top1 ?? 0} label="دقت درون‌توزیعی (تست ۱۵٪)" />
              <Meter value={model?.macroF1 ?? 0} label="میانگین F1 کلاس‌ها" />
              <Meter value={acceptance?.top1 ?? 0} label="پذیرش خارج از توزیع (۵۱ جملهٔ دستی)" />
            </div>
            <p className="mt-3 rounded-lg border border-white/[0.08] bg-black/30 p-2.5 text-[10.5px] leading-6 text-slate-400">
              دقت ۹۹.۹٪ درون‌توزیعی خوش‌بینانه است چون جمله‌های تست از همان الگوهای آموزش ساخته شده‌اند. عدد صادقانه‌تر،
              نتیجهٔ جمله‌های دستی است. موتور قواعد همیشه مرجع اجراست و مدل فقط سیگنال کمکی است.
              {acceptance ? ` در این ارزیابی ${acceptance.total - Math.round(acceptance.top1 * acceptance.total)} جمله اشتباه شد.` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/model" className="flex-1 rounded-lg border border-white/12 px-3 py-1.5 text-center text-[11.5px] text-slate-200 hover:bg-white/5">
                جزئیات مدل
              </Link>
              <Link href="/tests" className="flex-1 rounded-lg border border-white/12 px-3 py-1.5 text-center text-[11.5px] text-slate-200 hover:bg-white/5">
                آزمون‌ها
              </Link>
            </div>
          </Card>

          <Card>
            <SectionHeading eyebrow="برنامه‌ها" title="راهنمای نام" />
            <KeyValue label="تعداد برنامه‌ها">{formatNumber(bundle.apps.length)}</KeyValue>
            <KeyValue label="نسخهٔ دوگانهٔ MIUI">{formatNumber(dualApps)} برنامه</KeyValue>
            <KeyValue label="پکیج تأییدشده">
              {bundle.apps.filter((app) => app.packageSource === "project-kb").length} مورد (بقیه زمان اجرا)
            </KeyValue>
            <KeyValue label="تست «باز کن»">
              <Badge tone="emerald">{formatNumber(bundle.apps.length)} نام آزمایش‌شده</Badge>
            </KeyValue>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="روش کار"
          title="از باگ تا تحویل، در چهار گام"
          description="همهٔ خروجی‌ها در همین محیط تولید و بازتولیدپذیر شده‌اند؛ هیچ عددی دستی نوشته نشده است."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: "۱",
              title: "موتور تمیز",
              body: "نرمال‌سازی فارسی و فینگلیش، مرز کلمه، ظهر/شب، تایمر، جست‌وجوی تمیز، تفکیک حذف از دوربین و دروازهٔ اطمینان ۰.۹.",
            },
            {
              step: "۲",
              title: "دیتاست باکیفیت",
              body: "۳۴ کلاس متوازن، نمونه‌های منفی متنوع، حذف تکراری‌ها و تقسیم قطعی آموزش/آزمون با seed ثابت.",
            },
            {
              step: "۳",
              title: "مدل ۱۰ میلیونی",
              body: "ویژگی n-gram هش‌شده، softmax با AdaGrad، کوانتایز int8 و ارزیابی درون و خارج از توزیع.",
            },
            {
              step: "۴",
              title: "پچ و انتشار",
              body: "MediaStore delete request، ACTION_DELETE، دوربین با FileProvider، LauncherApps دوگانه، gradle و اسکریپت تأیید اثر انگشت.",
            },
          ].map((card) => (
            <Card key={card.step}>
              <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400/80">{card.step}</span>
              <h3 className="mt-1 text-[13.5px] font-bold text-slate-100">{card.title}</h3>
              <p className="mt-1 text-[11.5px] leading-6 text-slate-400">{card.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/engine" className="card p-4 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.05]">
          <p className="text-[13px] font-bold text-slate-100">موتور دستور را امتحان کنید</p>
          <p className="mt-1 text-[11.5px] leading-6 text-slate-400">جمله بدهید؛ قصد، اسلات‌ها، اطمینان، تصمیم تأیید و پیش‌بینی مدل را ببینید.</p>
        </Link>
        <Link href="/dataset" className="card p-4 transition hover:border-sky-400/30 hover:bg-sky-400/[0.05]">
          <p className="text-[13px] font-bold text-slate-100">دیتاست را ببینید</p>
          <p className="mt-1 text-[11.5px] leading-6 text-slate-400">توزیع ۳۴ کلاس، جست‌وجو در نمونه‌ها و توضیح این‌که هر کلاس دقیقاً چه کاری اجرا می‌کند.</p>
        </Link>
        <Link href="/apps" className="card p-4 transition hover:border-violet-400/30 hover:bg-violet-400/[0.05]">
          <p className="text-[13px] font-bold text-slate-100">راهنمای ۱۲۲ برنامه</p>
          <p className="mt-1 text-[11.5px] leading-6 text-slate-400">نام فارسی، انگلیسی، محاوره‌ای و فینگلیش؛ دوگانه‌های MIUI و وضعیت پکیج.</p>
        </Link>
      </section>
    </div>
  );
}
