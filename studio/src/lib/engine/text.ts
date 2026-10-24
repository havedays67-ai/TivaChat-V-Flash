/**
 * Shared Persian text utilities for the TivaChat engine.
 * Pure functions only: used by the Next.js app, the dataset generator and the test runner.
 */

const CHAR_MAP: Record<string, string> = {
  ي: "ی",
  ك: "ک",
  ﻻ: "لا",
  ة: "ه",
  ۀ: "ه",
  أ: "ا",
  إ: "ا",
  ؤ: "و",
  ئ: "ی",
  "‌": " ", // ZWNJ -> space so «می‌کنم» and «میکنم» normalize alike
  "٬": " ",
  "،": " ",
  "؛": " ",
  "؟": " ",
  "!": " ",
  "?": " ",
  ".": " ",
  "«": " ",
  "»": " ",
  "(": " ",
  ")": " ",
  "\u200f": " ",
  "\u200e": " ",
};

const DIGITS: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/** Latin/finglish tokens the user actually types, mapped to Persian equivalents. */
const FINGLISH: Record<string, string> = {
  ro: "رو",
  ra: "را",
  kon: "کن",
  konid: "کنید",
  bokon: "بکن",
  baz: "باز",
  bazkon: "بازکن",
  beband: "ببند",
  band: "ببند",
  zang: "زنگ",
  bezan: "بزن",
  beboos: "ببوس",
  timer: "تایمر",
  alarm: "آلارم",
  alaarm: "آلارم",
  sohbat: "صحبت",
  paam: "پیام",
  payam: "پیام",
  maloom: "معلوم",
  batri: "باتری",
  battery: "باتری",
  flash: "چراغ",
  chrag: "چراغ",
  cheragh: "چراغ",
  ghermez: "قرمز",
  aks: "عکس",
  "aks begir": "عکس بگیر",
  begir: "بگیر",
  film: "فیلم",
  search: "سرچ",
  jostojoo: "جستجو",
  jostojo: "جستجو",
  gooshe: "گوشی",
  gooshi: "گوشی",
  ram: "رم",
  hafeze: "حافظه",
  varzesh: "ورزش",
  tamas: "تماس",
  sos: "sos",
  hello: "سلام",
  salam: "سلام",
  mamnoon: "ممنون",
  merc: "مرسی",
  merci: "مرسی",
  lotfan: "لطفا",
  lotfann: "لطفا",
  khob: "خوب",
  khubi: "خوبی",
  chetori: "چطوری",
  kojaei: "کجایی",
  chera: "چرا",
  key: "کی",
};

export function normalize(input: string): string {
  if (!input) return "";
  let out = "";
  for (const char of input.normalize("NFC")) {
    if (DIGITS[char]) out += DIGITS[char];
    else if (CHAR_MAP[char]) out += CHAR_MAP[char];
    else if (/[\u064B-\u0652\u0670]/.test(char)) continue; // diacritics
    else out += char;
  }
  return out
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize and expand finglish tokens while keeping Persian word order. */
export function normalizeWithFinglish(input: string): string {
  const base = normalize(input);
  const words = base.split(" ").filter(Boolean);
  const mapped = words.map((word) => FINGLISH[word] ?? word);
  return mapped.join(" ").replace(/\s+/g, " ").trim();
}

export function tokens(input: string): string[] {
  return normalizeWithFinglish(input).split(" ").filter(Boolean);
}

export function hasAnyToken(words: string[], list: string[]): boolean {
  return list.some((word) => words.includes(word));
}

export function hasPhrase(text: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (text.includes(normalizeWithFinglish(phrase))) return phrase;
  }
  return null;
}

