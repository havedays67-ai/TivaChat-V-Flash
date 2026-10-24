package ir.tivachat.flash;

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
}