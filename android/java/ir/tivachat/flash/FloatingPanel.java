package ir.tivachat.flash;

import android.app.ActivityManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.List;
import java.util.Locale;

/**
 * Small, focusable overlay panel for the assistant.
 *
 * SAFETY CONTRACT:
 * - It never covers the full screen. The window is a bounded card and uses
 *   FLAG_NOT_TOUCH_MODAL, so every touch outside the card goes to the app below.
 * - It is removed on screen-off, on outside touch, from the close button, or on
 *   any construction error. There is no transparent full-screen layer.
 * - The bubble and panel can always be removed from the ongoing notification.
 */
public class FloatingPanel {
    private final Context context;
    private final OverlayService host;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private FrameLayout root;
    private WebView web;
    private WindowManager.LayoutParams params;
    private boolean shown;
    private int baseHeight;
    private int baseY;
    private final Runnable watchdog = this::enforceKeyboardAndBounds;

    public FloatingPanel(OverlayService host) {
        this.host = host;
        this.context = host;
    }

    private int dp(float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public boolean isShown() { return shown; }

    public void show() {
        if (shown) { focusInput(); return; }
        try {
            wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
            DisplayMetrics dm = context.getResources().getDisplayMetrics();
            int width = Math.min(dm.widthPixels - dp(16), dp(470));
            baseHeight = Math.min((int) (dm.heightPixels * 0.72), Math.min(dp(600), dm.heightPixels - dp(120)));
            baseY = Math.max(dp(12), dm.heightPixels - baseHeight - dp(18));

            root = new FrameLayout(context);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.parseColor("#F70A0812"));
            bg.setCornerRadius(dp(24));
            bg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));
            root.setBackground(bg);
            root.setElevation(dp(16));
            root.setClipToOutline(true);

