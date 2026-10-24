import { parseCommand, type ParseResult } from "./parse";

export type Expectation = {
  intent?: string;
  notIntent?: string[];
  hour?: number;
  minute?: number;
  minutes?: number;
  query?: string;
  app?: string;
  contact?: string;
  dual?: boolean;
  needsConfirmation?: boolean;
  shouldAsk?: boolean;
  mediaKind?: string;
  minConfidence?: number;
  action?: string;
  planIncludes?: string;
};

export type TestCase = {
  key: string;
  prompt: string;
  group: string;
  origin: "v1.0.1-regression" | "v1.0.2-requirement";
  expected: Expectation;
  why: string;
};

export const TEST_CASES: TestCase[] = [
  {
    key: "alarm-colon",
    prompt: "آلارم ساعت 6:30",
    group: "آلارم",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", hour: 6, minute: 30 },
    why: "آلارم با ساعت و دقیقهٔ درست؛ رگرسیون 1.0.1",
  },
  {
    key: "alarm-noon-2",
    prompt: "ساعت ۲ ظهر بیدارم کن",
    group: "آلارم",
    origin: "v1.0.2-requirement",
    expected: { intent: "alarm", hour: 14, minute: 0 },
    why: "قاعدهٔ ظهر در 1.0.2: «۲ ظهر» = ۱۴:۰۰",
  },
  {
    key: "alarm-noon-12",
    prompt: "آلارم ۱۲ ظهر بذار",
    group: "آلارم",
    origin: "v1.0.2-requirement",
    expected: { intent: "alarm", hour: 12, minute: 0 },
    why: "ظهر با ۱۲ باید ۱۲:۰۰ بماند",
  },
  {
    key: "alarm-evening",
    prompt: "آلارم ۸ شب بذار",
    group: "آلارم",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", hour: 20, minute: 0 },
    why: "«۸ شب» ← ۲۰:۰۰",
  },
  {
    key: "alarm-morning-word",
    prompt: "آلارم ۷ صبح بذار",
    group: "آلارم",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", hour: 7, minute: 0 },
    why: "عدد فارسی + صبح",
  },
  {
    key: "alarm-half",
    prompt: "ساعت شش و نیم صبح بیدارم کن",
    group: "آلارم",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", hour: 6, minute: 30 },
    why: "ساعت با حروف + «و نیم»",
  },
  {
    key: "alarm-without-time",
    prompt: "آلارم بذار",
    group: "آلارم",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", shouldAsk: true },
    why: "بدون زمان هیچ آلارمی ساخته نمی‌شود و پرسیده می‌شود",
  },
  {
    key: "timer-half",
    prompt: "نیم ساعت تایمر بذار",
    group: "تایمر",
    origin: "v1.0.1-regression",
    expected: { intent: "timer", minutes: 30 },
    why: "«نیم ساعت» = ۳۰ دقیقه",
  },
  {
    key: "timer-hour-half",
    prompt: "یک ساعت و نیم دیگه تایمر بذار",
    group: "تایمر",
    origin: "v1.0.1-regression",
    expected: { intent: "timer", minutes: 90 },
    why: "«یک ساعت و نیم» = ۹۰ دقیقه",
  },
  {
    key: "timer-45",
    prompt: "۴۵ دقیقه تایمر بذار",
    group: "تایمر",
    origin: "v1.0.1-regression",
    expected: { intent: "timer", minutes: 45 },
    why: "تایمر دقیقه‌ای",
  },
  {
    key: "timer-no-duration",
    prompt: "تایمر بذار",
    group: "تایمر",
    origin: "v1.0.2-requirement",
    expected: { intent: "timer", shouldAsk: true },
    why: "بدون مدت، تایمر بی‌صدا ساخته نمی‌شود",
  },
  {
    key: "open-telegram-fa",
    prompt: "Telegram رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.1-regression",
    expected: { intent: "open_app", app: "telegram" },
    why: "نام انگلیسی برنامه با فعل فارسی",
  },
  {
    key: "open-bale",
    prompt: "بله رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "bale" },
    why: "«بله» + فعل باز کردن = برنامه، نه پاسخ تأیید",
  },
  {
    key: "open-telegram-finglish",
    prompt: "telegram ro baz kon",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "telegram" },
    why: "فینگلیش باید به همان قصد برسد",
  },
  {
    key: "open-dual-telegram",
    prompt: "تلگرام دوگانه رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "telegram", dual: true },
    why: "نسخهٔ دوگانه MIUI باید با UserHandle باز شود",
  },
  {
    key: "open-myket",
    prompt: "مایکت رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "myket" },
    why: "alias فارسی فروشگاه",
  },
  {
    key: "open-google-photos",
    prompt: "گوگل فوتوز رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "photos" },
    why: "طولانی‌ترین alias بر «گوگل» مقدم است",
  },
  {
    key: "open-mini-browser",
    prompt: "مرورگر می رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "mi-browser" },
    why: "«مرورگر می» نباید به «مرورگر» ساده تقلیل یابد",
  },
  {
    key: "close-telegram",
    prompt: "تلگرام را ببند",
    group: "برنامه‌ها",
    origin: "v1.0.1-regression",
    expected: { intent: "close_app", app: "telegram" },
    why: "بستن برنامه = صفحهٔ App Info، نه درخواست غیرممکن",
  },
  {
    key: "search-dollar",
    prompt: "کروم رو باز کن و قیمت دلار رو سرچ کن",
    group: "جست‌وجو",
    origin: "v1.0.1-regression",
    expected: { intent: "search", query: "قیمت دلار" },
    why: "نام برنامه و فعل باز کردن از عبارت جست‌وجو حذف می‌شود",
  },
  {
    key: "search-simple",
    prompt: "قیمت دلار رو سرچ کن",
    group: "جست‌وجو",
    origin: "v1.0.1-regression",
    expected: { intent: "search", query: "قیمت دلار" },
    why: "جست‌وجوی تمیز",
  },
  {
    key: "call-mom",
    prompt: "به مامان زنگ بزن",
    group: "تماس",
    origin: "v1.0.1-regression",
    expected: { intent: "call", contact: "مامان", needsConfirmation: true },
    why: "تماس فقط با تأیید و شماره‌گیر سیستم",
  },
  {
    key: "call-no-contact",
    prompt: "زنگ بزن",
    group: "تماس",
    origin: "v1.0.2-requirement",
    expected: { intent: "call", shouldAsk: true },
    why: "بدون مخاطب، تماس گرفته نمی‌شود",
  },
  {
    key: "sms-mom",
    prompt: "به مامان پیامک بده",
    group: "پیام",
    origin: "v1.0.1-regression",
    expected: { intent: "sms", contact: "مامان", needsConfirmation: true },
    why: "پیامک از انتخاب‌گر سیستم، بدون ارسال خودکار",
  },
  {
    key: "battery",
    prompt: "باتری چقدره؟",
    group: "گزارش",
    origin: "v1.0.1-regression",
    expected: { intent: "battery" },
    why: "گزارش باتری",
  },
  {
    key: "ram-report",
    prompt: "رم گوشی چقدره",
    group: "گزارش",
    origin: "v1.0.1-regression",
    expected: { intent: "ram" },
    why: "واژهٔ مستقل «رم»",
  },
  {
    key: "alarm-not-ram",
    prompt: "آلارم",
    group: "گزارش",
    origin: "v1.0.1-regression",
    expected: { intent: "alarm", notIntent: ["ram"] },
    why: "مرز کلمه: «آلارم» نباید گزارش رم بدهد",
  },
  {
    key: "slow-phone",
    prompt: "گوشی کند شده",
    group: "گزارش",
    origin: "v1.0.2-requirement",
    expected: { intent: "ram", notIntent: ["battery"] },
    why: "کندی گوشی نباید گزارش باتری بدهد؛ رم + مدیریت برنامه‌ها",
  },
  {
    key: "free-ram-honest",
    prompt: "رم رو آزاد کن",
    group: "گزارش",
    origin: "v1.0.2-requirement",
    expected: { intent: "ram", notIntent: ["negative"] },
    why: "آزادسازی رم با توضیح صادقانه و هدایت به مدیریت برنامه‌ها",
  },
  {
    key: "hot-phone",
    prompt: "گوشی گرمه",
    group: "گزارش",
    origin: "v1.0.2-requirement",
    expected: { intent: "temperature" },
    why: "گرم بودن گوشی = دما",
  },
  {
    key: "hot-weather-negative",
    prompt: "گرم شدن هوا",
    group: "منفی",
    origin: "v1.0.2-requirement",
    expected: { intent: "negative" },
    why: "«گرم شدن هوا» دربارهٔ گوشی نیست",
  },
  {
    key: "country-negative",
    prompt: "کشور ایران کجاست",
    group: "منفی",
    origin: "v1.0.1-regression",
    expected: { intent: "negative" },
    why: "«کشور» شامل «کش» است اما نباید پاک‌سازی کش اجرا شود",
  },
  {
    key: "cream-negative",
    prompt: "کرم ضدآفتاب",
    group: "منفی",
    origin: "v1.0.1-regression",
    expected: { intent: "negative", notIntent: ["ram"] },
    why: "«کرم» شامل «رم» است اما گزارش رم نیست",
  },
  {
    key: "format-negative",
    prompt: "فرمت",
    group: "منفی",
    origin: "v1.0.1-regression",
    expected: { intent: "negative", notIntent: ["ram"] },
    why: "«فرمت» شامل «رم» است",
  },
  {
    key: "photo-camera",
    prompt: "یه عکس بگیر",
    group: "دوربین",
    origin: "v1.0.2-requirement",
    expected: { intent: "camera_photo", notIntent: ["delete_media"] },
    why: "«عکس بگیر» باید دوربین باشد، نه انتخاب‌گر حذف عکس",
  },
  {
    key: "camera-open",
    prompt: "دوربین رو باز کن",
    group: "دوربین",
    origin: "v1.0.2-requirement",
    expected: { intent: "camera_photo" },
    why: "باز کردن دوربین = عکاسی",
  },
  {
    key: "video-capture",
    prompt: "یه ویدیو بگیر",
    group: "دوربین",
    origin: "v1.0.2-requirement",
    expected: { intent: "camera_video" },
    why: "ضبط ویدیو",
  },
  {
    key: "delete-photos",
    prompt: "عکس‌ها رو پاک کن",
    group: "حذف",
    origin: "v1.0.2-requirement",
    expected: { intent: "delete_media", mediaKind: "photo", needsConfirmation: true },
    why: "حذف فقط با MediaStore.createDeleteRequest",
  },
  {
    key: "delete-file",
    prompt: "این فایل رو حذف کن",
    group: "حذف",
    origin: "v1.0.1-regression",
    expected: { intent: "delete_media", mediaKind: "file", needsConfirmation: true },
    why: "حذف فایل با دیالوگ سیستم",
  },
  {
    key: "uninstall-app",
    prompt: "تلگرام رو حذف کن",
    group: "حذف",
    origin: "v1.0.2-requirement",
    expected: { intent: "uninstall_app", app: "telegram", needsConfirmation: true, action: "action_delete_package" },
    why: "حذف برنامه با ACTION_DELETE و دیالوگ سیستم",
  },
  {
    key: "flashlight-on",
    prompt: "چراغ قوه رو روشن کن",
    group: "ابزار",
    origin: "v1.0.1-regression",
    expected: { intent: "flashlight_on" },
    why: "چراغ‌قوه با CameraManager",
  },
  {
    key: "flashlight-off",
    prompt: "چراغ‌قوه رو خاموش کن",
    group: "ابزار",
    origin: "v1.0.1-regression",
    expected: { intent: "flashlight_off" },
    why: "خاموش کردن چراغ‌قوه",
  },
  {
    key: "wifi-settings",
    prompt: "وای فای رو خاموش کن",
    group: "تنظیمات",
    origin: "v1.0.1-regression",
    expected: { intent: "settings_wifi" },
    why: "تغییر مستقیم وای‌فای ممکن نیست؛ مسیر رسمی",
  },
  {
    key: "cache-and-space",
    prompt: "کش‌ها رو پاک کن و فضا رو بهینه کن",
    group: "تنظیمات",
    origin: "v1.0.1-regression",
    expected: { intent: "storage" },
    why: "عملیات قبل از گزارش‌های اطلاعاتی بررسی می‌شود",
  },
  {
    key: "brightness",
    prompt: "روشنایی رو ۴۰ درصد کن",
    group: "تنظیمات",
    origin: "v1.0.2-requirement",
    expected: { intent: "brightness_set" },
    why: "تنظیم روشنایی با مقدار",
  },
  {
    key: "thanks",
    prompt: "مرسی",
    group: "اجتماعی",
    origin: "v1.0.1-regression",
    expected: { intent: "thanks" },
    why: "پاسخ تشکر بدون اجرای عملیات",
  },
  {
    key: "greeting",
    prompt: "سلام",
    group: "اجتماعی",
    origin: "v1.0.1-regression",
    expected: { intent: "greeting" },
    why: "سلام و احوال‌پرسی",
  },
  {
    key: "ambiguous",
    prompt: "یه کاری کن",
    group: "اطمینان",
    origin: "v1.0.2-requirement",
    expected: { intent: "negative", shouldAsk: true },
    why: "اطمینان زیر ۰٫۹ ← اجرا نکن و بپرس",
  },
  {
    key: "compose-telegram",
    prompt: "به تلگرام پیام بده که دیر می‌رسم",
    group: "پیام",
    origin: "v1.0.2-requirement",
    expected: { intent: "compose_message", app: "telegram", needsConfirmation: true },
    why: "فقط پیش‌نویس با دسترس‌پذیری؛ ارسال خودکار نداریم",
  },
  {
    key: "open-settings-app",
    prompt: "تنظیمات رو باز کن",
    group: "برنامه‌ها",
    origin: "v1.0.2-requirement",
    expected: { intent: "open_app", app: "settings" },
    why: "برنامهٔ تنظیمات در فهرست aliasها هست",
  },
  {
    key: "browser-type-google-ai-studio",
    prompt: "کروم رو باز کن و بنویس google ai studio",
    group: "گزارش‌شده",
    origin: "v1.0.1-regression",
    expected: { intent: "browser_type", app: "chrome", query: "google ai studio", notIntent: ["compose_message", "call", "sms"] },
    why: "باگ گزارش‌شده: قبلاً مخاطبین را چک می‌کرد؛ باید در مرورگر جست‌وجو شود",
  },
  {
    key: "browser-type-typo",
    prompt: "کروم رو باز کن و بنویس google ai studuo",
    group: "گزارش‌شده",
    origin: "v1.0.2-requirement",
    expected: { intent: "browser_type", app: "chrome", query: "google ai studio" },
    why: "غلط تایپی studuo باید به studio اصلاح شود",
  },
  {
    key: "browser-type-in-chrome",
    prompt: "تو کروم بنویس google ai studio",
    group: "مرورگر",
    origin: "v1.0.2-requirement",
    expected: { intent: "browser_type", app: "chrome", query: "google ai studio" },
    why: "الگوی «تو <مرورگر> بنویس <متن>»",
  },
  {
    key: "browser-type-no-contacts",
    prompt: "بنویس google ai studio",
    group: "گزارش‌شده",
    origin: "v1.0.2-requirement",
    expected: { intent: "browser_type", query: "google ai studio", notIntent: ["compose_message", "call"] },
    why: "بدون نام برنامه هم نباید مخاطبین را بررسی کند",
  },
  {
    key: "compose-telegram-draft",
    prompt: "به تلگرام پیام بده که دیر می‌رسیم",
    group: "پیام",
    origin: "v1.0.2-requirement",
    expected: { intent: "compose_message", app: "telegram", needsConfirmation: true },
    why: "برای پیام‌رسان هنوز پیش‌نویس با تأیید لازم است",
  },
  {
    key: "hide-icon",
    prompt: "آیکون رو بردار",
    group: "آیکون",
    origin: "v1.0.2-requirement",
    expected: { intent: "hide_floating_icon" },
    why: "درخواست کاربر: برداشتن آیکون شناور",
  },
  {
    key: "hide-icon-cross",
    prompt: "× رو بزن",
    group: "آیکون",
    origin: "v1.0.2-requirement",
    expected: { intent: "hide_floating_icon" },
    why: "لمس ضربدر گوشهٔ آیکون",
  },
  {
    key: "hide-icon-typo",
    prompt: "ایکون رو ببند",
    group: "آیکون",
    origin: "v1.0.2-requirement",
    expected: { intent: "hide_floating_icon" },
    why: "املای محاوره‌ای «ایکون» هم باید کار کند",
  },
  {
    key: "show-icon",
    prompt: "آیکون رو برگردون",
    group: "آیکون",
    origin: "v1.0.2-requirement",
    expected: { intent: "show_floating_icon" },
    why: "برگرداندن آیکون پس از برداشتن",
  },
  {
    key: "alarm-silent-permission",
    prompt: "آلارم ۷ صبح بدون اینکه ساعت باز بشه",
    group: "آلارم",
    origin: "v1.0.2-requirement",
    expected: {
      intent: "alarm",
      hour: 7,
      minute: 0,
      needsConfirmation: false,
      action: "set_alarm_silent",
      planIncludes: "EXTRA_SKIP_UI",
    },
    why: "آلارم بدون پنجرهٔ اجازه و بدون باز کردن برنامهٔ ساعت",
  },
  {
    key: "icon-not-uninstall",
    prompt: "آیکون رو پاک کن",
    group: "آیکون",
    origin: "v1.0.2-requirement",
    expected: { intent: "hide_floating_icon", notIntent: ["uninstall_app", "delete_media"] },
    why: "«آیکون» هرگز نباید به حذف برنامه یا فایل برود",
  },
  {
    key: "screenshot",
    prompt: "یه اسکرین شات بگیر",
    group: "ابزار",
    origin: "v1.0.2-requirement",
    expected: { intent: "screenshot" },
    why: "اسکرین‌شات از مسیر دسترس‌پذیری",
  },
];

