#!/usr/bin/env python3
"""Train a small, honest Persian intent classifier for TivaChat V Flash.

Architecture: hashed n-gram features -> linear softmax (multinomial logistic
regression), quantized to int8. It is NOT an LLM and does not generate text.
This script writes:
  android/assets/tiva_model.bin       int8 weights (C x D)
  android/assets/tiva_model_meta.json labels, scales, bias, metrics
  ml/dataset_train.jsonl / dataset_test.jsonl
  ml/metrics.json
"""
import json, re, random, math, hashlib, os
from pathlib import Path
import numpy as np

random.seed(1404)
np.random.seed(1404)
ROOT = Path(__file__).resolve().parents[1]
KB_FILE = ROOT / 'android/assets/tiva_knowledge.js'
OUT_ASSETS = ROOT / 'android/assets'
OUT_ML = ROOT / 'ml'
DIM = int(os.environ.get("TIVA_DIM", "196608"))   # default 192*1024; TIVA_DIM=500000 -> 10M params for 20 classes
LABELS = ['open_app','close_app','battery','ram','storage','temperature','device_all',
          'flashlight_on','flashlight_off','settings_wifi','settings_bluetooth','alarm',
          'timer','call','sms','search','compose_message','greeting','thanks','negative']
L2I = {l:i for i,l in enumerate(LABELS)}

FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

def norm(text: str) -> str:
    text = str(text or '')
    text = text.replace('ي','ی').replace('ك','ک').replace('ۀ','ه').replace('ة','ه')
    text = text.replace('أ','ا').replace('إ','ا').replace('آ','ا').lower()
    text = re.sub('[\u064B-\u0652\u0640\u200c\u200d]', ' ', text)
    text = ''.join(str(FA_DIGITS.index(c)) if c in FA_DIGITS else (str(AR_DIGITS.index(c)) if c in AR_DIGITS else c) for c in text)
    text = re.sub('[^0-9a-z\u0600-\u06FF\\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def feature_strings(text: str):
    text = norm(text)
    tokens = [t for t in text.split(' ') if t]
    tokens = tokens[:26]
    feats = []
    for t in tokens:
        feats.append('w:' + t)
    for a,b in zip(tokens, tokens[1:]):
        feats.append('b:' + a + '_' + b)
    for t in tokens:
        padded = '^' + t + '$'
        for n in (3,4,5):
            if len(padded) >= n:
                for i in range(len(padded)-n+1):
                    feats.append('c%d:' % n + padded[i:i+n])
    # Presence-only features keep Java/Python identical and fast.
    return list(dict.fromkeys(feats))[:260]

def fnv1a(s: str) -> int:
    h = 2166136261
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 16777619) & 0xffffffff
    return h

def vectorize(text: str):
    idx = []
    for f in feature_strings(text):
        h = fnv1a(f)
        idx.append((h % DIM, 1.0 if ((h >> 16) & 1) else -1.0))
    return idx

def load_kb():
    raw = KB_FILE.read_text(encoding='utf-8')
    m = re.search(r'window\.TIVA_KB\s*=\s*(\{.*\})\s*;?', raw, re.S)
    return json.loads(m.group(1))

KB = load_kb()
APPS = ['تلگرام','واتساپ','اینستاگرام','کروم','یوتیوب','گوگل','جی میل','جیمیل','نقشه گوگل','مایکت','بازار',
        'روبیکا','بله','بلو','بلد','شاد','لینکدین','اسپاتیفای','توییتر','تلگرام ایکس','پلی استور','گوگل پلی',
        'دوربین','گالری','تنظیمات','ماشین حساب','تقویم','هواشناسی','ضبط صدا','اسکنر','دانلودها','ساعت',
        'یادداشت','موسیقی','مدیر فایل','ترجمه','فایرفاکس','اپرا مینی','وایبر','اسکایپ','دیسکورد','تلگرام وب',
        'همراه بانک','همراه من','ایرانسل من','قبضینو','شاد','دیپ سیک','کلود','جمینای','چت جی پی تی','تیواچت']
