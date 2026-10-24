import { findApp, type AppMatch } from "./apps";
import { CONFIDENCE_GATE, INTENT_BY_KEY } from "./intents";
import {
  type Clock,
  type Duration,
  formatClock,
  normalizeWithFinglish,
  parseClock,
  parseDuration,
  tokens,
} from "./text";

export type ParseSlots = {
  app?: {
    key: string;
    nameFa: string;
    nameEn: string;
    dual: boolean;
    alias: string;
    packageHint: string | null;
  };
  clock?: Clock;
  duration?: Duration;
  query?: string;
  contact?: string;
  message?: string;
  level?: number;
  mode?: string;
  mediaKind?: string;
  direction?: string;
  note?: string;
};

export type PlanStep = { step: string; detail: string };

export type ParseResult = {
  input: string;
  normalized: string;
  intent: string;
  labelFa: string;
  confidence: number;
  matchedBy: string;
  slots: ParseSlots;
  action: string;
  risk: string;
  needsConfirmation: boolean;
  shouldAsk: boolean;
  question: string | null;
  reply: string;
  honestLimit: string;
  alternatives: { intent: string; labelFa: string; confidence: number }[];
  plan: PlanStep[];
  trace: { step: string; detail: string }[];
};

const DELETE_VERBS = ["حذف کن", "حذفش کن", "پاک کن", "پاکش کن", "پاک کنید", "حذف", "پاک"];
const MEDIA_WORDS = ["عکس", "عکسا", "عکسام", "تصویر", "تصاویر", "فیلم", "ویدیو", "ویدئو", "فایل", "فایلا", "گالری", "مدیا"];
const OPEN_VERBS = ["باز کن", "بازکن", "رو باز", "را باز", "اجرا کن", "لانچ کن", "باز کنید", "اوپن کن"];
const CLOSE_VERBS = ["ببند", "بستن", "بنداز", "بسته"];
const SEARCH_VERBS = ["سرچ کن", "سرچ", "جستجو کن", "جستجو", "جست و جو", "بگرد", "پیدا کن"];
const ALARM_PHRASES = ["آلارم", "بیدارم کن", "بیدار کن", "زنگ ساعت", "ساعت بیداری", "ویک اپ"];
const TIMER_PHRASES = ["تایمر", "کرنومتر", "زمان سنج", "زمانسنج"];
const REPORT_BATTERY = ["باتری", "شارژ گوشی", "شارژ چقدر", "چقدر شارژ"];
const DEVICE_PHRASES = ["وضعیت گوشی", "اطلاعات گوشی", "گزارش کامل", "همه چیز", "گوشی چه خبر", "وضعیت دستگاه"];

/** Extract the object of a dial/compose instruction: «به مامان زنگ بزن» -> مامان */
function extractAfter(text: string, marker: string, stopWords: string[]): string | null {
  const index = text.indexOf(marker);
  if (index === -1) return null;
  const rest = text.slice(index + marker.length).trim();
  if (!rest) return null;
  const words = rest.split(" ");
  const collected: string[] = [];
  for (const word of words) {
    if (stopWords.includes(word)) break;
    collected.push(word);
    if (collected.length >= 4) break;
  }
  const value = collected.join(" ").trim();
  return value.length > 0 ? value : null;
}

const QUERY_STOPWORDS = new Set([
  "رو",
  "را",
  "و",
  "کن",
  "کنید",
  "برام",
  "برای",
  "من",
  "تو",
  "توی",
  "در",
  "از",
  "اینترنت",
  "گوگل",
  "سرچ",
  "جستجو",
  "جست",
  "بگرد",
  "پیدا",
  "لطفا",
  "یه",
  "یک",
  "برام",
  "باز",
  "بازکن",
  "اجرا",
  "لطفاً",
]);

