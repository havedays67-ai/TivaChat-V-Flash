package ir.tivachat.flash;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.text.InputType;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * User-visible contact resolver. It asks for READ_CONTACTS only when a call by
 * name is requested, resolves matching numbers, shows a chooser when needed and
 * always asks for confirmation before opening the system dialer.
 * It never performs a call and never runs as an overlay.
 */
public class ContactResolverActivity extends Activity {
    private static final int PERMISSION_CONTACTS = 701;
    private String contactName = "";
    private String explicitNumber = "";

    private static class Match {
        String name;
        String number;
        Match(String name, String number) { this.name = name; this.number = number; }
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        contactName = getIntent().getStringExtra("contact");
        explicitNumber = getIntent().getStringExtra("number");
        if (contactName == null) contactName = "";
        if (explicitNumber == null) explicitNumber = "";
        if (!explicitNumber.isEmpty()) {
            confirmNumber(explicitNumber, contactName);
            return;
        }
        if (contactName.isEmpty()) {
            askForNumber("شماره یا نام مخاطب مشخص نشد.");
            return;
        }
        if (Build.VERSION.SDK_INT >= 23) {
            if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, PERMISSION_CONTACTS);
            } else {
                resolveContact(contactName);
            }
        } else {
            resolveContact(contactName);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_CONTACTS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                resolveContact(contactName);
            } else {
                askForNumber("دسترسی مخاطبین داده نشد؛ شماره را خودتان وارد کنید.");
            }
        }
    }

    private void resolveContact(String name) {
        List<Match> matches = new ArrayList<>();
        try {
            Uri uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
            String[] projection = new String[]{
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
            };
            String selection = ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?";
            String[] args = new String[]{"%" + name + "%"};
            try (Cursor cursor = getContentResolver().query(uri, projection, selection, args, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC")) {
                if (cursor != null) {
                    int nameIdx = cursor.getColumnIndex(projection[0]);
                    int numberIdx = cursor.getColumnIndex(projection[1]);
                    while (cursor.moveToNext() && matches.size() < 8) {
                        String display = cursor.getString(nameIdx);
                        String number = cursor.getString(numberIdx);
                        if (number != null && !number.trim().isEmpty()) matches.add(new Match(display, number));
                    }
                }
            }
        } catch (Exception ignored) { }
        if (matches.isEmpty()) {
            askForNumber("مخاطبی با نام «" + name + "» پیدا نشد. شماره را وارد کنید یا نام را در دفترچه اصلاح کنید.");
            return;
        }
        if (matches.size() == 1) {
            confirmNumber(matches.get(0).number, matches.get(0).name);
            return;
        }
        final List<Match> list = matches;
        String[] labels = new String[list.size()];
        for (int i = 0; i < list.size(); i++) labels[i] = list.get(i).name + "\n" + list.get(i).number;
        new AlertDialog.Builder(this)
                .setTitle("کدام مخاطب؟")
                .setItems(labels, (dialog, which) -> confirmNumber(list.get(which).number, list.get(which).name))
                .setNegativeButton("لغو", (dialog, which) -> finish())
                .setCancelable(false)
                .show();
    }

    private void confirmNumber(final String number, final String name) {
        String label = name == null || name.trim().isEmpty() ? number : name + "\n" + number;
        new AlertDialog.Builder(this)
                .setTitle("تأیید تماس")
                .setMessage("شماره‌گیر سیستم برای این مخاطب باز شود؟\n\n" + label + "\n\nبرقراری تماس نهایی را خودتان در شماره‌گیر انجام می‌دهید.")
                .setPositiveButton("باز کردن شماره‌گیر", (dialog, which) -> {
                    try {
                        Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)));
                        dial.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(dial);
                    } catch (Exception e) {
                        Toast.makeText(this, "شماره‌گیر باز نشد.", Toast.LENGTH_SHORT).show();
                    }
                    finish();
                })
                .setNegativeButton("لغو", (dialog, which) -> finish())
                .setCancelable(false)
                .show();
    }

    private void askForNumber(String message) {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        wrapper.setPadding(pad, pad / 2, pad, 0);
        final EditText input = new EditText(this);
        input.setHint("مثلاً 09121234567");
        input.setInputType(InputType.TYPE_CLASS_PHONE);
        wrapper.addView(input);
        new AlertDialog.Builder(this)
                .setTitle("شماره را وارد کنید")
                .setMessage(message)
                .setView(wrapper)
                .setPositiveButton("ادامه", (dialog, which) -> {
                    String value = input.getText().toString().replaceAll("[^0-9+]", "");
                    if (value.length() < 4) {
                        Toast.makeText(this, "شماره معتبر نیست.", Toast.LENGTH_SHORT).show();
                        finish();
                        return;
                    }
                    confirmNumber(value, contactName);
                })
                .setNegativeButton("لغو", (dialog, which) -> finish())
                .setCancelable(false)
                .show();
    }
}
