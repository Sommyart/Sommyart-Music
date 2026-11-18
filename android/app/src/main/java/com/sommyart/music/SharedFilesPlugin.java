package com.sommyart.music;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * Receives songs shared to the app from a file manager (Share > Sommyart Studio).
 * Each file is copied into the app's own cache, then the web app is told about it
 * so it can fill in the upload form. Only the Studio app offers itself in the Share
 * menu; in the listener app this plugin simply never receives anything.
 */
@CapacitorPlugin(name = "SharedFiles")
public class SharedFilesPlugin extends Plugin {

    private static final long MAX_BYTES = 60L * 1024 * 1024;
    private JSObject pending = null;

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        if (isShare(intent)) {
            receive(intent);
            // Handled: do not take the same files again if the page reloads.
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (isShare(intent)) receive(intent);
    }

    /** Files shared before the page was ready to listen. Each batch is handed out once. */
    @PluginMethod
    public void takePending(PluginCall call) {
        JSObject out = pending != null ? pending : new JSObject().put("files", new JSArray());
        pending = null;
        call.resolve(out);
    }

    private boolean isShare(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    @SuppressWarnings("deprecation")
    private ArrayList<Uri> urisOf(Intent intent) {
        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Uri one = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (one != null) uris.add(one);
        } else {
            ArrayList<Uri> many = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (many != null) uris.addAll(many);
        }
        if (uris.isEmpty() && intent.getClipData() != null) {
            for (int i = 0; i < intent.getClipData().getItemCount(); i++) {
                Uri u = intent.getClipData().getItemAt(i).getUri();
                if (u != null) uris.add(u);
            }
        }
        return uris;
    }

    private void receive(final Intent intent) {
        final ArrayList<Uri> uris = urisOf(intent);
        if (uris.isEmpty()) return;
        // Copying can take a moment for large files: keep it off the screen's thread.
        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "shared");
            clearOld(dir);
            dir.mkdirs();
            ContentResolver resolver = getContext().getContentResolver();
            JSArray files = new JSArray();
            JSArray skipped = new JSArray();
            long stamp = System.currentTimeMillis();
            int n = 0;
            for (Uri uri : uris) {
                String name = displayName(resolver, uri);
                String type = resolver.getType(uri);
                if (type == null) type = "";
                try {
                    File out = new File(dir, stamp + "_" + (n++) + "_" + safe(name));
                    long size = copy(resolver, uri, out);
                    if (size < 0) {
                        out.delete();
                        skipped.put(name);
                        continue;
                    }
                    JSObject f = new JSObject();
                    f.put("path", Uri.fromFile(out).toString());
                    f.put("name", name);
                    f.put("type", type);
                    f.put("size", size);
                    files.put(f);
                } catch (Exception e) {
                    skipped.put(name);
                }
            }
            JSObject batch = new JSObject();
            batch.put("id", String.valueOf(stamp));
            batch.put("files", files);
            batch.put("skipped", skipped);
            pending = batch;
            notifyListeners("filesShared", batch, true);
        }).start();
    }

    /** Copies one shared file. Returns its size, or -1 when it is too large. */
    private long copy(ContentResolver resolver, Uri uri, File out) throws Exception {
        long total = 0;
        try (InputStream in = resolver.openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
            if (in == null) throw new Exception("unreadable");
            byte[] buf = new byte[64 * 1024];
            int r;
            while ((r = in.read(buf)) != -1) {
                total += r;
                if (total > MAX_BYTES) return -1;
                os.write(buf, 0, r);
            }
        }
        return total;
    }

    private String displayName(ContentResolver resolver, Uri uri) {
        String name = null;
        try (Cursor c = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
        }
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        return name == null || name.isEmpty() ? "song" : name;
    }

    private String safe(String name) {
        String s = name.replaceAll("[^A-Za-z0-9._ -]", "_");
        return s.length() > 80 ? s.substring(s.length() - 80) : s;
    }

    /** Shared copies are only needed until they are uploaded: remove ones older than a day. */
    private void clearOld(File dir) {
        File[] old = dir.listFiles();
        if (old == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File f : old) if (f.lastModified() < cutoff) f.delete();
    }
}