ALIASES = list(KB.get('aliases',{}).keys()) + APPS
CONTACTS = ['علی','سارا','مینا','رضا','مامان','بابا','مدیر','مریم','امیر','نگار','حسین','فاطمه','شرکت','گروه خانواده']
MESSAGES = ['سلام','رسیدم','فردا میبینمت','تماس بگیر','جلسه ساعت ۱۰','دیر می‌رسم','ممنون','حالم خوبه','کجایی','صبخ بخیر','تایید شد']
PREFIX = ['', 'لطفا ', 'میخوام ', 'می‌خوام ', 'سریع ', 'برام ', 'میشه ', 'یک بار ', 'الان ']
SUFFIX = ['', ' لطفا', ' سریع', ' الان', ' برام', ' تو گوشی', ' دیگه']

def add(bucket, label, text):
    t = text.strip()
    if 3 <= len(norm(t)) <= 140:
        bucket.append((label, re.sub(r'\s+',' ',t)))

base = []
# ---------- open app ----------
open_pat = ['{a} رو باز کن','{a} را باز کن','برو تو {a}','{a} رو بیار','میخوام {a} ببینم','{a} باز بشه',
            'لطفا {a} باز کن','{a} اجرا کن','{a} باز کن','وارد {a} شو','{a} رو اجرا کن','{a} رو باز کن لطفا',
            '{a} کجاست بازش کن',' سریع {a} رو باز کن']
for a in ALIASES:
    for p in open_pat:
        add(base,'open_app',p.replace('{a}',a))
# ---------- close app ----------
for a in ['تلگرام','کروم','واتساپ','اینستاگرام','گالری','تنظیمات','بازی']:
    for p in ['{a} رو ببند','{a} را ببند','از {a} بیا بیرون','{a} بسته بشه','بستن {a}','بیا بیرون از {a}']:
        add(base,'close_app',p.replace('{a}',a))
for p in ['ببند','ببندش','بیا بیرون','خروج از برنامه','برگرد به خانه','بستن برنامه','برو خانه','صفحه اصلی']:
    add(base,'close_app',p)
# ---------- device ----------
for p in KB['patterns']['battery'] + ['چند درصد باتری','وضعیت شارژ','باتری','شارژ چقدره','درصد شارژ']:
    add(base,'battery',p)
for p in KB['patterns']['ram'] + ['رم','حافظه موقت','رم گوشی','رم آزاد چقدره']:
    add(base,'ram',p)
for p in KB['patterns']['storage'] + ['حافظه','فضا','استوریج','چقدر فضا دارم','حافظه داخلی']:
    add(base,'storage',p)
for p in KB['patterns']['temperature'] + ['دما','دمای گوشی','حرارت','گرم شده','دمای باتری']:
    add(base,'temperature',p)
for p in KB['patterns']['device_all'] + ['گزارش کامل','وضعیت گوشی','اطلاعات کامل گوشی','همه چیز','گزارش دستگاه']:
    add(base,'device_all',p)
# ---------- flashlight ----------
for p in KB['patterns']['flash_on'] + ['چراغ قوه','نور','فلش','روشنایی چراغ','چراغ گوشی']:
    add(base,'flashlight_on',p)
for p in KB['patterns']['flash_off'] + ['چراغ قوه خاموش','فلش خاموش','نور رو ببند']:
    add(base,'flashlight_off',p)
# ---------- settings ----------
for p in KB['patterns']['wifi_settings'] + ['وای فای','wifi','اتصال وای فای','شبکه بی سیم']:
    add(base,'settings_wifi',p)
for p in KB['patterns']['bluetooth_settings'] + ['بلوتوث','هندزفری','دستگاه بلوتوث']:
    add(base,'settings_bluetooth',p)
# ---------- time ----------
for p in KB['patterns']['alarm'] + ['آلارم','ساعت بیدار','بیدارم کن','زنگ ساعت']:
    add(base,'alarm',p)
for p in KB['patterns']['timer'] + ['تایمر','زمان سنج','شمارش معکوس']:
    add(base,'timer',p)
# ---------- calls/sms ----------
for p in KB['patterns']['call'] + ['تماس','زنگ بزن','شماره گیری','تماس بگیر']:
    add(base,'call',p)
for p in KB['patterns']['sms'] + ['پیامک','اس ام اس','sms','پیام کوتاه']:
    add(base,'sms',p)
