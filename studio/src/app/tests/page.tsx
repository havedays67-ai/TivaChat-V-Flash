import { getLatestTestRun, getStaticBundle } from "@/lib/dashboard";
import { formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { TestRunner } from "@/components/test-runner";
import { TEST_CASES } from "@/lib/engine/tests";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const [latest, bundle] = await Promise.all([getLatestTestRun(), getStaticBundle()]);

  if (!latest) {
    return (
      <EmptyState
        title="آزمونی ثبت نشده است"
        body="اسکریپت آزمون‌ها را اجرا کنید: npx tsx scripts/run-tests.ts — یا از دکمهٔ اجرای آزمون در همین صفحه استفاده کنید."
      />
    );
  }

  const { run, results } = latest;
  const caseDefs = new Map(TEST_CASES.map((testCase) => [testCase.key, testCase]));
  const groups = new Map<string, typeof results>();
  for (const result of results) {
    const group = caseDefs.get(result.caseKey)?.group ?? "سایر";
    groups.set(group, [...(groups.get(group) ?? []), result]);
  }
  const intentLabels = new Map(bundle.classes.map((intent) => [intent.key, intent.labelFa]));
  const failedCases = results.filter((result) => !result.passed);
  const regression = results.filter((result) => bundle.classes.length > 0 && result.caseKey).length;

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="آزمون‌های پذیرش"
          title={`${formatNumber(run.passed)} از ${formatNumber(run.total)} آزمون قبول`}
          description="این آزمون‌ها همان جمله‌های بخش ۶ و ۷ پرامپت هستند: رگرسیون ۱.۰.۱ که نباید بشکند و نیازمندی‌های تازهٔ ۱.۰.۲. هر مورد در همین سرور روی موتور واقعی اجرا می‌شود."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={run.failed === 0 ? "emerald" : "rose"}>{run.failed === 0 ? "بدون شکست" : `${run.failed} شکست`}</Badge>
          <Badge tone="sky">{formatPercent(run.passed / Math.max(1, run.total))} نرخ قبولی</Badge>
          <Badge tone="violet">{formatNumber(run.durationMs)} میلی‌ثانیه</Badge>
          <Badge tone="neutral">آخرین اجرا: {new Date(run.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</Badge>
        </div>
        <div className="mt-4">
          <TestRunner />
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل آزمون‌ها" value={formatNumber(run.total)} hint="شامل رگرسیون ۱.۰.۱ و نیازمندی‌های ۱.۰.۲" />
        <StatCard label="قبول" value={formatNumber(run.passed)} hint="شامل ظهر، دوربین، حذف، دوگانه و فینگلیش" tone="sky" />
        <StatCard label="شکست" value={formatNumber(run.failed)} hint={failedCases.length ? "جزئیات پایین" : "همه سبز"} tone="amber" />
        <StatCard label="کلاس‌های موتور" value={formatNumber(bundle.classes.length)} hint={`${formatNumber(regression)} مورد ثبت‌شده`} tone="violet" />
      </section>

      {[...groups.entries()].map(([group, items]) => {
        const passed = items.filter((item) => item.passed).length;
        return (
          <section key={group}>
            <SectionHeading
              eyebrow={`${formatNumber(passed)}/${formatNumber(items.length)}`}
              title={group}
            />
            <div className="space-y-2">
              {items.map((item) => {
                const expectedIntent = caseDefs.get(item.caseKey)?.expected.intent;
                return (
                  <details key={item.id} className="card group overflow-hidden">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 marker:content-none">
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${item.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}
                      >
                        {item.passed ? "✓" : "✗"}
                      </span>
                      <span className="text-[12.5px] font-medium text-slate-100">{item.prompt}</span>
                      <span className="hash text-[10px] text-slate-500">{item.caseKey}</span>
                      {expectedIntent ? <Badge tone="neutral">{intentLabels.get(expectedIntent) ?? expectedIntent}</Badge> : null}
                      <span className="ms-auto text-slate-600 transition group-open:rotate-90">◂</span>
                    </summary>
                    <div className="border-t border-white/[0.07] bg-black/25 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] text-slate-500">انتظار</p>
                          <code className="hash mt-0.5 block text-[10.5px] leading-5 text-slate-300">{item.expected}</code>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">نتیجهٔ واقعی</p>
                          <code className={`hash mt-0.5 block text-[10.5px] leading-5 ${item.passed ? "text-emerald-300" : "text-rose-300"}`}>
                            {item.actual}
                          </code>
                        </div>
                      </div>
                      {item.detail ? <p className="mt-2 text-[10.5px] text-rose-300">{item.detail}</p> : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
