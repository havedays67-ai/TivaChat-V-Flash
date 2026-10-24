import { APPS } from "./apps";
import { INTENTS } from "./intents";
import { normalizeWithFinglish } from "./text";

export type GeneratedSample = {
  classKey: string;
  text: string;
  normalized: string;
  split: "train" | "test";
  seed: number;
};

export type DatasetStats = {
  total: number;
  train: number;
  test: number;
  duplicatesSkipped: number;
  perClass: { key: string; count: number; target: number }[];
};

const COMMAND_PREFIXES = ["", "لطفا ", "برام ", "الان ", "سریع ", "همین حالا ", "خب ", "داداش ", "تیوا "];
const COMMAND_SUFFIXES = ["", " لطفا", " برام", " الان", " سریع", " ممنون"];
const QUERY_PREFIXES = ["", "لطفا ", "برام ", "خب ", "تیوا ", "داداش ", "الان ", "سریع ", "سلام "];
const QUERY_SUFFIXES = ["", "؟", " ?", " لطفا", " رو بگو", " چک کن", " ببین", " گزارش بده", " الان", " ممنون", " دیگه"];
const SOCIAL_SUFFIXES = ["", " تیوا", " جان", " عزیز", " دوست من", " وقت بخیر", " روزت بخیر"];

type ExpandMode = "command" | "query" | "social";

