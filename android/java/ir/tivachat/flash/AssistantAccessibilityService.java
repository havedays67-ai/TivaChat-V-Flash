package ir.tivachat.flash;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * User-controlled accessibility helper.
 *
 * Two carefully separated jobs:
 * 1) Safe global actions (back / home / recents / notifications).
 * 2) A user-confirmed "compose a message" flow inside a messenger. It searches
 *    for the chat, opens it and writes the draft text, but NEVER presses send.
 *
 * Enabled only when the user enables it in Android settings. No screen content
 * is stored, logged or transmitted.
 */
public class AssistantAccessibilityService extends AccessibilityService {

    public interface AutomationListener {
        void onProgress(int percent, String stage);
        void onResult(boolean ok, String message);
    }

    private static AssistantAccessibilityService instance;
    private static AutomationListener listener;
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static boolean automationRunning = false;
    private static String automationPackage = "";
    private static final Runnable WATCHDOG = () -> {
        if (!automationRunning) return;
        automationRunning = false;
        automationPackage = "";
        if (listener != null) listener.onResult(false, "زمان عملیات تمام شد؛ برای امنیت شما خودکار متوقف شدم.");
    };
    private static long lastVolumeAt = 0L;
    private static int lastVolumeKey = -1;

    public static boolean isConnected() { return instance != null; }

    /** Hard safety release. Stops any automation, clears UI callbacks, never touches other apps afterwards. */
    public static void cancelAutomation() {
        automationRunning = false;
        automationPackage = "";
        listener = null;
        handler.removeCallbacksAndMessages(null);
    }
    public static void setAutomationListener(AutomationListener newListener) { listener = newListener; }

    /** v1.0.3: write text into the focused editable field; never presses send/search. */
    public static boolean typeText(String text) {
        if (instance == null || text == null || text.trim().isEmpty()) return false;
        AccessibilityNodeInfo root;
        try { root = instance.getRootInActiveWindow(); } catch (Exception e) { return false; }
        if (root == null) return false;
        AccessibilityNodeInfo target = findEditable(root);
        if (target == null) return false;
        try {
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            if (target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) return true;
            target.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            return target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        } catch (Exception e) {
            return false;
        } finally {
            try { target.recycle(); } catch (Exception ignored) { }
        }
    }