function buildQuery(text: string, aliasList: string[]): string {
  const words = text.split(" ").filter(Boolean);
  const aliases = new Set(aliasList.map((alias) => normalizeWithFinglish(alias)));
  const aliasTokens = new Set(aliases);
  const kept = words.filter((word) => !QUERY_STOPWORDS.has(word) && !aliasTokens.has(word));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

export function parseCommand(rawInput: string): ParseResult {
  const input = (rawInput ?? "").trim();
  const normalized = normalizeWithFinglish(input);
  const words = tokens(input);
  const text = ` ${normalized} `;
  const trace: { step: string; detail: string }[] = [];
  const appMatch: AppMatch | null = findApp(normalized, normalizeWithFinglish);
  if (appMatch) trace.push({ step: "تطبیق برنامه", detail: `«${appMatch.matchedAlias}» → ${appMatch.app.nameFa} (${appMatch.app.key})` });

  const appSlot = appMatch
    ? {
        key: appMatch.app.key,
        nameFa: appMatch.app.nameFa,
        nameEn: appMatch.app.nameEn,
        dual: appMatch.dual,
        alias: appMatch.matchedAlias,
        packageHint: appMatch.app.packageHint ?? null,
      }
    : undefined;

  const has = (phrases: string[]) => phrases.some((phrase) => text.includes(` ${normalizeWithFinglish(phrase)} `));
  const hasToken = (list: string[]) => list.some((word) => words.includes(word));
  const deleteVerb = has(DELETE_VERBS);
  const openVerb = has(OPEN_VERBS);
  const searchVerb = has(SEARCH_VERBS);

  const finish = (
    intentKey: string,
    confidence: number,
    matchedBy: string,
    slots: ParseSlots,
    options: {
      needsConfirmation?: boolean;
      shouldAsk?: boolean;
      question?: string | null;
      reply?: string;
      plan?: PlanStep[];
      alternatives?: { intent: string; labelFa: string; confidence: number }[];
    } = {},
  ): ParseResult => {
    const intent = INTENT_BY_KEY.get(intentKey);
    const risk = intent?.risk ?? "safe";
    const needsConfirmation = options.needsConfirmation ?? risk === "confirm";
    const shouldAsk = options.shouldAsk ?? confidence < CONFIDENCE_GATE;
    trace.push({ step: "قصد", detail: `${intentKey} · اطمینان ${(confidence * 100).toFixed(0)}٪ · ${matchedBy}` });

    const alternatives =
      options.alternatives ??
      (shouldAsk
        ? [
            { intent: intentKey, labelFa: intent?.labelFa ?? intentKey, confidence },
            { intent: "negative", labelFa: "هیچ کاری نکن", confidence: Number((1 - confidence).toFixed(2)) },
          ]
        : []);

    return {
      input,
      normalized,
      intent: intentKey,
      labelFa: intent?.labelFa ?? intentKey,
      confidence: Number(confidence.toFixed(2)),
      matchedBy,
      slots,
      action: intent?.action ?? "no_action",
      risk,
      needsConfirmation,
      shouldAsk,
      question: options.question ?? (shouldAsk ? "منظورتان این بود؟ اگر نه، دقیق‌تر بگویید." : null),
      reply: options.reply ?? "",
      honestLimit: options.shouldAsk ? "" : intent?.honestLimit ?? "",
      alternatives,
      plan: options.plan ?? [],
      trace,
    };
  };

  const mediaWord = hasToken(MEDIA_WORDS) || has(["عکس", "تصویر", "ویدیو", "فایل"]);
  const mediaKind = hasToken(["عکس", "عکسا", "عکسام", "تصویر", "تصاویر", "سلفی", "گالری"])
    ? "photo"
    : hasToken(["فیلم", "ویدیو", "ویدئو"])
      ? "video"
      : hasToken(["فایل", "فایلا"])
        ? "file"
        : undefined;

  // -------- 1. destructive: media deletion (system dialog only) --------
  if (deleteVerb && mediaWord && !(appMatch && !mediaKind)) {
    return finish("delete_media", 0.96, "فعل حذف + هدف رسانه", { mediaKind, app: appSlot }, {
      needsConfirmation: true,
      reply:
        "حذف مستقیم انجام نمی‌شود. انتخاب‌گر رسانه باز می‌شود و حذف فقط با دیالوگ تأیید سیستم انجام می‌گیرد.",
      plan: [
        { step: "انتخاب فایل", detail: "MediaStore.createDeleteRequest برای همان فایل‌های انتخاب‌شده" },
        { step: "تأیید کاربر", detail: "دیالوگ سیستمی «حذف شود؟» — انصراف = هیچ تغییری" },
      ],
    });
  }

  // -------- 2. destructive: uninstall app (ACTION_DELETE) --------
  if (deleteVerb && appMatch) {
    return finish("uninstall_app", 0.95, "فعل حذف + نام برنامه", { app: appSlot }, {
      needsConfirmation: true,
      reply: `حذف ${appMatch.app.nameFa} فقط با دیالوگ رسمی اندروید ممکن است. صفحهٔ حذف همان برنامه باز می‌شود.`,
      plan: [
        { step: "یافتن پکیج", detail: "PackageManager در زمان اجرا (بدون پکیج حدسی)" },
        { step: "دیالوگ سیستم", detail: "Intent ACTION_DELETE با پکیج همان برنامه" },
      ],
    });
  }

  // -------- 3. camera --------
  if (!deleteVerb && (has(["عکس بگیر", "سلفی بگیر", "عکس بینداز", "عکس بنداز", "یه عکس بگیر", "عکس بگیرم"]) || (hasToken(["دوربین", "camera"]) && openVerb) || (hasToken(["عکس", "سلفی"]) && hasToken(["بگیر", "بگیرم", "بینداز"])))) {
    return finish("camera_photo", 0.96, "فعل عکاسی", { app: appSlot }, {
      reply: "دوربین باز می‌شود؛ عکس با دکمهٔ شاتر خود دوربین گرفته می‌شود.",
      plan: [
        { step: "دوربین", detail: "Intent ACTION_IMAGE_CAPTURE با FileProvider" },
        { step: "ذخیره", detail: "عکس در پوشهٔ اختصاصی برنامه، بیرون از گالری تا انتخاب کاربر" },
      ],
    });
  }
  if (!deleteVerb && hasToken(["فیلم", "ویدیو", "ویدئو"]) && hasToken(["بگیر", "ضبط", "بگیرم"])) {
    return finish("camera_video", 0.94, "فعل ضبط ویدیو", {}, {
      reply: "دوربین در حالت ویدیو باز می‌شود؛ ضبط با دکمهٔ خود دوربین آغاز می‌شود.",
      plan: [{ step: "دوربین", detail: "Intent ACTION_VIDEO_CAPTURE" }],
    });
  }

  // -------- 4. search (before open_app: «کروم رو باز کن و قیمت دلار رو سرچ کن») --------
  if (searchVerb) {
    const aliasList = appMatch ? appMatch.app.aliases : [];
    const query = buildQuery(normalized, aliasList);
    if (!query) {
      return finish("search", 0.86, "فعل جست‌وجو بدون عبارت", {}, {
        shouldAsk: true,
        question: "چه چیزی را جست‌وجو کنم؟",
        reply: "عبارت جست‌وجو مشخص نبود، پس چیزی باز نشد.",
      });
    }
    return finish("search", 0.96, "فعل جست‌وجو + عبارت", { query, app: appSlot }, {
      reply: `در مرورگر پیش‌فرض «${query}» جست‌وجو می‌شود.`,
      plan: [{ step: "مرورگر", detail: `ACTION_WEB_SEARCH با عبارت «${query}»` }],
    });
  }

  // -------- 5. sms / call / compose --------
  if (has(["پیامک", "اس ام اس", "sms"])) {
    const contact = extractAfter(normalized, "به", ["پیامک", "پیام", "بده", "بفرست", "بنویس"]) ?? undefined;
    return finish("sms", contact ? 0.95 : 0.88, "واژهٔ پیامک", { contact, message: undefined }, {
      needsConfirmation: true,
      shouldAsk: !contact,
      question: contact ? null : "پیامک برای چه شماره یا مخاطبی؟",
      reply: contact
        ? `برنامهٔ پیام‌ها برای «${contact}» باز می‌شود؛ ارسال با تأیید خودتان.`
        : "شماره یا مخاطب مشخص نشد، پس برنامهٔ پیام‌ها باز نشد.",
      plan: [{ step: "پیامک", detail: "Intent ACTION_SENDTO با شماره و انتخاب‌گر سیستم" }],
    });
  }

  if (has(["زنگ بزن", "تماس بگیر", "تماس", "کال کن", "dial", "زنگ بزنم"])) {
    const contact =
      extractAfter(normalized, "به", ["زنگ", "تماس", "بزن", "بگیر", "کن"]) ??
      (normalized.match(/(09\d{9})/) ?? [])[1];
    return finish("call", contact ? 0.96 : 0.88, "فعل تماس", { contact }, {
      needsConfirmation: true,
      shouldAsk: !contact,
      question: contact ? null : "با چه کسی تماس بگیرم؟ نام مخاطب یا شماره را بگویید.",
      reply: contact
        ? `شماره‌گیر سیستم برای «${contact}» باز می‌شود؛ تماس با تأیید خودتان برقرار می‌شود.`
        : "مخاطب مشخص نشد؛ برای اینکه اشتباه تماس گرفته نشود، کاری انجام نمی‌دهم.",
      plan: [
        { step: "مخاطب", detail: "READ_CONTACTS زمان‌نیاز؛ در چند نتیجه، انتخاب‌گر ContactResolverActivity" },
        { step: "شماره‌گیر", detail: "ACTION_DIAL با شماره — هیچ ACTION_CALL مستقیمی نیست" },
      ],
    });
  }

  if (hasToken(["بنویس", "تایپ"]) || (has(["پیام", "مسیج"]) && !hasToken(["پیامک"]) && (appMatch || hasToken(["بده", "بفرست"])))) {
    const contact = extractAfter(normalized, "به", ["پیام", "مسیج", "بنویس", "که"]) ?? undefined;
    const message = extractAfter(normalized, "که", []) ?? extractAfter(normalized, "بنویس", []) ?? undefined;
    return finish("compose_message", 0.93, "فعل نوشتن پیام", { contact, message, app: appSlot }, {
      needsConfirmation: true,
      shouldAsk: false,
      question: null,
      reply: "متن به‌صورت پیش‌نویس در کادر پیام نوشته می‌شود و ارسال نمی‌شود؛ دکمهٔ ارسال دست خودتان است.",
      plan: [
        { step: "باز کردن پیام‌رسان", detail: "همان برنامهٔ نام‌برده‌شده" },
        { step: "نوشتن", detail: "AssistantAccessibilityService متن را در کادر می‌نویسد (بدون ارسال)" },
      ],
    });
  }

  // -------- 6. alarm / timer --------
  if (has(ALARM_PHRASES) || (hasToken(["آلارم", "بیدارم"]) && !hasToken(["پاک"]))) {
    const clock = parseClock(normalized);
    if (!clock) {
      return finish("alarm", 0.8, "واژهٔ آلارم بدون زمان", {}, {
        shouldAsk: true,
        question: "برای چه ساعتی آلارم بگذارم؟ مثلاً «آلارم ۷ صبح».",
        reply: "آلارم بدون ساعت ساخته نمی‌شود؛ زمان را بگویید.",
      });
    }
    return finish("alarm", clock.ambiguous ? 0.89 : 0.97, "آلارم + زمان", { clock }, {
      shouldAsk: clock.ambiguous,
      question: clock.ambiguous ? `منظورتان ساعت ${formatClock(clock.hour, clock.minute)} بود؟` : null,
      reply: `آلارم برای ساعت ${formatClock(clock.hour, clock.minute)} تنظیم می‌شود.`,
      plan: [{ step: "ساعت", detail: `AlarmClock.ACTION_SET_ALARM ساعت ${formatClock(clock.hour, clock.minute)}` }],
    });
  }

  if (has(TIMER_PHRASES)) {
    const duration = parseDuration(normalized);
    if (!duration) {
      return finish("timer", 0.82, "واژهٔ تایمر بدون مدت", {}, {
        shouldAsk: true,
        question: "تایمر برای چه مدتی؟ مثلاً «نیم ساعت» یا «۱۰ دقیقه».",
        reply: "تایمر بدون مدت ساخته نمی‌شود؛ مدت را بگویید.",
      });
    }
    const minutes = duration.seconds / 60;
    return finish("timer", 0.96, "تایمر + مدت", { duration }, {
      reply: `تایمر برای ${duration.human} تنظیم می‌شود.`,
      plan: [{ step: "تایمر", detail: `AlarmClock.ACTION_SET_TIMER با ${duration.seconds} ثانیه` }],
    });
  }

  // -------- 7. flashlight --------
  if (has(["چراغ قوه", "چراغقوه", "فلاشر", "تورچ"]) || (hasToken(["چراغ"]) && hasToken(["قوه", "قوه‌اش"]))) {
    const off = hasToken(["خاموش", "ببند", "قطع", "off"]);
    const on = hasToken(["روشن", "باز", "on", "بزن"]);
    if (!off && !on) {
      return finish("flashlight_on", 0.9, "چراغ‌قوه بدون وضعیت", {}, {
        shouldAsk: false,
        reply: "چراغ‌قوه روشن می‌شود. اگر می‌خواهید خاموش شود بگویید «چراغ‌قوه رو خاموش کن».",
      });
    }
    return finish(off ? "flashlight_off" : "flashlight_on", 0.97, "چراغ‌قوه + وضعیت", {}, {
      reply: off ? "چراغ‌قوه خاموش می‌شود." : "چراغ‌قوه روشن می‌شود.",
      plan: [{ step: "دوربین", detail: `CameraManager.setTorchMode(${off ? "false" : "true"})` }],
    });
  }

  // -------- 8. brightness / volume --------
  const numberMatch = normalized.match(/(\d{1,3})/);
  if (hasToken(["روشنایی", "برایتنس", "brightness"])) {
    const level = numberMatch ? Math.min(100, Number.parseInt(numberMatch[1], 10)) : undefined;
    return finish("brightness_set", level !== undefined ? 0.95 : 0.86, "واژهٔ روشنایی", { level }, {
      shouldAsk: level === undefined,
      question: level === undefined ? "روشنایی چند درصد باشد؟" : null,
      reply: level !== undefined ? `روشنایی صفحه روی ${level}٪ تنظیم می‌شود.` : "درصد روشنایی مشخص نشد.",
    });
  }
  if (hasToken(["صدا", "ولوم", "volume"]) && (numberMatch || hasToken(["کم", "زیاد", "بیصدا", "قطع"]))) {
    const level = numberMatch ? Math.min(100, Number.parseInt(numberMatch[1], 10)) : undefined;
    return finish("volume_set", level !== undefined ? 0.95 : 0.9, "صدا + مقدار", { level }, {
      shouldAsk: false,
      reply: level !== undefined ? `صدای رسانه روی ${level}٪ تنظیم می‌شود.` : "سطح صدا با دکمه‌های سیستم کم یا زیاد می‌شود.",
    });
  }

  // -------- 9. settings + toggles --------
  if (hasToken(["وایفای", "wifi"]) || has(["وای فای", "وای‌فای"])) {
    return finish("settings_wifi", 0.96, "واژهٔ وای‌فای", {}, {
      reply: "صفحهٔ وای‌فای باز می‌شود؛ روشن یا خاموش کردن را خودتان در پنل سیستم تأیید کنید.",
      plan: [{ step: "تنظیمات", detail: "Settings.ACTION_WIFI_SETTINGS" }],
    });
  }
  if (hasToken(["بلوتوث", "bluetooth"])) {
    return finish("settings_bluetooth", 0.96, "واژهٔ بلوتوث", {}, {
      reply: "صفحهٔ بلوتوث باز می‌شود.",
      plan: [{ step: "تنظیمات", detail: "Settings.ACTION_BLUETOOTH_SETTINGS" }],
    });
  }
  if (has(["حالت هواپیما", "هواپیما"])) {
    return finish("airplane_mode", 0.94, "حالت هواپیما", {}, {
      reply: "تنظیمات شبکه باز می‌شود؛ حالت هواپیما را خودتان فعال کنید.",
    });
  }
  if (has(["مزاحم نشوید", "مزاحم", "do not disturb"])) {
    return finish("dnd_on", 0.93, "مزاحم نشوید", {}, { reply: "تنظیمات مزاحم نشوید باز می‌شود." });
  }
  if (hasToken(["صدا"]) && !numberMatch) {
    return finish("settings_sound", 0.92, "تنظیمات صدا", {}, { reply: "تنظیمات صدا و لرزش باز می‌شود." });
  }
  if (hasToken(["نمایش", "display"])) {
    return finish("settings_display", 0.92, "تنظیمات نمایش", {}, { reply: "تنظیمات نمایش باز می‌شود." });
  }

  // -------- 10. misc single intents --------
  if (has(["اسکرین شات", "اسکرین‌شات", "نماگرفت", "screenshot"])) {
    return finish("screenshot", 0.95, "واژهٔ اسکرین‌شات", {}, { reply: "اسکرین‌شات با سرویس دسترس‌پذیری گرفته می‌شود." });
  }
  if (hasToken(["موزیک", "آهنگ", "موسیقی"]) || has(["پخش کن"])) {
    return finish("music_play", 0.93, "واژهٔ موسیقی", {}, { reply: "پخش‌کنندهٔ پیش‌فرض باز می‌شود." });
  }
  if (hasToken(["یادداشت", "نوت"]) && hasToken(["ذخیره", "بنویس", "ثبت"])) {
    const note = extractAfter(normalized, "که", []) ?? extractAfter(normalized, "بنویس", []) ?? undefined;
    return finish("notes_save", 0.94, "یادداشت + فعل ذخیره", { note }, { reply: "یادداشت به‌صورت محلی ذخیره می‌شود." });
  }
  if (hasToken(["تقویم", "رویداد", "قرار"]) && hasToken(["بذار", "اضافه", "ثبت", "بساز"])) {
    const clock = parseClock(normalized);
    return finish("calendar_event", clock ? 0.94 : 0.87, "تقویم + زمان", { clock: clock ?? undefined }, {
      shouldAsk: !clock,
      question: clock ? null : "چه روز و ساعتی برای تقویم ثبت شود؟",
      reply: clock ? `رویداد تقویم برای ${formatClock(clock.hour, clock.minute)} پیشنهاد می‌شود.` : "زمان مشخص نشد.",
    });
  }

  // -------- 11. close app / open app --------
  if (has(CLOSE_VERBS) && appMatch) {
    return finish("close_app", 0.94, "فعل بستن + نام برنامه", { app: appSlot }, {
      reply: `اندروید بستن اجباری برنامهٔ دیگر را نمی‌دهد؛ صفحهٔ اطلاعات ${appMatch.app.nameFa} باز می‌شود تا با Force stop ببندید.`,
      plan: [
        { step: "App Info", detail: "Settings.ACTION_APPLICATION_DETAILS_SETTINGS با پکیج همان برنامه" },
        { step: "بستن", detail: "دکمهٔ Force stop فقط با لمس خودتان" },
      ],
    });
  }

  if (openVerb && appMatch) {
    return finish("open_app", 0.97, "فعل باز کردن + نام برنامه", { app: appSlot }, {
      reply: `${appMatch.app.nameFa} باز می‌شود.${appMatch.dual ? " نسخهٔ دوگانه با پروفایل کاربری خودش باز می‌شود." : ""}`,
      plan: [
        { step: "پکیج", detail: "PackageManager.getLaunchIntentForPackage در زمان اجرا" },
        ...(appMatch.dual
          ? [{ step: "دوگانه", detail: "LauncherApps.getActivityList با UserHandle برای نسخهٔ دوم" }]
          : []),
      ],
    });
  }
  if (openVerb && !appMatch) {
    return finish("open_app", 0.78, "فعل باز کردن بدون نام برنامه", {}, {
      shouldAsk: true,
      question: "کدام برنامه را باز کنم؟",
      reply: "نام برنامه مشخص نشد، پس چیزی باز نشد.",
    });
  }

  // -------- 12. close app without name --------
  if (has(CLOSE_VERBS) && hasToken(["برنامه", "اپ", "همه"])) {
    return finish("close_app", 0.9, "بستن برنامه‌ها بدون نام", {}, {
      reply: "بستن گروهی برنامه‌ها در اندروید ممکن نیست؛ مدیریت برنامه‌ها باز می‌شود.",
      plan: [{ step: "مدیریت برنامه‌ها", detail: "Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS" }],
    });
  }

  // -------- 13. device reports (word-boundary safe) --------
  const slowDevice = has(["کند شده", "کندی", "کشیده", "روون نیست", "لگ", "داغ میکنه", "داغ می‌کنه"]);
  if (slowDevice) {
    return finish("ram", 0.93, "گوشی کند شده", { mode: "slow_device" }, {
      reply:
        "برای کندی، اول گزارش رم و حافظه را می‌دهم و بعد مدیریت برنامه‌ها را باز می‌کنم؛ اندروید اجازهٔ آزادسازی مستقیم رم برنامه‌های دیگر را نمی‌دهد.",
      plan: [
        { step: "گزارش", detail: "ActivityManager.MemoryInfo + StatFs" },
        { step: "مدیریت", detail: "Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS" },
      ],
    });
  }

  if (hasToken(["رم", "memory"]) || has(["حافظه موقت", "رم گوشی"])) {
    return finish("ram", 0.95, "واژهٔ رم", {}, {
      reply:
        "رم را گزارش می‌دهم؛ اندروید ۱۱+ اجازهٔ آزادسازی رم برنامه‌های دیگر را نمی‌دهد. برای آزادسازی، «مدیریت برنامه‌ها» باز می‌شود تا برنامه‌های پرمصرف را ببندید.",
      plan: [
        { step: "گزارش", detail: "ActivityManager.MemoryInfo" },
        { step: "مدیریت", detail: "Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS — بدون بستن خودکار" },
      ],
    });
  }
  if (hasToken(["حافظه", "فضا", "استوریج", "storage", "هارد"]) || hasToken(["کش", "کشها", "کش‌ها"]) || has(["کش ها"])) {
    const cache = hasToken(["کش", "کشها", "بهینه"]);
    return finish("storage", 0.95, cache ? "پاک‌سازی کش + فضا" : "واژهٔ حافظه", { mode: cache ? "cache" : "report" }, {
      reply:
        "فضای ذخیره‌سازی را گزارش می‌دهم و صفحهٔ ذخیره‌سازی باز می‌شود. پاک‌کردن کش برنامه‌های دیگر در اندروید ۱۱+ از داخل تیواچت ممکن نیست و باید از همان صفحه انجام شود.",
      plan: [
        { step: "گزارش", detail: "StatFs روی data و sdcard" },
        { step: "مسیر رسمی", detail: "Settings.ACTION_STORAGE_SETTINGS" },
      ],
    });
  }
  if (hasToken(["باتری", "شارژ"]) || has(REPORT_BATTERY)) {
    return finish("battery", 0.96, "واژهٔ باتری", {}, {
      reply: "درصد و وضعیت باتری خوانده می‌شود.",
      plan: [{ step: "باتری", detail: "BatteryManager.GET_PROPERTY_INT" }],
    });
  }
  if (hasToken(["دما", "داغ", "داغه", "داغون", "گرمه", "گرمم", "داغم"]) || (hasToken(["گرم"]) && hasToken(["گوشی", "دستگاه", "بدنه", "میشه", "میشود", "کرده"]))) {
    if (hasToken(["هوا", "شده"]) && !hasToken(["گوشی", "دستگاه", "بدنه"])) {
      return finish("negative", 0.94, "گرم شدن هوا (نه دمای گوشی)", {}, {
        shouldAsk: false,
        reply: "این جمله دربارهٔ دمای گوشی نیست، پس هیچ گزارشی نمی‌دهم.",
        alternatives: [],
      });
    }
    return finish("temperature", 0.95, "واژهٔ دما", {}, {
      reply: "دمای باتری و وضعیت حرارتی خوانده می‌شود.",
      plan: [{ step: "دما", detail: "BatteryManager.EXTRA_TEMPERATURE؛ دمای CPU فقط در مسیر رسمی" }],
    });
  }
  if (has(DEVICE_PHRASES) || has(["گوشی چطوره", "گوشی چطور است", "همه گزارش"])) {
    return finish("device_all", 0.95, "گزارش کامل دستگاه", {}, {
      reply: "باتری، رم، حافظه و دما با هم گزارش می‌شوند.",
    });
  }
  if (hasToken(["تنظیمات", "settings"]) && !appMatch) {
    return finish("settings_display", 0.9, "واژهٔ تنظیمات", {}, { reply: "تنظیمات سیستم باز می‌شود." });
  }

  // -------- 14. social --------
  if (hasToken(["ممنون", "مرسی", "مرسلی", "سپاس", "دستت"])) {
    return finish("thanks", 0.97, "واژهٔ تشکر", {}, { reply: "خواهش می‌کنم! کاری هست که بتوانم برایتان انجام دهم؟" });
  }
  if (hasToken(["سلام", "درود", "hi", "hello", "صبح"]) && words.length <= 5) {
    return finish("greeting", 0.96, "واژهٔ سلام", {}, { reply: "سلام! در خدمتم. چه کاری برایتان انجام دهم؟" });
  }
  if (hasToken(["چطوری", "خوبی", "حالت", "خوب"]) && hasToken(["چطوری", "خوبی", "حالت"])) {
    return finish("greeting", 0.93, "احوال‌پرسی", {}, { reply: "خوبم، ممنون! شما چطورید؟ چه دستوری دارید؟" });
  }
  if (hasToken(["بله", "آره", "باشه", "اوکی", "ok"]) && words.length <= 2) {
    return finish("greeting", 0.9, "تأیید کوتاه", {}, { reply: "باشه. منتظر دستور بعدی هستم." });
  }

  // -------- 15. fallback --------
  const imperative = hasToken(["کن", "کنید", "بگیر", "بذار", "بزن", "باز", "ببند", "بفرست", "بنویس"]);
  if (imperative) {
    return finish("negative", 0.55, "دستور نامشخص", {}, {
      shouldAsk: true,
      question: "دستور را دقیق متوجه نشدم. مثلاً «آلارم ۷ صبح بذار» یا «تلگرام رو باز کن».",
      reply: "برای اینکه کار اشتباهی انجام نشود، هیچ عملی اجرا نشد. کمی دقیق‌تر بگویید.",
    });
  }
  return finish("negative", 0.96, "خارج از محدودهٔ دستورها", {}, {
    shouldAsk: false,
    reply: "این درخواست خارج از دستورهای تیواچت است؛ هیچ عملی روی دستگاه اجرا نمی‌شود.",
    alternatives: [],
  });
}
