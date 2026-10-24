/* TivaChat v1.0.2 — Persian / colloquial / Finglish aliases for the apps the user has installed.
   IMPORTANT: these are label hints only. No package name is hard-coded; the real package is
   resolved at runtime with PackageManager (QUERY_ALL_PACKAGES) and a click on the shown label.
   When two copies exist (MIUI Dual apps), the resolver sees two matches and asks the user. */
window.TIVA_APP_ALIASES = {
  /* messengers */
  "تلگرام": "telegram", "تلگرامو": "telegram", "تلگرام رو": "telegram", "telegram": "telegram", "تلگرام دوگانه": "telegram",
  "بله": "bale", "بله رو": "bale", "پیام رسان بله": "bale", "bale": "bale",
  "بلو": "blu", "بلو رو": "blu", "بلو روبیکا": "blu", "blu": "blu",
  "روبیکا": "rubika", "روبیکا رو": "rubika", "rubika": "rubika",
  "بلد": "balad", "بلد رو": "balad", "balad": "balad",
  "شاد": "shad", "شاد رو": "shad", "شاد مدرسه": "shad",
  "ایتا": "eitaa", "سروش": "soroush", "گپ": "gap", "آی گپ": "igap", "واتساپ": "whatsapp", "واتس": "whatsapp", "whatsapp": "whatsapp",
  /* system & MIUI tools */
  "پاک کننده": "cleaner", "پاک‌کننده": "cleaner", "cleaner": "cleaner", "امنیت": "security", "security": "security",
  "مدیر فایل": "file manager", "مدیرفایل": "file manager", "فایل منیجر": "file manager", "file manager": "file manager", "فایل‌ها": "file manager",
  "گالری": "gallery", "گالری رو": "gallery", "gallery": "gallery", "photos": "photos", "گوگل فوتوز": "photos", "فتوز": "photos",
  "تنظیمات": "settings", "settings": "settings", "تلویزیون": "mi video", "mi video": "mi video", "ویدیو": "mi video",
  "یادداشت": "notes", "نوت": "notes", "notes": "notes", "ساعت": "clock", "clock": "clock", "زنگ ساعت": "clock",
  "گاوصندوق": "app vault", "app vault": "app vault", "ولت": "app vault", "ماشین حساب": "calculator", "calculator": "calculator",
  "تقویم": "calendar", "سالنامه": "calendar", "calendar": "calendar", "تقویم فارسی": "persian calendar", "persian calendar": "persian calendar",
  "هوا": "weather", "آب و هوا": "weather", "weather": "weather", "ضبط صدا": "recorder", "رکوردر": "recorder", "recorder": "recorder",
  "اسکنر": "scanner", "scanner": "scanner", "دانلودها": "downloads", "دانلود": "downloads", "downloads": "downloads",
  "قطب نما": "compass", "compass": "compass", "شیر": "shareme", "shareme": "shareme", "کنترل از راه دور": "mi remote", "mi remote": "mi remote",
  "رادیو": "fm radio", "fm radio": "fm radio", "سیم کارت": "sim tool kit", "sim tool kit": "sim tool kit",
  "مرورگر شیائومی": "mi browser", "mi browser": "mi browser", "مرورگر": "browser", "browser": "browser",
  "کپی متن": "copy text on screen", "copy text on screen": "copy text on screen",
  /* google */
  "گوگل": "google", "google": "google", "جی میل": "gmail", "جیمیل": "gmail", "gmail": "gmail", "ایمیل": "gmail",
  "نقشه": "maps", "گوگل مپ": "maps", "maps": "maps", "یوتیوب": "youtube", "youtube": "youtube", "یوتیوب رو": "youtube",
  "درایو": "drive", "گوگل درایو": "drive", "drive": "drive", "میت": "meet", "meet": "meet", "گوگل میت": "meet",
  "مخاطبین": "contacts", "contacts": "contacts", "پلی استور": "play store", "play store": "play store", "گوگل پلی": "play store",
  "پلی گیمز": "play games", "play games": "play games", "لنز": "lens", "lens": "lens", "گوگل لنز": "lens",
  "کروم": "chrome", "chrome": "chrome", "کروم رو": "chrome", "پیام‌رسان گوگل": "messages", "messages": "messages",
  "تلفن": "phone", "phone": "phone", "گوشی": "phone", "دوربین": "camera", "camera": "camera",
  "ترجمه": "translate", "مترجم": "translate", "translate": "translate", "authenticator": "authenticator", "گوگل آتنتیکیتور": "authenticator",
  /* browsers & stores */
  "فایرفاکس": "firefox", "firefox": "firefox", "اپرا مینی": "opera mini", "opera mini": "opera mini", "اپرا": "opera mini",
  "داک": "duckassist", "duckassist": "duckassist", "مایکت": "myket", "myket": "myket", "بازار": "bazaar", "کافه بازار": "bazaar", "bazaar": "bazaar",
  "ای پی کی کلاب": "apkclub", "apkclub": "apkclub", "@apkclub": "apkclub",
  /* AI */
  "تیواچت": "tivachat", "tivachat": "tivachat", "چت جی پی تی": "chatgpt", "چت جی‌پی‌تی": "chatgpt", "chatgpt": "chatgpt",
  "کلود": "claude", "claude": "claude", "جمینای": "gemini", "جمنای": "gemini", "gemini": "gemini",
  "دیپ سیک": "deepseek", "deepseek": "deepseek", "کیمی": "kimi", "kimi": "kimi", "گروک": "grok", "grok": "grok",
  "کوئن": "qwen", "qwen studio": "qwen", "چت باکس": "chatbox", "chatbox": "chatbox", "گپ جی پی تی": "gapgpt", "gapgpt": "gapgpt",
  "پلی باز": "polybuzz", "polybuzz": "polybuzz", "اموچی": "emochi", "emochi": "emochi", "آلورا": "alura", "alura": "alura",
  /* bank & services */
  "همراه بانک": "همراه بانک", "بانک ملت": "همراه بانک", "دولت من": "دولت من", "my medu": "mymedu", "مای مدیو": "mymedu",
  "مخابرات من": "my tci", "my tci": "mytci", "قبض گاز": "قبض گاز", "قبض آب": "قبض آب", "برق من": "برق من", "قبضینو": "قبضینو",
  "همراه من": "my-mci", "my-mci": "mymci", "ایرانسل من": "my irancell", "ایرانسل": "irancell", "باران": "baran", "ریدا": "raida", "raida": "raida",
  "تون کیپر": "tonkeeper", "tonkeeper": "tonkeeper",
  /* video & fun */
  "انی فلکس": "aniflex", "aniflex": "aniflex", "اسپات پلیر": "spotplayer", "spotplayer": "spotplayer", "های فیلم": "highfilm", "highfilm": "highfilm",
  "سیمبا": "simba", "simba": "simba", "مووی جوان": "movie javan", "movie javan": "movie javan", "دی ال فارس": "dlfars", "dlfars": "dlfars",
  "ویوا": "vivatv", "vivatv": "vivatv", "بکس مووی": "boxmovie", "مووی چی": "moviechi", "ایران فیلم": "iranfilm", "دلفان": "delfan",
  "مووی لیکس": "movielix", "movielix": "movielix", "مستر بتل": "masterbattle", "فیلم کیو": "filmkio", "filmkio": "filmkio",
  "کیل هاوس": "killhouse", "killhouse": "killhouse", "فیلم باکس": "filmbox", "نکست مووی": "nextmovie", "کیا مووی": "kiamovie",
  "ببین تو": "bebin2tv", "bebin2tv": "bebin2tv", "ایوانو": "ewano", "ewano": "ewano", "ام ایکس پلیر": "mx player", "mx player": "mx player",
  "وی ال سی": "vlc", "vlc": "vlc", "کال آو دیوتی": "call of duty", "کالاف دیوتی": "call of duty",
  /* vpn & security */
  "وارپی": "warpi", "warpi": "warpi", "مون وی پی ان": "moon vpn", "moon vpn": "moon vpn", "آلن وی پی ان": "alan vpn", "alan vpn": "alan vpn",
  "هپ": "happ", "happ": "happ", "وایر گارد": "wireguard", "wireguard": "wireguard", "تمپ میل": "temp mail", "temp mail": "temp mail",
  "پیسنو": "pessno", "pessno": "pessno",
  /* tools & files */
  "رار": "rar", "rar": "rar", "زیپ آرشیو": "zarchiver", "zarchiver": "zarchiver", "ای دی ام": "adm", "adm": "adm", "دانلود منیجر": "adm",
  "اکسترکت صدا": "audio extractor", "audio extractor": "audio extractor", "اینشات": "inshot", "inshot": "inshot",
  "ورد خوان": "docx reader", "docx reader": "docx reader", "پی دی اف خوان": "pdf reader", "pdf reader": "pdf reader", "هی رید": "hi read",
  "ترمکس": "termux", "termux": "termux", "گودو": "godot", "godot": "godot", "گودو انجین": "godot", "笔花": "笔花"
};
