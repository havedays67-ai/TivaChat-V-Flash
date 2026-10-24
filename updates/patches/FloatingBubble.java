package ir.tivachat.flash;

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
}