/** Regex safe for Persian: prevents «رم» inside «آلارم/کرم/فرمت/گرم». */
const FA = "\\u0621-\\u064A\\u0660-\\u0669\\u06F0-\\u06F9\\u200c";
export function wordRegex(word: string): RegExp {
  const normalized = normalizeWithFinglish(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![${FA}])${normalized}(?![${FA}])`, "u");
}

const NUMBER_WORDS: Record<string, number> = {
  صفر: 0,
  یک: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  شیش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
  یازده: 11,
  دوازده: 12,
  سیزده: 13,
  چهارده: 14,
  پانزده: 15,
  شانزده: 16,
  هفده: 17,
  هجده: 18,
  نوزده: 19,
  بیست: 20,
  سی: 30,
  چهل: 40,
  پنجاه: 50,
  شصت: 60,
};

export function wordToNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number.parseInt(word, 10);
  return NUMBER_WORDS[word] ?? null;
}

export type Clock = {
  hour: number;
  minute: number;
  period: "صبح" | "ظهر" | "عصر" | "شب" | "بامداد" | null;
  ambiguous: boolean;
  source: string;
};

const PERIOD_PATTERNS: { period: Clock["period"]; patterns: string[] }[] = [
  { period: "ظهر", patterns: ["بعد از ظهر", "بعدازظهر", "ظهر"] },
  { period: "عصر", patterns: ["عصر", "بعد از ظهر"] },
  { period: "شب", patterns: ["شب", "شبه", "توی شب"] },
  { period: "بامداد", patterns: ["بامداد", "سپیده"] },
  { period: "صبح", patterns: ["صبح", "صبحی"] },
];

function detectPeriod(text: string): Clock["period"] {
  for (const { period, patterns } of PERIOD_PATTERNS) {
    if (patterns.some((pattern) => text.includes(normalizeWithFinglish(pattern)))) return period ?? null;
  }
  return null;
}

/**
 * v1.0.2 rule: «ظهر» covers 12..16.
 *   «۲ ظهر» -> 14:00 · «۱۲ ظهر» -> 12:00 · «۱ ظهر» -> 13:00 · «۴ ظهر» -> 16:00
 */
export function applyPeriod(hour: number, period: Clock["period"]): number {
  if (!period) return hour;
  if (period === "ظهر" || period === "عصر") {
    if (hour === 12) return 12;
    return hour < 12 ? hour + 12 : hour;
  }
  if (period === "شب") {
    if (hour === 12) return 0;
    return hour < 12 ? hour + 12 : hour;
  }
  // صبح / بامداد
  return hour === 12 ? 0 : hour;
}

const HOUR_WORD_SRC = Object.keys(NUMBER_WORDS)
  .filter((word) => (NUMBER_WORDS[word] ?? 0) >= 1 && (NUMBER_WORDS[word] ?? 0) <= 24)
  .join("|");

export function parseClock(input: string): Clock | null {
  const text = ` ${normalizeWithFinglish(input)} `;
  const period = detectPeriod(text);

  // 18:30 / 6:30
  const colon = text.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (colon) {
    const rawHour = Number.parseInt(colon[1], 10);
    const minute = Number.parseInt(colon[2], 10);
    const hour = applyPeriod(rawHour, period);
    return {
      hour: hour === 24 ? 0 : hour,
      minute: Math.min(59, Math.max(0, minute)),
      period,
      ambiguous: false,
      source: colon[0].trim(),
    };
  }

  // «۷ صبح» / «شش و نیم» / «۲ ظهر»
  const wordHour = text.match(
    new RegExp(`(?:ساعت\\s*)?(${HOUR_WORD_SRC})(?:\\s*و\\s*(نیم|ربع|(?:${HOUR_WORD_SRC})))?(?:\\s*(دقیقه))?(?=\\s|$)`, "u"),
  );
  const numericHour = text.match(/(?:ساعت\s*)?(\d{1,2})(?:\s*و\s*(نیم|ربع|\d{1,2}))?/);

  const pick = numericHour ?? wordHour;
  if (!pick) return null;

  const parsedHour = wordToNumber(pick[1]);
  if (parsedHour === null || parsedHour > 24) return null;

  let minute = 0;
  const tail = pick[2];
  if (tail) {
    if (tail === "نیم") minute = 30;
    else if (tail === "ربع") minute = 15;
    else {
      const parsedMinute = wordToNumber(tail);
      if (parsedMinute !== null && parsedMinute <= 59) minute = parsedMinute;
    }
  }

  const periodFromText = period ?? (pick[0].includes("ظهر") ? "ظهر" : null);
  const hour = applyPeriod(parsedHour, periodFromText);
  return {
    hour: hour === 24 ? 0 : hour,
    minute,
    period: periodFromText,
    ambiguous: periodFromText === null,
    source: pick[0].trim(),
  };
}

export type Duration = { seconds: number; human: string; source: string };

export function parseDuration(input: string): Duration | null {
  const text = ` ${normalizeWithFinglish(input)} `;
  let seconds = 0;
  let source = "";
  let matched = false;

  const half = text.match(/نیم\s*ساعت|نیم ساعت/);
  if (half) {
    seconds += 1800;
    source += half[0];
    matched = true;
  }

  const hourMatch = text.match(/(\d+)\s*(?:ساعت|ساعته)/) ?? text.match(new RegExp(`(${HOUR_WORD_SRC})\\s*ساعت`));
  if (hourMatch) {
    const value = wordToNumber(hourMatch[1]);
    if (value !== null) {
      seconds += value * 3600;
      source += ` ${hourMatch[0]}`;
      matched = true;
    }
  }

  const hourAndHalf = text.match(/ساعت\s*و\s*نیم/);
  if (hourAndHalf && !half) {
    seconds += 1800;
    source += ` ${hourAndHalf[0]}`;
    matched = true;
  }

  const minuteMatch = text.match(/(\d+)\s*دقیقه/) ?? text.match(new RegExp(`(${HOUR_WORD_SRC})\\s*دقیقه`));
  if (minuteMatch) {
    const value = wordToNumber(minuteMatch[1]);
    if (value !== null) {
      seconds += value * 60;
      source += ` ${minuteMatch[0]}`;
      matched = true;
    }
  }

  const secondMatch = text.match(/(\d+)\s*ثانیه/);
  if (secondMatch) {
    seconds += Number.parseInt(secondMatch[1], 10);
    source += ` ${secondMatch[0]}`;
    matched = true;
  }

  const quarter = text.match(/ربع\s*ساعت/);
  if (quarter && seconds === 0) {
    seconds += 900;
    source += ` ${quarter[0]}`;
    matched = true;
  }

  if (!matched || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [
    hours > 0 ? `${hours} ساعت` : "",
    minutes > 0 ? `${minutes} دقیقه` : "",
    secs > 0 ? `${secs} ثانیه` : "",
  ].filter(Boolean);

  return { seconds, human: parts.join(" و "), source: source.trim() };
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Persian-aware similarity for the < 0.9 confidence gate. */
export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}
