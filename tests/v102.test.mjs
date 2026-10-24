/* TivaChat V Flash — v1.0.2 regression suite (jsdom, no network). */
import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('android/assets/assistant.html', 'utf8');
const kb = fs.readFileSync('android/assets/tiva_knowledge.js', 'utf8');
const aliases = fs.readFileSync('android/assets/tiva_app_aliases.js', 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const APPS = [
  { label: 'Telegram', pkg: 'org.telegram.messenger', sys: false },
  { label: 'Bale', pkg: 'ir.bale.messenger', sys: false },
  { label: 'blu', pkg: 'ir.blu.messenger', sys: false },
  { label: 'Rubika', pkg: 'ir.rubika.main', sys: false },
  { label: 'Chrome', pkg: 'com.android.chrome', sys: false },
  { label: 'Gallery', pkg: 'com.miui.gallery', sys: false },
  { label: 'Camera', pkg: 'com.android.camera', sys: false },
  { label: 'Settings', pkg: 'com.android.settings', sys: true },
  { label: 'Myket', pkg: 'ir.mservices.market', sys: false },
  { label: 'فارسی', pkg: 'ir.demo.vault', sys: false }
];
const DEVICE = {
  battery: 78, ramTotal: 6144, ramAvail: 2150, ramUsed: 3994,
  storageTotal: 120, storageFree: 38.6, storageUsed: 81.4,
  cpuTemp: 41, batteryTemp: 35, status: 'شارژ', health: 'خوب', voltage: 4210, apps: 10, model: 'Redmi Note 8 Pro'
};
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'https://local.test/',
  pretendToBeVisual: true,
  beforeParse(w) {
    w.__calls = [];
    const ok = () => '{"ok":true}';
    w.TivaNative = {
      listApps: () => JSON.stringify(APPS),
      deviceInfo: () => JSON.stringify(DEVICE),
      permissions: () => JSON.stringify({ overlay: true, accessibility: true, batteryOpt: true, notifications: true }),
      isFloating: () => false,
      version: () => '1.0.2',
      vaultList: () => '[]',
      vaultStatus: () => '{}',
      setBubble: ok,
      openApp: (p) => { w.__calls.push(['openApp', p]); return ok(); },
      appInfo: (p) => { w.__calls.push(['appInfo', p]); return ok(); },
      openAppInfo: (p) => { w.__calls.push(['openAppInfo', p]); return ok(); },
      openMediaPicker: (t) => { w.__calls.push(['openMediaPicker', t]); return ok(); },
      openFilePicker: () => { w.__calls.push(['openFilePicker']); return ok(); },
      openCamera: () => { w.__calls.push(['openCamera']); return ok(); },
      deleteMedia: (u) => { w.__calls.push(['deleteMedia', u]); return '{"ok":false,"message":"نیازمند تأیید سیستم"}'; },
      uninstallApp: (p) => { w.__calls.push(['uninstallApp', p]); return ok(); },
      composeMessage: (p, c, m) => { w.__calls.push(['composeMessage', p, c, m]); return '{"started":true}'; },
      flashlight: ok,
      openSettings: (k) => { w.__calls.push(['openSettings', k]); },
      searchWeb: (q) => { w.__calls.push(['searchWeb', q]); return ok(); },
      resolveContact: (c) => { w.__calls.push(['resolveContact', c]); return ok(); },
      setAlarm: (h, m) => { w.__calls.push(['setAlarm', h, m]); return ok(); },
      setTimer: (s) => { w.__calls.push(['setTimer', s]); return ok(); },
      copyText: () => {}, startVoice: () => {}, closeOverlayChat: () => {}, openFullApp: () => {},
      confirmAction: () => {}, requestVaultUnlock: () => {}, lockVault: () => {}
    };
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    w.scrollTo = () => {};
  }
});
const w = dom.window;
w.eval(kb);
w.eval(aliases);
w.eval(inline);
await new Promise((r) => setTimeout(r, 300));
const T = w.__tivaTest;
const fakeEl = { querySelector: () => null, insertAdjacentHTML: () => {} };
let fail = 0;
function check(name, fn) {
  let ok = false, extra = '';
  try { const out = fn(); ok = out === true || (out && out.ok === true); if (out && out.extra) extra = out.extra; }
  catch (e) { extra = e.message; }
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
}
function parse(text) { return T.parseCommand(text); }