export type TestOutcome = {
  key: string;
  prompt: string;
  group: string;
  origin: string;
  why: string;
  expected: string;
  actual: string;
  passed: boolean;
  detail: string;
  result: ParseResult;
};

function describe(result: ParseResult): string {
  const parts = [`intent=${result.intent}`];
  if (result.slots.clock) parts.push(`time=${String(result.slots.clock.hour).padStart(2, "0")}:${String(result.slots.clock.minute).padStart(2, "0")}`);
  if (result.slots.duration) parts.push(`minutes=${Math.round(result.slots.duration.seconds / 60)}`);
  if (result.slots.query) parts.push(`query=${result.slots.query}`);
  if (result.slots.app) parts.push(`app=${result.slots.app.key}${result.slots.app.dual ? "(dual)" : ""}`);
  if (result.slots.contact) parts.push(`contact=${result.slots.contact}`);
  if (result.slots.mediaKind) parts.push(`media=${result.slots.mediaKind}`);
  parts.push(`conf=${result.confidence}`);
  if (result.needsConfirmation) parts.push("confirm");
  if (result.shouldAsk) parts.push("ask");
  return parts.join(" · ");
}

function compare(expected: Expectation, result: ParseResult): { passed: boolean; detail: string[] } {
  const failures: string[] = [];
  if (expected.intent && result.intent !== expected.intent) failures.push(`قصد: ${result.intent} ≠ ${expected.intent}`);
  for (const forbidden of expected.notIntent ?? []) {
    if (result.intent === forbidden) failures.push(`نباید ${forbidden} باشد`);
  }
  if (expected.hour !== undefined && result.slots.clock?.hour !== expected.hour) {
    failures.push(`ساعت: ${result.slots.clock?.hour ?? "—"} ≠ ${expected.hour}`);
  }
  if (expected.minute !== undefined && result.slots.clock?.minute !== expected.minute) {
    failures.push(`دقیقه: ${result.slots.clock?.minute ?? "—"} ≠ ${expected.minute}`);
  }
  if (expected.minutes !== undefined) {
    const minutes = result.slots.duration ? Math.round(result.slots.duration.seconds / 60) : null;
    if (minutes !== expected.minutes) failures.push(`مدت: ${minutes ?? "—"} ≠ ${expected.minutes}`);
  }
  if (expected.query !== undefined && result.slots.query !== expected.query) {
    failures.push(`عبارت: «${result.slots.query ?? "—"}» ≠ «${expected.query}»`);
  }
  if (expected.app !== undefined && result.slots.app?.key !== expected.app) {
    failures.push(`برنامه: ${result.slots.app?.key ?? "—"} ≠ ${expected.app}`);
  }
  if (expected.dual !== undefined && (result.slots.app?.dual ?? false) !== expected.dual) {
    failures.push(`دوگانه: ${result.slots.app?.dual ?? false} ≠ ${expected.dual}`);
  }
  if (expected.contact !== undefined && result.slots.contact !== expected.contact) {
    failures.push(`مخاطب: ${result.slots.contact ?? "—"} ≠ ${expected.contact}`);
  }
  if (expected.mediaKind !== undefined && result.slots.mediaKind !== expected.mediaKind) {
    failures.push(`نوع رسانه: ${result.slots.mediaKind ?? "—"} ≠ ${expected.mediaKind}`);
  }
  if (expected.needsConfirmation !== undefined && result.needsConfirmation !== expected.needsConfirmation) {
    failures.push(`تأیید: ${result.needsConfirmation} ≠ ${expected.needsConfirmation}`);
  }
  if (expected.shouldAsk !== undefined && result.shouldAsk !== expected.shouldAsk) {
    failures.push(`پرسش: ${result.shouldAsk} ≠ ${expected.shouldAsk}`);
  }
  if (expected.action !== undefined && result.action !== expected.action) {
    failures.push(`اکشن: ${result.action} ≠ ${expected.action}`);
  }
  if (expected.planIncludes !== undefined && !result.plan.some((step) => `${step.step} ${step.detail}`.includes(expected.planIncludes))) {
    failures.push(`برنامهٔ اجرا شامل «${expected.planIncludes}» نیست`);
  }
  if (expected.minConfidence !== undefined && result.confidence < expected.minConfidence) {
    failures.push(`اطمینان: ${result.confidence} < ${expected.minConfidence}`);
  }
  return { passed: failures.length === 0, detail: failures };
}

export function runSuite(): { total: number; passed: number; failed: number; outcomes: TestOutcome[]; durationMs: number } {
  const started = Date.now();
  const outcomes: TestOutcome[] = TEST_CASES.map((testCase) => {
    const result = parseCommand(testCase.prompt);
    const { passed, detail } = compare(testCase.expected, result);
    return {
      key: testCase.key,
      prompt: testCase.prompt,
      group: testCase.group,
      origin: testCase.origin,
      why: testCase.why,
      expected: Object.entries(testCase.expected)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" · "),
      actual: describe(result),
      passed,
      detail: detail.join(" | "),
      result,
    };
  });
  return {
    total: outcomes.length,
    passed: outcomes.filter((outcome) => outcome.passed).length,
    failed: outcomes.filter((outcome) => !outcome.passed).length,
    outcomes,
    durationMs: Date.now() - started,
  };
}
