package com.sommyart.music;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Downloads a new version of this app and hands it to Android's installer, so an
 * update takes one tap instead of "open the browser, download, find the file".
 * Android still asks the person to confirm the install, and to allow installs
 * from this app the first time.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    /** Only files from this project's own release page may be downloaded. */
    private static final String ALLOWED_PREFIX =
        "https://github.com/Sommyart/Sommyart-Music/releases/download/";

    private volatile boolean busy = false;

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject out = new JSObject();
        out.put("allowed", allowed);
        call.resolve(out);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the settings screen: " + e.getMessage());
        }
    }

    /** Downloads the update (resuming a partial file if there is one) and checks that it is this app. */
    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith(ALLOWED_PREFIX)) {
            call.reject("That download address is not allowed.");
            return;
        }
        if (busy) {
            call.reject("A download is already running.");
            return;
        }
        busy = true;
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File dir = updatesDir();
                File part = new File(dir, "update.apk.part");
                File done = new File(dir, "update.apk");
                if (done.exists()) done.delete();

                long have = part.exists() ? part.length() : 0;
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                if (have > 0) conn.setRequestProperty("Range", "bytes=" + have + "-");
                int code = conn.getResponseCode();
                if (code != 200 && code != 206) throw new Exception("Server answered " + code);

                boolean resumed = code == 206 && have > 0;
                if (!resumed) have = 0;
                long total = conn.getContentLengthLong();
                if (total > 0) total += have;

                long loaded = have;
                long lastReport = 0;
                try (InputStream in = conn.getInputStream();
                     OutputStream out = new FileOutputStream(part, resumed)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        loaded += n;
                        long now = System.currentTimeMillis();
                        if (now - lastReport > 250) {
                            lastReport = now;
                            JSObject p = new JSObject();
                            p.put("loaded", loaded);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                }
                if (total > 0 && part.length() != total) {
                    throw new Exception("The download was cut short. Try again.");
                }
                if (!part.renameTo(done)) throw new Exception("Could not save the update.");

                // It must be a readable app package with our own name.
                PackageInfo info = getContext().getPackageManager()
                    .getPackageArchiveInfo(done.getAbsolutePath(), 0);
                if (info == null || !getContext().getPackageName().equals(info.packageName)) {
                    done.delete();
                    throw new Exception("The downloaded file is not a Sommyart Music update.");
                }

                JSObject result = new JSObject();
                result.put("path", done.getAbsolutePath());
                result.put("size", done.length());
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Download failed." : e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
                busy = false;
            }
        }).start();
    }

    /** Opens Android's installer for a file that download() saved. */
    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        try {
            if (path == null) throw new Exception("No file given.");
            File file = new File(path).getCanonicalFile();
            if (!file.getParentFile().equals(updatesDir().getCanonicalFile()) || !file.exists()) {
                throw new Exception("That file is not a downloaded update.");
            }
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Could not open the installer." : e.getMessage());
        }
    }
}
