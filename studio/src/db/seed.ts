import { sql } from "drizzle-orm";
import { db } from "./index";
import { appRegistry, intentClasses, patches, signingFacts, testCases } from "./schema";
import { APPS } from "../lib/engine/apps";
import { INTENTS } from "../lib/engine/intents";
import { TEST_CASES } from "../lib/engine/tests";

const PATCHES = [
  {
    key: "p-delete-media",
    title: "حذف عکس و فایل با تأیید سیستم (الزام ۱.۰.۲)",
    target: "android/java/ir/tivachat/flash/DeleteHelper.java",
    language: "java",
    kind: "source",
    requirement: "بند ۷-۶: حذف با MediaStore.createDeleteRequest در اندروید ۱۱+ و RecoverableSecurityException در اندروید ۱۰",
    rationale:
      "حذف مستقیم ممنوع است. این کلاس هیچ فایلی را خودش پاک نمی‌کند و فقط IntentSender سیستمی را باز می‌کند؛ نتیجه به onActivityResult برمی‌گردد.",
    order: 1,
    content: `package ir.tivachat.flash;

import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentResolver;
import android.content.IntentSender;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import java.util.ArrayList;

/**
 * TivaChat 1.0.2 - destructive media actions always go through the OS consent dialog.
 * API 30+ : MediaStore.createDeleteRequest (one dialog for N uris)
 * API 29   : RecoverableSecurityException -> userAction.actionIntent
 * API 28   : only app-owned files, still behind an in-app confirm dialog
 */
public final class DeleteHelper {

    public static final int REQ_DELETE_MEDIA = 4701;
    public static final int REQ_UNINSTALL_APP = 4702;

    private DeleteHelper() {}

    public static void requestDelete(Activity activity, ArrayList<Uri> uris) {
        if (activity == null || uris == null || uris.isEmpty()) return;
        ContentResolver resolver = activity.getContentResolver();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            IntentSender sender = MediaStore.createDeleteRequest(resolver, uris).getIntentSender();
            try {
                activity.startIntentSenderForResult(sender, REQ_DELETE_MEDIA, null, 0, 0, 0);
            } catch (IntentSender.SendIntentException ignored) {
                ToastHelper.show(activity, "حذف انجام نشد؛ دوباره تلاش کنید.");
            }
            return;
        }

        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
            try {
                deleteOneByOne(activity, uris);
            } catch (SecurityException error) {
                RecoverableSecurityException recoverable = asRecoverable(error);
                if (recoverable != null) {
                    try {
                        activity.startIntentSenderForResult(
                            recoverable.getUserAction().getActionIntent().getIntentSender(),
                            REQ_DELETE_MEDIA, null, 0, 0, 0);
                    } catch (IntentSender.SendIntentException ignored) { }
                } else {
                    ToastHelper.show(activity, "دسترسی حذف داده نشد. فایل دست‌نخورده ماند.");
                }
            }
            return;
        }

        // Android 9: no media consent flow. Only delete what this app created.
        deleteOneByOne(activity, uris);
    }

    private static void deleteOneByOne(Activity activity, ArrayList<Uri> uris) {
        ContentResolver resolver = activity.getContentResolver();
        for (Uri uri : uris) {
            resolver.delete(uri, null, null);
        }
    }

    private static RecoverableSecurityException asRecoverable(SecurityException error) {
        return error instanceof RecoverableSecurityException ? (RecoverableSecurityException) error : null;
    }

    public static boolean isConfirmed(int requestCode, int resultCode) {
        if (requestCode != REQ_DELETE_MEDIA) return false;
        return resultCode == Activity.RESULT_OK;
    }
}`,
  },
  {
    key: "p-uninstall-app",
    title: "حذف برنامه فقط با دیالوگ رسمی اندروید",
    target: "android/java/ir/tivachat/flash/AppActions.java",
    language: "java",
    kind: "source",
    requirement: "بند ۷-۶: حذف برنامه با ACTION_DELETE و دیالوگ سیستم",
    rationale:
      "هیچ حذف بی‌صدایی وجود ندارد. پکیج در زمان اجرا از PackageManager خوانده می‌شود و به ACTION_DELETE داده می‌شود؛ تأیید نهایی در صفحهٔ خود اندروید است.",
    order: 2,
    content: `package ir.tivachat.flash;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

public final class AppActions {

    private AppActions() {}

    public static boolean requestUninstall(Activity activity, String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        PackageManager pm = activity.getPackageManager();
        try {
            pm.getPackageInfo(packageName, 0);
        } catch (PackageManager.NameNotFoundException notInstalled) {
            ToastHelper.show(activity, "این برنامه روی گوشی نصب نیست.");
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_DELETE);
        intent.setData(Uri.parse("package:" + packageName));
        intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
        if (intent.resolveActivity(pm) == null) {
            openAppInfo(activity, packageName);
            return false;
        }
        activity.startActivityForResult(intent, DeleteHelper.REQ_UNINSTALL_APP);
        return true;
    }

    /** Android does not allow other apps to force-stop a package: show the official screen. */
    public static void openAppInfo(Activity activity, String packageName) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + packageName));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(activity.getPackageManager()) == null) {
            Intent fallback = new Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(fallback);
            return;
        }
        activity.startActivity(intent);
    }

    public static boolean isSystemApp(PackageManager pm, String packageName) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(packageName, 0);
            return (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }
}`,
  },
  {
    key: "p-dual-apps",
    title: "باز کردن نسخهٔ دوگانهٔ MIUI با LauncherApps و UserHandle",
    target: "android/java/ir/tivachat/flash/DualAppLauncher.java",
    language: "java",
    kind: "source",
    requirement: "بند ۵: Telegram / Bale / blu / Balad دو نسخه دارند و باید با package و user جدا شوند",
    rationale:
      "PackageManager فقط نسخهٔ کاربر جاری را می‌بیند. LauncherApps.getActivityList(pkg, user) روی پروفایل‌های کار و Dual Apps کار می‌کند. اگر پروفایل دوم در دسترس نبود، صادقانه به کاربر گفته می‌شود.",
    order: 3,
    content: `package ir.tivachat.flash;

import android.content.Context;
import android.content.pm.LauncherApps;
import android.content.pm.PackageManager;
import android.os.Process;
import android.os.UserHandle;
import android.os.UserManager;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;

public final class DualAppLauncher {

    private static final String TAG = "TivaDualApp";

    private DualAppLauncher() {}

    public static class Target {
        public final String label;
        public final UserHandle user;

        Target(String label, UserHandle user) {
            this.label = label;
            this.user = user;
        }
    }

    /** Every profile that has a launchable activity for this package. */
    public static List<Target> listTargets(Context context, String packageName) {
        List<Target> targets = new ArrayList<>();
        LauncherApps launcherApps = (LauncherApps) context.getSystemService(Context.LAUNCHER_APPS_SERVICE);
        UserManager userManager = (UserManager) context.getSystemService(Context.USER_SERVICE);
        if (launcherApps == null || userManager == null) return targets;

        for (UserHandle user : userManager.getUserProfiles()) {
            List<LauncherApps.AppUsageItem> items = launcherApps.getActivityList(packageName, user);
            for (LauncherApps.AppUsageItem item : items) {
                String suffix = user.equals(Process.myUserHandle()) ? "" : " (دوگانه)";
                targets.add(new Target(item.getLabel() + suffix, user));
            }
        }
        return targets;
    }

    /** Launch a specific profile. Returns false if the OS refuses. */
    public static boolean launch(Context context, String packageName, UserHandle user) {
        LauncherApps launcherApps = (LauncherApps) context.getSystemService(Context.LAUNCHER_APPS_SERVICE);
        if (launcherApps == null) return false;
        try {
            List<LauncherApps.AppUsageItem> items = launcherApps.getActivityList(packageName, user);
            if (items.isEmpty()) return false;
            LauncherApps.AppUsageItem item = items.get(0);
            launcherApps.startMainActivity(item.getComponentName(), user, null, null);
            return true;
        } catch (SecurityException | IllegalStateException error) {
            Log.w(TAG, "dual launch denied: " + error.getClass().getSimpleName());
            return false;
        }
    }

    /** Fallback: the normal launch intent of the current profile. */
    public static boolean launchCurrentProfile(Context context, String packageName) {
        IntentHolder.Result result = IntentHolder.launch(context, packageName);
        return result == IntentHolder.Result.LAUNCHED;
    }

    public static boolean isInstalled(Context context, String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }
}`,
  },
  {
    key: "p-camera",
    title: "«یه عکس بگیر» ← دوربین، نه انتخاب‌گر حذف",
    target: "android/java/ir/tivachat/flash/CameraActions.java",
    language: "java",
    kind: "source",
    requirement: "بند ۷-۳: «یه عکس بگیر» باید دوربین را باز کند و به حذف نرود",
    rationale:
      "مسیر عکاسی از مسیر حذف جدا می‌شود. ACTION_IMAGE_CAPTURE با FileProvider و Uri موقت؛ اگر دوربینی نبود، پیام صادقانه.",
    order: 4,
    content: `package ir.tivachat.flash;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;

public final class CameraActions {

    public static final int REQ_PHOTO = 4801;
    public static final int REQ_VIDEO = 4802;

    private CameraActions() {}

    public static Uri newCaptureUri(Activity activity) {
        File dir = new File(activity.getCacheDir(), "captures");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File file;
        try {
            file = File.createTempFile("tiva_", ".jpg", dir);
        } catch (IOException error) {
            return null;
        }
        return FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
    }

    public static void capturePhoto(Activity activity) {
        if (!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            ToastHelper.show(activity, "این دستگاه دوربین ندارد.");
            return;
        }
        Uri output = newCaptureUri(activity);
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (output != null) {
            intent.putExtra(MediaStore.EXTRA_OUTPUT, output);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        }
        if (intent.resolveActivity(activity.getPackageManager()) == null) {
            ToastHelper.show(activity, "برنامهٔ دوربینی پیدا نشد.");
            return;
        }
        activity.startActivityForResult(intent, REQ_PHOTO);
    }

    public static void captureVideo(Activity activity) {
        Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1);
        if (intent.resolveActivity(activity.getPackageManager()) == null) {
            ToastHelper.show(activity, "برنامهٔ دوربین ویدیویی پیدا نشد.");
            return;
        }
        activity.startActivityForResult(intent, REQ_VIDEO);
    }
}`,
  },
  {
    key: "p-persian-time",
    title: "قاعدهٔ ظهر و زمان‌سنج فارسی",
    target: "android/java/ir/tivachat/flash/PersianTime.java",
    language: "java",
    kind: "source",
    requirement: "بند ۷-۱: «۲ ظهر» = ۱۴، «۱۲ ظهر» = ۱۲، «۸ شب» = ۲۰",
    rationale:
      "پارس زمان در جاوا هم‌تراز با موتور JS انجام می‌شود تا رفتار یکسان باشد؛ بدون زمان، آلارم ساخته نمی‌شود.",
    order: 5,
    content: `package ir.tivachat.flash;

import java.util.HashMap;
import java.util.Map;

public final class PersianTime {

    private static final Map<String, Integer> WORDS = new HashMap<>();
    static {
        String[] names = {"صفر","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه","ده","یازده","دوازده"};
        for (int i = 0; i < names.length; i++) WORDS.put(names[i], i);
        WORDS.put("شیش", 6);
        WORDS.put("نیم", 30);
        WORDS.put("ربع", 15);
    }

    public static class Clock {
        public final int hour;
        public final int minute;
        public final boolean hasPeriod;
        Clock(int hour, int minute, boolean hasPeriod) {
            this.hour = hour;
            this.minute = minute;
            this.hasPeriod = hasPeriod;
        }
        public String text() {
            return String.format("%02d:%02d", hour, minute);
        }
    }

    public static int applyPeriod(int hour, String period) {
        if (period == null) return hour;
        if (period.equals("ظهر") || period.equals("عصر")) {
            if (hour == 12) return 12;
            return hour < 12 ? hour + 12 : hour;
        }
        if (period.equals("شب")) {
            if (hour == 12) return 0;
            return hour < 12 ? hour + 12 : hour;
        }
        return hour == 12 ? 0 : hour; // صبح / بامداد
    }

    public static Clock parse(String normalized) {
        if (normalized == null) return null;
        String period = null;
        String[] periods = {"بعد از ظهر", "ظهر", "عصر", "شب", "بامداد", "صبح"};
        for (String candidate : periods) {
            if (normalized.contains(candidate)) { period = candidate.contains("ظهر") ? "ظهر" : candidate; break; }
        }

        java.util.regex.Matcher colon = java.util.regex.Pattern.compile("(\\\\d{1,2})\\\\s*:\\\\s*(\\\\d{1,2})").matcher(normalized);
        if (colon.find()) {
            int hour = Integer.parseInt(colon.group(1));
            int minute = Integer.parseInt(colon.group(2));
            return new Clock(applyPeriod(hour, period) % 24, Math.min(59, minute), period != null);
        }

        java.util.regex.Matcher numeric = java.util.regex.Pattern.compile("(\\\\d{1,2})(?:\\\\s*و\\\\s*(نیم|ربع|\\\\d{1,2}))?").matcher(normalized);
        if (numeric.find()) {
            int hour = Integer.parseInt(numeric.group(1));
            int minute = numeric.group(2) == null ? 0 : WORDS.getOrDefault(numeric.group(2), safeInt(numeric.group(2)));
            return new Clock(applyPeriod(hour, period) % 24, minute, period != null);
        }
        return null;
    }

    /** Seconds, or -1 when the sentence has no duration. */
    public static int durationSeconds(String normalized) {
        if (normalized == null) return -1;
        int seconds = 0;
        boolean matched = false;
        if (normalized.contains("نیم ساعت")) { seconds += 1800; matched = true; }
        java.util.regex.Matcher hours = java.util.regex.Pattern.compile("(\\\\d+)\\\\s*ساعت").matcher(normalized);
        if (hours.find()) { seconds += Integer.parseInt(hours.group(1)) * 3600; matched = true; }
        java.util.regex.Matcher minutes = java.util.regex.Pattern.compile("(\\\\d+)\\\\s*دقیقه").matcher(normalized);
        if (minutes.find()) { seconds += Integer.parseInt(minutes.group(1)) * 60; matched = true; }
        return matched && seconds > 0 ? seconds : -1;
    }

    private static int safeInt(String value) {
        try { return Integer.parseInt(value); } catch (NumberFormatException error) { return 0; }
    }
}`,
  },
  {
    key: "p-confidence-gate",
    title: "دروازهٔ اطمینان ۰٫۹ و ممنوعیت دور زدن تأیید",
    target: "android/java/ir/tivachat/flash/KnowledgeGate.java",
    language: "java",
    kind: "source",
    requirement: "بند ۷-۲ و قانون ۴-۶: اطمینان زیر ۰٫۹ ← اجرا نکن و بپرس",
    rationale:
      "حتی اگر مدل/دانش اطمینان بالا بدهد، قصدهای خطرناک بدون تأیید صریح اجرا نمی‌شوند. این لایه بعد از موتور و قبل از TivaNative صدا زده می‌شود.",
    order: 6,
    content: `package ir.tivachat.flash;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class KnowledgeGate {

    public static final double MIN_CONFIDENCE = 0.9;

    private static final Set<String> CONFIRM_REQUIRED = new HashSet<>(Arrays.asList(
        "call", "sms", "compose_message", "delete_media", "uninstall_app", "calendar_event",
        "type_in_app"
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
}`,
  },
  {
    key: "p-alarm-silent",
    title: "آلارم بدون اجازه و بدون باز شدن برنامهٔ ساعت",
    target: "android/java/ir/tivachat/flash/AlarmActions.java",
    language: "java",
    kind: "source",
    requirement: "درخواست کاربر: آلارم اشکالی ندارد و بدون گرفتن اجازه تنظیم شود",
    rationale:
      "SET_ALARM از دستهٔ normal است و در نصب داده می‌شود؛ هیچ دیالوگ runtime ندارد. با EXTRA_SKIP_UI=true خود اندروید آلارم را بی‌درنگ ثبت می‌کند. اگر سازندهٔ گوشی این اکسترا را نادیده بگیرد، فقط در همان حالت صفحهٔ ساعت باز می‌شود.",
    order: 6,
    content: `package ir.tivachat.flash;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.provider.AlarmClock;

/**
 * 1.0.1/1.0.2 - silent alarm.
 * SET_ALARM is a NORMAL permission: granted at install time, no runtime dialog.
 * EXTRA_SKIP_UI asks the OEM clock app to create the alarm without showing its UI.
 */
public final class AlarmActions {

    private AlarmActions() {}

    public static boolean setAlarm(Context context, int hour, int minute, String label) {
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;

        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
        intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
        intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);          // <-- silent
        if (label != null && !label.isEmpty()) {
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (intent.resolveActivity(context.getPackageManager()) == null) {
            ToastHelper.show(context, "برنامهٔ ساعت روی این گوشی پیدا نشد.");
            return false;
        }
        try {
            context.startActivity(intent);
            ToastHelper.show(context, String.format("آلارم %02d:%02d تنظیم شد", hour, minute));
            return true;
        } catch (android.content.ActivityNotFoundException error) {
            return setAlarmWithUi(context, hour, minute, label);
        } catch (SecurityException error) {
            // OEM blocked the silent path; fall back to opening the clock UI.
            return setAlarmWithUi(context, hour, minute, label);
        }
    }

    /** Fallback only: opens the clock app so the user can confirm manually. */
    private static boolean setAlarmWithUi(Context context, int hour, int minute, String label) {
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
        intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
        intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        if (label != null && !label.isEmpty()) intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        ToastHelper.show(context, "صفحهٔ ساعت باز شد؛ تأیید نهایی با خودتان است.");
        return true;
    }

    public static boolean setTimer(Context context, int seconds, String label) {
        if (seconds <= 0) return false;
        Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
        intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        if (label != null && !label.isEmpty()) intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        return true;
    }
}`,
  },
  {
    key: "p-bubble-close",
    title: "× روی گوشهٔ آیکون شناور برای برداشتن آیکون",
    target: "android/java/ir/tivachat/flash/FloatingBubble.java",
    language: "java",
    kind: "source",
    requirement: "درخواست کاربر: یک × روی گوشهٔ آیکون باشد و با زدن آن آیکون حذف شود",
    rationale:
      "× فقط لمس خودش را می‌گیرد (نه کل صفحه)، محاسبهٔ حذف روی ترد اصلی انجام می‌شود و وضعیت پنهان بودن ذخیره می‌شود تا بوت/سرویس دوباره آیکون نسازد. دسترسی از کاشی و برنامه باقی می‌ماند.",
    order: 7,
    content: `package ir.tivachat.flash;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Floating bubble with a small × badge on the top corner.
 * Tapping the bubble opens the assistant; tapping × removes the bubble for good.
 */
public final class FloatingBubble {

    public static final String PREFS = "tiva_overlay";
    public static final String KEY_VISIBLE = "bubble_visible";

    private final Context context;
    private final WindowManager windowManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final SharedPreferences prefs;
    private FrameLayout root;
    private WindowManager.LayoutParams params;

    public FloatingBubble(Context context) {
        this.context = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean isVisible() {
        return prefs.getBoolean(KEY_VISIBLE, true);
    }

    public void show() {
        if (root != null || !isVisible()) return;
        if (!android.provider.Settings.canDrawOverlays(context)) {
            ToastHelper.show(context, "برای نمایش آیکون، اجازهٔ نمایش روی برنامه‌ها لازم است.");
            return;
        }

        root = new FrameLayout(context);
        View bubble = buildBubble();
        View close = buildCloseBadge();

        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(dp(56), dp(56));
        bubbleParams.gravity = Gravity.CENTER;
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(24), dp(24));
        closeParams.gravity = Gravity.TOP | Gravity.END;

        root.addView(bubble, bubbleParams);
        root.addView(close, closeParams);

        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            android.graphics.PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(16);
        params.y = dp(180);

        bubble.setOnClickListener(view -> AssistantBridge.openPanel(context));
        close.setOnClickListener(view -> hide());

        mainHandler.post(() -> {
            try {
                windowManager.addView(root, params);
                prefs.edit().putBoolean(KEY_VISIBLE, true).apply();
            } catch (SecurityException | IllegalStateException error) {
                root = null;
            }
        });
    }

    /** Removes the overlay view; called by TivaNative.hideBubble() and by the × badge. */
    public void hide() {
        prefs.edit().putBoolean(KEY_VISIBLE, false).apply();
        final FrameLayout target = root;
        root = null;
        mainHandler.post(() -> {
            if (target == null) return;
            try {
                windowManager.removeViewImmediate(target);
            } catch (IllegalArgumentException | IllegalStateException ignored) {
                // already detached (activity destroyed / config change)
            }
        });
        ToastHelper.show(context, "آیکون برداشته شد. برای برگرداندن بگویید «آیکون رو برگردون».");
    }

    private View buildBubble() {
        TextView view = new TextView(context);
        view.setText("T");
        view.setTextColor(Color.WHITE);
        view.setTextSize(20);
        view.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.parseColor("#0E9F6E"));
        background.setStroke(dp(1), Color.parseColor("#A7F3D0"));
        view.setBackground(background);
        view.setElevation(dp(6));
        return view;
    }

    private View buildCloseBadge() {
        TextView view = new TextView(context);
        view.setText("×");
        view.setTextColor(Color.WHITE);
        view.setTextSize(14);
        view.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.parseColor("#DC2626"));
        background.setStroke(dp(1), Color.WHITE);
        view.setBackground(background);
        view.setContentDescription("برداشتن آیکون");
        view.setPadding(0, 0, 0, dp(2));
        return view;
    }

    private int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}`,
  },
  {
    key: "p-manifest",
    title: "افزودنی‌های مانیفست ۱.۰.۲",
    target: "android/AndroidManifest.xml",
    language: "xml",
    kind: "manifest",
    requirement: "FileProvider برای دوربین، WRITE_SETTINGS برای روشنایی، queries دوربین",
    rationale:
      "بدون این موارد ACTION_IMAGE_CAPTURE در اندروید ۱۱+ با FileUriExposedException می‌شکند و تنظیم روشنایی خطای مجوز می‌دهد.",
    order: 8,
    content: `<!-- داخل <manifest> : -->
<uses-permission android:name="android.permission.WRITE_SETTINGS" tools:ignore="ProtectedPermissions" />
<!-- normal permission: no runtime dialog, needed for silent alarms/timers -->
<uses-permission android:name="android.permission.SET_ALARM" />

<!-- داخل <queries> : -->
<intent>
    <action android:name="android.media.action.IMAGE_CAPTURE" />
</intent>
<intent>
    <action android:name="android.media.action.VIDEO_CAPTURE" />
</intent>

<!-- داخل <application> : -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="\${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>

<!-- res/xml/file_paths.xml : -->
<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="captures" path="captures/" />
</paths>`,
  },
  {
    key: "p-gradle",
    title: "build.gradle با نسخهٔ ۱.۰.۱ (build 4) و امضای همان keystore",
    target: "app/build.gradle",
    language: "gradle",
    kind: "gradle",
    requirement: "نسخه همان ۱ می‌ماند: versionCode 4، versionName 1.0.1، minSdk 28، targetSdk 34، R8، امضا با keystore قبلی",
    rationale:
      "کلید امضا داخل مخزن نگه داشته نمی‌شود؛ از متغیرهای محیطی CI خوانده می‌شود. اگر fingerprint گواهی با 2e3eee11… یکی نباشد، build باید شکست بخورد.",
    order: 9,
    content: `android {
    namespace "ir.tivachat.flash"
    compileSdk 34

    defaultConfig {
        applicationId "ir.tivachat.flash"
        minSdk 28
        targetSdk 34
        versionCode 4
        versionName "1.0.1"
    }

    signingConfigs {
        release {
            storeFile file(System.getenv("TIVA_KEYSTORE") ?: "../keystore/tivachat-release-2026.jks")
            storePassword System.getenv("TIVA_STORE_PASSWORD")
            keyAlias System.getenv("TIVA_KEY_ALIAS") ?: "tivachat"
            keyPassword System.getenv("TIVA_KEY_PASSWORD")
            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            signingConfig signingConfigs.release
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

// proguard-rules.pro
-keepclassmembers class ir.tivachat.flash.MainActivity {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class ir.tivachat.flash.Vault { *; }
-keep class ir.tivachat.flash.PersianTime { *; }`,
  },
  {
    key: "p-verify",
    title: "اسکریپت امضا و تأیید اثر انگشت",
    target: "tools/sign-and-verify.sh",
    language: "bash",
    kind: "doc",
    requirement: "امضا با همان keystore و تأیید یکسان بودن SHA-256 گواهی؛ بدون تغییر شماره نسخه",
    rationale:
      "اگر اثر انگشت گواهی با نسخهٔ ۱.۰.۱ یکی نباشد، آپدیت روی گوشی نصب نمی‌شود. این اسکریپت قبل از انتشار build را متوقف می‌کند.",
    order: 10,
    content: `#!/usr/bin/env bash
set -euo pipefail

APK="\${1:-app/build/outputs/apk/release/app-release.apk}"
EXPECTED_CERT="2e3eee11ae6276418d17085fc6a39373ea9c811c2b5c62bc1c7f64b42ffa46b7"

# 1) sign (v1+v2+v3) with the ORIGINAL keystore (never commit the keystore)
apksigner sign \\
  --ks "keystore/tivachat-release-2026.jks" \\
  --ks-key-alias "tivachat" \\
  --ks-pass "env:TIVA_STORE_PASSWORD" \\
  --key-pass "env:TIVA_KEY_PASSWORD" \\
  --min-sdk-version 21 \\
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \\
  --out TivaChat-V-Flash-v1.0.1.apk "\$APK"

# 2) verify signatures
apksigner verify --verbose --print-certs TivaChat-V-Flash-v1.0.1.apk | tee verify-1.0.1.txt

# 3) hard gate: certificate fingerprint must equal 1.0.1
CERT=\$(openssl x509 -inform DER -in <(unzip -p TivaChat-V-Flash-v1.0.1.apk META-INF/TIVACHAT.RSA | openssl pkcs7 -inform DER -print_certs) -noout -fingerprint -sha256 | tr -d ':' | cut -d= -f2 | tr 'A-F' 'a-f')
if [ "\$CERT" != "\$EXPECTED_CERT" ]; then
  echo "STOP: certificate changed (\$CERT). Update path would break." >&2
  exit 1
fi

# 4) hashes + version check
sha256sum TivaChat-V-Flash-v1.0.1.apk
aapt2 dump badging TivaChat-V-Flash-v1.0.1.apk | head -1
echo "OK: signed with the same key and the same version (1.0.1 build 4)"`,
  },
];