/** deterministic PRNG so every run reproduces the same dataset */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function expand(bases: string[], target: number, rnd: () => number, mode: ExpandMode = "command"): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const pool = bases.length > 0 ? bases : ["هیچ"];
  const prefixes = mode === "command" ? COMMAND_PREFIXES : mode === "query" ? QUERY_PREFIXES : [""];
  const suffixes = mode === "command" ? COMMAND_SUFFIXES : mode === "query" ? QUERY_SUFFIXES : SOCIAL_SUFFIXES;
  for (let attempt = 0; attempt < target * 60 && out.length < target; attempt += 1) {
    const base = pool[Math.floor(rnd() * pool.length)];
    const prefix = prefixes[Math.floor(rnd() * prefixes.length)];
    const suffix = suffixes[Math.floor(rnd() * suffixes.length)];
    const text = `${prefix}${base}${suffix}`.replace(/\s+/g, " ").trim();
    const key = normalizeWithFinglish(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

const CONTACTS = ["مامان", "بابا", "داداش", "خواهرم", "علی", "رضا", "سارا", "مریم", "مدیر", "همکار", "دکتر", "آقای احمدی", "خونه", "همسایه", "09121234567", "09350001122", "شماره اورژانس"];
const SEARCH_TOPICS = ["قیمت دلار", "قیمت طلا", "هوای تهران", "اخبار امروز", "نتایج فوتبال", "قیمت بیت کوین", "ساعت قطار", "دستور پخت قرمه سبزی", "معنی کلمه serendipity", "بهترین گوشی ارزان", "قطار مشهد", "قیمت بنزین", "تعطیلات رسمی", "نرخ سکه", "برنامه هفته", "کتاب خوب", "آموزش پایتون", "قیمت لپ تاپ", "مسیر تهران شیراز", "بورس امروز"];
const ALARM_PERIODS = ["صبح", "ظهر", "عصر", "شب", "بامداد"];
const ALARM_BASES = [
  "آلارم {h} {p} بذار",
  "برای ساعت {h} {p} آلارم بذار",
  "ساعت {h} {p} بیدارم کن",
  "{h} {p} آلارم بذار",
  "آلارم ساعت {h}:{m} بذار",
  "آلارم {h} و {m} دقیقه بذار",
  "منو {h} {p} بیدار کن",
  "{h} {p} زنگ ساعت بذار",
  "ویک اپ برای {h} {p}",
  "آلارم فردا {h} {p}",
  "بدون اینکه ساعت باز بشه {h} {p} آلارم بذار",
  "آلارم {h} {p} رو خودت بذار",
  "ساکت {h} {p} آلارم بذار",
  "آلارم {h} {p} بدون اجازه بذار",
];
const TIMER_DURATIONS = ["نیم ساعت", "یک ساعت", "یک ساعت و نیم", "دو ساعت", "۱۰ دقیقه", "۱۵ دقیقه", "۲۰ دقیقه", "۳۰ دقیقه", "۴۵ دقیقه", "۵ دقیقه", "دو دقیقه", "یک ربع", "۹۰ دقیقه", "۱۲۰ دقیقه", "سه ربع"];

const REPORT_BASES: Record<string, string[]> = {
  battery: [
    "باتری چقدره",
    "شارژ گوشی چنده",
    "درصد باتری",
    "وضعیت باتری",
    "چقدر شارژ دارم",
    "باتری گوشیم رو بگو",
    "میزان شارژ باقی مونده",
    "باطری چقدره",
    "عمر باتری چقدره",
    "برق گوشی چقدره",
    "باتری خوبه",
    "battery cheghadre",
    "battery status",
    "شارژم چقدره",
    "چند درصد شارژ دارم",
    "باتری تموم نشده",
    "health باتری",
    "شارژ گوشیم چنده",
  ],
  ram: [
    "رم چقدره",
    "رم گوشی چقدره",
    "حافظه موقت چقدره",
    "مصرف رم چقدره",
    "رم فری چقدره",
    "رم رو آزاد کن",
    "رم رو خالی کن",
    "رم گوشی رو گزارش بده",
    "چقدر رم آزاد دارم",
    "ram cheghadre",
    "memory usage",
    "گوشی کند شده",
    "گوشی کند شده چیکار کنم",
    "گوشی لگ میزنه",
    "گوشی روون نیست",
    "کندی گوشی",
    "برنامه های باز رو ببند",
    "حافظه رم پر شده",
  ],
  storage: [
    "حافظه چقدره",
    "فضای خالی چقدره",
    "چقدر فضا دارم",
    "حافظه گوشی پر شده",
    "فضا کم آوردم",
    "استوریج چقدره",
    "کش ها رو پاک کن",
    "کش رو خالی کن",
    "فضا رو بهینه کن",
    "کش برنامه ها رو پاک کن",
    "storage cheghadre",
    "free space",
    "حافظه داخلی چقدره",
    "میزان فضای مصرفی",
    "چی فضا رو پر کرده",
    "حافظه رو گزارش بده",
    "فایل های اضافی رو پاک کن",
    "فضای گوشی تموم شده",
  ],
  temperature: [
    "دمای گوشی چقدره",
    "گوشی گرمه",
    "گوشی داغ کرده",
    "حرارت گوشی",
    "دمای باتری چقدره",
    "گوشیم داغ شده",
    "دما رو بگو",
    "حرارت دستگاه",
    "دمای cpu",
    "گوشی خیلی گرم میشه",
    "دستگاه داغونه",
    "temperature",
    "دمای گوشی رو چک کن",
    "چرا گوشی گرم میشه",
    "اضافه حرارت داره",
    "دمای بدنه",
  ],
  device_all: [
    "وضعیت گوشی چطوره",
    "گوشی چه خبر",
    "گزارش کامل بده",
    "همه چیز رو بگو",
    "اطلاعات گوشی",
    "وضعیت دستگاه",
    "گزارش کلی",
    "گوشی رو بررسی کن",
    "سلامت گوشی چطوره",
    "یه گزارش کامل بده",
    "status گوشی",
    "device status",
  ],
};

const NEGATIVE_BASES: string[] = [
  "کشور ایران کجاست",
  "کرم ضدآفتاب برای پوست چیه",
  "گرم شدن هوا تا کی ادامه داره",
  "آلارم ساعت دیواری رو تنظیم کن",
  "فرمت ورد رو عوض کن",
  "پایتخت استرالیا کجاست",
  "قیمت دلار امروز چنده",
  "یه جوک بگو",
  "شعر حافظ بخون",
  "معنی کلمه serendipity چیه",
  "چطور پایتون یاد بگیرم",
  "چی بخورم برای ناهار",
  "دستور پخت قرمه سبزی",
  "بهترین فیلم سال",
  "نتیجه بازی دیشب",
  "هوای فردا چطوره",
  "قانون نیوتن چیه",
  "چند تا سیاره داریم",
  "تاریخ جنگ جهانی دوم",
  "ویژگی های یک رهبر خوب",
  "چرا آسمون آبیه",
  "اختلاف ساعت تهران و لندن",
  "معنی اسم سارا",
  "چطور گلدون رو نگه دارم",
  "قرص سردرد چی بخورم",
  "ماشین حساب ۲۲ ضربدر ۳",
  "ریشه کلمه philosophy",
  "فرق شیعه و سنی",
  "قوانین شطرنج",
  "آموزش قلاب بافی",
  "بهترین برند لباس",
  "تعطیلات نوروز چند روزه",
  "سرمایه اولیه چقدر باشه",
  "مالیات بر درآمد چطوره",
  "ساختار یک مقاله علمی",
  "چی کار کنم حالم بهتر شه",
  "جمله انگلیسی بساز",
  "کد پایتون بنویس",
  "الگوریتم مرتب سازی",
  "معرفی کتاب",
  "چرا خواب میبینیم",
  "ویتامین دی از کجا بگیرم",
  "کدوم دانشگاه بهتره",
  "چطور ماشین بخرم",
  "قیمت مسکن در تهران",
  "بهترین رستوران شهر",
  "باران چطور تشکیل میشه",
  "معنی این جمله چیه",
  "عالی بود",
  "خوبم",
  "شما کی هستید",
  "اسمت چیه",
  "چند سالته",
  "تیواچت چیه",
  "چه کارایی بلدی",
  "کجا زندگی میکنی",
  "یه سوال دارم",
  "میشه کمکم کنی",
  "خسته ام",
  "بی حوصله ام",
  "دوستت دارم",
  "شب بخیر",
  "روز خوبی داشته باشی",
  "تبریک",
  "بله",
  "خیر",
  "شاید",
  "نمیخوام",
  "گوگل چه شرکتیه",
  "کروم چه موتوریه",
  "تلگرام کی ساخته شد",
  "آیکون یعنی چه",
  "ضربدر در ریاضی چیه",
  "بنویس یعنی چی",
  "آلارم ساعت دیواری",
  "قیمت بنزین چنده",
  "ساعت کاری بانک",
  "تقویم ۱۴۰۴",
  "معنی اسم آوا",
  "شعر مولانا",
  "هوای مشهد فردا",
  "نرخ ارز امروز",
  "چطور تایپ سریع یاد بگیرم",
  "بهترین مرورگر کدومه",
  "گوگل پلی چیه",
  "چرا تلگرام فیلتره",
  "فرق هوش مصنوعی و انسان",
  "گوگل کروم چه نسخه‌ایه",
];

const CLOSE_FORMS = ["{app} رو ببند", "{app} را ببند", "{app} رو ببندش", "برام {app} رو ببند", "{app} رو بسته کن", "{app} رو بنداز", "{app} باز نمونده"];
const UNINSTALL_FORMS = ["{app} رو حذف کن", "{app} رو پاک کن", "{app} رو حذفش کن", "برام {app} رو حذف کن", "{app} را پاک کن", "میخوام {app} رو حذف کنم", "حذف {app}"];
const BROWSER_QUERIES = [
  "google ai studio", "google ai studuo", "google", "gemini", "chatgpt", "github", "youtube", "gmail",
  "قیمت دلار", "هوای تهران", "اخبار امروز", "آموزش پایتون", "قیمت بیت کوین", "نقشه تهران", "ترجمه انگلیسی",
  "بهترین گوشی", "دانلود واتساپ", "تست سرعت اینترنت", "ساعت قطار", "بورس", "کتاب صوتی", "موسیقی ایرانی",
];
const BROWSER_TEXTS = ["کروم", "مرورگر", "مرورگر می", "فایرفاکس", "اوپرا مینی", "browser", "chrome"];
const COMPOSE_TEXTS = ["دیر میرسم", "سلام خوبی", "جلسه کنسل شد", "شب میام خونه", "فایل رو فرستادم", "فردا صبح میام", "ممنون از پیامت", "کجایی", "داری میای", "زنگ بزن"];

export function buildDataset(): { samples: GeneratedSample[]; stats: DatasetStats } {
  const rnd = mulberry32(20261024);
  const seenGlobal = new Set<string>();
  const perClass: { key: string; count: number; target: number }[] = [];
  const samples: GeneratedSample[] = [];
  let duplicatesSkipped = 0;

  const add = (classKey: string, rawTexts: string[], target: number) => {
    let added = 0;
    let attempts = 0;
    for (const raw of rawTexts) {
      if (added >= target) break;
      attempts += 1;
      const text = raw.replace(/\s+/g, " ").trim();
      const normalized = normalizeWithFinglish(text);
      if (normalized.length < 3) continue;
      if (seenGlobal.has(normalized)) {
        duplicatesSkipped += 1;
        continue;
      }
      seenGlobal.add(normalized);
      const split: "train" | "test" = hashString(normalized) % 100 < 85 ? "train" : "test";
      samples.push({ classKey, text, normalized, split, seed: (attempts + 17) % 997 });
      added += 1;
    }
    perClass.push({ key: classKey, count: added, target });
  };

  for (const intent of INTENTS) {
    const target = intent.sampleTarget;
    if (intent.key === "negative") {
      add(intent.key, expand(NEGATIVE_BASES, target, rnd, "query"), target);
      continue;
    }
    if (intent.key === "open_app") {
      const texts: string[] = [];
      for (const app of APPS) {
        for (const name of [app.nameFa, app.nameEn, ...app.aliases.slice(0, 2)]) {
          texts.push(`${name} رو باز کن`);
          texts.push(`${name} باز کن`);
          if (app.dualApp) texts.push(`${name} دوگانه رو باز کن`);
        }
      }
      add(intent.key, expand(texts, target, rnd).slice(0, target), target);
      continue;
    }
    if (intent.key === "close_app") {
      const bases = CLOSE_FORMS.flatMap((form) => APPS.map((app) => form.replace("{app}", app.nameFa)));
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "uninstall_app") {
      const bases = UNINSTALL_FORMS.flatMap((form) => APPS.map((app) => form.replace("{app}", app.nameFa)));
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "browser_type") {
      const bases: string[] = [];
      for (const browser of BROWSER_TEXTS) {
        for (const query of BROWSER_QUERIES.slice(0, 12)) {
          bases.push(`${browser} رو باز کن و بنویس ${query}`);
          bases.push(`تو ${browser} بنویس ${query}`);
          bases.push(`${browser} رو باز کن و تایپ کن ${query}`);
          bases.push(`تو ${browser} سرچ کن ${query}`);
          bases.push(`${query} رو تو ${browser} بنویس`);
        }
      }
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "hide_floating_icon") {
      add(
        intent.key,
        expand(
          [
            "آیکون رو بردار",
            "آیکون شناور رو حذف کن",
            "آیکون رو ببند",
            "ایکون رو بردار",
            "آیکون رو پنهان کن",
            "دکمه شناور رو بردار",
            "حباب شناور رو ببند",
            "× رو بزن",
            "ضربدر رو بزن",
            "آیکون رو از صفحه بردار",
            "نشان شناور رو خاموش کن",
            "آیکون تیوا رو ببر",
            "آیکون رو بنداز کنار",
            "دیگه آیکون رو نشون نده",
            "آیکون رو قطع کن",
            "حباب رو حذف کن",
          ],
          target,
          rnd,
          "command",
        ),
        target,
      );
      continue;
    }
    if (intent.key === "show_floating_icon") {
      add(
        intent.key,
        expand(
          [
            "آیکون رو برگردون",
            "آیکون شناور رو نشون بده",
            "آیکون رو نمایش بده",
            "آیکون رو روشن کن",
            "آیکون رو بیار",
            "دکمه شناور رو برگردون",
            "حباب رو دوباره بساز",
            "آیکون تیوا رو برگردون",
            "آیکون رو فعال کن",
            "نشان شناور رو نشان بده",
            "آیکون رو بازگردان",
            "آیکون رو از نو بذار",
          ],
          target,
          rnd,
          "command",
        ),
        target,
      );
      continue;
    }
    if (intent.key === "compose_message") {
      const messengers = APPS.filter((app) => ["telegram", "bale", "blu", "rubika", "balad", "shad", "messages", "whatsapp"].includes(app.key));
      const bases: string[] = [];
      for (const app of messengers) {
        for (const text of COMPOSE_TEXTS) {
          bases.push(`به ${app.nameFa} پیام بده که ${text}`);
          bases.push(`تو ${app.nameFa} بنویس ${text}`);
        }
      }
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "call") {
      const callForms = ["به {c} زنگ بزن", "با {c} تماس بگیر", "به {c} تماس بزن", "زنگ بزن به {c}", "{c} رو کال کن", "به شماره {c} زنگ بزن"];
      add(intent.key, expand(callForms.flatMap((form) => CONTACTS.map((contact) => form.replace("{c}", contact))), target, rnd), target);
      continue;
    }
    if (intent.key === "sms") {
      const smsForms = ["به {c} پیامک بده", "به {c} اس ام اس بفرست", "برای {c} پیامک بزن", "{c} پیامک بفرست", "به شماره {c} پیامک بده"];
      add(intent.key, expand(smsForms.flatMap((form) => CONTACTS.map((contact) => form.replace("{c}", contact))), target, rnd), target);
      continue;
    }
    if (intent.key === "search") {
      const bases: string[] = [];
      for (const topic of SEARCH_TOPICS) {
        bases.push(`${topic} رو سرچ کن`);
        bases.push(`${topic} رو جستجو کن`);
        bases.push(`درباره ${topic} بگرد`);
        bases.push(`تو گوگل ${topic} رو پیدا کن`);
        bases.push(`کروم رو باز کن و ${topic} رو سرچ کن`);
      }
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "alarm") {
      const bases: string[] = [];
      for (const base of ALARM_BASES) {
        for (const period of ALARM_PERIODS) {
          for (let h = 1; h <= 12; h += 1) {
            bases.push(base.replaceAll("{h}", String(h)).replaceAll("{p}", period).replaceAll("{m}", String((h * 5) % 60)));
          }
        }
      }
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "timer") {
      const bases: string[] = [];
      for (const duration of TIMER_DURATIONS) {
        bases.push(`${duration} تایمر بذار`);
        bases.push(`تایمر ${duration} بذار`);
        bases.push(`برای ${duration} تایمر بذار`);
        bases.push(`کرنومتر ${duration}`);
        bases.push(`${duration} دیگه تایمر بذار`);
      }
      add(intent.key, expand(bases, target, rnd), target);
      continue;
    }
    if (intent.key === "battery" || intent.key === "ram" || intent.key === "storage" || intent.key === "temperature" || intent.key === "device_all") {
      add(intent.key, expand(REPORT_BASES[intent.key], target, rnd, "query"), target);
      continue;
    }
    const specific: Record<string, string[]> = {
      flashlight_on: ["چراغ قوه رو روشن کن", "چراغ قوه روشن", "فلاشر رو روشن کن", "نور دوربین رو روشن کن", "تورچ روشن کن", "چراغ قوه", "چراغ قوه رو بزن", "نور فلاشر", "چراغ قوه گوشی", "لامپ گوشی رو روشن کن", "چراغ دوربین", "فلاش رو روشن کن", "روشنایی چراغ قوه", "چراغ قوه لازم دارم", "چراغ قوه روشن کن لطفا", "فلاشر گوشی رو فعال کن"],
      flashlight_off: ["چراغ قوه رو خاموش کن", "چراغ قوه خاموش", "فلاشر رو خاموش کن", "نور دوربین رو قطع کن", "تورچ خاموش کن", "چراغ قوه رو قطع کن", "فلاشر خاموش", "چراغ قوه رو ببند", "نور چراغ قوه", "چراغ قوه خاموش کن لطفا", "فلاشر گوشی رو غیرفعال کن", "لامپ رو خاموش کن"],
      settings_wifi: ["وای فای رو روشن کن", "وای فای رو خاموش کن", "تنظیمات وای فای", "wifi رو باز کن", "اینترنت وای فای", "وای فای وصله", "وایفای رو باز کن", "تنظیمات اینترنت", "شبکه وای فای", "اتصال وای فای", "wifi settings", "وای فای قطع شده", "اینترنت گوشی", "وای فای وصل نمیشه", "شبکه بی سیم", "باز کردن تنظیمات وای فای"],
      settings_bluetooth: ["بلوتوث رو روشن کن", "بلوتوث رو خاموش کن", "تنظیمات بلوتوث", "به بلوتوث وصل شو", "بلوتوث", "بلوتوث گوشی", "اتصال بلوتوث", "تنظیمات بلوتوث رو باز کن", "بلوتوث فعال کن", "بلوتوث قطع کن", "بلوتوث وصل نمیشه", "bluetooth settings", "بلوتوث هدفون", "جفت کردن بلوتوث"],
      settings_sound: ["تنظیمات صدا", "صدای گوشی", "زنگ گوشی رو تنظیم کن", "لرزش گوشی", "صدا رو باز کن", "صدای زنگ", "تنظیم زنگ گوشی", "صدای اعلان", "لرزش و صدا", "بررسی صدای گوشی", "تنظیمات لرزش", "صدای تماس", "زنگ پیامک", "حالت بی صدا"],
      settings_display: ["تنظیمات نمایش", "صفحه نمایش", "روشنایی صفحه رو باز کن", "تنظیمات ظاهر گوشی", "تنظیمات نمایش گوشی", "صفحه نمایش رو تنظیم کن", "روشنایی و نمایش", "اندازه فونت", "تاریک شدن صفحه", "تنظیمات ظاهری", "نمایش گوشی", "چرخش صفحه"],
      camera_photo: ["یه عکس بگیر", "عکس بگیر", "سلفی بگیر", "دوربین رو باز کن", "یه عکس بنداز", "عکس بگیرم", "با دوربین عکس بگیر", "عکس بگیر لطفا", "با دوربین عکس بگیر", "یه سلفی بگیر", "دوربین رو روشن کن", "عکس فوری بگیر", "دوربین گوشی", "عکاسی کن", "یه عکس از اینجا بگیر"],
      camera_video: ["یه ویدیو بگیر", "فیلم بگیر", "ویدیو ضبط کن", "دوربین رو ویدیو کن", "ضبط ویدیو", "ویدیو بگیر", "فیلم ضبط کن", "دوربین رو برای ویدیو باز کن", "ضبط تصویر", "فیلم گرفتن", "ویدیو گرفتن از صفحه", "دوربین ویدیویی"],
      screenshot: ["یه اسکرین شات بگیر", "اسکرین شات", "از صفحه عکس بگیر", "نماگرفت بگیر", "screenshot بگیر", "اسکرین شات بگیر", "از صفحه اسکرین شات بگیر", "نماگرفت", "عکس از صفحه گوشی", "اسکرین شات از صفحه", "screenshot", "تصویر صفحه رو ذخیره کن"],
      volume_set: ["صدا رو ۵۰ درصد کن", "صدای گوشی رو کم کن", "صدا رو زیاد کن", "ولوم رو ۳۰ کن", "صدا رو بیصدا کن", "volume 40", "صدای گوشی رو تنظیم کن", "ولوم صدا", "صدا رو کم کن", "صدا رو قطع کن", "صدا رو ۲۰ کن", "صدا رو زیاد کن", "سطح صدا", "صدای رسانه"],
      brightness_set: ["روشنایی رو ۴۰ درصد کن", "نور صفحه رو کم کن", "روشنایی رو زیاد کن", "برایتنس ۶۰", "روشنایی صفحه ۲۰", "روشنایی گوشی", "نور صفحه رو تنظیم کن", "روشنایی رو کم کن", "نور صفحه زیاد", "روشنایی ۷۰ درصد", "برایتنس گوشی", "روشنایی صفحه رو ببر بالا"],
      airplane_mode: ["حالت هواپیما رو روشن کن", "هواپیما رو خاموش کن", "حالت پرواز", "airplane mode", "حالت پرواز رو روشن کن", "هواپیما حالت", "آفلاین کن گوشی", "حالت هواپیما گوشی", "شبکه رو قطع کن"],
      dnd_on: ["مزاحم نشوید رو روشن کن", "حالت مزاحم نشوید", "do not disturb", "اعلان ها رو قطع کن", "مزاحم نشوید گوشی", "حالت سکوت", "اعلان ها رو ببند", "مزاحم نشوید فعال کن", "حالت تمرکز گوشی"],
      music_play: ["یه آهنگ پخش کن", "موزیک پخش کن", "آهنگ بذار", "پخش موسیقی", "آهنگ بعدی", "آهنگ پخش کن", "موسیقی پخش کن", "پلی کن آهنگ", "آهنگ بذار", "موزیک بزن", "پخش کننده موسیقی", "آهنگ پلی کن"],
      notes_save: ["یادداشت کن که فردا خرید کنم", "یه یادداشت ذخیره کن", "نوت بنویس", "تو یادداشت بنویس شیر بخرم", "یادداشت بردار", "یه نوت ذخیره کن", "بنویس تو یادداشت", "یادداشت جدید", "ثبت یادداشت", "نوشتن نوت"],
      calendar_event: ["یه رویداد تقویم بذار", "برای فردا قرار بذار", "تقویم رو باز کن و رویداد بساز", "قرار ساعت ۵ ثبت کن", "رویداد تقویم بساز", "تو تقویم ثبت کن", "قرار بذار تو تقویم", "جلسه ثبت کن", "اضافه کردن رویداد", "تقویم رو باز کن"],
      delete_media: ["عکس ها رو پاک کن", "این فایل رو حذف کن", "عکس رو پاک کن", "ویدیو رو حذف کن", "از گالری پاک کن", "فایل ها رو پاک کن", "این عکس رو حذف کن", "حذف عکس", "پاک کردن عکس های گالری", "این ویدیو رو پاک کن", "فایل رو حذف کن", "عکسهای اضافی رو پاک کن", "حذف از گالری", "پاک کردن فایل", "حذف ویدیو"],
      greeting: ["سلام", "درود", "سلام خوبی", "صبح بخیر", "ظهر بخیر", "عصر بخیر", "شب بخیر", "وقت بخیر", "چطوری", "حالت چطوره", "خوبی", "چخبر", "چه خبر", "سلام چه خبر", "روز بخیر", "سلام تیوا", "سلام دستیار", "درود بر تو", "سلام وقتت بخیر", "صبحت بخیر", "سلام خسته نباشی", "حالت خوبه", "خوبی تو", "چه میکنی", "چیکار میکنی", "سلام رفیق", "سلام دوست", "درود بر شما", "سلام بر تو", "صبح زیبا", "شب آروم", "سلام مجدد", "دوباره سلام", "سلام برگشتم", "هی سلام", "سلام سلام", "سلام عزیز", "درود خدمت شما", "وقتت بخیر", "روزت بخیر", "سلام و درود", "سلام بر همه", "حال و احوال", "چه حالی داری", "سلام خوش اومدی", "سلام من برگشتم", "خوبی عزیز", "سلام گلم", "صبح امید", "سلام همسفر", "وقت بخیر دستیار", "سلام تیوا جان", "درود ای دستیار"],
      thanks: ["ممنون", "مرسی", "دستت درد نکنه", "سپاس", "ممنونم", "تشکر", "دستت طلا", "دمت گرم", "لطف کردی", "مرسی که کمک کردی", "ممنون از راهنمایی", "خیلی ممنون", "سپاسگزارم", "دست درد نکنه", "ممنون از تلاشت", "مرسی از کمکت", "لطف داشتی", "نوکرم", "زحمت کشیدی", "دستت درد نکنه داداش", "مرسی عزیز", "ممنون که رسیدگی کردی", "سپاس از شما", "بابت کمک ممنون", "دستت درد نکنه تیوا", "مرسی تیوا", "ممنون از توجهت", "کارت درسته", "دست مریزاد", "احسنت", "آفرین", "عالی بود", "خوب بود", "ممنون از تو", "تشکر از دستیار", "سپاس فراوان", "ممنونم واقعا", "مرسی که هستی", "لطف تو بود", "زنده باد", "دست قوت", "خدا قوت", "ممنون از وقتی که گذاشتی", "مرسی از تو", "دمت گرم تیوا", "سپاس", "ممنون و سپاس", "تشکر میکنم", "خیلی لطف کردی", "مرسی از وقتی که گذاشتی"],
      negative: NEGATIVE_BASES,
    };
    const list = specific[intent.key] ?? [intent.labelFa];
    const mode: ExpandMode = intent.key === "greeting" || intent.key === "thanks" ? "social" : "command";
    add(intent.key, expand(list, target, rnd, mode), target);
  }

  return {
    samples,
    stats: {
      total: samples.length,
      train: samples.filter((sample) => sample.split === "train").length,
      test: samples.filter((sample) => sample.split === "test").length,
      duplicatesSkipped,
      perClass,
    },
  };
}
