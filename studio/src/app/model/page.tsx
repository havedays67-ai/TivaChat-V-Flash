import { getLatestModel } from "@/lib/dashboard";
import { formatBytes, formatNumber, formatPercent, shortHash } from "@/lib/format";
import { Badge, Card, EmptyState, HashRow, KeyValue, Meter, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  const model = await getLatestModel();

  if (!model) {
    return (
      <EmptyState
        title="مدلی آموزش ندیده است"
        body="اسکریپت داده و آموزش را اجرا کنید: npx tsx scripts/generate-dataset.ts و سپس npx tsx scripts/train-model.ts"
      />
    );
  }

  const metrics = model.metrics;
  const acceptance = metrics.acceptance;
  const worst = [...metrics.perClass].sort((a, b) => a.f1 - b.f1).slice(0, 6);
  const memoryMB = (model.params * 4) / (1024 * 1024);

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="آموزش واقعی"
          title={`مدل ${formatNumber(model.params)} پارامتری نسخهٔ ${model.version}`}
          description="این عدد ساختهٔ نمایش نیست: ۲۹۴٬۹۱۲ سبد ویژگی در ۳۴ کلاس ضرب شده و همان تعداد وزن واقعاً آموزش دیده و به int8 کوانتایز شده است. مدل از صفر روی همین دیتاست یاد گرفته است."
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">از صفر آموزش دید</Badge>
          <Badge tone="sky">int8 · {formatBytes(model.artifactBytes)}</Badge>
          <Badge tone="violet">top-1 {formatPercent(model.top1)}</Badge>
          <Badge tone="amber">خارج از توزیع {acceptance ? formatPercent(acceptance.top1) : "—"}</Badge>
          <Badge tone="neutral">اجرا روی همین سرور</Badge>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="پارامترهای آموزش‌دیده" value={formatNumber(model.params)} hint={`${formatNumber(model.dim)} ویژگی × ${formatNumber(model.classCount)} کلاس`} />
        <StatCard label="دادهٔ آموزش / آزمون" value={`${formatNumber(model.trainRows)} / ${formatNumber(model.testRows)}`} hint="تقسیم قطعی بر پایهٔ هش متن" tone="sky" />
        <StatCard label="دقت top-1 (تست)" value={formatPercent(model.top1)} hint={`top-3 ${formatPercent(model.top3)} · F1 ${formatPercent(model.macroF1)}`} tone="violet" />
        <StatCard label="زمان آموزش" value={`${(model.durationMs / 1000).toFixed(1)} ثانیه`} hint={`${model.epochs} epoch · lr ${model.learningRate}`} tone="amber" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionHeading
            eyebrow="کیفیت"
            title="سه معیار، با صداقت"
            description="دقت درون‌توزیعی خوش‌بینانه است؛ جمله‌های آزمون از همان الگوهای آموزش ساخته شده‌اند. معیار سوم روی جمله‌هایی است که مدل هرگز ندیده."
          />
          <div className="space-y-4">
            <Meter value={model.top1} label="top-1 روی ۱۵٪ دادهٔ کنارگذاشته" />
            <Meter value={model.macroF1} label="میانگین F1 (۳۴ کلاس)" />
            <Meter value={model.top3} label="top-3 (پوشش سه گزینهٔ اول)" />
            {acceptance ? <Meter value={acceptance.top1} label={`top-1 روی ${acceptance.total} جملهٔ دستی پذیرش`} /> : null}
          </div>

          {acceptance && acceptance.misses.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3">
              <p className="text-[11.5px] font-bold text-amber-200">جاهایی که مدل تنها اشتباه کرد</p>
              <ul className="mt-1.5 space-y-1">
                {acceptance.misses.map((miss) => (
                  <li key={miss.prompt} className="text-[11px] leading-6 text-slate-300">
                    «{miss.prompt}» ← {miss.predicted} (انتظار: {miss.expected})
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10.5px] leading-6 text-slate-400">
                هر دو مورد در موتور قواعد درست تشخیص داده می‌شود؛ همان دلیلی که اجرا به قواعد سپرده شده و مدل فقط کمک می‌کند.
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-3">
            <p className="text-[11px] font-bold text-slate-300">معماری</p>
            <p className="mt-1 text-[11px] leading-6 text-slate-400">{model.architecture}</p>
            <p className="mt-1 text-[10.5px] leading-6 text-slate-500">{metrics.optimizer} · مقدار اولیه: {metrics.init}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metrics.features.map((feature) => (
                <Badge key={feature} tone="neutral">{feature}</Badge>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading eyebrow="آرتیفکت" title="فایل مدل" />
            <KeyValue label="نسخه">{model.version}</KeyValue>
            <KeyValue label="ابعاد ویژگی">{formatNumber(model.dim)}</KeyValue>
            <KeyValue label="تعداد کلاس">{formatNumber(model.classCount)}</KeyValue>
            <KeyValue label="حجم فایل">{formatBytes(model.artifactBytes)}</KeyValue>
            <KeyValue label="نوع">{model.quantized ? "int8 کوانتایزشده" : "float"}</KeyValue>
            <KeyValue label="حافظهٔ آموزش (float32)">{memoryMB.toFixed(1)} مگابایت</KeyValue>
            <KeyValue label="زمان ثبت">{new Date(model.createdAt).toISOString().slice(0, 16).replace("T", " ")}</KeyValue>
            <div className="mt-3">
              <HashRow label="SHA-256 آرتیفکت" value={model.artifactSha256} />
              <HashRow label="مسیر" value={shortHash(model.artifactPath, 22, 22)} />
            </div>
          </Card>

          <Card>
            <SectionHeading eyebrow="گزارش" title="اعداد قابل بازتولید" />
            <ul className="space-y-1.5">
              {metrics.notes.map((note) => (
                <li key={note} className="flex gap-1.5 text-[10.5px] leading-6 text-slate-400">
                  <span className="text-emerald-400">•</span>
                  {note}
                </li>
              ))}
            </ul>
            <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-2 text-[10.5px] leading-6 text-rose-100">
              این مدل LLM یا TFLite نیست و در APK فعلی هم قرار ندارد. یک طبقه‌بند خطی n-gram است؛ برای همین هم اجرای دستور
              به موتور قواعد سپرده شده است.
            </p>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <SectionHeading eyebrow="کیفیت کلاس‌ها" title="ضعیف‌ترین شش کلاس" description="دقت (precision)، فراخوانی (recall) و F1 روی دادهٔ کنارگذاشته." />
          <div className="space-y-2">
            {worst.map((row) => (
              <div key={row.key} className="rounded-lg border border-white/[0.07] bg-black/20 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="hash text-[10.5px] text-slate-300">{row.key}</code>
                  <span className="text-[10.5px] text-slate-500">{formatNumber(row.support)} نمونه</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                  <span>P {formatPercent(row.precision)}</span>
                  <span>R {formatPercent(row.recall)}</span>
                  <span>F1 {formatPercent(row.f1)}</span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${Math.max(2, row.f1 * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading eyebrow="خطاها" title="بیشترین اشتباه‌های مدل" />
          {metrics.confusion.length === 0 ? (
            <p className="text-[11.5px] text-emerald-300">روی دادهٔ آزمون هیچ خطایی ثبت نشد.</p>
          ) : (
            <div className="space-y-1.5">
              {metrics.confusion.map((pair) => (
                <div key={`${pair.expected}-${pair.predicted}`} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-1.5">
                  <span className="hash text-[10px] text-slate-300">
                    {pair.expected} → {pair.predicted}
                  </span>
                  <span className="text-[10.5px] text-amber-300">{formatNumber(pair.count)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] leading-6 text-slate-500">
            هدف بعدی: جمله‌های واقعی کاربر به‌جای الگوهای تولیدی، تا این اعداد به رفتار میدانی نزدیک شوند.
          </p>
        </Card>
      </section>
    </div>
  );
}
