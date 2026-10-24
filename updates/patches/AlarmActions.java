package ir.tivachat.flash;

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
}