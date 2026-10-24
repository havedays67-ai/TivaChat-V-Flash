/* TivaChat V Flash — v1.0.3 regression suite: browser writing, direct alarm, × bubble, dataset quality. */
import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('android/assets/assistant.html', 'utf8');
const kb = fs.readFileSync('android/assets/tiva_knowledge.js', 'utf8');
const aliases = fs.readFileSync('android/assets/tiva_app_aliases.js', 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const APPS = [
  { label: 'Chrome', pkg: 'com.android.chrome', sys: false },
  { label: 'Telegram', pkg: 'org.telegram.messenger', sys: false },
  { label: 'Bale', pkg: 'ir.bale.messenger', sys: false },
  { label: 'Camera', pkg: 'com.android.camera', sys: false },
  { label: 'Myket', pkg: 'ir.mservices.market', sys: false }
];
const DEVICE = { battery: 78, ramTotal: 6144, ramAvail: 2150, ramUsed: 3994, storageTotal: 120, storageFree: 38.6, storageUsed: 81.4, cpuTemp: 41, batteryTemp: 35, status: 'شارژ', health: 'خوب', voltage: 4210, apps: 5, model: 'Redmi Note 8 Pro' };
const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'https://local.test/', pretendToBeVisual: true,
  beforeParse(w) {
    w.__calls = [];
    const ok = () => '{"ok":true}';
    w.TivaNative = {
      listApps: () => JSON.stringify(APPS), deviceInfo: () => JSON.stringify(DEVICE),
      permissions: () => JSON.stringify({ overlay: true, accessibility: true, batteryOpt: true, notifications: true }),
      isFloating: () => false, version: () => '1.0.3', vaultList: () => '[]', vaultStatus: () => '{}',
      setBubble: ok,
      openApp: (p) => { w.__calls.push(['openApp', p]); return ok(); },
      typeIntoApp: (t) => { w.__calls.push(['typeIntoApp', t]); return ok(); },
      setAlarmDirect: (h, m) => { w.__calls.push(['setAlarmDirect', h, m]); return ok(); },
      setAlarm: (h, m) => { w.__calls.push(['setAlarm', h, m]); return ok(); },
      setTimer: (s) => { w.__calls.push(['setTimer', s]); return ok(); },
      openCamera: ok, appInfo: ok, openAppInfo: ok, flashlight: ok,
      openMediaPicker: ok, openFilePicker: ok, openSettings: (k) => { w.__calls.push(['openSettings', k]); },
      searchWeb: (q) => { w.__calls.push(['searchWeb', q]); return ok(); },
      composeMessage: (p, c, m) => { w.__calls.push(['composeMessage', p, c, m]); return '{"started":true}'; },
      resolveContact: (c) => { w.__calls.push(['resolveContact', c]); return ok(); },
      copyText: () => {}, startVoice: () => {}, closeOverlayChat: () => {}, openFullApp: () => {},
      confirmAction: () => {}, requestVaultUnlock: () => {}, lockVault: () => {}
    };
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    w.scrollTo = () => {};
  }
});
const w = dom.window;
w.eval(kb); w.eval(aliases); w.eval(inline);
await new Promise((r) => setTimeout(r, 300));
const T = w.__tivaTest;
const fakeEl = { querySelector: () => null, insertAdjacentHTML: () => {} };
let fail = 0;
function check(name, fn) {
  let ok = false, extra = '';
  try { const out = fn(); ok = out === true || (out && out.ok === true); extra = (out && out.extra) || ''; }
  catch (e) { extra = e.stack?.split('\n')[0] || e.message; }
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
}
const parse = (t) => T.parseCommand(t);

/* ---- ۱. «کروم رو باز کن و بنویس google ai studio» باید تایپ کند، نه تماس/مخاطب ---- */
for (const text of [
  'کروم رو باز کن و بنویس google ai studio',
  'کروم رو باز کن و بنویس google ai studuo',
  'برو کروم و تایپ کن google ai studio',
  'کروم باز کن و تایپ کن google ai studio',
  'مرورگر رو باز کن و بنویس google ai studio'
]) {
  check(`مسیر نوشتن در مرورگر: ${text}`, () => {
    w.__calls.length = 0;
    const r = parse(text);
    T.execute(fakeEl, r);
    const opened = w.__calls.find((c) => c[0] === 'openApp');
    const typed = w.__calls.find((c) => c[0] === 'typeIntoApp');
    const contact = w.__calls.find((c) => c[0] === 'resolveContact');
    const composed = w.__calls.find((c) => c[0] === 'composeMessage');
    const isBrowser = /chrome/i.test(text);
    const okAll = contact === undefined && composed === undefined && (
      isBrowser
        ? r.type === 'openThenWrite' && /chrome/i.test(opened?.[1] || '') && typed && /google ai stud/i.test(typed[1])
        : (r.type === 'openThenWrite' || r.type === 'search')
    );
    return { ok: okAll, extra: `${r.type} | open=${opened?.[1]} type=${typed?.[1]}` };
  });
}

/* ---- ۲. پیام واقعی در پیام‌رسان باید همچنان compose بماند ---- */
check('پیام واقعی تلگرام همچنان compose است', () => {
  const r = parse('تلگرام رو باز کن و به علی بنویس سلام');
  return { ok: r.type === 'compose' || r.type === 'clarify', extra: r.type };
});
check('پیام‌رسان بدون مخاطب، مخاطب نمی‌سازد', () => {
  const r = parse('تلگرام رو باز کن و بنویس سلام');
  const compose = r.type === 'compose';
  const contactIsPhrase = compose && /google|studio|https?/i.test(r.payload?.contact || '');
  return { ok: !contactIsPhrase, extra: r.type };
});

