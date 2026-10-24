/**
 * Live information about the published APK. The version stays 1.x on purpose:
 * no version bump is made by this workspace.
 */
export const RELEASE = {
  tag: "v1.0.1",
  versionName: "1.0.1",
  versionCode: 4,
  apkName: "TivaChat-V-Flash-v1.0.1.apk",
  bytes: 361690,
  sha256: "ff2292a0c76fd50901d13da631e6a88c6d939c46e6aacac59f30b829181ef419",
  downloadUrl: "https://github.com/havedays67-ai/TivaChat-V-Flash/releases/download/v1.0.1/TivaChat-V-Flash-v1.0.1.apk",
  releaseUrl: "https://github.com/havedays67-ai/TivaChat-V-Flash/releases/tag/v1.0.1",
  repoUrl: "https://github.com/havedays67-ai/TivaChat-V-Flash",
  branch: "studio/1.0.2-workbench",
  commitSha: "2b1fabac118e710058c581c42c1678b2943b7482",
  pullRequestUrl: "https://github.com/havedays67-ai/TivaChat-V-Flash/pull/1",
  pullRequestNumber: 1,
  branchUrl: "https://github.com/havedays67-ai/TivaChat-V-Flash/tree/studio/1.0.2-workbench",
  pushedAt: "2026-10-24T03:52:00Z",
  packageName: "ir.tivachat.flash",
  minSdk: 28,
  targetSdk: 34,
  certificateSha256: "2e3eee11ae6276418d17085fc6a39373ea9c811c2b5c62bc1c7f64b42ffa46b7",
};

export type ReleaseVerification = {
  checkedAt: string;
  reachable: boolean;
  bytes: number;
  sha256: string;
  hashMatch: boolean;
  sizeMatch: boolean;
  status: number;
  message: string;
};

const TTL_MS = 5 * 60 * 1000;

type Store = { value: ReleaseVerification | null; at: number };
const globalStore = globalThis as typeof globalThis & { __tivaReleaseVerification?: Store };

/** Downloads the published APK and re-hashes it, so the page never shows an unverified link. */
export async function verifyRelease(force = false): Promise<ReleaseVerification> {
  const store = (globalStore.__tivaReleaseVerification ??= { value: null, at: 0 });
  if (!force && store.value && Date.now() - store.at < TTL_MS) return store.value;

  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(RELEASE.downloadUrl, { redirect: "follow", cache: "no-store" });
    if (!response.ok) {
      const value: ReleaseVerification = {
        checkedAt,
        reachable: false,
        bytes: 0,
        sha256: "",
        hashMatch: false,
        sizeMatch: false,
        status: response.status,
        message: `دانلود لینک انتشار ناموفق بود (HTTP ${response.status}).`,
      };
      store.value = value;
      store.at = Date.now();
      return value;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const hashMatch = sha256 === RELEASE.sha256;
    const sizeMatch = buffer.length === RELEASE.bytes;

    const value: ReleaseVerification = {
      checkedAt,
      reachable: true,
      bytes: buffer.length,
      sha256,
      hashMatch,
      sizeMatch,
      status: response.status,
      message: hashMatch && sizeMatch
        ? "لینک دانلود فعال است و فایل دقیقاً همان APK امضاشدهٔ ثبت‌شده است."
        : "لینک فعال است اما هش فایل با مقدار ثبت‌شده یکسان نیست؛ به‌روزرسانی فایل را بررسی کنید.",
    };
    store.value = value;
    store.at = Date.now();
    globalStore.__tivaReleaseVerification = store;
    return value;
  } catch (error) {
    const value: ReleaseVerification = {
      checkedAt,
      reachable: false,
      bytes: 0,
      sha256: "",
      hashMatch: false,
      sizeMatch: false,
      status: 0,
      message: error instanceof Error ? error.message : "خطای شبکه در بررسی لینک دانلود",
    };
    store.value = value;
    store.at = Date.now();
    return value;
  }
}
