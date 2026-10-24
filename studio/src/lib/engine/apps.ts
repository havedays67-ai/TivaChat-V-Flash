/**
 * App alias registry for the user's Xiaomi Redmi Note 8 Pro (MIUI).
 * Rules followed:
 *  - names come from the user's screenshots (no invented apps);
 *  - package names are NOT guessed. Only packages confirmed by the project's own
 *    `tiva_knowledge.js` are stored; everything else is resolved at runtime with
 *    PackageManager / LauncherApps;
 *  - dual apps (MIUI second space / dual apps) need a UserHandle, handled in the patch.
 */

export type AppCategory =
  | "messaging"
  | "system"
  | "google"
  | "browser"
  | "store"
  | "ai"
  | "iran-service"
  | "entertainment"
  | "vpn"
  | "tools";

export type AppDef = {
  key: string;
  nameFa: string;
  nameEn: string;
  category: AppCategory;
  aliases: string[];
  dualApp?: boolean;
  packageHint?: string;
  packageSource?: "runtime" | "project-kb";
  note?: string;
};

export const CATEGORY_FA: Record<AppCategory, string> = {
  messaging: "پیام‌رسان",
  system: "سیستمی و MIUI",
  google: "گوگل",
  browser: "مرورگر",
  store: "فروشگاه",
  ai: "هوش مصنوعی",
  "iran-service": "خدمات ایرانی",
  entertainment: "فیلم و سرگرمی",
  vpn: "VPN و امنیت",
  tools: "ابزار و فایل",
};

const A = (
  key: string,
  nameFa: string,
  nameEn: string,
  category: AppCategory,
  aliases: string[],
  extra: Partial<Pick<AppDef, "dualApp" | "packageHint" | "packageSource" | "note">> = {},
): AppDef => ({ key, nameFa, nameEn, category, aliases, ...extra });