            web = new WebView(context);
            web.setBackgroundColor(Color.TRANSPARENT);
            web.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
            WebSettings settings = web.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(false);
            settings.setSupportZoom(false);
            settings.setMediaPlaybackRequiresUserGesture(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setTextZoom(100);
            web.setWebChromeClient(new WebChromeClient());
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (url.startsWith("file:///android_asset/")) return false;
                    try { context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                    catch (Exception ignored) { }
                    return true;
                }
                @Override public void onPageFinished(WebView view, String url) {
                    view.evaluateJavascript("window.onNativeReady && window.onNativeReady();", null);
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    handler.post(FloatingPanel.this::hide);
                    return true;
                }
            });
            web.addJavascriptInterface(new Bridge(), "TivaNative");
            web.setFocusable(true);
            web.setFocusableInTouchMode(true);
            root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            // Native escape hatch: it exists even if the page fails to load.
            TextView nativeClose = new TextView(context);
            nativeClose.setText("✕");
            nativeClose.setTextSize(16);
            nativeClose.setTextColor(Color.WHITE);
            nativeClose.setGravity(Gravity.CENTER);
            GradientDrawable closeBg = new GradientDrawable();
            closeBg.setShape(GradientDrawable.OVAL);
            closeBg.setColor(Color.parseColor("#CC241A33"));
            closeBg.setStroke(dp(1), Color.parseColor("#55FFFFFF"));
            nativeClose.setBackground(closeBg);
            nativeClose.setContentDescription("بستن فوری پنجره");
            nativeClose.setOnClickListener(v -> hide());
            FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(34), dp(34));
            closeParams.gravity = Gravity.TOP | Gravity.LEFT;
            closeParams.leftMargin = dp(6);
            closeParams.topMargin = dp(6);
            root.addView(nativeClose, closeParams);
            root.setOnTouchListener((view, event) -> {
                if (event.getAction() == MotionEvent.ACTION_OUTSIDE) { hide(); return true; }
                return false;
            });
            root.setFocusableInTouchMode(true);
            root.setOnKeyListener((view, keyCode, event) -> {
                if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                    hide();
                    return true;
                }
                return false;
            });

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            params = new WindowManager.LayoutParams(width, baseHeight, type,
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                            | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
                            | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                    PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.x = 0;
            params.y = baseY;
            params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
            params.setTitle("TivaChat floating panel");

            wm.addView(root, params);
            shown = true;
            web.loadUrl("file:///android_asset/assistant.html?floating=1");
            root.getViewTreeObserver().addOnGlobalLayoutListener(layoutListener);
            web.requestFocus();
            startWatchdog();
        } catch (Throwable error) {
            destroy();
            toast("پنجرهٔ شناور باز نشد؛ هیچ لایه‌ای روی صفحه باقی نماند.");
        }
    }

    private final ViewTreeObserver.OnGlobalLayoutListener layoutListener = this::enforceKeyboardAndBounds;

    private void startWatchdog() {
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, 250);
    }

    /** Moves the card above the keyboard and never lets it exceed the screen. */
    private void enforceKeyboardAndBounds() {
        if (!shown || root == null) return;
        try {
            DisplayMetrics dm = context.getResources().getDisplayMetrics();
            Rect visible = new Rect();
            root.getWindowVisibleDisplayFrame(visible);
            int ime = Math.max(0, dm.heightPixels - visible.bottom);
            int targetHeight = ime > dp(100)
                    ? Math.min(baseHeight, dm.heightPixels - ime - dp(24))
                    : baseHeight;
            targetHeight = Math.max(dp(300), targetHeight);
            int targetY = ime > dp(100)
                    ? Math.max(dp(8), dm.heightPixels - ime - targetHeight - dp(8))
                    : baseY;
            if (params.height != targetHeight || params.y != targetY) {
                params.height = targetHeight;
                params.y = targetY;
                wm.updateViewLayout(root, params);
            }
            handler.postDelayed(watchdog, 220);
        } catch (Exception ignored) { }
    }

    private void focusInput() {
        try { if (web != null) { web.requestFocus(); web.evaluateJavascript("window.focusComposer && window.focusComposer();", null); } }
        catch (Exception ignored) { }
    }

    /** Always safe to call from any thread. Removes the window first, then frees the WebView. */
    public void hide() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post(this::hide);
            return;
        }
        destroyOnMainThread();
        try { host.onPanelClosed(); } catch (Throwable ignored) { }
    }

    /** Called by the service on the main thread. Does not notify the host. */
    public void destroy() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post(this::destroy);
            return;
        }
        destroyOnMainThread();
    }

    private void destroyOnMainThread() {
        shown = false;
        handler.removeCallbacks(watchdog);
        final View localRoot = root;
        final WebView localWeb = web;
        root = null;
        web = null;
        try {
            if (localRoot != null) localRoot.getViewTreeObserver().removeOnGlobalLayoutListener(layoutListener);
        } catch (Exception ignored) { }
        // 1) detach from the window FIRST; this is what makes the X work reliably.
        try {
            if (localRoot != null && wm != null) {
                localRoot.setOnTouchListener(null);
                wm.removeViewImmediate(localRoot);
            }
        } catch (Throwable ignored) {
            try { if (localRoot != null && wm != null) wm.removeView(localRoot); } catch (Throwable ignored2) { }
        }
        // 2) only after the window is gone, release the WebView.
        try {
            if (localWeb != null) {
                localWeb.stopLoading();
                localWeb.removeJavascriptInterface("TivaNative");
                localWeb.setWebChromeClient(null);
                localWeb.setWebViewClient(null);
                localWeb.loadUrl("about:blank");
                localWeb.destroy();
            }
        } catch (Throwable ignored) { }
    }

    /** Detach the overlay, then launch the requested screen on the UI thread. */
    private void launchAndClose(final Intent intent) {
        handler.post(() -> {
            hide();
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                toast("باز کردن صفحه ممکن نشد.");
            }
        });
    }

    public void deliverNativeResult(boolean ok, String message) {
        js("window.onNativeResult && window.onNativeResult(''," + ok + "," + JSONObject.quote(message == null ? "" : message) + ");");
    }

    private void toast(final String message) {
        handler.post(() -> Toast.makeText(context, message, Toast.LENGTH_SHORT).show());
    }

    private void js(final String code) {
        handler.post(() -> { try { if (web != null) web.evaluateJavascript(code, null); } catch (Exception ignored) { } });
    }

    private void setTextZoomByKeyboard(boolean open) {
        try { if (web != null) web.evaluateJavascript("document.body.classList.toggle('kb-open'," + open + ");", null); }
        catch (Exception ignored) { }
    }

    // ------------------------------------------------------------------
    // Bridge exposed to the local asset page
    // ------------------------------------------------------------------
    private class Bridge {
        @JavascriptInterface public boolean isFloating() { return true; }
        @JavascriptInterface public String version() {
            try { return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName; }
            catch (Exception e) { return "1.0.0"; }
        }
        @JavascriptInterface public void closeOverlayChat() { handler.post(FloatingPanel.this::hide); }
        @JavascriptInterface public void minimizeOverlayChat() { handler.post(FloatingPanel.this::hide); }
        @JavascriptInterface public void openFullApp() {
            handler.post(() -> {
                hide();
                try {
                    Intent intent = new Intent(context, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(intent);
                } catch (Exception ignored) { }
            });
        }
        @JavascriptInterface public void setPanelIme(boolean open) { setTextZoomByKeyboard(open); }

        @JavascriptInterface public String deviceInfo() {
            JSONObject out = new JSONObject();
            try {
                Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                int level = battery != null ? battery.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) : 0;
                int scale = battery != null ? battery.getIntExtra(BatteryManager.EXTRA_SCALE, 100) : 100;
                int status = battery != null ? battery.getIntExtra(BatteryManager.EXTRA_STATUS, 0) : 0;
                int temp = battery != null ? battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) : 0;
                int voltage = battery != null ? battery.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) : 0;
                out.put("battery", scale > 0 ? Math.round(level * 100f / scale) : 0);
                out.put("batteryTemp", Math.round(temp / 10f * 10f) / 10f);
                out.put("voltage", voltage);
                out.put("status", status == BatteryManager.BATTERY_STATUS_CHARGING ? "در حال شارژ"
                        : status == BatteryManager.BATTERY_STATUS_FULL ? "شارژ کامل" : "در حال مصرف");
                out.put("health", "نامشخص");
                out.put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING
                        || status == BatteryManager.BATTERY_STATUS_FULL);
                ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
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
                out.put("cpuTemp", temperature());
                out.put("model", Build.MANUFACTURER + " " + Build.MODEL);
                out.put("android", Build.VERSION.RELEASE);
                out.put("arch", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "");
                out.put("uptime", SystemClock.elapsedRealtime() / 60000);
                out.put("apps", launchableCount());
                out.put("overlay", Settings.canDrawOverlays(context));
                out.put("accessibility", accessibilityEnabled());
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                out.put("batteryOpt", pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName()));
                out.put("notifications", true);
                out.put("vaultCount", 0);
                out.put("version", version());
            } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface public String listApps() { return appsJson(); }
        @JavascriptInterface public String permissions() {
            JSONObject out = new JSONObject();
            try {
                out.put("overlay", Settings.canDrawOverlays(context));
                out.put("accessibility", accessibilityEnabled());
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                out.put("batteryOpt", pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName()));
                out.put("notifications", true);
            } catch (Exception ignored) { }
            return out.toString();
        }
        @JavascriptInterface public void openPermission(String key) {
            openSettings("overlay".equals(key) || "accessibility".equals(key) || "batteryOpt".equals(key) ? key : "apps");
        }
        @JavascriptInterface public String openApp(String pkg) {
            try {
                android.content.Intent launch = context.getPackageManager().getLaunchIntentForPackage(pkg);
                if (launch == null) return "{\"ok\":false,\"message\":\"برنامه پیدا نشد.\"}";
                launchAndClose(launch);
                return "{\"ok\":true,\"message\":\"برنامه باز شد.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"باز کردن برنامه ممکن نشد.\"}"; }
        }
        @JavascriptInterface public void openSettings(String key) {
            Intent intent = new Intent(Settings.ACTION_SETTINGS);
            if ("wifi".equals(key)) intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            else if ("bluetooth".equals(key)) intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            else if ("display".equals(key)) intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS);
            else if ("sound".equals(key)) intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
            else if ("battery".equals(key)) intent = new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS);
            else if ("apps".equals(key)) intent = new Intent(Settings.ACTION_APPLICATION_SETTINGS);
            else if ("storage".equals(key)) intent = new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS);
            else if ("accessibility".equals(key)) intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            else if ("overlay".equals(key)) intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.getPackageName()));
            else if ("batteryOpt".equals(key)) intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + context.getPackageName()));
            launchAndClose(intent);
        }
        @JavascriptInterface public String searchWeb(String query) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(query)));
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"جست‌وجو باز شد.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"مرورگر باز نشد.\"}"; }
        }
        @JavascriptInterface public String setAlarm(int hour, int minute, String label) {
            try {
                Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
                        .putExtra(AlarmClock.EXTRA_HOUR, hour).putExtra(AlarmClock.EXTRA_MINUTES, minute)
                        .putExtra(AlarmClock.EXTRA_MESSAGE, label == null ? "تیواچت" : label)
                        .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"آلارم تنظیم شد.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"آلارم تنظیم نشد.\"}"; }
        }
        @JavascriptInterface public String setTimer(int seconds, String label) {
            try {
                Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER)
                        .putExtra(AlarmClock.EXTRA_LENGTH, Math.max(1, seconds))
                        .putExtra(AlarmClock.EXTRA_MESSAGE, label == null ? "تیواچت" : label)
                        .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"تایمر تنظیم شد.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"تایمر تنظیم نشد.\"}"; }
        }
        @JavascriptInterface public String flashlight(boolean on) {
            try {
                CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
                for (String id : manager.getCameraIdList()) {
                    Boolean available = manager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                    if (available != null && available) {
                        manager.setTorchMode(id, on);
                        return "{\"ok\":true,\"message\":\"" + (on ? "چراغ‌قوه روشن شد." : "چراغ‌قوه خاموش شد.") + "\"}";
                    }
                }
                return "{\"ok\":false,\"message\":\"چراغ‌قوه در دسترس نیست.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"چراغ‌قوه در دسترس نیست.\"}"; }
        }
        @JavascriptInterface public void confirmAction(String action, String payloadJson) {
            try {
                JSONObject payload = new JSONObject(payloadJson == null ? "{}" : payloadJson);
                Intent intent = null;
                if ("call".equals(action)) {
                    intent = new Intent(context, ContactResolverActivity.class)
                            .putExtra("number", payload.optString("number"))
                            .putExtra("contact", payload.optString("contact"));
                } else if ("sms".equals(action)) {
                    intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(payload.optString("number"))))
                            .putExtra("sms_body", payload.optString("text"));
                } else if ("uninstall".equals(action)) {
                    intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + payload.optString("pkg")));
                }
                if (intent != null) {
                    host.emitNativeResult(true, "صفحهٔ تأیید سیستم باز شد.");
                    launchAndClose(intent);
                } else host.emitNativeResult(false, "این عملیات پشتیبانی نمی‌شود.");
            } catch (Exception e) { host.emitNativeResult(false, "اقدام انجام نشد."); }
        }
        @JavascriptInterface public String accessibilityAction(String action) {
            boolean ok = AssistantAccessibilityService.perform(action);
            return "{\"ok\":" + ok + ",\"message\":\"" + (ok ? "انجام شد." : "سرویس دسترس‌پذیری فعال نیست.") + "\"}";
        }
        @JavascriptInterface public String composeMessage(String pkg, String contact, String message, boolean send) {
            JSONObject out = new JSONObject();
            try {
                if (!accessibilityEnabled()) {
                    out.put("started", false);
                    out.put("message", "برای نوشتن پیام، سرویس دسترس‌پذیری را فعال کنید.");
                    return out.toString();
                }
                AssistantAccessibilityService.setAutomationListener(new AssistantAccessibilityService.AutomationListener() {
                    @Override public void onProgress(int percent, String stage) { }
                    @Override public void onResult(boolean ok, String text) { toast(text); }
                });
                handler.post(FloatingPanel.this::hide);
                AssistantAccessibilityService.composeMessage(pkg, contact, message, send);
                out.put("started", true);
                out.put("message", "در حال جست‌وجوی گفتگو…");
            } catch (Exception ignored) { }
            return out.toString();
        }
        @JavascriptInterface public String resolveContact(String contact) {
            try {
                Intent intent = new Intent(context, ContactResolverActivity.class)
                        .putExtra("contact", contact == null ? "" : contact)
                        .putExtra("number", "");
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"در حال جست‌وجوی مخاطب و درخواست تأیید…\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"جست‌وجوی مخاطب ممکن نشد.\"}"; }
        }

        @JavascriptInterface public String openAppInfo(String pkg) {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + pkg));
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"صفحهٔ اطلاعات برنامه باز شد؛ برای توقف، Force stop را خودتان بزنید.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"صفحهٔ اطلاعات باز نشد.\"}"; }
        }
        @JavascriptInterface public String openMediaPicker(String mime) {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime == null || mime.isEmpty() ? "image/*" : mime);
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"مرورگر رسمی رسانه باز شد؛ انتخاب و حذف نهایی با شماست.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"مرورگر رسانه باز نشد.\"}"; }
        }
        @JavascriptInterface public String openFilePicker() {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*");
                launchAndClose(intent);
                return "{\"ok\":true,\"message\":\"مرورگر رسمی فایل‌ها باز شد؛ حذف نهایی با تأیید سیستم است.\"}";
            } catch (Exception e) { return "{\"ok\":false,\"message\":\"صفحهٔ فایل‌ها باز نشد.\"}"; }
        }
        @JavascriptInterface public String setBubble(boolean on) { if (!on) handler.post(host::stopEverything); return "{\"ok\":true}"; }
        @JavascriptInterface public String setEdgeGesture(boolean on) { host.setEdgeEnabled(on); return "{\"ok\":true}"; }
        @JavascriptInterface public boolean isEdgeEnabled() { return host.isEdgeEnabled(); }
        @JavascriptInterface public void copyText(String text) {
            try {
                ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("tivachat", text));
                toast("کپی شد.");
            } catch (Exception ignored) { }
        }
        @JavascriptInterface public String vaultList() { return "{\"locked\":true}"; }
        @JavascriptInterface public String vaultAdd(String a, String u, String p) { return "{\"ok\":false,\"message\":\"برای گاوصندوق برنامهٔ کامل را باز کنید.\"}"; }
        @JavascriptInterface public String vaultReveal(String id) { return "{}"; }
        @JavascriptInterface public String vaultDelete(String id) { return "{\"ok\":false,\"message\":\"برای گاوصندوق برنامهٔ کامل را باز کنید.\"}"; }
        @JavascriptInterface public String vaultStatus() { return "{\"unlocked\":false,\"count\":0}"; }
        @JavascriptInterface public void requestVaultUnlock() { toast("برای گاوصندوق، برنامهٔ کامل را باز کنید."); }
        @JavascriptInterface public void lockVault() { }
        @JavascriptInterface public void startVoice() { toast("صفحهٔ کامل را برای ورودی صوتی باز کنید."); }
    }

    private String temperature() {
        for (int i = 0; i < 8; i++) {
            try (BufferedReader reader = new BufferedReader(new FileReader("/sys/class/thermal/thermal_zone" + i + "/temp"))) {
                String line = reader.readLine();
                if (line == null) continue;
                float value = Float.parseFloat(line.trim());
                if (value > 1000) value = value / 1000f;
                if (value > 5 && value < 120) return String.valueOf(Math.round(value * 10f) / 10f);
            } catch (Exception ignored) { }
        }
        return "0";
    }

    private int launchableCount() {
        try {
            Intent main = new Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> list = context.getPackageManager().queryIntentActivities(main, 0);
            return list == null ? 0 : list.size();
        } catch (Exception e) { return 0; }
    }

    private boolean accessibilityEnabled() {
        String enabled = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled != null && enabled.contains(context.getPackageName() + "/" + AssistantAccessibilityService.class.getName());
    }

    private String appsJson() {
        JSONArray out = new JSONArray();
        try {
            Intent main = new Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> list = context.getPackageManager().queryIntentActivities(main, 0);
            java.util.HashSet<String> seen = new java.util.HashSet<>();
            for (ResolveInfo info : list) {
                String pkg = info.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                if (context.getPackageManager().getLaunchIntentForPackage(pkg) == null) continue;
                JSONObject row = new JSONObject();
                row.put("pkg", pkg);
                row.put("label", info.loadLabel(context.getPackageManager()).toString());
                row.put("sys", (info.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                out.put(row);
                if (out.length() >= 350) break;
            }
        } catch (Exception ignored) { }
        return out.toString();
    }
}
