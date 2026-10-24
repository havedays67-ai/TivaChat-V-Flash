package ir.tivachat.flash;

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
}