export const APPS: AppDef[] = [
  // ---------- messaging (dual apps on MIUI) ----------
  A("telegram", "تلگرام", "Telegram", "messaging", ["تلگرام", "telegram", "تلگرام دوگانه", "telegram dual"], {
    dualApp: true,
    packageHint: "org.telegram.messenger",
    packageSource: "project-kb",
  }),
  A("bale", "بله", "Bale", "messaging", ["بله", "bale", "پیام رسان بله", "بله دوگانه"], {
    dualApp: true,
    packageHint: "com.bale.android",
    packageSource: "project-kb",
    note: "«بله» در جملهٔ تأیید هم به‌کار می‌رود؛ فقط با فعل «باز کن/حذف» برنامه در نظر گرفته می‌شود.",
  }),
  A("blu", "بلو", "Blu", "messaging", ["بلو", "blu", "بلو دوگانه", "blue"], {
    dualApp: true,
    packageHint: "com.blu.app",
    packageSource: "project-kb",
  }),
  A("rubika", "روبیکا", "Rubika", "messaging", ["روبیکا", "rubika", "روبینو"]),
  A("balad", "بلد", "Balad", "messaging", ["بلد", "balad", "نقشه بلد", "بلد دوگانه"], {
    dualApp: true,
    note: "دو آیکون در گوشی؛ نسخهٔ دوگانه با LauncherApps و UserHandle باز می‌شود.",
  }),
  A("shad", "شاد", "Shad", "messaging", ["شاد", "shad", "شاد مدرسه"]),
  A("whatsapp", "واتساپ", "WhatsApp", "messaging", ["واتساپ", "واتس", "whatsapp", "واتس اپ"], {
    packageHint: "com.whatsapp",
    packageSource: "project-kb",
    note: "در پایگاه دانش پروژه بود؛ در فهرست اسکرین‌شات‌ها دیده نشد، در صورت نبود نصب، صادقانه اعلام می‌شود.",
  }),

  // ---------- system / MIUI ----------
  A("cleaner", "پاک‌کننده", "Cleaner", "system", ["پاک کننده", "کلینر", "cleaner", "پاکسازی"]),
  A("security", "امنیت", "Security", "system", ["امنیت", "security", "مرکز امنیت", "اسکن امنیتی"]),
  A("files", "مدیریت فایل", "File Manager", "system", ["مدیریت فایل", "فایل منیجر", "file manager", "فایل ها"]),
  A("gallery", "گالری", "Gallery", "system", ["گالری", "gallery", "تصاویر", "گالری عکس"]),
  A("settings", "تنظیمات", "Settings", "system", ["تنظیمات", "settings", "ستینگ"]),
  A("mi-video", "ویدیوی می", "Mi Video", "system", ["ویدیوی می", "mi video", "می ویدیو"]),
  A("notes", "یادداشت", "Notes", "system", ["یادداشت", "notes", "نوت", "یاداشت"]),
  A("clock", "ساعت", "Clock", "system", ["ساعت", "clock", "تایمر گوشی"]),
  A("app-vault", "گاوصندوق برنامه‌ها", "App vault", "system", ["app vault", "گاوصندوق برنامه", "اپ والت"]),
  A("calculator", "ماشین‌حساب", "Calculator", "system", ["ماشین حساب", "calculator", "حسابگر"]),
  A("calendar", "تقویم", "Calendar", "system", ["تقویم", "calendar", "تقویم گوشی"]),
  A("weather", "آب‌وهوا", "Weather", "system", ["آب و هوا", "هوا شناسی", "weather", "هواشناسی"]),
  A("recorder", "ضبط صدا", "Recorder", "system", ["ضبط صدا", "recorder", "ضبط کننده", "ویس"]),
  A("scanner", "اسکنر", "Scanner", "system", ["اسکنر", "scanner", "اسکن"]),
  A("downloads", "دانلودها", "Downloads", "system", ["دانلودها", "downloads", "دانلود"]),
  A("compass", "قطب‌نما", "Compass", "system", ["قطب نما", "compass"]),
  A("shareme", "شیرمی", "ShareMe", "system", ["shareme", "شیر می", "ارسال فایل"]),
  A("services-feedback", "سرویس‌ها و بازخورد", "Services & feedback", "system", ["services", "بازخورد", "سرویس و بازخورد"]),
  A("mi-remote", "می ریموت", "Mi Remote", "system", ["mi remote", "می ریموت", "کنترل تلویزیون"]),
  A("sim-toolkit", "سیم تول‌کیت", "SIM Tool Kit", "system", ["sim toolkit", "سیم تول کیت"]),
  A("fm-radio", "رادیو اف‌ام", "FM Radio", "system", ["رادیو", "fm radio", "اف ام"]),
  A("mi-browser", "مرورگر می", "Mi Browser", "browser", ["مرورگر می", "mi browser", "مرورگر شیائومی"]),
  A("browser", "مرورگر", "Browser", "browser", ["مرورگر", "browser", "مرورگر پیش فرض"]),
  A("copy-text", "کپی متن از صفحه", "Copy Text On Screen Pro", "system", ["copy text", "کپی متن", "کپی متن از صفحه"]),

  // ---------- google ----------
  A("google", "گوگل", "Google", "google", ["گوگل", "google", "جستجوگر گوگل"]),
  A("gmail", "جیمیل", "Gmail", "google", ["جیمیل", "gmail", "ایمیل", "میل"]),
  A("maps", "نقشه", "Maps", "google", ["نقشه", "maps", "گوگل مپ", "مسیریابی"]),
  A("youtube", "یوتیوب", "YouTube", "google", ["یوتیوب", "youtube", "یوتیوب ویدیو"]),
  A("drive", "درایو", "Drive", "google", ["درایو", "drive", "گوگل درایو"]),
  A("google-music", "گوگل موزیک", "Music", "google", ["گوگل موزیک", "google music", "موزیک گوگل"]),
  A("meet", "میت", "Meet", "google", ["میت", "meet", "گوگل میت"]),
  A("photos", "گوگل فوتوز", "Photos", "google", ["فوتوز", "photos", "گوگل فوتوز", "گوگل عکس"]),
  A("contacts", "مخاطبین", "Contacts", "google", ["مخاطبین", "contacts", "دفترچه تلفن", "شماره ها"]),
  A("play-store", "پلی استور", "Play Store", "google", ["پلی استور", "play store", "گوگل پلی", "پلی"]),
  A("play-games", "پلی گیمز", "Play Games", "google", ["پلی گیمز", "play games"]),
  A("lens", "لنز", "Lens", "google", ["لنز", "lens", "گوگل لنز"]),
  A("chrome", "کروم", "Chrome", "browser", ["کروم", "chrome", "گوگل کروم"]),
  A("messages", "پیام‌ها", "Messages", "google", ["پیام ها", "messages", "گوگل مسیج"]),
  A("phone", "تلفن", "Phone", "google", ["تلفن", "phone", "دیالر", "dialer"]),
  A("camera", "دوربین", "Camera", "google", ["دوربین", "camera", "کمرا"]),
  A("translate", "ترجمه", "Translate", "google", ["ترجمه", "translate", "مترجم"]),
  A("authenticator", "اتنتیکیتور", "Authenticator", "google", ["authenticator", "اتنتیکیتور", "کد ورود"]),

  // ---------- browsers ----------
  A("firefox", "فایرفاکس", "Firefox", "browser", ["فایرفاکس", "firefox", "فایر فاکس"]),
  A("opera-mini", "اوپرا مینی", "Opera Mini", "browser", ["اوپرا", "opera", "opera mini", "اوپرا مینی"]),
  A("duckassist", "داک اسیست", "duckAssist", "browser", ["duck", "duckassist", "داک"]),

  // ---------- stores ----------
  A("myket", "مایکت", "Myket", "store", ["مایکت", "myket", "مای کت"]),
  A("bazaar", "بازار", "Bazaar", "store", ["بازار", "bazaar", "کافه بازار", "کافه‌بازار"]),
  A("apkclub", "ای‌پی‌کی کلاپ", "APKCLUB", "store", ["apkclub", "ای پی کی کلاپ", "اپک کلاب"]),

  // ---------- AI ----------
  A("tivachat", "تیواچت", "TivaChat", "ai", ["تیواچت", "tivachat", "تیوا چت", "تیواچت وی فلش"]),
  A("chatgpt", "چت‌جی‌پی‌تی", "ChatGPT", "ai", ["چت جی پی تی", "chatgpt", "چت جیپیتی", "جی پی تی"]),
  A("claude", "کلاد", "Claude", "ai", ["کلاد", "claude", "کلاود"]),
  A("gemini", "جمینای", "Gemini", "ai", ["جمینای", "gemini", "جمنای"]),
  A("deepseek", "دیپ‌سیک", "DeepSeek", "ai", ["دیپ سیک", "deepseek", "دیپسیک"]),
  A("kimi", "کیمی", "Kimi", "ai", ["کیمی", "kimi"]),
  A("grok", "گراک", "Grok", "ai", ["گراک", "grok", "گروک"]),
  A("qwen", "کوین استودیو", "Qwen Studio", "ai", ["qwen", "کوین", "qwen studio"]),
  A("chatbox", "چت‌باکس", "Chatbox", "ai", ["chatbox", "چت باکس"]),
  A("gapgpt", "گپ‌جی‌پی‌تی", "GapGPT", "ai", ["gapgpt", "گپ جی پی تی"]),
  A("polybuzz", "پلی‌باز", "PolyBuzz", "ai", ["polybuzz", "پلی باز"]),
  A("emochi", "اموچی", "Emochi", "ai", ["emochi", "اموچی"]),
  A("alura", "آلورا", "Alura", "ai", ["alura", "آلورا", "ai chat photo"]),

  // ---------- Iranian services ----------
  A("mellat-bank", "همراه بانک ملت", "Bank Mellat", "iran-service", ["همراه بانک ملت", "بانک ملت", "ملت", "mellat"]),
  A("dolat-man", "دولت من", "Dolat Man", "iran-service", ["دولت من", "dolat man", "دولت"]),
  A("mymedu", "مای مدیو", "MyMedu", "iran-service", ["مای مدیو", "mymedu", "وزارت آموزش و پرورش", "مدیو"]),
  A("my-tci", "مخابرات من", "My TCI", "iran-service", ["مخابرات من", "my tci", "مخابرات", "tci"]),
  A("gas-bill", "قبض گاز", "Gas Bill", "iran-service", ["قبض گاز", "گاز", "gas bill"]),
  A("water-bill", "قبض آب", "Water Bill", "iran-service", ["قبض آب", "آب و فاضلاب", "water bill"]),
  A("barq-man", "برق من", "Barq Man", "iran-service", ["برق من", "برق", "barq man"]),
  A("ghabzino", "قبضینو", "Ghabzino", "iran-service", ["قبضینو", "قبضینو", "ghabzino", "قبض"]),
  A("my-mci", "همراه من", "My MCI", "iran-service", ["همراه من", "my mci", "همراه اول", "mci"]),
  A("my-irancell", "ایرانسل من", "My Irancell", "iran-service", ["ایرانسل من", "my irancell", "ایرانسل", "irancell"]),
  A("baran", "باران", "Baran", "iran-service", ["باران", "baran"]),
  A("raida", "رایدا", "RAIDA", "iran-service", ["raida", "رایدا"]),
  A("tonkeeper", "تون کیپر", "Tonkeeper", "iran-service", ["tonkeeper", "تون کیپر", "تون"]),

  // ---------- entertainment ----------
  A("aniflex", "انی‌فلکس", "AniFlex", "entertainment", ["انی فلکس", "aniflex"]),
  A("spotplayer", "اسپات پلیر", "SpotPlayer", "entertainment", ["اسپات پلیر", "spotplayer", "اسپات"]),
  A("highfilm", "های‌فیلم", "HighFilm", "entertainment", ["های فیلم", "highfilm"]),
  A("simba", "سیمبا", "Simba", "entertainment", ["سیمبا", "simba"]),
  A("movie-javan", "مووی جوان", "Movie Javan", "entertainment", ["مووی جوان", "movie javan"]),
  A("dlfars", "دی‌ال‌فارس", "DLFars", "entertainment", ["dlfars", "دی ال فارس", "دی ال"]),
  A("vivatv", "ویوا تی‌وی", "VivaTV", "entertainment", ["ویوا", "vivatv", "ویوا تی وی"]),
  A("box-movie", "بکس مووی", "Box Movie", "entertainment", ["بکس مووی", "box movie"]),
  A("movie-chi", "مووی چی", "Movie Chi", "entertainment", ["مووی چی", "movie chi"]),
  A("iran-film", "ایران فیلم", "Iran Film", "entertainment", ["ایران فیلم", "iran film"]),
  A("dolfan", "دلفان", "Dolfan", "entertainment", ["دلفان", "dolfan"]),
  A("movielix", "مووی‌لیکس", "MovieLix", "entertainment", ["movielix", "مووی لیکس"]),
  A("masterbetel", "مستربتل", "MasterBetel", "entertainment", ["مستربتل", "masterbetel", "مستر بتل"]),
  A("filmkio", "فیلم‌کیو", "FilmKio", "entertainment", ["filmkio", "فیلم کیو", "فیلمکیو"]),
  A("killhouse", "کیل‌هاوس", "Killhouse", "entertainment", ["killhouse", "کیل هاوس"]),
  A("filmbox", "فیلم باکس", "FilmBox", "entertainment", ["فیلم باکس", "filmbox"]),
  A("next-movie", "نکست مووی", "Next Movie", "entertainment", ["نکست مووی", "next movie"]),
  A("kiamovie", "کیا مووی", "KiaMovie", "entertainment", ["کیا مووی", "kiamovie"]),
  A("bebin2tv", "ببین تو تی‌وی", "Bebin2TV", "entertainment", ["bebin", "ببین ۲", "bebin2tv", "ببین"]),
  A("ewano", "ایوانو", "Ewano", "entertainment", ["ewano", "ایوانو"]),
  A("mx-player", "ام‌ایکس پلیر پرو", "MX Player Pro", "entertainment", ["ام ایکس پلیر", "mx player", "پلیر"]),
  A("vlc", "وی‌ال‌سی", "VLC", "entertainment", ["vlc", "وی ال سی"]),
  A("call-of-duty", "کال آو دیوتی", "Call of Duty", "entertainment", ["کال اف دیوتی", "call of duty", "کال آو دیوتی", "cod"]),

  // ---------- VPN / security ----------
  A("warpi", "وارپی", "Warpi Free VPN", "vpn", ["وارپی", "warpi", "وارپی وی پی ان"]),
  A("moon-vpn", "مون وی‌پی‌ان", "Moon VPN", "vpn", ["مون", "moon", "moon vpn", "مون وی پی ان"]),
  A("alan-vpn", "آلان وی‌پی‌ان", "Alan VPN", "vpn", ["آلان", "alan", "alan vpn"]),
  A("happ", "هپ", "Happ", "vpn", ["هپ", "happ", "هپ وی پی ان"]),
  A("wireguard", "وایرگارد", "WireGuard", "vpn", ["wireguard", "وایرگارد", "وایر گارد"]),
  A("temp-mail", "تمپ میل", "Temp Mail", "vpn", ["temp mail", "تمپ میل", "ایمیل موقت"]),
  A("peyso", "پیسنو", "Peyso", "vpn", ["پیسنو", "peyso", "پیس نو"]),

  // ---------- tools ----------
  A("rar", "آر‌آر", "RAR", "tools", ["rar", "آر آر", "فشرده ساز"]),
  A("zarchiver", "زی‌آرچایور", "ZArchiver", "tools", ["zarchiver", "زی ارچایور", "زیپ"]),
  A("adm", "ای‌دی‌ام", "ADM", "tools", ["adm", "ای دی ام", "دانلود منیجر"]),
  A("audio-extractor", "استخراج صدا", "Audio Extractor", "tools", ["audio extractor", "استخراج صدا", "صدای ویدیو"]),
  A("inshot", "اینشات", "InShot", "tools", ["inshot", "اینشات", "ادیت ویدیو"]),
  A("docx-reader", "خواننده ورد", "Docx Reader", "tools", ["docx", "ورد", "docx reader", "خواننده ورد"]),
  A("pdf-reader", "خواننده پی‌دی‌اف", "PDF Reader Hi Read", "tools", ["pdf", "پی دی اف", "pdf reader"]),
  A("persian-calendar", "تقویم فارسی", "Persian Calendar", "tools", ["تقویم فارسی", "persian calendar", "تقویم شمسی"]),
  A("termux", "ترموکس", "Termux", "tools", ["termux", "ترموکس", "ترمینال"]),
  A("godot", "گودو", "Godot Engine 4", "tools", ["godot", "گودو", "موتور بازی"]),
  A("bihua", "بیهوا", "笔花", "tools", ["笔花", "bihua", "بیهوا"]),
];

