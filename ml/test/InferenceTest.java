import ir.tivachat.flash.TivaClassifier;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
public class InferenceTest {
  public static void main(String[] args) throws Exception {
    byte[] weights = Files.readAllBytes(Paths.get("android/assets/tiva_model.bin"));
    String meta = new String(Files.readAllBytes(Paths.get("android/assets/tiva_model_meta.json")), StandardCharsets.UTF_8);
    TivaClassifier c = new TivaClassifier(weights, meta);
    String[] tests = {
      "تلگرام رو باز کن و در پیام های شخصی بنویس سلام",
      "تلگرام رو باز کن و به علی بنویس سلام",
      "میشه برام کروم رو باز کنی؟",
      "میخوام برم تو اینستاگرام",
      "چند درصد شارژ مونده",
      "وضعیت انرژی گوشی چطوره",
      "برام یک چای دم کن",
      "قیمت بیتکوین چنده",
      "از تلگرام بیا بیرون",
      "بریم تنظیمات شبکه",
      "به مامانم زنگ بزن",
      "درباره هوش مصنوعی سرچ کن",
      "سلام چطوری",
      "خیلی لطف کردی",
      "آلارم ۷ صبح بذار"
    };
    for (String t : tests) {
      TivaClassifier.Prediction p = c.classify(t);
      System.out.println(t + "\t" + p.label + "\t" + Math.round(p.confidence*10000)/100.0);
    }
    System.out.println("INFO " + c.info().toString());
  }
}