# ---------- search ----------
for p in KB['patterns']['search'] + ['جستجو','سرچ','گوگل','جستجو کن','توی گوگل بگرد','دنبال چیزی بگرد']:
    add(base,'search',p)
# ---------- compose ----------
for app in ['تلگرام','واتساپ','اینستاگرام','روبیکا','بله','تلگرام ایکس']:
    for c in CONTACTS:
        for m in MESSAGES:
            for p in ['{app} رو باز کن و به {c} بنویس {m}','برو {app} و در پیام های شخصی بنویس {m}',
                      '{app} رو باز کن و برای {c} پیام بنویس {m}','سلام {app} باز کن به {c} بگو {m}',
                      '{app} رو باز کن و به {c} پیام بده {m}']:
                add(base,'compose_message',p.format(app=app,c=c,m=m))
for p in ['تلگرام رو باز کن و در پیام های شخصی بنویس سلام','تنها در پیام های شخصی بنویس سلام',
          'پیام بده به علی','برام پیام بنویس','توی چت سلام بنویس']:
    add(base,'compose_message',p)
# ---------- conversation ----------
for p in ['سلام','درود','صبح بخیر','شب بخیر','وقت بخیر','خوبی','چطوری','حالت چطوره','سلام خوبی']:
    add(base,'greeting',p)
for p in ['ممنون','مرسی','دستت درد نکنه','لطف کردی','دمت گرم']:
    add(base,'thanks',p)
# ---------- negative ----------
NEG = ['برام قهوه بپز','قیمت دلار امروز','یک شعر بگو','گوشی من جادو میکنه','این جمله هیچ دستوری نیست',
       'امروز هوا خوبه','اسم تو چیه','تعطیلات کجا بریم','دو دوتا چهارتا','برام لطیفه بگو',
       'آخرالزمان کی است','چرا آسمان آبی است','میخوام سفر کنم','فیلم ببینیم','بازی کنیم',
       'شام چی بخوریم','تو کی هستی','چه خبر','خسته نباشی','حوصله ندارم','دلم گرفته',
       'چی کار کنم','بگو ببینم','اینو میفهمی','داستان بخون','شعر بگو','معنی زندگی چیست',
       'الان ساعت چنده','فردا چه روزیه','هفته چندمه','تقویم چی میگه']
for p in NEG:
    add(base,'negative',p)
# ---------- augmentation ----------
aug = list(base)
for label,text in base:
    for pre in PREFIX:
        for suf in SUFFIX:
            if random.random() < 0.42:
                t = (pre + text + suf).strip()
                add(aug,label,t)
# small spelled/typo/no-space and fEnglish variants
for label,text in list(aug):
    if random.random() < 0.08:
        add(aug,label,text.replace(' ', ' ' if random.random()<.5 else '  '))
    if random.random() < 0.05 and 'باز' in text:
        add(aug,label,text.replace('باز','بزن'))

# ---------- hold-out by template, not by sentence ----------
def template_key(label, text):
    t = norm(text)
    for a in sorted(ALIASES, key=len, reverse=True):
        t = t.replace(norm(a), '{app}')
    for c in CONTACTS:
        t = t.replace(norm(c), '{contact}')
    for m in MESSAGES:
        t = t.replace(norm(m), '{msg}')
    t = re.sub(r'\b\d+\b', '{n}', t)
    return label + '|' + t

# ---------- clean ----------
seen = {}
for label,text in aug:
    n = norm(text)
    if not n or len(n) < 3:
        continue
    if n in seen:
        if seen[n][0] == label:
            continue
        # conflicting label: keep the first, drop ambiguity
        continue
    seen[n] = (label, text.strip())
items = [(lbl,txt) for (lbl,txt) in seen.values()]
random.shuffle(items)
groups = {}
for lbl,txt in items:
    groups.setdefault(template_key(lbl,txt), []).append((lbl,txt))
keys = list(groups.keys()); random.shuffle(keys)
n_test_groups = max(1, int(len(keys)*0.20))
test_keys = set(keys[:n_test_groups])
train,test = [],[]
for k,rows in groups.items():
    if k in test_keys: test.extend(rows)
    else: train.extend(rows)
