package ir.tivachat.flash;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Local-only AES-256-GCM vault. No plaintext secret is written to disk or logs. */
public class Vault {
    private static final String STORE = "tiva_vault_v1";
    private static final String BLOB = "blob";
    private static final String KEY_ALIAS = "tiva_vault_key_v1";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private final SharedPreferences prefs;

    public Vault(Context context) {
        prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        if (!ks.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build());
            generator.generateKey();
        }
        return (SecretKey) ks.getKey(KEY_ALIAS, null);
    }

    private String seal(String plain) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plain.getBytes("UTF-8"));
        byte[] combined = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
        return Base64.encodeToString(combined, Base64.NO_WRAP);
    }

    private String open(String sealed) throws Exception {
        byte[] combined = Base64.decode(sealed, Base64.NO_WRAP);
        byte[] iv = new byte[12];
        byte[] encrypted = new byte[combined.length - 12];
        System.arraycopy(combined, 0, iv, 0, 12);
        System.arraycopy(combined, 12, encrypted, 0, encrypted.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), "UTF-8");
    }

    private synchronized JSONArray items() {
        String blob = prefs.getString(BLOB, null);
        if (blob == null) return new JSONArray();
        try {
            return new JSONArray(open(blob));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private synchronized boolean save(JSONArray items) {
        try {
            prefs.edit().putString(BLOB, seal(items.toString())).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized boolean add(String app, String username, String password) {
        try {
            JSONArray items = items();
            JSONObject item = new JSONObject();
            item.put("id", UUID.randomUUID().toString().substring(0, 8));
            item.put("app", app);
            item.put("username", username);
            item.put("password", password);
            items.put(item);
            return save(items);
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized String maskedList() {
        JSONArray out = new JSONArray();
        try {
            JSONArray items = items();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                JSONObject row = new JSONObject();
                row.put("id", item.optString("id"));
                row.put("app", item.optString("app"));
                row.put("username", item.optString("username"));
                out.put(row);
            }
        } catch (Exception ignored) { }
        return out.toString();
    }

    public synchronized String reveal(String id) {
        try {
            JSONArray items = items();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if (id.equals(item.optString("id"))) {
                    JSONObject out = new JSONObject();
                    out.put("id", id);
                    out.put("app", item.optString("app"));
                    out.put("username", item.optString("username"));
                    out.put("password", item.optString("password"));
                    return out.toString();
                }
            }
        } catch (Exception ignored) { }
        return "{}";
    }

    public synchronized boolean delete(String id) {
        try {
            JSONArray items = items();
            JSONArray next = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if (!id.equals(item.optString("id"))) next.put(item);
            }
            return save(next);
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized int count() {
        return items().length();
    }

    public synchronized void clear() {
        prefs.edit().remove(BLOB).apply();
    }
}
