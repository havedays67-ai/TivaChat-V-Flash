package ir.tivachat.flash;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/** Restores the floating bubble after reboot or app update, if the user enabled it. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("tiva_state", Context.MODE_PRIVATE);
            if (!prefs.getBoolean("bubble_enabled", false)) return;
            Intent service = new Intent(context, OverlayService.class).setAction(OverlayService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
            else context.startService(service);
        } catch (Exception ignored) { }
    }
}
