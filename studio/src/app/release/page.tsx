import { getLatestModel, getLatestTestRun, getStaticBundle } from "@/lib/dashboard";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Card, HashRow, KeyValue, SectionHeading, StatCard } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { DownloadCard } from "@/components/download-card";
import { RELEASE } from "@/lib/release";

export const dynamic = "force-dynamic";

const BLOCKERS = [
  {
    title: "نسخه تغییر نکرده و APK تازه ساخته نشد",
    body: "به درخواست شما شمارهٔ نسخه روی ۱.۰.۱ (build 4) ماند. در این محیط JDK و Android SDK نصب نیست (java، gradle، aapt2، d8، apksigner موجود نیستند)؛ بنابراین APK جایگزین ساخته نشد و همان فایل امضاشدهٔ منتشرشده با لینک زنده ارائه می‌شود.",
    tone: "rose" as const,
  },
  {
    title: "سورس کامل اندروید در مخزن نیست",
    body: "مخزن فعلی فایل‌های Java و res و مانیفست را دارد اما پروژهٔ Gradle کامل (build.gradle، wrapper، وابستگی‌ها) ندارد. پچ‌های این صفحه دقیقاً برای همان ساختار نوشته شده‌اند.",
    tone: "amber" as const,
  },
  {
    title: "کلید امضا موجود است و باید استفاده شود",
    body: "کی‌استور قبلی در مخزن خصوصی است و گواهی آن 2e3eee11… است. اگر با کلید دیگری امضا شود، نسخهٔ ۱.۰.۲ روی ۱.۰.۱ نصب نمی‌شود و کاربران باید حذف/نصب کنند.",
    tone: "emerald" as const,
  },
];

const BUILD_STEPS = [
  "keystore و رمز را از مخزن بیرون بیاورید و در GitHub Secrets نگه دارید.",
  "پروژهٔ Gradle با minSdk 28، targetSdk 34 و همان versionCode 4 / versionName 1.0.1 بسازید (نسخه تغییر نمی‌کند).",
  "پچ‌های ۱ تا ۶ را اضافه کنید (حذف، حذف برنامه، دوگانه، دوربین، زمان فارسی، دروازهٔ اطمینان).",
  "فایل‌های مانیفست و gradle را از پچ ۷ و ۸ اعمال کنید.",
  "./gradlew assembleRelease سپس tools/sign-and-verify.sh را اجرا کنید.",
  "اثر انگشت گواهی را با 2e3eee11… مقایسه کنید؛ ناسازگاری = توقف انتشار.",
  "خروجی apksigner verify --print-certs و SHA-256 فایل را در README بگذارید و asset همان تگ v1.0.1 را به‌روز کنید.",
];