const SIGNING_FACTS = [
  { label: "مخزن مبدأ", value: "havedays67-ai/TivaChat-V-Flash (main · 419d364)", source: "GitHub API", note: "نسخهٔ ۱.۰.۱" },
  { label: "APK ۱.۰.۱ — SHA-256", value: "ff2292a0c76fd50901d13da631e6a88c6d939c46e6aacac59f30b829181ef419", source: "محاسبهٔ مستقل + SHA256SUMS.txt", note: "۳۶۱٬۶۹۰ بایت · build 4" },
  { label: "گواهی امضاکننده — SHA-256", value: "2e3eee11ae6276418d17085fc6a39373ea9c811c2b5c62bc1c7f64b42ffa46b7", source: "META-INF/TIVACHAT.RSA + بلوک v2/v3 + کی‌استور", note: "باید برای ۱.۰.۲ دقیقاً همین بماند" },
  { label: "گواهی — SHA-1", value: "c7f446842a47419bbdaa8f1750a79479767c37f4", source: "X.509", note: "" },
  { label: "گواهی — MD5", value: "2c1a718bf5c7baa615769035c222ea24", source: "X.509", note: "" },
  { label: "کلید عمومی — SHA-256", value: "b5f78472646eec43f6a9539c9b1635689100aed2543cf757f387298128e61661", source: "SPKI", note: "RSA 4096" },
  { label: "Serial گواهی", value: "8BF48ECC65F5846C", source: "X.509", note: "خودامضا · sha384 · تا ۲۰۵۶" },
  { label: "Keystore", value: "tivachat-release-2026.jks · PKCS#12 · alias tivachat", source: "مخزن خصوصی (بازبینی قبلی)", note: "رمز فقط از متغیر محیطی؛ داخل APK یا مخزن عمومی نباشد" },
  { label: "طرح‌های امضای ۱.۰.۱", value: "v1 (JAR) + v2 + v3 — هر سه تأیید شد", source: "jarsigner + APK Sig Block", note: "برای آپدیت همین سه طرح لازم است" },
  { label: "باگ گزارش‌شدهٔ مرورگر", value: "«کروم رو باز کن و بنویس google ai studio» ← اکنون browser_type با متن google ai studio" , source: "آزمون پذیرش", note: "قبلاً compose_message و چک مخاطبین بود" },
  { label: "آیکون شناور", value: "× روی گوشهٔ آیکون + گفتن «آیکون رو بردار» / «آیکون رو برگردون»", source: "FloatingBubble.java", note: "وضعیت در SharedPreferences ذخیره می‌شود" },
  { label: "آلارم", value: "SET_ALARM (مجوز normal) + EXTRA_SKIP_UI=true ← بدون اجازه و بدون باز شدن ساعت", source: "AlarmActions.java", note: "در صورت نادیده گرفتن OEM، صفحهٔ ساعت باز می‌شود" },
  { label: "نسخهٔ منتشرشده", value: "1.0.1 (build 4) — شمارهٔ نسخه تغییر نمی‌کند", source: "بررسی محیط", note: "لینک دانلود رسمی v1.0.1 فعال و هش آن تأیید شده است؛ APK جایگزین ساخته نشد" },
];

