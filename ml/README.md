# TivaChat V Flash — trained intent classifier & dataset

This folder is the transparent, reproducible training material behind the
on-device **intent classifier** inside TivaChat V Flash 1.0.0 (build 3).
It is published for review. The APK contains the quantized model, not the
training scripts.

## What the model is — and is not

- **Architecture:** signed feature hashing (word unigrams, word bigrams,
  character 3–5 grams) → linear softmax, **3,932,180 int8 parameters**.
- **Classes:** 20 supported intents.
- **Quantization:** per-class symmetric int8; model file 3,932,160 bytes.
- **Not** a generative LLM, not a chatbot, not TFLite, not a transformer.
- It proposes an intent. The **Safety Guard and rule layer** decide whether an
  action is allowed; message sending is never automatic.

## Dataset

- 14,858 **training** examples, 3,195 **template-held-out test** examples.
- Dominant classes were capped; inverse-frequency class weights were used.
- Persian normalization: ي/ی، ك/ک، ZWNJ, Persian/Arabic digits, punctuation.
- Duplicate normalized sentences removed; no template appears in both splits.
- A separate **32-sentence novel test set** was written by hand and never
  trained on.

Files:

| file | purpose |
|---|---|
| `train_model.py` | reproducible NumPy training, dedupe, split, quantization |
| `dataset_train.jsonl` | balanced training split |
| `dataset_test.jsonl` | template-held-out test split |
| `label_map.json` | label → class index |
| `metrics.json` | params, counts, accuracy, per-class accuracy, novel failures |
| `tiva_model.bin` | int8 weights, row-major, included for verification |
| `tiva_model_meta.json` | labels, scales, bias, metrics |
| `test/InferenceTest.java` | JVM parity test against the Android classifier |
| `test/java_predictions.txt` | sample predictions from the Java implementation |

## Results (honest)

- Template-held-out test accuracy: **100%** (3,195 examples). This is a
  synthetic, curated dataset; the number is not a guarantee for arbitrary
  human speech.
- Separate novel hand-written test: **93.75%** (30/32). Two failures:
  battery/device_all ambiguity and one negative phrase.
- After int8 quantization, **107,139 weights are non-zero** (2.7% of the
  allocated 3.93M tensor). The rest are zeroed by the quantizer.

## Rebuild

```bash
python3 -m pip install numpy
python3 ml/train_model.py
# outputs android/assets/tiva_model.bin + tiva_model_meta.json
```

The Java inference must mirror the Python normalizer and FNV-1a hashing
exactly. `ml/test/InferenceTest.java` checks this on a JVM.


## درخواست «۱۰ میلیون پارامتر» — تحلیل صادقانه

پیکربندی آزمایشی در `ml/model_config_10m.json` قرار دارد (`TIVA_DIM=500000` × ۲۰ کلاس).

- در معماری hashing خطی، «پارامتر» یعنی خانهٔ آدرس‌پذیر؛ با ~۱۷ هزار نمونه فقط بخش کوچکی
  از این ۱۰ میلیون خانه مقدار مؤثر می‌گیرد و بقیه صفر می‌مانند.
- افزایش ظرفیت، کمبود داده را جبران نمی‌کند. مسیر درست: جمع‌آوری ≥۱۰۰ هزار نمونهٔ واقعی و
  غیرقالبی، آزمون جداگانه با گویش‌های مختلف، و گزارش دقت روی جملات تازه (نه قالب آموزشی).
- هزینه: ۱۰ میلیون وزن int8 = ۱۰ مگابایت، بیش از ۲۵ برابر مدل فعلی (۳٫۹ مگابایت) بدون شاهد
  بر بهبود دقت در این حجم داده. تا سنجش واقعی، مدل منتشرشده همان ۱۹۶٬۶۰۸ بُعدی می‌ماند.
- عدد دقت هیچ نسخهٔ جدیدی بدون اجرای واقعی آزمون گزارش نمی‌شود.