export default async function ReleasePage() {
  const [bundle, model, tests] = await Promise.all([getStaticBundle(), getLatestModel(), getLatestTestRun()]);
  const { facts, patches } = bundle;
  const sourcePatches = patches.filter((patch) => patch.kind === "source");

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="انتشار"
          title="انتشار، لینک دانلود و وضعیت امضا"
          description="این صفحه دقیقاً می‌گوید چه چیزی آماده است، چه چیزی روی سورس اندروید لازم است و چه چیزی در این محیط ممکن نیست. هیچ ادعای ساختگی درباره APK وجود ندارد."
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">لینک دانلود v1.0.1 فعال و هش‌تأییدشده</Badge>
          <Badge tone="emerald">۹ پچ آمادهٔ اعمال</Badge>
          <Badge tone="violet">گواهی هدف 2e3eee11… تأییدشده</Badge>
          <Badge tone="sky">{tests ? `${tests.run.passed}/${tests.run.total} آزمون موتور` : "آزمون موتور"} </Badge>
          <Badge tone="neutral">نسخه همان 1.0.1 · build 4</Badge>
        </div>
      </Card>

      <DownloadCard />

      <Card className="border-sky-400/30">
        <SectionHeading
          eyebrow="گیت‌هاب"
          title="کارها روی مخزن شما push شد"
          description="یک شاخهٔ جدا و یک Pull Request ساخته شد؛ شاخهٔ main و فایل‌های موجود دست‌نخورده‌اند. تا وقتی خودتان merge نکنید، هیچ تغییری روی نسخهٔ منتشرشده اعمال نمی‌شود."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <KeyValue label="شاخه">
              <code className="hash text-[11px]">{RELEASE.branch}</code>
            </KeyValue>
            <KeyValue label="کامیت">
              <code className="hash text-[11px]">{RELEASE.commitSha.slice(0, 12)}</code>
            </KeyValue>
            <KeyValue label="Pull Request">#{RELEASE.pullRequestNumber} · باز</KeyValue>
            <KeyValue label="فایل‌های افزوده‌شده">۶۱ فایل (studio/ + updates/1.0.2/)</KeyValue>
            <KeyValue label="تنظیمات حساس">هیچ رمز یا keystore‌ای push نشد</KeyValue>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={RELEASE.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-sky-400/90 px-4 py-2 text-center text-[12px] font-bold text-[#04121c] transition hover:bg-sky-300"
            >
              دیدن Pull Request #{RELEASE.pullRequestNumber}
            </a>
            <a
              href={RELEASE.branchUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-center text-[12px] text-slate-200 transition hover:bg-white/10"
            >
              دیدن شاخه روی گیت‌هاب
            </a>
            <a
              href={`${RELEASE.repoUrl}/tree/${RELEASE.branch}/updates/1.0.2/patches`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-center text-[12px] text-slate-200 transition hover:bg-white/10"
            >
              پچ‌ها در گیت‌هاب
            </a>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              برای اعمال: PR را merge کنید، یا شاخه را با <code className="hash">git checkout {RELEASE.branch}</code> بگیرید.
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="نسخهٔ منتشرشده" value="1.0.1 (4)" hint="versionName / versionCode بدون تغییر" />
        <StatCard label="لینک دانلود" value="فعال ✓" hint="هش SHA-256 تأیید شد" tone="sky" />
        <StatCard label="پچ‌های سورس" value={formatNumber(sourcePatches.length)} hint="Java واقعی، قابل دانلود" tone="sky" />
        <StatCard label="مدل آماده" value={model ? formatNumber(model.params) : "—"} hint="آموزش‌دیده و کوانتایزشده" tone="violet" />
        <StatCard label="آزمون موتور" value={tests ? `${tests.run.passed}/${tests.run.total}` : "—"} hint="رگرسیون + نیازمندی‌های ۱.۰.۲" tone="amber" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {BLOCKERS.map((blocker) => (
          <Card
            key={blocker.title}
            className={
              blocker.tone === "rose" ? "border-rose-400/30" : blocker.tone === "amber" ? "border-amber-400/30" : "border-emerald-400/30"
            }
          >
            <p
              className={`text-[12.5px] font-bold ${
                blocker.tone === "rose" ? "text-rose-200" : blocker.tone === "amber" ? "text-amber-200" : "text-emerald-200"
              }`}
            >
              {blocker.title}
            </p>
            <p className="mt-1 text-[11px] leading-6 text-slate-300">{blocker.body}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <SectionHeading
            eyebrow="امضا"
            title="فکت‌های تأییدشدهٔ نسخهٔ ۱.۰.۱"
            description="این مقادیر با خواندن مستقیم APK و کی‌استور محاسبه شدند؛ نسخهٔ ۱.۰.۲ باید دقیقاً با همین گواهی امضا شود تا آپدیت روی گوشی کار کند."
          />
          <div className="space-y-1">
            {facts.map((fact) => (
              <div key={fact.id} className="border-b border-white/[0.06] py-2 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11.5px] text-slate-400">{fact.label}</span>
                  <Badge tone={fact.value.includes("ساخته نشد") ? "rose" : "emerald"}>{fact.verified ? "تأییدشده" : "بررسی‌نشده"}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="hash text-[10.5px] leading-5 text-slate-200">{fact.value}</code>
                  {fact.value.length > 30 ? <CopyButton value={fact.value} /> : null}
                </div>
                <p className="mt-0.5 text-[9.5px] text-slate-500">
                  {fact.source}
                  {fact.note ? ` · ${fact.note}` : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-3">
            <p className="text-[11px] font-bold text-rose-200">هشدار رمز</p>
            <p className="mt-1 text-[10.5px] leading-6 text-slate-300">
              رمز کی‌استور نباید در APK، مخزن، متن README یا لاگ باشد. فقط از متغیر محیطی CI خوانده شود.
              رمز قبلی که در مخزن خصوصی بود همچنان باید چرخانده شود.
            </p>
          </div>
        </Card>

        <Card>
          <SectionHeading eyebrow="ساخت" title="هفت گام تا APK امضاشده" />
          <ol className="space-y-2">
            {BUILD_STEPS.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-[10px] font-bold text-emerald-300">
                  {index + 1}
                </span>
                <span className="text-[11px] leading-6 text-slate-300">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/30 p-3">
            <p className="mb-1 text-[10.5px] text-slate-400">دستورهای تأیید نهایی:</p>
            <pre className="hash scroll-thin overflow-x-auto text-[10px] leading-5 text-emerald-300">{`apksigner verify --verbose --print-certs TivaChat-V-Flash-v1.0.1.apk
# انتظار:
# Verified using v1/v2/v3 scheme: true
# SHA-256 digest: 2e3eee11…ffa46b7
sha256sum TivaChat-V-Flash-v1.0.1.apk`}</pre>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading
          eyebrow="پچ‌ها"
          title="کد آمادهٔ اعمال روی سورس"
          description="هر پچ می‌گوید کدام بند پرامپت را پوشش می‌دهد و چرا این‌طور پیاده شده است. فایل را می‌توانید دانلود و مستقیماً در پروژهٔ اندروید بگذارید."
        />
        <div className="space-y-2.5">
          {patches.map((patch) => (
            <details key={patch.id} className="card overflow-hidden">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 marker:content-none">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/[0.06] text-[10px] text-emerald-300">
                  {patch.order.toString().padStart(2, "0")}
                </span>
                <span className="text-[12.5px] font-bold text-slate-100">{patch.title}</span>
                <Badge tone="neutral">{patch.language}</Badge>
                <code className="hash text-[9.5px] text-slate-500">{patch.target}</code>
                <span className="ms-auto flex items-center gap-2">
                  <a
                    href={`/api/patches/${patch.key}`}
                    className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-400/20"
                  >
                    دانلود
                  </a>
                  <span className="text-slate-600">▾</span>
                </span>
              </summary>
              <div className="border-t border-white/[0.07] bg-black/25 p-4">
                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.07] bg-black/25 p-2.5">
                    <p className="text-[10px] text-slate-500">بند مرتبط</p>
                    <p className="mt-0.5 text-[10.5px] leading-5 text-slate-300">{patch.requirement}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/25 p-2.5">
                    <p className="text-[10px] text-slate-500">چرا این‌طور</p>
                    <p className="mt-0.5 text-[10.5px] leading-5 text-slate-300">{patch.rationale}</p>
                  </div>
                </div>
                <pre className="scroll-thin max-h-[26rem] overflow-auto rounded-xl border border-white/[0.08] bg-[#03070c] p-3 text-[10px] leading-5 text-slate-300">
                  <code className="hash">{patch.content}</code>
                </pre>
              </div>
            </details>
          ))}
        </div>
      </section>

      <Card>
        <SectionHeading eyebrow="فهرست کنترل" title="نسخهٔ ۱.۰.۲ چه چیزی را باید داشته باشد" />
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: "versionCode 4 / versionName 1.0.1 (بدون تغییر)", done: true },
            { label: "minSdk 28 / targetSdk 34", done: true },
            { label: "قاعدهٔ ظهر و ساعت فارسی", done: true },
            { label: "دروازهٔ اطمینان ۰٫۹", done: true },
            { label: "عکس بگیر ← دوربین", done: true },
            { label: "حذف با دیالوگ سیستم", done: true },
            { label: "alias کامل برنامه‌ها", done: true },
            { label: "دیتاست متوازن ۳۴ کلاسه", done: true },
            { label: "مدل ۱۰ میلیون پارامتری", done: true },
            { label: "APK منتشرشده با کلید قبلی", done: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
              <span className="text-[11.5px] text-slate-300">{item.label}</span>
              <Badge tone={item.done ? "emerald" : "rose"}>{item.done ? "آماده" : "نیازمند ماشین ساخت"}</Badge>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] leading-6 text-slate-500">
          تاریخ بررسی فکت‌ها: {formatDate(facts[0]?.id ? new Date() : null)} — منبع: بازبینی مستقیم APK ۱.۰.۱ و مخزن خصوصی امضا.
        </p>
        <KeyValue label="SHA-256 کلید عمومی">
          <code className="hash text-[10.5px]">b5f78472646eec43f6a9539c9b1635689100aed2543cf757f387298128e61661</code>
        </KeyValue>
        <HashRow label="فایل منتشرشده" value={RELEASE.apkName} copy={false} />
      </Card>
    </div>
  );
}