    private static AccessibilityNodeInfo findEditable(AccessibilityNodeInfo node) {
        if (node == null) return null;
        try {
            if (node.isEditable() && node.isEnabled()) return node;
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child == null) continue;
                AccessibilityNodeInfo found = findEditable(child);
                if (found != null) return found;
                child.recycle();
            }
        } catch (Exception ignored) { }
        return null;
    }

    public static boolean perform(String action) {
        if (instance == null) return false;
        switch (action) {
            case "back": return instance.performGlobalAction(GLOBAL_ACTION_BACK);
            case "home": return instance.performGlobalAction(GLOBAL_ACTION_HOME);
            case "recents": return instance.performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notifications": return instance.performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            default: return false;
        }
    }

    public static void composeMessage(final String pkg, final String contact,
                                     final String message, final boolean sendRequested) {
        if (instance == null) {
            emitResult(false, "سرویس دسترس‌پذیری فعال نیست. برای نوشتن پیام، آن را در تنظیمات فعال کنید.");
            return;
        }
        if (automationRunning) {
            emitResult(false, "یک عملیات نوشتن پیام در حال اجراست؛ کمی صبر کنید.");
            return;
        }
        instance.runCompose(pkg, contact == null ? "" : contact.trim(),
                message == null ? "" : message.trim());
    }

    private static void emitProgress(int percent, String stage) {
        if (listener != null) {
            final int p = percent;
            final String s = stage;
            handler.post(() -> { if (listener != null) listener.onProgress(p, s); });
        }
    }

    private static void emitResult(boolean ok, String message) {
        automationRunning = false;
        automationPackage = "";
        if (listener != null) {
            handler.post(() -> { if (listener != null) listener.onResult(ok, message); });
        }
    }

    @Override
    public void onServiceConnected() {
        instance = this;
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
            setServiceInfo(info);
        }
    }

    /** Read-only listener; it never acts on events and never loops on screen changes. */
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { }

    @Override
    public void onDestroy() {
        instance = null;
        listener = null;
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    // Message compose automation: no content is logged or transmitted.
    // ------------------------------------------------------------------

    private void runCompose(final String pkg, final String contact, final String message) {
        automationRunning = true;
        automationPackage = pkg;
        handler.removeCallbacks(WATCHDOG);
        handler.postDelayed(WATCHDOG, 26000L);
        emitProgress(8, "باز کردن برنامه…");
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch == null) {
                finish(false, "برنامه پیام‌رسان روی این دستگاه پیدا نشد.");
                return;
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            startActivity(launch);
        } catch (Exception e) {
            finish(false, "باز کردن برنامه پیام‌رسان ممکن نشد.");
            return;
        }

        waitForForeground(pkg, 0, contact, message);
    }

    private void waitForForeground(final String pkg, final int attempt,
                                   final String contact, final String message) {
        AccessibilityNodeInfo root = activeRoot();
        String current = root == null || root.getPackageName() == null ? "" : root.getPackageName().toString();
        if (current.equals(pkg)) {
            emitProgress(24, "برنامه باز شد؛ آماده‌سازی جست‌وجو…");
            handler.postDelayed(() -> {
                boolean searchOpened = openSearch();
                handler.postDelayed(() -> continueAfterSearch(contact, message, searchOpened), 900);
            }, 700);
            return;
        }
        if (attempt >= 18) {
            finish(false, "برنامهٔ پیام‌رسان در زمان انتظار باز نشد؛ برای جلوگیری از نوشتن در برنامهٔ اشتباه متوقف شدم.");
            return;
        }
        handler.postDelayed(() -> waitForForeground(pkg, attempt + 1, contact, message), 400);
    }

    private boolean inTargetApp() {
        AccessibilityNodeInfo root = activeRoot();
        if (root == null || root.getPackageName() == null) return false;
        return root.getPackageName().toString().equals(automationPackage);
    }

    private void continueAfterSearch(final String contact, final String message, boolean searchOpened) {
        if (!inTargetApp()) {
            finish(false, "برنامهٔ مقصد در دسترس نیست؛ هیچ متنی نوشته نشد.");
            return;
        }
        if (contact.isEmpty()) {
            finish(true, "برنامه باز شد. برای نوشتن پیام، نام مخاطب را هم بگویید.");
            return;
        }
        emitProgress(42, "جست‌وجوی گفتگو…");
        AccessibilityNodeInfo root = activeRoot();
        AccessibilityNodeInfo field = findSearchableEditText(root);
        if (field != null) {
            focusAndSetText(field, contact);
        } else if (!searchOpened) {
            finish(false, "کادر جست‌وجو در این صفحه پیدا نشد. برنامه را باز نگه داشتم؛ جست‌وجو کادر را نمی‌شناسم.");
            return;
        }

        handler.postDelayed(() -> {
            emitProgress(58, "باز کردن گفتگوی «" + contact + "»…");
            AccessibilityNodeInfo activeRoot = activeRoot();
            AccessibilityNodeInfo match = findByText(activeRoot, contact);
            if (match == null) {
                finish(false, "گفتگویی با نام «" + contact + "» پیدا نشد؛ برای جلوگیری از ارسال اشتباه متوقف شدم.");
                return;
            }
            clickWithParent(match);
            handler.postDelayed(() -> writeDraft(message), 1500);
        }, 1600);
    }

    private void writeDraft(final String message) {
        if (!inTargetApp()) {
            finish(false, "برنامهٔ پیام‌رسان در دسترس نیست؛ متن در جای دیگری نوشته نشد.");
            return;
        }
        emitProgress(76, "نوشتن متن در کادر پیام…");
        handler.postDelayed(() -> {
            AccessibilityNodeInfo root = activeRoot();
            AccessibilityNodeInfo input = findMessageEditText(root);
            if (input == null) {
                finish(false, "کادر پیام پیدا نشد. متن را در حافظه کپی کردم تا خودتان بچسبانید.");
                return;
            }
            focusAndSetText(input, message);
            emitProgress(100, "متن در کادر پیام نوشته شد.");
            finish(true, "متن «" + message + "» در کادر پیام نوشته شد؛ ارسال نهایی را خودتان در همان برنامه تأیید کنید.");
        }, 700);
    }

    private void finish(boolean ok, String message) {
        handler.removeCallbacks(WATCHDOG);
        automationRunning = false;
        automationPackage = "";
        emitResult(ok, message);
    }

    private boolean openSearch() {
        AccessibilityNodeInfo root = activeRoot();
        if (root == null) return false;
        AccessibilityNodeInfo search = findSearchNode(root);
        if (search == null) return false;
        clickWithParent(search);
        pause(250);
        AccessibilityNodeInfo field = findSearchableEditText(activeRoot());
        return field != null;
    }

    private void pause(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) { }
    }

    private AccessibilityNodeInfo activeRoot() {
        try { return super.getRootInActiveWindow(); } catch (Exception e) { return null; }
    }

    private String norm(String value) {
        if (value == null) return "";
        return value.replace('ي', 'ی').replace('ك', 'ک').replace('\u200c', ' ')
                .replaceAll("\\s+", " ").trim().toLowerCase();
    }

    private String describe(AccessibilityNodeInfo node) {
        if (node == null) return "";
        String text = node.getText() == null ? "" : node.getText().toString();
        String hint = node.getHintText() == null ? "" : node.getHintText().toString();
        String desc = node.getContentDescription() == null ? "" : node.getContentDescription().toString();
        return norm(text + " " + hint + " " + desc);
    }

    private List<AccessibilityNodeInfo> allNodes(AccessibilityNodeInfo root) {
        List<AccessibilityNodeInfo> out = new ArrayList<>();
        collect(root, out, 0);
        return out;
    }

    private void collect(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> out, int depth) {
        if (node == null || depth > 40 || out.size() > 420) return;
        try {
            if (node.isVisibleToUser()) out.add(node);
            for (int i = 0; i < node.getChildCount(); i++) {
                collect(node.getChild(i), out, depth + 1);
            }
        } catch (Exception ignored) { }
    }

    private AccessibilityNodeInfo findSearchNode(AccessibilityNodeInfo root) {
        for (AccessibilityNodeInfo node : allNodes(root)) {
            String label = describe(node);
            boolean searchLabel = label.contains("search") || label.contains("جستجو")
                    || label.contains("جست‌وجو") || label.contains("جست و جو");
            CharSequence className = node.getClassName();
            if (searchLabel && (node.isClickable() || className != null && className.toString().contains("EditText"))) {
                return node;
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findSearchableEditText(AccessibilityNodeInfo root) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int screenHeight = metrics.heightPixels;
        List<AccessibilityNodeInfo> nodes = allNodes(root);
        for (AccessibilityNodeInfo node : nodes) {
            CharSequence cls = node.getClassName();
            if (cls == null || !cls.toString().contains("EditText")) continue;
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            boolean nearTop = bounds.top < screenHeight * 0.45;
            String label = describe(node);
            if (nearTop || label.contains("search") || label.contains("جستجو") || label.contains("پیام")) {
                return node;
            }
        }
        for (AccessibilityNodeInfo node : nodes) {
            CharSequence cls = node.getClassName();
            if (cls != null && cls.toString().contains("EditText")) return node;
        }
        return null;
    }

    private AccessibilityNodeInfo findMessageEditText(AccessibilityNodeInfo root) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int screenHeight = metrics.heightPixels;
        AccessibilityNodeInfo best = null;
        int bestTop = -1;
        for (AccessibilityNodeInfo node : allNodes(root)) {
            CharSequence cls = node.getClassName();
            if (cls == null || !cls.toString().contains("EditText")) continue;
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (bounds.top > screenHeight * 0.30 && bounds.bottom <= screenHeight && bounds.top > bestTop) {
                best = node;
                bestTop = bounds.top;
            }
        }
        return best;
    }

    private AccessibilityNodeInfo findByText(AccessibilityNodeInfo root, String query) {
        String wanted = norm(query);
        if (wanted.isEmpty()) return null;
        AccessibilityNodeInfo partial = null;
        for (AccessibilityNodeInfo node : allNodes(root)) {
            CharSequence cls = node.getClassName();
            if (cls != null && cls.toString().contains("EditText")) continue;
            if (node.isEditable()) continue;
            String label = describe(node);
            if (label.isEmpty()) continue;
            if (label.equals(wanted) || label.contains(wanted)) {
                if (node.isClickable()) return node;
                if (partial == null) partial = node;
            }
        }
        return partial;
    }

    private boolean focusAndSetText(AccessibilityNodeInfo node, String text) {
        if (node == null) return false;
        try {
            node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) return true;
            // some apps expose only a paste action
            android.content.ClipboardManager clipboard =
                    (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (clipboard != null) {
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("tivachat", text));
                node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
                return node.performAction(AccessibilityNodeInfo.ACTION_PASTE);
            }
        } catch (Exception ignored) { }
        return false;
    }

    private boolean clickWithParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int depth = 0; depth < 8 && current != null; depth++) {
            try {
                if (current.isClickable() && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
                AccessibilityNodeInfo parent = current.getParent();
                if (parent == null) break;
                current = parent;
            } catch (Exception e) {
                break;
            }
        }
        return false;
    }
}