export async function ensureSeed(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7712345)`);

    for (const intent of INTENTS) {
      await tx
        .insert(intentClasses)
        .values({
          key: intent.key,
          labelFa: intent.labelFa,
          kind: intent.kind,
          action: intent.action,
          summary: intent.summary,
          risk: intent.risk,
          honestLimit: intent.honestLimit,
          sampleTarget: intent.sampleTarget,
          order: intent.order,
        })
        .onConflictDoUpdate({
          target: intentClasses.key,
          set: {
            labelFa: intent.labelFa,
            kind: intent.kind,
            action: intent.action,
            summary: intent.summary,
            risk: intent.risk,
            honestLimit: intent.honestLimit,
            sampleTarget: intent.sampleTarget,
            order: intent.order,
          },
        });
    }

    for (const app of APPS) {
      await tx
        .insert(appRegistry)
        .values({
          key: app.key,
          nameFa: app.nameFa,
          nameEn: app.nameEn,
          category: app.category,
          aliases: app.aliases,
          dualApp: app.dualApp ?? false,
          packageHint: app.packageHint ?? null,
          packageSource: app.packageSource ?? "runtime",
          note: app.note ?? "",
        })
        .onConflictDoUpdate({
          target: appRegistry.key,
          set: {
            nameFa: app.nameFa,
            nameEn: app.nameEn,
            category: app.category,
            aliases: app.aliases,
            dualApp: app.dualApp ?? false,
            packageHint: app.packageHint ?? null,
            packageSource: app.packageSource ?? "runtime",
            note: app.note ?? "",
          },
        });
    }

    for (const testCase of TEST_CASES) {
      await tx
        .insert(testCases)
        .values({
          key: testCase.key,
          prompt: testCase.prompt,
          group: testCase.group,
          origin: testCase.origin,
          expected: testCase.expected as Record<string, unknown>,
          why: testCase.why,
        })
        .onConflictDoUpdate({
          target: testCases.key,
          set: {
            prompt: testCase.prompt,
            group: testCase.group,
            origin: testCase.origin,
            expected: testCase.expected as Record<string, unknown>,
            why: testCase.why,
          },
        });
    }

    for (const patch of PATCHES) {
      await tx
        .insert(patches)
        .values({
          key: patch.key,
          title: patch.title,
          target: patch.target,
          language: patch.language,
          kind: patch.kind,
          requirement: patch.requirement,
          rationale: patch.rationale,
          content: patch.content,
          order: patch.order,
        })
        .onConflictDoUpdate({
          target: patches.key,
          set: {
            title: patch.title,
            target: patch.target,
            language: patch.language,
            kind: patch.kind,
            requirement: patch.requirement,
            rationale: patch.rationale,
            content: patch.content,
            order: patch.order,
          },
        });
    }

    const existingFacts = await tx.select({ id: signingFacts.id }).from(signingFacts).limit(1);
    if (existingFacts.length === 0) {
      await tx.insert(signingFacts).values(SIGNING_FACTS.map((fact) => ({ ...fact, verified: true })));
    }
  });
}
