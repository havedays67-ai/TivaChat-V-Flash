import { getStaticBundle } from "@/lib/dashboard";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { Playground } from "@/components/playground";
import { CONFIDENCE_GATE } from "@/lib/engine/intents";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIXES = [
  {
    tag: "۱.۰.۲",
    title: "قاعدهٔ ظهر و عصر",
    body: "ظهر بازهٔ ۱۲ تا ۱۶ است: «۲ ظهر» ۱۴:۰۰، «۱۲ ظهر» ۱۲:۰۰، «۱ ظهر» ۱۳:۰۰. عصر با ۱۲ همان ۱۲ می‌ماند و شبِ ۱۲ به ۰۰:۰۰ می‌رود.",
  },
  {
    tag: "۱.۰.۲",
    title: "دروازهٔ اطمینان",
    body: `اگر اطمینان موتور کمتر از ${CONFIDENCE_GATE} باشد هیچ قصدی اجرا نمی‌شود؛ گزینه‌ها نمایش داده و «منظورتان این بود؟» پرسیده می‌شود.`,
  },
  {
    tag: "۱.۰.۱",
    title: "مرز کلمه",
    body: "«آلارم» گزارش رم نمی‌دهد، «کرم» و «فرمت» هم. تطبیق روی توکن کامل انجام می‌شود، نه زیررشته.",
  },
  {
    tag: "۱.۰.۲",
    title: "عکس ≠ حذف",
    body: "«یه عکس بگیر» به دوربین می‌رود و «عکس‌ها رو پاک کن» به درخواست حذف سیستمی. دو مسیر کاملاً جدا با اکشن متفاوت.",
  },
  {
    tag: "۱.۰.۲",
    title: "کندی و آزادسازی رم",
    body: "«گوشی کند شده» گزارش رم + مدیریت برنامه‌ها می‌دهد، نه باتری. «رم رو آزاد کن» صادقانه می‌گوید اندروید اجازه نمی‌دهد.",
  },
  {
    tag: "۱.۰.۱",
    title: "جست‌وجوی تمیز",
    body: "«کروم رو باز کن و قیمت دلار رو سرچ کن» فقط «قیمت دلار» را جست‌وجو می‌کند؛ نام برنامه و افعال حذف می‌شوند.",
  },
  {
    tag: "۱.۰.۲",
    title: "تماس و پیام با تأیید",
    body: "تماس و پیامک همیشه از دیالر/پیام‌های سیستم و با تأیید شما؛ هیچ ACTION_CALL یا ارسال خودکاری وجود ندارد.",
  },
  {
    tag: "۱.۰.۲",
    title: "برنامه‌های دوگانهٔ MIUI",
    body: "تلگرام، بله، بلو و بلد نسخهٔ دوم دارند. موتور پرچم دوگانه را تشخیص می‌دهد و پچ LauncherApps آن را با UserHandle باز می‌کند.",
  },
];

export default async function EnginePage() {
  const { classes } = await getStaticBundle();
  const confirmIntents = classes.filter((intent) => intent.risk === "confirm");
  const normalIntents = classes.filter((intent) => intent.risk === "safe" && intent.kind !== "negative");
  const negative = classes.find((intent) => intent.kind === "negative");

  return (
    <div className="space-y-7">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
        <SectionHeading
          eyebrow="موتور ۱.۰.۲"
          title="دستیار فارسی که اشتباه اجرا نمی‌کند"
          description="موتور قواعد، همیشه مرجع اجراست: اول عملیات، بعد گزارش. جمله‌های مبهم اجرا نمی‌شوند و عملیات حساس بدون تأیید به TivaNative نمی‌رسند."
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{formatNumber(normalIntents.length)} قصد امن</Badge>
          <Badge tone="amber">{formatNumber(confirmIntents.length)} قصد نیازمند تأیید</Badge>
          <Badge tone="rose">۱ کلاس خارج از محدوده</Badge>
          <Badge tone="sky">{formatNumber(classes.length)} کلاس در مجموع</Badge>
          <Badge tone="violet">فینگلیش + فارسی محاوره‌ای</Badge>
        </div>
      </Card>

      <Playground />

      <section>
        <SectionHeading
          eyebrow="اصلاحات"
          title="چه چیزی نسبت به ۱.۰.۱ دقیقاً بهتر شد"
          description="همهٔ این رفتارها در آزمون‌های پذیرش، با جملهٔ فارسی واقعی، قفل شده‌اند."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {FIXES.map((fix) => (
            <Card key={fix.title}>
              <Badge tone={fix.tag === "۱.۰.۲" ? "emerald" : "neutral"}>{fix.tag}</Badge>
              <h3 className="mt-2 text-[13px] font-bold text-slate-100">{fix.title}</h3>
              <p className="mt-1 text-[11px] leading-6 text-slate-400">{fix.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <SectionHeading eyebrow="ایمنی" title="قصدهایی که هرگز بی‌تأیید اجرا نمی‌شوند" />
          <div className="space-y-2">
            {confirmIntents.map((intent) => (
              <div key={intent.key} className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="hash text-[11px] text-amber-200">{intent.key}</code>
                  <span className="text-[11.5px] font-bold text-slate-200">{intent.labelFa}</span>
                </div>
                <p className="mt-1 text-[10.5px] leading-5 text-slate-400">{intent.honestLimit || intent.summary}</p>
              </div>
            ))}
          </div>
          {negative ? (
            <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.05] p-2.5">
              <p className="text-[11.5px] font-bold text-rose-200">خارج از محدوده</p>
              <p className="mt-1 text-[10.5px] leading-5 text-slate-400">{negative.honestLimit}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionHeading
            eyebrow="مرجع"
            title="۳۴ کلاس و کاری که انجام می‌دهند"
            description="این فهرست همان چیزی است که دیتاست و مدل هم رویش آموزش دیده‌اند؛ هیچ قصد پنهانی وجود ندارد."
          />
          <div className="scroll-thin max-h-[26rem] overflow-y-auto pe-1">
            <table className="w-full text-start">
              <thead className="sticky top-0 bg-[#080e14]/95 text-[10px] text-slate-500 backdrop-blur">
                <tr>
                  <th className="py-2 text-start font-medium">کلید</th>
                  <th className="py-2 text-start font-medium">برچسب</th>
                  <th className="py-2 text-start font-medium">اکشن</th>
                  <th className="py-2 text-start font-medium">ریسک</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((intent) => (
                  <tr key={intent.key} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pe-2"><code className="hash text-[10.5px] text-slate-300">{intent.key}</code></td>
                    <td className="py-1.5 pe-2 text-[11px] text-slate-200">{intent.labelFa}</td>
                    <td className="py-1.5 pe-2"><code className="hash text-[9.5px] text-slate-500">{intent.action}</code></td>
                    <td className="py-1.5">
                      <Badge tone={intent.risk === "confirm" ? "amber" : intent.kind === "negative" ? "rose" : "emerald"}>
                        {intent.risk === "confirm" ? "تأیید" : intent.kind === "negative" ? "بدون اجرا" : "امن"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
