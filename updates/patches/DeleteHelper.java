package ir.tivachat.flash;

import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentResolver;
import android.content.IntentSender;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import java.util.ArrayList;

/**
 * TivaChat 1.0.2 - destructive media actions always go through the OS consent dialog.
 * API 30+ : MediaStore.createDeleteRequest (one dialog for N uris)
 * API 29   : RecoverableSecurityException -> userAction.actionIntent
 * API 28   : only app-owned files, still behind an in-app confirm dialog
 */
public final class DeleteHelper {

    public static final int REQ_DELETE_MEDIA = 4701;
    public static final int REQ_UNINSTALL_APP = 4702;

    private DeleteHelper() {}

    public static void requestDelete(Activity activity, ArrayList<Uri> uris) {
        if (activity == null || uris == null || uris.isEmpty()) return;
        ContentResolver resolver = activity.getContentResolver();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            IntentSender sender = MediaStore.createDeleteRequest(resolver, uris).getIntentSender();
            try {
                activity.startIntentSenderForResult(sender, REQ_DELETE_MEDIA, null, 0, 0, 0);
            } catch (IntentSender.SendIntentException ignored) {
                ToastHelper.show(activity, "حذف انجام نشد؛ دوباره تلاش کنید.");
            }
            return;
        }

        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
            try {
                deleteOneByOne(activity, uris);
            } catch (SecurityException error) {
                RecoverableSecurityException recoverable = asRecoverable(error);
                if (recoverable != null) {
                    try {
                        activity.startIntentSenderForResult(
                            recoverable.getUserAction().getActionIntent().getIntentSender(),
                            REQ_DELETE_MEDIA, null, 0, 0, 0);
                    } catch (IntentSender.SendIntentException ignored) { }
                } else {
                    ToastHelper.show(activity, "دسترسی حذف داده نشد. فایل دست‌نخورده ماند.");
                }
            }
            return;
        }

        // Android 9: no media consent flow. Only delete what this app created.
        deleteOneByOne(activity, uris);
    }

    private static void deleteOneByOne(Activity activity, ArrayList<Uri> uris) {
        ContentResolver resolver = activity.getContentResolver();
        for (Uri uri : uris) {
            resolver.delete(uri, null, null);
        }
    }

    private static RecoverableSecurityException asRecoverable(SecurityException error) {
        return error instanceof RecoverableSecurityException ? (RecoverableSecurityException) error : null;
    }

    public static boolean isConfirmed(int requestCode, int resultCode) {
        if (requestCode != REQ_DELETE_MEDIA) return false;
        return resultCode == Activity.RESULT_OK;
    }
}