export type AppMatch = {
  app: AppDef;
  matchedAlias: string;
  dual: boolean;
};

/** Longest alias wins so «گوگل فوتوز» beats «گوگل» and «مرورگر می» beats «مرورگر». */
export function findApp(text: string, normalizeFn: (value: string) => string): AppMatch | null {
  const haystack = ` ${normalizeFn(text)} `;
  let best: { app: AppDef; alias: string; dual: boolean } | null = null;

  for (const app of APPS) {
    for (const rawAlias of app.aliases) {
      const alias = normalizeFn(rawAlias);
      if (!alias) continue;
      const dualFromAlias = /دوگانه|dual|دوم/.test(rawAlias);
      const index = haystack.indexOf(` ${alias} `);
      if (index === -1) continue;
      if (!best || alias.length > best.alias.length) {
        best = { app, alias, dual: dualFromAlias };
      }
    }
  }

  if (!best) return null;
  const dualByToken = /(^|\s)(دوگانه|dual|دوم|دوتایی)(\s|$)/.test(haystack);
  return { app: best.app, matchedAlias: best.alias, dual: best.dual || dualByToken };
}

export function appByKey(key: string): AppDef | undefined {
  return APPS.find((app) => app.key === key);
}

export const DUAL_APPS = APPS.filter((app) => app.dualApp).map((app) => app.key);
export const RUNTIME_RESOLVED = APPS.filter((app) => app.packageSource !== "project-kb").length;
