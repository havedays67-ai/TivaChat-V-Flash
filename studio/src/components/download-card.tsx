import { verifyRelease, RELEASE } from "@/lib/release";
import { formatBytes, formatDate } from "@/lib/format";
import { Badge, Card, HashRow, KeyValue } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export async function DownloadCard() {
  const verification = await verifyRelease();
  const ok = verification.reachable && verification.hashMatch && verification.sizeMatch;

  return (
    <Card className={ok ? "border-emerald-400/35" : "border-amber-400/35"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400/80">دانلود رسمی</p>
          <h2 className="mt-1 text-lg font-bold text-slate-100">
            {RELEASE.apkName}
          </h2>
          <p className="mt-1 text-[11.5px] leading-6 text-slate-400">
            نسخه همان <strong className="text-slate-200">{RELEASE.versionName}</strong> (build {RELEASE.versionCode}) می‌ماند؛ شمارهٔ نسخه
            تغییر نکرده است. فایل با کلید اصلی پروژه امضا شده و در صفحهٔ انتشار گیت‌هاب شما قرار دارد.
          </p>
        </div>
        <Badge tone={ok ? "emerald" : "amber"}>{ok ? "لینک فعال · هش تأیید شد" : "لینک نیازمند بررسی"}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={RELEASE.downloadUrl}
          download={RELEASE.apkName}
          className="rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-4 py-2 text-[12.5px] font-bold text-[#04110d] transition hover:brightness-110"
        >
          دانلود APK ({formatBytes(RELEASE.bytes)})
        </a>
        <a
          href={RELEASE.releaseUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] text-slate-200 transition hover:bg-white/10"
        >
          صفحهٔ انتشار در گیت‌هاب
        </a>
        <CopyButton value={RELEASE.downloadUrl} label="کپی لینک" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <KeyValue label="نسخه">{`${RELEASE.versionName} (build ${RELEASE.versionCode})`}</KeyValue>
          <KeyValue label="پکیج"><code className="hash">{RELEASE.packageName}</code></KeyValue>
          <KeyValue label="اندروید">{RELEASE.minSdk} تا {RELEASE.targetSdk}</KeyValue>
          <KeyValue label="حجم واقعی">{formatBytes(RELEASE.bytes)}</KeyValue>
          <KeyValue label="تگ انتشار"><code className="hash">{RELEASE.tag}</code></KeyValue>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <p className="text-[11px] font-bold text-slate-300">تأیید زندهٔ لینک</p>
          <p className={`mt-1 text-[10.5px] leading-6 ${ok ? "text-emerald-300" : "text-amber-300"}`}>{verification.message}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            آخرین بررسی: {formatDate(verification.checkedAt)} · HTTP {verification.status || "—"} ·{" "}
            {verification.bytes ? formatBytes(verification.bytes) : "بدون حجم"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            هش دانلودشده: <code className="hash text-slate-400">{verification.sha256 ? `${verification.sha256.slice(0, 18)}…` : "—"}</code>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <HashRow label="SHA-256 رسمی APK" value={RELEASE.sha256} />
        <HashRow label="SHA-256 گواهی امضا" value={RELEASE.certificateSha256} />
      </div>

      <p className="mt-3 rounded-lg border border-white/[0.08] bg-black/25 p-2.5 text-[10.5px] leading-6 text-slate-400">
        پس از دانلود، هش فایل را با مقدار بالا مقایسه کنید. اگر یکی نبود، فایل را نصب نکنید. روش:
        <code className="hash mx-1 text-slate-300">sha256sum TivaChat-V-Flash-v1.0.1.apk</code>
        — روی گوشی هم می‌توانید از صفحهٔ جزئیات فایل یا ابزار Hash استفاده کنید.
      </p>
    </Card>
  );
}
