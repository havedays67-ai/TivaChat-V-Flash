package ir.tivachat.flash;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class KnowledgeGate {

    public static final double MIN_CONFIDENCE = 0.9;

    private static final Set<String> CONFIRM_REQUIRED = new HashSet<>(Arrays.asList(
        "call", "sms", "compose_message", "delete_media", "uninstall_app", "calendar_event"
    ));

    private KnowledgeGate() {}

    public static class Decision {
        public final boolean execute;
        public final boolean ask;
        public final String reason;

        Decision(boolean execute, boolean ask, String reason) {
            this.execute = execute;
            this.ask = ask;
            this.reason = reason;
        }
    }

    public static Decision decide(String intent, double confidence, boolean userConfirmed) {
        if (intent == null || "negative".equals(intent)) {
            return new Decision(false, false, "قصد قابل اجرا نیست");
        }
        if (confidence < MIN_CONFIDENCE) {
            return new Decision(false, true, "اطمینان پایین است؛ بپرس «منظورتان این بود؟»");
        }
        if (CONFIRM_REQUIRED.contains(intent) && !userConfirmed) {
            return new Decision(false, true, "این عملیات نیازمند تأیید صریح است");
        }
        return new Decision(true, false, "اجرا مجاز است");
    }
}