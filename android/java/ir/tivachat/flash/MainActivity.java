package ir.tivachat.flash;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.app.ActivityManager;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.FileReader;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int VAULT_REQUEST = 501;
    private static final int VOICE_REQUEST = 502;
    private WebView web;
    private Vault vault;
    private boolean vaultAuthorized = false;
    private final Object vaultLock = new Object();

    /** Overridden by the transparent floating-chat activity. */
    protected boolean isFloatingMode() { return false; }

    /** Overridden by the floating activity to make the host window transparent. */
    protected void configureWindow(Window window) {
        window.setStatusBarColor(0xFF08070D);
        window.setNavigationBarColor(0xFF08070D);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        configureWindow(window);
        vault = new Vault(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFF08070D);
        web.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:///android_asset/")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) { }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("window.onNativeReady && window.onNativeReady();", null);
            }
        });
        web.addJavascriptInterface(new Bridge(), "TivaNative");
        setContentView(web);
        web.loadUrl("file:///android_asset/assistant.html");
    }

    @Override protected void onResume() {
        super.onResume();
        requestNotificationPermission();
        maybeStartBubble();
    }

    private void maybeStartBubble() {
        try {
            SharedPreferences state = getSharedPreferences("tiva_state", MODE_PRIVATE);
            if (state.getBoolean("bubble_disabled", false)) return;
            if (!overlayAllowed() || OverlayService.running) return;
            Intent intent = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
            else startService(intent);
        } catch (Exception ignored) { }
    }

    /** Kept for bridge compatibility; there is no floating activity any more. */
    protected void finishFloating() { finish(); }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false;", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    private void toast(final String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
    }

    private void js(final String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    private void callback(String action, boolean ok, String message) {
        js("window.onNativeResult && window.onNativeResult(" + JSONObject.quote(action) + "," + ok + "," + JSONObject.quote(message) + ");");
    }

    private boolean overlayAllowed() { return Settings.canDrawOverlays(this); }

    private boolean accessibilityEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled != null && enabled.contains(getPackageName() + "/" + AssistantAccessibilityService.class.getName());
    }

    private boolean batteryIgnored() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private boolean notificationsAllowed() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    // ---------------- Device reports ----------------

    private String deviceInfo() {
        JSONObject out = new JSONObject();
        try {
            Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int level = 0, scale = 100, voltage = 0, health = 0, status = 0, tempTenths = 0;
            if (battery != null) {
                level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, 0);
                scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                voltage = battery.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0);
                health = battery.getIntExtra(BatteryManager.EXTRA_HEALTH, 0);
                status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, 0);
                tempTenths = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0);
            }
            int percent = scale > 0 ? Math.round(level * 100f / scale) : 0;
            out.put("battery", percent);
            out.put("batteryTemp", Math.round(tempTenths / 10f * 10f) / 10f);
            out.put("voltage", voltage);
            out.put("health", healthLabel(health));
            out.put("status", statusLabel(status));
            out.put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);

            ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            if (am != null) am.getMemoryInfo(memory);
            out.put("ramTotal", Math.round(memory.totalMem / 1048576.0));
            out.put("ramAvail", Math.round(memory.availMem / 1048576.0));
            out.put("ramUsed", Math.round((memory.totalMem - memory.availMem) / 1048576.0));
            out.put("lowRam", memory.lowMemory);

            StatFs stat = new StatFs(Environment.getDataDirectory().getAbsolutePath());
            long total = stat.getBlockCountLong() * stat.getBlockSizeLong();
            long free = stat.getAvailableBlocksLong() * stat.getBlockSizeLong();
            out.put("storageTotal", Math.round(total / 1073741824.0 * 10) / 10.0);
            out.put("storageFree", Math.round(free / 1073741824.0 * 10) / 10.0);
            out.put("storageUsed", Math.round((total - free) / 1073741824.0 * 10) / 10.0);

            out.put("cpu", Build.HARDWARE);
            out.put("cores", Runtime.getRuntime().availableProcessors());
            out.put("cpuTemp", cpuTemperature());
            out.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            out.put("android", Build.VERSION.RELEASE);
            out.put("arch", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : Build.CPU_ABI);
            out.put("uptime", SystemClock.elapsedRealtime() / 60000);
            out.put("apps", countLaunchableApps());
            out.put("overlay", overlayAllowed());
            out.put("accessibility", accessibilityEnabled());
            out.put("batteryOpt", batteryIgnored());
            out.put("notifications", notificationsAllowed());
            out.put("vaultCount", vault.count());
            out.put("version", versionName());
        } catch (Exception e) {
            try { out.put("error", "خواندن اطلاعات دستگاه کامل نشد"); } catch (Exception ignored) { }
        }
        return out.toString();
    }

    private float cpuTemperature() {
        for (int i = 0; i < 8; i++) {
            try (BufferedReader reader = new BufferedReader(new FileReader("/sys/class/thermal/thermal_zone" + i + "/temp"))) {
                String line = reader.readLine();
                if (line == null) continue;
                float value = Float.parseFloat(line.trim());
                if (value > 1000) value = value / 1000f;
                if (value > 5 && value < 120) return Math.round(value * 10f) / 10f;
            } catch (Exception ignored) { }
        }
        return 0f;
    }

    private String healthLabel(int health) {
        switch (health) {
            case BatteryManager.BATTERY_HEALTH_GOOD: return "خوب";
            case BatteryManager.BATTERY_HEALTH_OVERHEAT: return "دمای بالا";
            case BatteryManager.BATTERY_HEALTH_COLD: return "دمای پایین";
            case BatteryManager.BATTERY_HEALTH_DEAD: return "نیازمند بررسی";
            case BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE: return "ولتاژ بالا";
            default: return "نامشخص";
        }
    }

    private String statusLabel(int status) {
        switch (status) {
            case BatteryManager.BATTERY_STATUS_CHARGING: return "در حال شارژ";
            case BatteryManager.BATTERY_STATUS_FULL: return "شارژ کامل";
            case BatteryManager.BATTERY_STATUS_DISCHARGING: return "در حال مصرف";
            case BatteryManager.BATTERY_STATUS_NOT_CHARGING: return "شارژ نمی‌شود";
            default: return "نامشخص";
        }
    }

    private String versionName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "1.0.0"; }
    }

    private int countLaunchableApps() {
        Intent main = new Intent(Intent.ACTION_MAIN, null);
        main.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> list = getPackageManager().queryIntentActivities(main, 0);
        return list == null ? 0 : list.size();
    }

    private String appsJson() {
        JSONArray out = new JSONArray();
        try {
            Intent main = new Intent(Intent.ACTION_MAIN, null);
            main.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> list = getPackageManager().queryIntentActivities(main, 0);
            final Collator collator = Collator.getInstance(new Locale("fa", "IR"));
            List<ResolveInfo> sorted = new ArrayList<>(list);
            Collections.sort(sorted, new Comparator<ResolveInfo>() {
                @Override public int compare(ResolveInfo a, ResolveInfo b) {
                    return collator.compare(a.loadLabel(getPackageManager()).toString(), b.loadLabel(getPackageManager()).toString());
                }
            });
            java.util.HashSet<String> seen = new java.util.HashSet<>();
            for (ResolveInfo info : sorted) {
                String pkg = info.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                if (getPackageManager().getLaunchIntentForPackage(pkg) == null) continue;
                JSONObject row = new JSONObject();
                row.put("pkg", pkg);
                row.put("label", info.loadLabel(getPackageManager()).toString());
                row.put("sys", (info.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                out.put(row);
                if (out.length() >= 450) break;
            }
        } catch (Exception ignored) { }
        return out.toString();
    }

    private String permissionsJson() {
        JSONObject out = new JSONObject();
        try {
            out.put("overlay", overlayAllowed());
            out.put("accessibility", accessibilityEnabled());
            out.put("batteryOpt", batteryIgnored());
            out.put("notifications", notificationsAllowed());
        } catch (Exception ignored) { }
        return out.toString();
    }

    // ---------------- Safe intents and actions ----------------

    private String safeStart(Intent intent, String success) {
        JSONObject out = new JSONObject();
        try {
            startActivity(intent);
            out.put("ok", true);
            out.put("message", success);
        } catch (Exception e) {
            try { out.put("ok", false); out.put("message", "برنامه یا تنظیمات موردنظر روی این دستگاه در دسترس نیست."); }
            catch (Exception ignored) { }
        }
        return out.toString();
    }

    private void openSettingsKey(String key) {
        Intent intent = new Intent(Settings.ACTION_SETTINGS);
        if ("wifi".equals(key)) intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
        else if ("bluetooth".equals(key)) intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        else if ("display".equals(key)) intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS);
        else if ("sound".equals(key)) intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
        else if ("battery".equals(key)) intent = new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS);
        else if ("apps".equals(key)) intent = new Intent(Settings.ACTION_APPLICATION_SETTINGS);
        else if ("storage".equals(key)) intent = new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS);
        else if ("accessibility".equals(key)) intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        else if ("notifications".equals(key)) intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        else if ("usage".equals(key)) intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        else if ("overlay".equals(key)) intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
        else if ("unknown".equals(key)) intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
        else if ("batteryOpt".equals(key)) intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()));
        try { startActivity(intent); } catch (Exception e) { toast("این بخش تنظیمات باز نشد."); }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsAllowed()) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 91);
        }
    }

    private void toggleBubble(boolean on) {
        if (on) {
            if (!overlayAllowed()) {
                openSettingsKey("overlay");
                toast("اجازه نمایش روی برنامه‌ها را روشن کنید، سپس دوباره امتحان کنید.");
                return;
            }
            requestNotificationPermission();
            Intent intent = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
            else startService(intent);
            toast("آیکون شناور فعال شد.");
        } else {
            stopService(new Intent(this, OverlayService.class));
            toast("آیکون شناور بسته شد.");
        }
    }

    private void runConfirmed(String action, JSONObject payload) {
        String message;
        if ("call".equals(action)) {
            String number = payload.optString("number", "").trim();
            String contact = payload.optString("contact", "").trim();
            Intent intent = new Intent(this, ContactResolverActivity.class)
                    .putExtra("number", number)
                    .putExtra("contact", contact);
            message = safeStart(intent, "شماره‌گیر باز شد؛ برقراری نهایی با شماست.");
        } else if ("sms".equals(action)) {
            String number = payload.optString("number", "").trim();
            String text = payload.optString("text", "");
            if (number.isEmpty()) { callback(action, false, "شماره‌ای مشخص نشده است."); return; }
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)));
            intent.putExtra("sms_body", text);
            message = safeStart(intent, "پیش‌نویس پیامک آماده شد؛ ارسال با تأیید شما انجام می‌شود.");
        } else if ("uninstall".equals(action)) {
            String pkg = payload.optString("pkg", "");
            if (pkg.isEmpty()) { callback(action, false, "برنامه‌ای مشخص نشده است."); return; }
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            message = safeStart(intent, "صفحه اطلاعات برنامه باز شد؛ برای حذف، دکمهٔ سیستمی را خودتان بزنید.");
        } else {
            callback(action, false, "این عملیات در فهرست مجاز نیست.");
            return;
        }
        try { callback(action, new JSONObject(message).optBoolean("ok"), new JSONObject(message).optString("message")); }
        catch (Exception e) { callback(action, false, "اقدام انجام نشد."); }
    }

    private void askConfirmation(final String action, final JSONObject payload) {
        String title, message, positive;
        if ("call".equals(action)) { title = "تأیید تماس"; message = "شماره‌گیر با شماره مشخص‌شده باز شود؟"; positive = "باز کردن شماره‌گیر"; }
        else if ("sms".equals(action)) { title = "تأیید پیامک"; message = "پیش‌نویس پیامک برای این شماره آماده شود؟ ارسال نهایی با شماست."; positive = "ادامه"; }
        else if ("uninstall".equals(action)) { title = "تأیید حذف برنامه"; message = "صفحه حذف این برنامه باز شود؟ حذف نهایی را سیستم اندروید تأیید می‌کند."; positive = "باز کردن صفحه حذف"; }
        else { callback(action, false, "این عملیات تأییدپذیر نیست."); return; }
        runOnUiThread(() -> {
            AlertDialog.Builder builder = new AlertDialog.Builder(this)
                    .setTitle(title)
                    .setMessage(message)
                    .setNegativeButton("لغو", (dialog, which) -> callback(action, false, "عملیات لغو شد؛ هیچ تغییری اعمال نشد."))
                    .setPositiveButton(positive, (dialog, which) -> runConfirmed(action, payload));
            AlertDialog dialog = builder.create();
            dialog.setCanceledOnTouchOutside(false);
            dialog.show();
        });
    }

    private boolean flashlight(boolean on) {
        try {
            CameraManager manager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
            if (manager == null) return false;
            for (String id : manager.getCameraIdList()) {
                Boolean available = manager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (available != null && available) {
                    manager.setTorchMode(id, on);
                    return true;
                }
            }
        } catch (Exception ignored) { }
        return false;
    }

    private void beginVaultUnlock() {
        KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (keyguard == null || !keyguard.isDeviceSecure()) {
            js("window.onVaultState && window.onVaultState(false,'برای گاوصندوق ابتدا قفل صفحه یا اثر انگشت تنظیم کنید.');");
            return;
        }
        Intent intent = keyguard.createConfirmDeviceCredentialIntent("گاوصندوق تیواچت", "هویت خود را برای دسترسی به رمزها تأیید کنید");
        if (intent == null) {
            js("window.onVaultState && window.onVaultState(false,'قفل امن روی این دستگاه فعال نیست.');");
            return;
        }
        startActivityForResult(intent, VAULT_REQUEST);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VAULT_REQUEST) {
            synchronized (vaultLock) { vaultAuthorized = resultCode == RESULT_OK; }
            boolean ok = resultCode == RESULT_OK;
            js("window.onVaultState && window.onVaultState(" + ok + ",'" + (ok ? "گاوصندوق باز شد؛ فقط روی همین دستگاه." : "دسترسی لغو شد.") + "');");
            if (ok) js("window.onVaultData && window.onVaultData(" + vault.maskedList() + ");");
        } else if (requestCode == VOICE_REQUEST && resultCode == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                String text = results.get(0).replace("'", " ").replace("\n", " ");
                js("window.onVoiceResult && window.onVoiceResult(" + JSONObject.quote(text) + ");");
            }
        }
    }

    private class Bridge {
        @JavascriptInterface public String version() { return versionName(); }

        @JavascriptInterface public String deviceInfo() { return MainActivity.this.deviceInfo(); }

        @JavascriptInterface public String listApps() { return appsJson(); }

        @JavascriptInterface public String permissions() { return permissionsJson(); }

        @JavascriptInterface public void openPermission(String key) { openSettingsKey(key); }

        @JavascriptInterface public String openApp(String pkg) {
            JSONObject out = new JSONObject();
            try {
                Intent launch = getPackageManager().getLaunchIntentForPackage(pkg);
                if (launch == null) {
                    out.put("ok", false);
                    out.put("message", "این برنامه نصب نیست یا اجرای آن از این مسیر ممکن نیست.");
                } else {
                    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launch);
                    out.put("ok", true);
                    out.put("message", "برنامه باز شد.");
                }
            } catch (Exception e) {
                try { out.put("ok", false); out.put("message", "باز کردن برنامه ممکن نشد."); } catch (Exception ignored) { }
            }
            return out.toString();
        }

        @JavascriptInterface public String appInfo(String pkg) {
            return safeStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)), "اطلاعات برنامه باز شد.");
        }

        @JavascriptInterface public void openSettings(String key) { openSettingsKey(key); }

        @JavascriptInterface public String openAppInfo(String pkg) { return appInfo(pkg); }

        @JavascriptInterface public String resolveContact(String contact) {
            try {
                Intent intent = new Intent(MainActivity.this, ContactResolverActivity.class)
                        .putExtra("contact", contact == null ? "" : contact)
                        .putExtra("number", "");
                startActivity(intent);
                return "{\"ok\":true,\"message\":\"در حال جست‌وجوی مخاطب و درخواست تأیید…\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"جست‌وجوی مخاطب ممکن نشد.\"}"; }
        }

        @JavascriptInterface public String openMediaPicker(String mime) {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime == null || mime.isEmpty() ? "image/*" : mime);
                return safeStart(intent, "مرورگر رسمی رسانه باز شد؛ انتخاب و حذف نهایی با شماست.");
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"مرورگر رسانه باز نشد.\"}"; }
        }

        @JavascriptInterface public String openFilePicker() {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*");
                return safeStart(intent, "مرورگر رسمی فایل‌ها باز شد؛ حذف نهایی با تأیید سیستم است.");
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"صفحهٔ فایل‌ها باز نشد.\"}"; }
        }

        @JavascriptInterface public String searchWeb(String query) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(query)));
                return safeStart(intent, "نتایج جست‌وجو در مرورگر باز شد.");
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"مرورگر باز نشد.\"}"; }
        }

        @JavascriptInterface public String setAlarm(int hour, int minute, String label) {
            Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
                    .putExtra(AlarmClock.EXTRA_HOUR, hour)
                    .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    .putExtra(AlarmClock.EXTRA_MESSAGE, label == null ? "تیواچت" : label)
                    .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
            return safeStart(intent, "آلارم در ساعت مشخص‌شده تنظیم شد.");
        }

        @JavascriptInterface public String setTimer(int seconds, String label) {
            Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER)
                    .putExtra(AlarmClock.EXTRA_LENGTH, Math.max(1, seconds))
                    .putExtra(AlarmClock.EXTRA_MESSAGE, label == null ? "تیواچت" : label)
                    .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
            return safeStart(intent, "تایمر تنظیم شد.");
        }

        @JavascriptInterface public String flashlight(boolean on) {
            JSONObject out = new JSONObject();
            try {
                boolean ok = MainActivity.this.flashlight(on);
                out.put("ok", ok);
                out.put("message", ok ? (on ? "چراغ‌قوه روشن شد." : "چراغ‌قوه خاموش شد.") : "چراغ‌قوه روی این دستگاه در دسترس نیست.");
            } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface public void confirmAction(String action, String payloadJson) {
            try { askConfirmation(action, new JSONObject(payloadJson == null ? "{}" : payloadJson)); }
            catch (Exception e) { callback(action, false, "درخواست معتبر نبود."); }
        }

        @JavascriptInterface public String accessibilityAction(String action) {
            JSONObject out = new JSONObject();
            try {
                boolean ok = AssistantAccessibilityService.perform(action);
                out.put("ok", ok);
                out.put("message", ok ? "دستور دسترس‌پذیری اجرا شد." : "سرویس دسترس‌پذیری فعال نیست.");
            } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface public String setBubble(boolean on) {
            getSharedPreferences("tiva_state", MODE_PRIVATE).edit()
                    .putBoolean("bubble_enabled", on)
                    .putBoolean("bubble_disabled", !on)
                    .apply();
            toggleBubble(on);
            JSONObject out = new JSONObject();
            try { out.put("ok", on ? overlayAllowed() : true); } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface public void startVoice() {
            Intent intent = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "fa-IR");
            intent.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "دستور فارسی خود را بگویید");
            try { startActivityForResult(intent, VOICE_REQUEST); }
            catch (Exception e) { toast("موتور تشخیص گفتار روی این دستگاه پیدا نشد."); }
        }

        @JavascriptInterface public void copyText(String text) {
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (clipboard != null) clipboard.setPrimaryClip(android.content.ClipData.newPlainText("tivachat", text));
            toast("در حافظه کپی شد.");
        }

        @JavascriptInterface public boolean isFloating() { return isFloatingMode(); }

        @JavascriptInterface public String setEdgeGesture(boolean on) {
            getSharedPreferences("tiva_state", MODE_PRIVATE).edit().putBoolean("edge_enabled", on).apply();
            try {
                Intent intent = new Intent(MainActivity.this, OverlayService.class)
                        .setAction(OverlayService.ACTION_EDGE)
                        .putExtra(OverlayService.EXTRA_EDGE_ON, on);
                if (on && !OverlayService.running && overlayAllowed()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
                    else startService(intent);
                } else if (OverlayService.running) {
                    startService(intent);
                }
                if (on && !overlayAllowed()) openSettingsKey("overlay");
            } catch (Exception ignored) { }
            return "{\"ok\":true}";
        }

        @JavascriptInterface public boolean isEdgeEnabled() {
            return getSharedPreferences("tiva_state", MODE_PRIVATE).getBoolean("edge_enabled", false);
        }

        @JavascriptInterface public void closeOverlayChat() {
            runOnUiThread(() -> { if (isFloatingMode()) finishFloating(); });
        }

        @JavascriptInterface public void openFullApp() {
            runOnUiThread(() -> {
                Intent intent = new Intent(MainActivity.this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(intent);
                if (isFloatingMode()) finishFloating();
            });
        }

        @JavascriptInterface public String composeMessage(String pkg, String contact, String message, boolean send) {
            JSONObject out = new JSONObject();
            try {
                if (!accessibilityEnabled()) {
                    out.put("started", false);
                    out.put("message", "برای نوشتن پیام در برنامه‌های دیگر، سرویس دسترس‌پذیری تیواچت را فعال کنید.");
                    return out.toString();
                }
                if (pkg == null || pkg.trim().isEmpty() || message == null || message.trim().isEmpty()) {
                    out.put("started", false);
                    out.put("message", "نام برنامه و متن پیام لازم است.");
                    return out.toString();
                }
                AssistantAccessibilityService.setAutomationListener(new AssistantAccessibilityService.AutomationListener() {
                    @Override public void onProgress(int percent, String stage) {
                        js("window.onAutomationProgress && window.onAutomationProgress(" + percent + "," + JSONObject.quote(stage) + ");");
                    }
                    @Override public void onResult(boolean ok, String textMessage) {
                        js("window.onAutomationResult && window.onAutomationResult(" + ok + "," + JSONObject.quote(textMessage) + ");");
                    }
                });
                AssistantAccessibilityService.composeMessage(pkg, contact, message, send);
                out.put("started", true);
                out.put("message", "برنامه باز شد؛ در حال جست‌وجوی گفتگو…");
            } catch (Exception e) {
                try { out.put("started", false); out.put("message", "شروع عملیات ممکن نشد."); } catch (Exception ignored) { }
            }
            return out.toString();
        }

        @JavascriptInterface public void requestVaultUnlock() { runOnUiThread(MainActivity.this::beginVaultUnlock); }

        @JavascriptInterface public void lockVault() { synchronized (vaultLock) { vaultAuthorized = false; } }

        @JavascriptInterface public String vaultList() {
            synchronized (vaultLock) { return vaultAuthorized ? vault.maskedList() : "{\"locked\":true}"; }
        }

        @JavascriptInterface public String vaultAdd(String app, String user, String pass) {
            synchronized (vaultLock) {
                if (!vaultAuthorized) return "{\"ok\":false,\"message\":\"ابتدا گاوصندوق را باز کنید.\"}";
                if (app == null || app.trim().isEmpty() || pass == null || pass.isEmpty())
                    return "{\"ok\":false,\"message\":\"نام برنامه و رمز لازم است.\"}";
                boolean ok = vault.add(app.trim(), user == null ? "" : user.trim(), pass);
                return "{\"ok\":" + ok + ",\"message\":\"" + (ok ? "رمز رمزنگاری‌شده ذخیره شد." : "ذخیره ممکن نشد.") + "\"}";
            }
        }

        @JavascriptInterface public String vaultReveal(String id) {
            synchronized (vaultLock) { return vaultAuthorized ? vault.reveal(id) : "{}"; }
        }

        @JavascriptInterface public String vaultDelete(String id) {
            synchronized (vaultLock) {
                if (!vaultAuthorized) return "{\"ok\":false,\"message\":\"ابتدا گاوصندوق را باز کنید.\"}";
                boolean ok = vault.delete(id);
                return "{\"ok\":" + ok + ",\"message\":\"" + (ok ? "رمز حذف شد." : "حذف ممکن نشد.") + "\"}";
            }
        }

        @JavascriptInterface public String vaultStatus() {
            synchronized (vaultLock) {
                try { return "{\"unlocked\":" + vaultAuthorized + ",\"count\":" + vault.count() + "}"; }
                catch (Exception e) { return "{\"unlocked\":false,\"count\":0}"; }
            }
        }
    }
}
