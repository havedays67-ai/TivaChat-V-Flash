import { parseCommand } from "@/lib/engine/parse";
import { predict } from "@/lib/engine/model";
import { INTENT_BY_KEY, CONFIDENCE_GATE } from "@/lib/engine/intents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return Response.json({ error: "بدنهٔ درخواست JSON معتبر نیست." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "متن دستور خالی است." }, { status: 400 });
  }
  if (text.length > 300) {
    return Response.json({ error: "متن طولانی است؛ حداکثر ۳۰۰ نویسه." }, { status: 400 });
  }

  const rules = parseCommand(text);
  const model = predict(text);
  const top = model.predictions[0];

  const modelAgrees = top ? top.classKey === rules.intent : false;
  const modelConfident = top ? top.probability >= CONFIDENCE_GATE : false;

  const gate = {
    execute: !rules.shouldAsk && rules.intent !== "negative",
    ask: rules.shouldAsk || (modelConfident && !modelAgrees && rules.confidence < CONFIDENCE_GATE),
    needsConfirmation: rules.needsConfirmation,
    reason: rules.shouldAsk
      ? "اطمینان موتور زیر ۰٫۹ است؛ اجرا متوقف و سؤال پرسیده می‌شود."
      : rules.needsConfirmation
        ? "عملیات حساس است؛ اجرای واقعی فقط با تأیید صریح شما و دیالوگ سیستم."
        : rules.intent === "negative"
          ? "این جمله دستور قابل اجرا نیست؛ هیچ عملیاتی انجام نمی‌شود."
          : "اجرا مجاز است و به TivaNative می‌رسد.",
    authority: "موتور قواعد",
    modelAgrees,
    modelConfident,
    modelLabel: top ? (INTENT_BY_KEY.get(top.classKey)?.labelFa ?? top.classKey) : null,
  };

  return Response.json({
    input: text,
    rules,
    model: {
      predictions: model.predictions.map((prediction) => ({
        ...prediction,
        labelFa: INTENT_BY_KEY.get(prediction.classKey)?.labelFa ?? prediction.classKey,
      })),
      params: model.params,
      error: model.error,
    },
    gate,
  });
}
