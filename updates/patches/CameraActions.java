package ir.tivachat.flash;

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
}