# balance: cap the dominant classes before training; keep the test set capped too
def cap_rows(rows, maximum, seed=1404):
    rnd = random.Random(seed)
    by = {}
    for lbl,txt in rows: by.setdefault(lbl,[]).append((lbl,txt))
    out = []
    for lbl,rs in by.items():
        rnd.shuffle(rs)
        out.extend(rs[:maximum])
    rnd.shuffle(out)
    return out
train = cap_rows(train, 5000, 1404)
test = cap_rows(test, 1000, 1405)
random.shuffle(train); random.shuffle(test)
NOVEL = [
 ('open_app','میشه برام کروم رو باز کنی؟'),('open_app','تلگرامو بیار جلو'),('open_app','میخوام برم تو اینستاگرام'),
 ('open_app','واتساپو باز کن'),('open_app','بریم تو یوتیوب'),('open_app','چشمک تلگرام رو باز کن'),
 ('battery','چند درصد شارژ مونده'),('battery','وضعیت انرژی گوشی چطوره'),('ram','چقدر حافظه موقت آزاده'),
 ('storage','چقدر جای خالی داریم'),('temperature','گوشی چقدر داغ شده'),('device_all','یک گزارش کلی از گوشی بده'),
 ('flashlight_on','نور فلش رو روشن کن'),('flashlight_off','نور رو خاموش کن'),('settings_wifi','بریم تنظیمات شبکه'),
 ('settings_bluetooth','هندزفری رو وصل کن'),('alarm','ساعت شش بیدارم کن'),('timer','ده دقیقه دیگه خبرم کن'),
 ('call','به مامانم زنگ بزن'),('sms','برای مدیر پیامک بفرست'),('search','درباره هوش مصنوعی سرچ کن'),
 ('compose_message','تلگرام رو باز کن و در پیام های شخصی بنویس سلام'),
 ('compose_message','واتساپ باز کن و به مینا پیام بده رسیدم'),
 ('compose_message','برو تلگرام و برای علی بنویس فردا میبینمت'),
 ('negative','برام یک چای دم کن'),('negative','قیمت بیتکوین چنده'),('negative','یک آهنگ بخون'),
 ('negative','دلم برای تو تنگ شده'),('greeting','سلام چطوری'),('thanks','خیلی لطف کردی'),
 ('close_app','از تلگرام بیا بیرون'),('close_app','همه برنامه ها رو ببند'),
]

# ---------- save dataset ----------
def write_jsonl(path, rows):
    with open(path,'w',encoding='utf-8') as f:
        for lbl,txt in rows:
            f.write(json.dumps({'label':lbl,'text':txt},ensure_ascii=False)+'\n')
write_jsonl(OUT_ML/'dataset_train.jsonl', train)
write_jsonl(OUT_ML/'dataset_test.jsonl', test)
(OUT_ML/'label_map.json').write_text(json.dumps(L2I,ensure_ascii=False,indent=2),encoding='utf-8')
print('classes',len(LABELS),'train',len(train),'test',len(test),'dim',DIM,'params',len(LABELS)*DIM)

# ---------- train ----------
C = len(LABELS)
W = np.zeros((C,DIM),dtype=np.float32)
B = np.zeros(C,dtype=np.float32)
G2 = np.zeros((C,DIM),dtype=np.float32)
lr0 = 0.20
l2 = 1e-7

def feats_for(text):
    idx = np.array([i for i,_ in vectorize(text)],dtype=np.int32)
    sign = np.array([s for _,s in vectorize(text)],dtype=np.float32)
    return idx, sign

# inverse-frequency class weights keep minority intents from being ignored
train_counts = {l: sum(1 for x,_ in train if x==l) for l in LABELS}
total_train = max(1,len(train))
class_weight = {l: max(0.35, min(4.0, (total_train/(len(LABELS)*max(1,train_counts[l])))**0.5)) for l in LABELS}
print('balanced train counts',train_counts)
print('class weights',{k:round(v,2) for k,v in class_weight.items()})
# precompute sparse training vectors (memory is small: ~100 x 60k)
train_vec = [(L2I[l],)+feats_for(t) for l,t in train]
test_vec = [(L2I[l],)+feats_for(t) for l,t in test]
EPOCHS = 9
random.shuffle(train_vec)
for epoch in range(EPOCHS):
    lr = lr0 * (1.0 - epoch/EPOCHS*0.75)
    random.shuffle(train_vec)
    correct = 0
    for y, idx, sg in train_vec:
        if len(idx)==0: continue
        scores = B + W[:,idx].dot(sg)
        mx = scores.max()
        p = np.exp(scores-mx); p /= p.sum()
        if int(p.argmax())==y: correct += 1
        g = p.copy(); g[y] -= 1.0
        g *= class_weight[LABELS[y]]
        gw = g[:,None] * sg[None,:]
        G2[:,idx] += gw*gw
        W[:,idx] -= lr * gw / (np.sqrt(G2[:,idx]) + 1e-6) + lr*l2*W[:,idx]
        B -= lr*g
    print('epoch',epoch+1,'train_acc',round(correct/len(train_vec),4))

