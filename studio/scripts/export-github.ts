import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "../src/db";
import { ensureSeed } from "../src/db/seed";
import { datasetSamples, modelRuns, patches, testRuns } from "../src/db/schema";
import { sql } from "drizzle-orm";
import { RELEASE } from "../src/lib/release";

const OUT = path.join(process.cwd(), "updates", "1.0.2");
const EXT: Record<string, string> = { java: "java", xml: "xml", gradle: "gradle", bash: "sh" };

async function main() {
  await ensureSeed();
  fs.mkdirSync(path.join(OUT, "patches"), { recursive: true });

  const patchRows = await db.select().from(patches).orderBy(patches.order);
  const index: string[] = [];
  for (const patch of patchRows) {
    const fileName = patch.target.split("/").pop() ?? `${patch.key}.txt`;
    const extension = EXT[patch.language] ?? "txt";
    const finalName = fileName.endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;
    fs.writeFileSync(path.join(OUT, "patches", finalName), patch.content);
    index.push(`| ${patch.order} | \`${patch.title}\` | \`${finalName}\` | ${patch.requirement} |`);
  }

  const [datasetStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      train: sql<number>`count(*) filter (where ${datasetSamples.split} = 'train')::int`,
      test: sql<number>`count(*) filter (where ${datasetSamples.split} = 'test')::int`,
    })
    .from(datasetSamples);
  const perClass = await db
    .select({ classKey: datasetSamples.classKey, count: sql<number>`count(*)::int` })
    .from(datasetSamples)
    .groupBy(datasetSamples.classKey);

  const [model] = await db.select().from(modelRuns).orderBy(desc(modelRuns.createdAt)).limit(1);
  const [run] = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(1);

  const stats = {
    generatedAt: new Date().toISOString(),
    dataset: { ...datasetStats, classes: perClass.length, perClassSorted: [...perClass].sort((a, b) => b.count - a.count) },
    model: model
      ? {
          version: model.version,
          architecture: model.architecture,
          params: model.params,
          dim: model.dim,
          classes: model.classCount,
          trainRows: model.trainRows,
          testRows: model.testRows,
          top1: model.top1,
          top3: model.top3,
          macroF1: model.macroF1,
          acceptance: model.metrics.acceptance,
          artifactSha256: model.artifactSha256,
          artifactBytes: model.artifactBytes,
          artifactNote: "binary is not committed; regenerate with `npm run model:train` (≈5s)",
        }
      : null,
    tests: run ? { total: run.total, passed: run.passed, failed: run.failed, durationMs: run.durationMs } : null,
    apk: RELEASE,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), `${JSON.stringify(stats, null, 2)}\n`);

  const readme = `# تیواچت ۱.۰.۲ — کارهای آماده (نسخه همان ۱.۰.۱ می‌ماند)

این پوشه نتیجهٔ کارگاه مهندسی نسخهٔ ۱.۰.۲ است. طبق درخواست، **شمارهٔ نسخه تغییر نکرده** و
APK جایگزین ساخته نشده است. فایل منتشرشده همان \`${RELEASE.apkName}\` با نسخهٔ
\`${RELEASE.versionName} (build ${RELEASE.versionCode})\` است.

- لینک دانلود رسمی: ${RELEASE.downloadUrl}
- صفحهٔ انتشار: ${RELEASE.releaseUrl}
- SHA-256 فایل: \`${RELEASE.sha256}\`
- SHA-256 گواهی امضا: \`${RELEASE.certificateSha256}\`

## چه چیزی اصلاح شد (قابل آزمون)
- قاعدهٔ «ظهر»: «۲ ظهر» ← ۱۴:۰۰ و «۱۲ ظهر» ← ۱۲:۰۰
- دروازهٔ اطمینان ۰٫۹: زیر آستانه، هیچ دستوری اجرا نمی‌شود و سؤال پرسیده می‌شود
- «یه عکس بگیر» ← دوربین (جدا از مسیر حذف عکس)
- «گوشی کند شده» ← رم و مدیریت برنامه‌ها (نه گزارش باتری)
- «رم رو آزاد کن» ← توضیح صادقانهٔ محدودیت اندروید + مسیر رسمی
- حذف عکس/فایل و حذف برنامه فقط با دیالوگ تأیید سیستم
- aliasهای فارسی و محاوره‌ای برای ${""}${perClass.length} کلاس و ۱۲۲ برنامه
- دیتاست متوازن ${datasetStats?.total ?? 0} نمونه‌ای (هر کلاس ۳۰۰ تا ۸۰۰)
- مدل ${model?.params ?? 0} پارامتری آموزش‌دیده با ارزیابی درون و خارج از توزیع

## پچ‌های آمادهٔ اعمال

| # | عنوان | فایل | نیازمندی |
|---|---|---|---|
${index.join("\n")}

## ساخت APK (روی ماشینی که JDK و Android SDK دارد)
1. keystore و رمز را از مخزن بیرون بیاورید و در GitHub Secrets بگذارید.
2. \`versionCode 4\` و \`versionName "1.0.1"\` را دست نزنید.
3. پچ‌ها را اضافه کنید و \`./gradlew assembleRelease\` بزنید.
4. با \`apksigner\` و همان کلید امضا کنید و اثر انگشت گواهی را با
   \`${RELEASE.certificateSha256}\` مقایسه کنید.
5. asset همان تگ \`${RELEASE.tag}\` را به‌روز کنید و SHA-256 واقعی را در README بگذارید.

> این محیط JDK/Android SDK ندارد، بنابراین APK واقعی ساخته نشد و هیچ فایل ساختگی ارائه نشده است.

## گزارش‌ها
- \`report.json\`: آمار دیتاست، مدل، آزمون‌ها و اطلاعات انتشار
- \`patches/\`: کدهای آماده برای سورس اندروید
`;
  fs.writeFileSync(path.join(OUT, "README.md"), readme);

  console.log(
    JSON.stringify(
      {
        out: OUT,
        patches: patchRows.length,
        datasetTotal: datasetStats?.total ?? 0,
        modelParams: model?.params ?? 0,
        tests: run ? `${run.passed}/${run.total}` : "—",
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