/* ---- ۳. «بنویس» بدون متن: سؤال، نه تماس ---- */
check('بنویس بدون متن → سؤال و بدون تماس', () => {
  w.__calls.length = 0;
  const r = parse('کروم رو باز کن و بنویس');
  return { ok: r.type === 'clarify' && w.__calls.length === 0, extra: r.type };
});

/* ---- ۴. آلارم بدون پرسش و با پل مستقیم ---- */
check('آلارم ۶:۳۰ با setAlarmDirect اجرا می‌شود', () => {
  w.__calls.length = 0;
  T.execute(fakeEl, parse('آلارم ۶:۳۰ بذار'));
  const direct = w.__calls.find((c) => c[0] === 'setAlarmDirect');
  const legacy = w.__calls.find((c) => c[0] === 'setAlarm');
  return { ok: !!direct && direct[1] === 6 && direct[2] === 30 && !legacy, extra: JSON.stringify(w.__calls) };
});
check('آلارم ۲ ظهر → ۱۴:۰۰ مستقیم', () => {
  w.__calls.length = 0;
  T.execute(fakeEl, parse('ساعت ۲ ظهر بیدارم کن'));
  const direct = w.__calls.find((c) => c[0] === 'setAlarmDirect');
  return { ok: !!direct && direct[1] === 14, extra: JSON.stringify(w.__calls) };
});
check('آلارم بدون ساعت، پرسش می‌کند (نه آلارم پیش‌فرض ۷)', () => {
  const r = parse('آلارم بذار');
  return { ok: r.type === 'clarify', extra: r.type };
});

/* ---- ۵. رگرسیون ۱.۰.۱/۱.۰.۲ ---- */
check('حذف عکس همچنان انتخاب‌گر است', () => ({ ok: parse('عکس‌های گالری رو حذف کن').type === 'mediaPicker' }));
check('یه عکس بگیر ← دوربین', () => ({ ok: parse('یه عکس بگیر').type === 'camera' }));
check('گوشی کند شده ← گزارش صادقانه', () => ({ ok: parse('گوشی کند شده').type === 'slowDevice' }));
check('رم رو آزاد کن ← بدون ادعا', () => ({ ok: /اجازه نمی‌دهد/.test(parse('رم رو آزاد کن').reply) }));
check('کشور ایران ← بدون عملیات', () => ({ ok: parse('کشور ایران کجاست').type === 'clarify' }));

/* ---- ۶. کیفیت دیتاست (نرمال‌سازی، تکرار نزدیک، توازن) ---- */
const K = JSON.parse(kb.match(/window\.TIVA_KB=(\{.*\})\s*;/s)[1]);
function normalize(t) {
  return t.toLowerCase().replace(/\u200c/g, ' ').replace(/[يى]/g, 'ی').replace(/[ك]/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
}
function signature(t) {
  const toks = normalize(t).split(' ');
  const uni = [...new Set(toks)].sort();
  const bi = [...new Set(toks.slice(1).map((x, i) => `${toks[i]}_${x}`))].sort();
  return [...uni, ...bi].join('|');
}
const counts = {};
for (const e of K.examples) counts[e.intent] = (counts[e.intent] || 0) + 1;
const exact = K.examples.length - new Set(K.examples.map((e) => normalize(e.text))).size;
const sigs = new Set(K.examples.map((e) => signature(e.text)));
const near = K.examples.length - sigs.size;
const min = Math.min(...Object.values(counts));
const max = Math.max(...Object.values(counts));
check('دیتاست: صفر تکرار دقیق', () => ({ ok: exact === 0, extra: `exact=${exact}` }));
check('دیتاست: صفر تکرار نزدیک', () => ({ ok: near === 0, extra: `near=${near}` }));
check('دیتاست: حداقل ۳۰۰ نمونه هر کلاس', () => ({ ok: min >= 300, extra: `min=${min}` }));
check('دیتاست: حداکثر ۸۲۰ نمونه هر کلاس', () => ({ ok: max <= 820, extra: `max=${max}` }));
check('دیتاست: کلاس نوشتن در برنامه وجود دارد', () => ({ ok: (counts.type_in_app || 0) >= 25, extra: `type_in_app=${counts.type_in_app}` }));
check('دیتاست: منفی‌های واقعی', () => ({ ok: (counts.negative || 0) >= 500, extra: `negative=${counts.negative}` }));
check('دیتاست: جمله‌های حساس موجودند', () => {
  const texts = K.examples.map((e) => v => 0);
  const all = K.examples.map((e) => e.text);
  const needed = ['کروم رو باز کن و بنویس google ai studio'];
  return { ok: needed.every((n) => all.includes(n)), extra: `${all.length} examples / ${Object.keys(counts).length} classes` };
});

const native = fs.readFileSync('android/java/ir/tivachat/flash/OverlayService.java', 'utf8');
check('آیکون شناور × حذف دارد', () => ({ ok: /setText\("×"\)/.test(native) && /stopEverything\(\)/.test(native) }));
const manifest = fs.readFileSync('android/AndroidManifest.xml', 'utf8');
check('مانیفست ۱.۰.۳ / versionCode 6', () => ({ ok: /versionName="1.0.3"/.test(manifest) && /versionCode="6"/.test(manifest) }));
check('مجوز SET_ALARM', () => ({ ok: /com\.android\.alarm\.permission\.SET_ALARM/.test(manifest) }));

console.log(fail ? `\n${fail} FAILED` : '\nALL v1.0.3 TESTS PASSED');
process.exit(fail ? 1 : 0);
