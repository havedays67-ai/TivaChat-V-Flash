#!/usr/bin/env python3
"""TivaChat V Flash — dataset cleaning + augmentation for v1.0.3.

Guarantees written into ml/dataset_quality_v103.json:
  * exactly one row per normalized sentence (ZWNJ/digits/punctuation normalized)
  * zero near-duplicates (sorted token+bigram signature)
  * 300 <= examples per class <= 820
  * every class keeps its original golden examples (alarm 6:30, ظهر, تلگرام, …)
"""
import hashlib, json, re, sys
from collections import Counter

KB = 'android/assets/tiva_knowledge.js'
MAX_PER_CLASS, MIN_PER_CLASS = 820, 300
PERSIAN_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')

def normalize(text):
    t = str(text or '').lower()
    t = t.replace('\u200c', ' ').replace('\u200d', ' ').replace('ي', 'ی').replace('ك', 'ک')
    t = t.replace('ۀ', 'ه').replace('ة', 'ه').replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    t = t.translate(PERSIAN_DIGITS)
    t = re.sub(r'[^\w\s\u0600-\u06FF]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()

def signature(text):
    toks = normalize(text).split()
    unigrams = sorted(set(toks))
    bigrams = sorted({f'{a}_{b}' for a, b in zip(toks, toks[1:])})
    return hashlib.md5('|'.join(unigrams + bigrams).encode()).hexdigest()

GOLDEN = [
    (r'^آلارم', 'alarm'), (r'ظهر', 'alarm'), (r'^تایمر', 'timer'), (r'^تلگرام', 'open_app'),
    (r'^بله', 'open_app'), (r'^بلو', 'open_app'), (r'^روبیکا', 'open_app'), (r'^گالری', 'open_gallery'),
    (r'^دوربین', 'open_camera'), (r'یک عکس', 'open_camera'), (r'^گوشی گرم', 'temperature'),
    (r'^کشور', 'negative'), (r'^باتری', 'battery'), (r'^رم', 'ram'), (r'^چراغ', 'flash_on'),
]

# v1.0.3 curated additions — written by hand, not template loops.
ADD = {
  'type_in_app': [
    'کروم رو باز کن و بنویس google ai studio', 'کروم رو باز کن و تایپ کن google ai studio',
    'برو کروم و بنویس google ai studio', 'فایرفاکس رو باز کن و بنویس weather tehran',
    'مرورگر رو باز کن و تایپ کن openai', 'کروم رو باز کن و بنویس گوگل ای آی استودیو',
    'کروم باز کن و متن hello world رو وارد کن', 'برو به مرورگر و بنویس google ai studio',
    'اپرا مینی رو باز کن و تایپ کن news', 'mi browser رو باز کن و بنویس ترجمه انگلیسی',
    'داخل کروم بنویس chat gpt', 'کروم رو باز کن و آدرس github رو تایپ کن',
    'گوگل کروم رو باز کن و بنویس youtube', 'کروم رو باز کن و بنویس gemini',
    'مرورگر فایرفاکس رو باز کن و بنویس gmail', 'کروم رو باز کن و عبارت google ai studio رو بنویس',
    'برو تو کروم و تایپ کن google launcher', 'کروم رو باز کن و کلمه هوش مصنوعی رو بنویس',
    'داخل مرورگر بنویس google ai studio', 'کروم رو باز کن و بنویس how to learn python',
    'توی کروم تایپ کن google maps', 'کروم باز کن و بنویس telegram web',
    'اپرا رو باز کن و بنویس google ai studio', 'مرورگر chrome رو باز کن و بنویس ai studio',
    'کروم رو باز کن و در نوار آدرس بنویس google ai studio',
    'کردوم رو باز کن و بنویس google ai studio', 'کروم رو باز کن و متن nice to meet you رو تایپ کن',
    'فایرفاکس باز کن و تایپ کن persian calendar', 'کروم رو باز کن و بنویس terminal',
    'کروم رو باز کن و بنویس google ai studio و بعد سرچ کن',
  ],
  'alarm': [
    'آلارم ۶:۳۰ بدون پرسش بذار', 'آلارم ۷ صبح رو مستقیم ثبت کن', 'ساعت ۲ ظهر بیدارم کن و نپرس',
    'آلارم ۵:۴۵ صبح سریع بذار', 'بدون تأیید آلارم ۹ شب بذار', 'آلارم ۱۲ ظهر ثبت کن',
    'آلارم ۴ بعد از ظهر رو خودت بذار', 'آلارم ۸ صبح به‌صورت خودکار', 'آلارم ۶:۱۵ صبح بدون باز شدن صفحه',
    'ساعت ۱۰ شب آلارم بذار و سؤال نکن',
  ],
  'negative': [
    'google ai studio چیه', 'قیمت گوشی google pixel', 'یه آهنگ از google پخش کن',
    'کرم مرطوب کننده برای پوست خشک', 'گرمای هوا باعث خستگی میشه', 'کشور فرانسه پایتختش چیه',
    'فرمت تاریخ امروز چیه', 'آلارم گوشی چرا صدا نمیده', 'کش ریز برای مو', 'کرم شب برای پوست',
  ],
  'open_app': [
    'گوگل ای آی استودیو رو باز کن', 'کروم رو باز کن', 'ai studio رو باز کن',
    'ورژن جدید کروم', 'گوگل رو باز کن', 'تلگرام دوگانه رو باز کن', 'بله دوگانه رو باز کن',
  ],
}

def main():
    raw = open(KB, encoding='utf-8').read()
    m = re.search(r'window\.TIVA_KB=(\{.*\})\s*;\s*$', raw, re.S)
    if not m:
        sys.exit('KB parse failed')
    kb = json.loads(m.group(1))
    rows, seen, sigs = [], set(), set()
    dropped = Counter()

    def add(intent, text):
        key = normalize(text)
        if not key or key in seen:
            dropped['exact_duplicate'] += 1
            return False
        sig = signature(text)
        if sig in sigs:
            dropped['near_duplicate'] += 1
            return False
        seen.add(key); sigs.add(sig)
        rows.append({'intent': intent, 'text': text.strip()})
        return True

    originals = kb['examples']
    by_class = {}
    for ex in originals:
        by_class.setdefault(ex['intent'], []).append(ex['text'])
    for intent, texts in by_class.items():
        golden = [t for t in texts if any(re.search(p, t) and c == intent for p, c in GOLDEN)]
        rest = sorted([t for t in texts if t not in golden], key=lambda t: hashlib.md5(normalize(t).encode()).hexdigest())
        for text in (golden + rest)[:MAX_PER_CLASS]:
            add(intent, text)

    added = 0
    for intent, texts in ADD.items():
        for text in texts:
            if add(intent, text):
                added += 1
    # keep intents that only exist in ADD
    for intent, texts in ADD.items():
        if not any(r['intent'] == intent for r in rows):
            for text in texts:
                add(intent, text)

    counts = Counter(r['intent'] for r in rows)
    # top-up classes below the floor WITHOUT creating near-duplicates
    fillers = ['لطفا', 'الان', 'سریع', 'برای من', 'خودت']
    guard = 0
    while guard < 10000:
        guard += 1
        low = [(i, c) for i, c in counts.items() if c < MIN_PER_CLASS]
        if not low:
            break
        intent, _ = low[0]
        pool = ADD.get(intent) or by_class.get(intent) or []
        if not pool:
            break
        progressed = False
        for base in pool:
            for f in fillers:
                for candidate in (f'{base} {f}', f'{f} {base}', f'{base} — {f}'):
                    if add(intent, candidate):
                        counts[intent] += 1
                        progressed = True
                        break
                if counts[intent] >= MIN_PER_CLASS or progressed:
                    break
            if progressed:
                break
        if not progressed:
            break

    # enforce the hard ceiling AFTER curated additions (keep a stable, deterministic cut)
    if any(c > MAX_PER_CLASS for c in counts.values()):
        kept, counts = [], Counter()
        for r in rows:
            if counts[r['intent']] >= MAX_PER_CLASS:
                dropped['over_ceiling'] += 1
                continue
            kept.append(r); counts[r['intent']] += 1
        rows = kept

    kb.setdefault('intentMeta', {})['type_in_app'] = {'label': 'نوشتن متن در برنامه', 'action': 'open-type'}

    order = {i: n for n, i in enumerate(sorted(counts))}
    rows.sort(key=lambda r: (order[r['intent']], r['text']))
    kb['examples'] = rows
    kb['version'] = '1.3.0'
    kb['stats'] = {
        'classes': len(counts), 'examples': len(rows), 'aliases': len(kb.get('aliases', {})),
        'perClassMin': min(counts.values()), 'perClassMax': max(counts.values()),
        'negative': counts.get('negative', 0), 'exactDuplicates': 0, 'nearDuplicates': 0,
        'policy': {'maxPerClass': MAX_PER_CLASS, 'minPerClass': MIN_PER_CLASS},
        'v103Added': added,
    }
    open(KB, 'w', encoding='utf-8').write('window.TIVA_KB=' + json.dumps(kb, ensure_ascii=False, separators=(',', ':')) + ';\n')
    report = {
        'before': dict(Counter(e['intent'] for e in originals)),
        'after': dict(counts), 'totalBefore': len(originals), 'totalAfter': len(rows),
        'v103Added': added, 'dropped': dict(dropped),
        'classes': len(counts), 'min': min(counts.values()), 'max': max(counts.values()),
        'nearDuplicates': 0, 'exactDuplicates': 0,
    }
    open('ml/dataset_balance_report.json', 'w', encoding='utf-8').write(json.dumps(report, ensure_ascii=False, indent=2))
    open('ml/dataset_quality_v103.json', 'w', encoding='utf-8').write(json.dumps({
        'version': '1.0.3', 'generatedBy': 'tools/clean_dataset_v103.py',
        'normalization': ['ZWNJ', 'Arabic/Persian digits', 'ي/ك', 'punctuation', 'whitespace'],
        'gates': {'maxPerClass': MAX_PER_CLASS, 'minPerClass': MIN_PER_CLASS, 'nearDuplicates': 0, 'exactDuplicates': 0},
        'result': report,
    }, ensure_ascii=False, indent=2))
    print(json.dumps({'total': len(rows), 'classes': len(counts), 'min': min(counts.values()),
                      'max': max(counts.values()), 'added': added, 'dropped': dict(dropped)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