/* ---- 1. noon window 12..16 ---- */
check('ظهر ۲ → 14:00', () => { const r = parse('ساعت ۲ ظهر بیدارم کن'); return { ok: r.type === 'alarm' && r.payload.hour === 14 && r.payload.minute === 0, extra: JSON.stringify(r.payload) }; });
check('ظهر ۱۲ → 12:00', () => { const r = parse('ساعت ۱۲ ظهر آلارم بذار'); return { ok: r.type === 'alarm' && r.payload.hour === 12, extra: JSON.stringify(r.payload) }; });
check('بعد از ظهر ۳ → 15:00', () => { const r = parse('ساعت ۳ بعد از ظهر بیدارم کن'); return { ok: r.type === 'alarm' && r.payload.hour === 15, extra: JSON.stringify(r.payload) }; });
check('۶:۳۰ صبح ثابت مانده', () => { const r = parse('آلارم ساعت 6:30 بذار'); return { ok: r.type === 'alarm' && r.payload.hour === 6 && r.payload.minute === 30 }; });

/* ---- 2. camera ---- */
check('یه عکس بگیر → دوربین', () => { const r = parse('یه عکس بگیر'); return { ok: r.type === 'camera', extra: r.reply }; });
check('عکس گرفتن به دوربین می‌رسد', () => {
  w.__calls.length = 0; T.execute(fakeEl, parse('یه عکس بگیر'));
  return { ok: w.__calls.some((c) => c[0] === 'openCamera'), extra: JSON.stringify(w.__calls) };
});
check('حذف عکس همچنان picker است', () => { const r = parse('عکس‌های گالری رو حذف کن'); return { ok: r.type === 'mediaPicker' }; });

/* ---- 3. slow phone / free RAM are honest ---- */
check('گوشی کند شده → گزارش + مدیریت برنامه‌ها', () => {
  const r = parse('گوشی کند شده');
  return { ok: r.type === 'slowDevice' && r.payload === 'apps', extra: r.reply.slice(0, 70) };
});
check('رم رو آزاد کن → ادعای آزادسازی نمی‌کند', () => {
  const r = parse('رم رو آزاد کن');
  return { ok: r.type === 'slowDevice' && /اجازه نمی‌دهد/.test(r.reply) && !/آزاد شد/.test(r.reply), extra: r.reply.slice(0, 80) };
});
check('اجرای رم آزاد → settings apps', () => {
  w.__calls.length = 0; T.execute(fakeEl, parse('رم رو آزاد کن'));
  return { ok: w.__calls.some((c) => c[0] === 'openSettings' && c[1] === 'apps'), extra: JSON.stringify(w.__calls) };
});

/* ---- 4. regressions kept from 1.0.1 ---- */
check('تلگرام باز', () => { const r = parse('تلگرام رو باز کن'); return { ok: r.type === 'openApp' && /telegram/i.test(r.app.pkg) }; });
check('بله باز', () => { const r = parse('بله رو باز کن'); return { ok: r.type === 'openApp' && /bale/i.test(r.app.pkg) }; });
check('گوشی گرمه → دما', () => { const r = parse('گوشی گرمه'); return { ok: r.type === 'temp' }; });
check('کشور ایران → هیچ عملیات', () => { const r = parse('کشور ایران کجاست'); return { ok: r.type === 'clarify' }; });
check('کرم ضدآفتاب → هیچ عملیات', () => { const r = parse('کرم ضدآفتاب چیه'); return { ok: r.type === 'clarify' }; });
check('حذف برنامه از مسیر رسمی', () => { const r = parse('تلگرام رو حذف کن'); return { ok: r.type === 'appInfo' && /telegram/i.test(r.app.pkg) }; });

