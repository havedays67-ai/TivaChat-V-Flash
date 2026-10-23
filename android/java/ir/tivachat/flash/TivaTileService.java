package ir.tivachat.flash;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.TileService;

/** Quick Settings tile: open the floating assistant from anywhere. */
public class TivaTileService extends TileService {
    @Override public void onClick() {
        super.onClick();
        try {
            Intent intent = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_PANEL);
            if (android.provider.Settings.canDrawOverlays(this)) {
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
            } else {
                Intent full = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(full);
            }
        } catch (Exception ignored) { }
    }
}