def predict(idx,sg):
    if len(idx)==0: return int(np.argmax(B)), B.copy()
    scores = B + W[:,idx].dot(sg)
    mx = scores.max(); p = np.exp(scores-mx); p/=p.sum()
    return int(p.argmax()), p

# quantize per class
scales = np.maximum(np.abs(W).max(axis=1)/127.0, 1e-8).astype(np.float32)
Q = np.clip(np.round(W/scales[:,None]), -127, 127).astype(np.int8)
def predict_q(idx,sg):
    if len(idx)==0: return int(np.argmax(B)), B.copy()
    scores = B + scales * Q[:,idx].astype(np.float32).dot(sg)
    mx=scores.max(); p=np.exp(scores-mx); p/=p.sum()
    return int(p.argmax()), p

correct=0; confusion={}
for y,idx,sg in test_vec:
    pred,p = predict_q(idx,sg)
    if pred==y: correct+=1
    confusion.setdefault(LABELS[y],{}).setdefault(LABELS[pred],0)
    confusion[LABELS[y]][LABELS[pred]] += 1
acc = correct/max(1,len(test_vec))
novel_rows=[]
for lbl,txt in NOVEL:
    idx,sg = feats_for(txt)
    pred,p = predict_q(idx,sg)
    novel_rows.append({'label':lbl,'text':txt,'pred':LABELS[pred],'confidence':round(float(p[pred]),4)})
novel_correct=sum(1 for r in novel_rows if r['label']==r['pred'])
novel_acc=novel_correct/max(1,len(novel_rows))
per_class={}
for lbl,row in confusion.items():
    per_class[lbl] = round(row.get(lbl,0)/max(1,sum(row.values())),4)
for lbl in LABELS:
    per_class.setdefault(lbl,0.0)
macro = sum(per_class.values())/max(1,len(per_class))
# sample latency estimate (pure python/numpy on desktop; device differs)
import time
sample=[x for x in test_vec[:120]]
t0=time.time()
for y,idx,sg in sample: predict_q(idx,sg)
lat=(time.time()-t0)/max(1,len(sample))*1000
meta = {
 'version':'1.0.0',
 'architecture':'hashed-ngram linear softmax (int8)',
 'not_an_llm':True,
 'dim':DIM,
 'classes':LABELS,
 'quant_scale':scales.tolist(),
 'bias':B.tolist(),
 'params':int(C*DIM + C),
 'train_size':len(train),
 'test_size':len(test),
 'test_accuracy':round(float(acc),4),
 'per_class_accuracy':per_class,
 'feature_types':['word unigram','word bigram','char 3-5 grams with boundaries'],
 'hashing':'FNV-1a 32-bit, signed modulo',
 'quantization':'int8 per-class symmetric',
 'desktop_latency_ms':round(lat,3),
 'notes':'Synthetic, curated Persian dataset. Test set is held out. Not a generative model.'
}
(OUT_ASSETS/'tiva_model.bin').write_bytes(Q.tobytes(order='C'))
(OUT_ASSETS/'tiva_model_meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT_ML/'metrics.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('TEMPLATE-HELDOUT ACC',round(acc,4),'MACRO',round(macro,4),'NOVEL ACC',round(novel_acc,4))
print('NOVEL FAILURES',[r for r in novel_rows if r['label']!=r['pred']])
print('model bytes', (OUT_ASSETS/'tiva_model.bin').stat().st_size, 'params',meta['params'])
print('top confusion', sorted(confusion.items())[:3])