/* ---- 5. confidence gate below 0.9 never executes ---- */
check('اطمینان زیر ۰٫۹ اجرا نمی‌شود (۸۹٪ → پرسش)', () => {
  const raw = T.parseRaw('لامپ رو روشن کن');
  const r = parse('لامپ رو روشن کن');
  const gated = r.type === 'clarify' && /۹۰٪/.test(r.reply) && raw.confidence < 0.9;
  return { ok: gated, extra: `raw=${raw.type}@${raw.confidence} -> ${r.type} | ${r.reply.slice(0, 50)}` };
});
check('اطمینان بالا اجرا می‌شود (آلارم ۶:۳۰)', () => {
  const r = parse('آلارم ساعت 6:30 بذار');
  return { ok: r.type === 'alarm' && r.confidence >= 0.9, extra: String(r.confidence) };
});

/* ---- 6. aliases resolve (never guesses package names) ---- */
const aliasObj = w.TIVA_APP_ALIASES || {};
check('aliasها بارگذاری شده‌اند', () => ({ ok: Object.keys(aliasObj).length >= 100, extra: `${Object.keys(aliasObj).length} aliases` }));
const mustOpen = ['تلگرام', 'بله', 'بلو', 'روبیکا', 'مایکت', 'بازار', 'کروم', 'فایرفاکس', 'گوگل', 'یوتیوب', 'اینشات', 'ترمکس', 'vlc', 'chatgpt', 'کلود', 'جمینای'];
for (const name of mustOpen) {
  check(`alias «${name}» کرش نمی‌کند و مسیر برنامه را می‌گیرد`, () => {
    const r = parse(`${name} رو باز کن`);
    return { ok: ['openApp', 'clarify', 'camera', 'settings'].includes(r.type), extra: r.type };
  });
}
check('telegram دوگانه → شفاف‌سازی بین دو نسخه', () => {
  const original = T.apps();
  T.setApps([...original, { label: 'Telegram', pkg: 'org.telegram.messenger.u0', sys: false }]);
  const r = parse('تلگرام رو باز کن');
  T.setApps(original);
  return { ok: r.type === 'clarify', extra: `${r.type} | ${(r.clarify || []).join(' / ')}` };
});

/* ---- 7. dataset gates ---- */
const K = JSON.parse(kb.match(/window\.TIVA_KB=(\{.*\})\s*;/s)[1]);
const counts = {};
for (const e of K.examples) counts[e.intent] = (counts[e.intent] || 0) + 1;
const dup = K.examples.length - new Set(K.examples.map((e) => e.text.replace(/\u200c/g, ' '))).size;
const min = Math.min(...Object.values(counts));
const max = Math.max(...Object.values(counts));
check('دیتاست: ≥۳۰۰ نمونه برای هر کلاس', () => ({ ok: min >= 300, extra: `min=${min}` }));
check('دیتاست: سقف ۸۲۰ نمونه برای هر کلاس', () => ({ ok: max <= 820, extra: `max=${max}` }));
check('دیتاست: صفر تکرار', () => ({ ok: dup === 0, extra: `dup=${dup}` }));
check('دیتاست: منفی‌های بیشتر ≥۵۰۰', () => ({ ok: (counts.negative || 0) >= 500, extra: `negative=${counts.negative}` }));
check('دیتاست: compose_message متوازن‌شده', () => ({ ok: (counts.compose_message || 0) <= 820, extra: `compose=${counts.compose_message}` }));
check('دیتاست: کل کلاس‌ها ≥۳۰', () => ({ ok: Object.keys(counts).length >= 30, extra: `${Object.keys(counts).length} classes / ${K.examples.length} examples` }));

console.log(fail ? `\n${fail} FAILED` : '\nALL v1.0.2 TESTS PASSED');
process.exit(fail ? 1 : 0);
