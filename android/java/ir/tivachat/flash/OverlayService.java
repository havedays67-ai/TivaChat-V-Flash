package ir.tivachat.flash;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Foreground service hosting the floating bubble and the bounded chat panel.
 *
 * It deliberately owns no full-screen window. The bubble is 56dp, the panel is a
 * card smaller than the screen and FLAG_NOT_TOUCH_MODAL, and the optional edge
 * strip is at most 18dp wide. Everything outside those areas stays interactive.
 */
public class OverlayService extends Service {
    public static final String ACTION_START = "start";
    public static final String ACTION_STOP = "stop";
    public static final String ACTION_PANEL = "panel";
    public static final String ACTION_EDGE = "edge";
    public static final String EXTRA_EDGE_ON = "edge_on";
    private static final String CHANNEL = "tiva_ready";
    private static final String EDGE_CHANNEL = "tiva_edge";
    public static boolean running = false;

    private WindowManager windowManager;
    private FrameLayout bubble;
    private View edgeView;
    private WindowManager.LayoutParams bubbleParams;
    private WindowManager.LayoutParams edgeParams;
    private FloatingPanel panel;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable fade;
    private boolean screenOn = true;

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                screenOn = false;
                if (panel != null) panel.hide();
            } else if (Intent.ACTION_SCREEN_ON.equals(action)) {
                screenOn = true;
                ensureEdge();
            }
        }
    };

    private SharedPreferences prefs() { return getSharedPreferences("tiva_state", MODE_PRIVATE); }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        try { registerReceiver(screenReceiver, filter); } catch (Exception ignored) { }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null && intent.getAction() != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            prefs().edit().putBoolean("bubble_enabled", false).putBoolean("bubble_disabled", true).apply();
            stopEverything();
            return START_NOT_STICKY;
        }
        if (ACTION_EDGE.equals(action)) {
            boolean on = intent != null && intent.getBooleanExtra(EXTRA_EDGE_ON, true);
            try { startForeground(7, notification()); } catch (Exception ignored) { }
            running = true;
            setEdgeEnabled(on);
            if (bubble == null && on) showBubble();
            return START_STICKY;
        }
        prefs().edit().putBoolean("bubble_enabled", true).apply();
        try { startForeground(7, notification()); }
        catch (Exception ignored) { }
        running = true;
        if (ACTION_PANEL.equals(action)) {
            showPanel();
        } else {
            if (bubble == null) showBubble();
            if (prefs().getBoolean("edge_enabled", false)) showEdge();
        }
        return START_STICKY;
    }

    public void onPanelClosed() {
        panel = null;
        if (screenOn) showBubble();
        ensureEdge();
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        try {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "آماده‌باش تیواچت", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("آیکون شناور و پنجرهٔ چت دستیار");
            nm.createNotificationChannel(channel);
        } catch (Exception ignored) { }

        Intent openPanel = new Intent(this, OverlayService.class).setAction(ACTION_PANEL);
        PendingIntent panelPending = PendingIntent.getService(this, 11, openPanel,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent full = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent fullPending = PendingIntent.getActivity(this, 14, full,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, OverlayService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 12, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        return builder
                .setContentTitle("تیواچت فعال است")
                .setContentText("ضربه روی آیکون شناور یا این اعلان؛ بستن از دکمهٔ پایان")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentIntent(panelPending)
                .addAction(new Notification.Action.Builder(null, "باز کردن چت", panelPending).build())
                .addAction(new Notification.Action.Builder(null, "برنامه کامل", fullPending).build())
                .addAction(new Notification.Action.Builder(null, "پایان دستیار", stopPending).build())
                .setOngoing(true)
                .setColor(Color.parseColor("#9270FF"))
                .build();
    }

    private void showPanel() {
        try {
            if (panel != null && !panel.isShown()) { try { panel.destroy(); } catch (Exception ignored) { } panel = null; }
            if (panel == null) panel = new FloatingPanel(this);
            hideBubbleTemporarily();
            panel.show();
            removeEdgeSafely();
        } catch (Throwable error) {
            toast("باز کردن پنجره ممکن نشد.");
            destroyPanel();
            try { if (bubble != null) bubble.setVisibility(View.VISIBLE); } catch (Exception ignored) { }
        }
    }

    private void destroyPanel() {
        try { if (panel != null) panel.destroy(); } catch (Exception ignored) { }
        panel = null;
    }

    private void hideBubbleTemporarily() {
        try { if (bubble != null) bubble.setVisibility(View.GONE); } catch (Exception ignored) { }
    }

    private void showBubble() {
        if (bubble != null) {
            bubble.setVisibility(View.VISIBLE);
            bubble.setAlpha(1f);
            scheduleFade();
            return;
        }
        if (!Settings.canDrawOverlays(this)) return;
        try {
            int size = dp(58);
            FrameLayout wrap = new FrameLayout(this);
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    new int[]{Color.parseColor("#E2D8FF"), Color.parseColor("#9270FF"), Color.parseColor("#5B2FD6")});
            bg.setShape(GradientDrawable.OVAL);
            bg.setStroke(dp(1), Color.parseColor("#66FFFFFF"));
            wrap.setBackground(bg);
            wrap.setElevation(dp(12));

            TextView glyph = new TextView(this);
            glyph.setText("⚡");
            glyph.setTextSize(26);
            glyph.setTextColor(Color.WHITE);
            glyph.setGravity(Gravity.CENTER);
            wrap.addView(glyph, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

            /* v1.0.3: a small × badge on the bubble corner removes the floating icon. */
            TextView closeBtn = new TextView(this);
            closeBtn.setText("×");
            closeBtn.setTextSize(14);
            closeBtn.setTextColor(Color.WHITE);
            closeBtn.setGravity(Gravity.CENTER);
            closeBtn.setContentDescription("برداشتن آیکون شناور تیواچت");
            GradientDrawable closeBg = new GradientDrawable();
            closeBg.setShape(GradientDrawable.OVAL);
            closeBg.setColor(Color.parseColor("#E11D48"));
            closeBg.setStroke(dp(1), Color.parseColor("#CCFFFFFF"));
            closeBtn.setBackground(closeBg);
            int badge = dp(19);
            FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(badge, badge);
            closeLp.gravity = Gravity.TOP | Gravity.END;
            closeLp.setMargins(0, -dp(1), -dp(1), 0);
            wrap.addView(closeBtn, closeLp);
            closeBtn.setOnClickListener(v -> {
                try {
                    prefs().edit().putBoolean("bubble_enabled", false).putBoolean("bubble_disabled", true).apply();
                } catch (Exception ignored) { }
                try {
                    Toast.makeText(this, "آیکون شناور برداشته شد. برای بازگردانی از اعلان تیواچت یا کاشی تنظیمات سریع استفاده کنید.", Toast.LENGTH_LONG).show();
                } catch (Exception ignored) { }
                stopEverything();
            });
            wrap.setContentDescription("تیواچت؛ دستیار فارسی. برای برداشتن آیکون، × گوشهٔ آن را بزنید.");

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            bubbleParams = new WindowManager.LayoutParams(size, size, type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);
            bubbleParams.gravity = Gravity.TOP | Gravity.START;
            bubbleParams.x = dp(6);
            bubbleParams.y = getResources().getDisplayMetrics().heightPixels / 2;
            clampBubble();

            wrap.setOnTouchListener(new View.OnTouchListener() {
                private int startX, startY;
                private float touchX, touchY;
                private long downAt;
                private boolean moved;
                @Override public boolean onTouch(View view, MotionEvent event) {
                    switch (event.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = bubbleParams.x;
                            startY = bubbleParams.y;
                            touchX = event.getRawX();
                            touchY = event.getRawY();
                            downAt = System.currentTimeMillis();
                            moved = false;
                            view.animate().scaleX(0.92f).scaleY(0.92f).setDuration(90).start();
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            int dx = (int) (event.getRawX() - touchX);
                            int dy = (int) (event.getRawY() - touchY);
                            if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) moved = true;
                            bubbleParams.x = startX + dx;
                            bubbleParams.y = startY + dy;
                            try { windowManager.updateViewLayout(view, bubbleParams); } catch (Exception ignored) { }
                            return true;
                        case MotionEvent.ACTION_UP:
                            view.animate().scaleX(1f).scaleY(1f).setDuration(120).start();
                            snapBubble();
                            if (!moved && System.currentTimeMillis() - downAt < 450) showPanel();
                            scheduleFade();
                            return true;
                    }
                    return false;
                }
            });
            wrap.setScaleX(0.2f);
            wrap.setScaleY(0.2f);
            wrap.setAlpha(0f);
            windowManager.addView(wrap, bubbleParams);
            wrap.animate().scaleX(1f).scaleY(1f).alpha(1f)
                    .setDuration(340).setInterpolator(new OvershootInterpolator(1.7f)).start();
            bubble = wrap;
            scheduleFade();
        } catch (Throwable error) {
            bubble = null;
            toast("آیکون شناور اضافه نشد؛ مجوز نمایش روی برنامه‌ها را بررسی کنید.");
        }
    }

    private void clampBubble() {
        if (bubbleParams == null) return;
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        bubbleParams.x = Math.max(0, Math.min(bubbleParams.x, screenW - dp(64)));
        bubbleParams.y = Math.max(dp(24), Math.min(bubbleParams.y, screenH - dp(120)));
    }

    private void snapBubble() {
        if (bubble == null || bubbleParams == null) return;
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        bubbleParams.x = bubbleParams.x + dp(29) > screenW / 2 ? screenW - dp(64) : dp(4);
        bubbleParams.y = Math.max(dp(24), Math.min(bubbleParams.y, screenH - dp(120)));
        try { windowManager.updateViewLayout(bubble, bubbleParams); } catch (Exception ignored) { }
    }

    private void scheduleFade() {
        if (fade != null) handler.removeCallbacks(fade);
        if (bubble != null) bubble.setAlpha(1f);
        fade = () -> {
            if (bubble == null || (panel != null && panel.isShown())) return;
            bubble.animate().alpha(0.35f).setDuration(500).start();
        };
        handler.postDelayed(fade, 9000);
    }

    // ---------------- optional edge strip ----------------

    public boolean isEdgeEnabled() { return prefs().getBoolean("edge_enabled", false); }

    public void setEdgeEnabled(boolean enabled) {
        prefs().edit().putBoolean("edge_enabled", enabled).apply();
        if (enabled) showEdge(); else removeEdgeSafely();
    }

    private void ensureEdge() { if (isEdgeEnabled()) showEdge(); }

    private void showEdge() {
        if (!Settings.canDrawOverlays(this) || edgeView != null) return;
        try {
            final int h = (int) (getResources().getDisplayMetrics().heightPixels * 0.42);
            FrameLayout edge = new FrameLayout(this);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.parseColor("#559270FF"));
            bg.setCornerRadii(new float[]{dp(9), dp(9), 0, 0, 0, 0, dp(9), dp(9)});
            edge.setBackground(bg);
            TextView hint = new TextView(this);
            hint.setText("⋮");
            hint.setTextColor(Color.WHITE);
            hint.setTextSize(15);
            hint.setGravity(Gravity.CENTER);
            edge.addView(hint, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
            edge.setAlpha(0.5f);

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            edgeParams = new WindowManager.LayoutParams(dp(16), h, type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT);
            edgeParams.gravity = Gravity.TOP | Gravity.END;
            edgeParams.x = 0;
            edgeParams.y = (int) (getResources().getDisplayMetrics().heightPixels * 0.29);

            edge.setOnTouchListener(new View.OnTouchListener() {
                private long lastTap = 0L;
                private long downAt = 0L;
                private boolean moved = false;
                private float startY = 0f;
                @Override public boolean onTouch(View view, MotionEvent event) {
                    switch (event.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            downAt = System.currentTimeMillis();
                            startY = event.getRawY();
                            moved = false;
                            view.animate().alpha(0.9f).setDuration(100).start();
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            if (Math.abs(event.getRawY() - startY) > dp(14)) moved = true;
                            return true;
                        case MotionEvent.ACTION_UP:
                            view.animate().alpha(0.5f).setDuration(300).start();
                            if (moved) return true;
                            long now = System.currentTimeMillis();
                            if (now - lastTap < 750L) {
                                lastTap = 0L;
                                showPanel();
                            } else {
                                lastTap = now;
                                toast("برای باز کردن، دوباره ضربه بزنید.");
                            }
                            return true;
                    }
                    return false;
                }
            });
            windowManager.addView(edge, edgeParams);
            edgeView = edge;
        } catch (Throwable ignored) { edgeView = null; }
    }

    private void removeEdgeSafely() {
        try { if (edgeView != null && windowManager != null) windowManager.removeViewImmediate(edgeView); }
        catch (Exception ignored) { }
        edgeView = null;
    }

    public void stopEverything() {
        AssistantAccessibilityService.cancelAutomation();
        destroyPanel();
        removeEdgeSafely();
        try { if (bubble != null && windowManager != null) windowManager.removeViewImmediate(bubble); }
        catch (Exception ignored) { }
        bubble = null;
        stopForeground(true);
        stopSelf();
    }

    private void toast(final String message) {
        handler.post(() -> { try { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); } catch (Exception ignored) { } });
    }

    public void emitNativeResult(boolean ok, String message) {
        try {
            if (panel != null) panel.deliverNativeResult(ok, message);
        } catch (Exception ignored) { }
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        try {
            destroyPanel();
            removeEdgeSafely();
            if (bubble != null) { windowManager.removeViewImmediate(bubble); bubble = null; }
            if (screenOn) { showBubble(); ensureEdge(); }
        } catch (Exception ignored) { }
    }

    @Override public void onDestroy() {
        running = false;
        handler.removeCallbacksAndMessages(null);
        destroyPanel();
        removeEdgeSafely();
        try { unregisterReceiver(screenReceiver); } catch (Exception ignored) { }
        try { if (bubble != null && windowManager != null) windowManager.removeViewImmediate(bubble); }
        catch (Exception ignored) { }
        bubble = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
