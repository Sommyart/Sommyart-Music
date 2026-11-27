package com.sommyart.music;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaRouter2;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Sees which speakers and headphones the phone can play through (phone speaker, Bluetooth,
 * wired, USB), tells the app when one connects or disconnects, and opens Android's own
 * "play on" picker. Android only lets that system picker move music between outputs, so the
 * app shows the list and hands the final choice to it. Reading the list needs no permission.
 */
@CapacitorPlugin(name = "AudioOutputs")
public class AudioOutputsPlugin extends Plugin {

    private AudioManager audio;
    private AudioDeviceCallback callback;

    @Override
    public void load() {
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return;
        callback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] added) { changed(added, true); }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { changed(removed, false); }
        };
        audio.registerAudioDeviceCallback(callback, new Handler(Looper.getMainLooper()));
    }

    @Override
    protected void handleOnDestroy() {
        if (audio != null && callback != null) audio.unregisterAudioDeviceCallback(callback);
    }

    private void changed(AudioDeviceInfo[] devices, boolean connected) {
        JSObject data = snapshot();
        JSArray which = new JSArray();
        for (AudioDeviceInfo d : devices) {
            String kind = kindOf(d.getType());
            if (kind != null && !"speaker".equals(kind)) which.put(describe(d));
        }
        data.put("connected", connected);
        data.put("changed", which);
        notifyListeners("outputsChanged", data, true);
    }

    @PluginMethod
    public void list(PluginCall call) {
        call.resolve(snapshot());
    }

    /** Opens Android's output picker so the person can move the music to another speaker. */
    @PluginMethod
    public void openPicker(PluginCall call) {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        String how = null;
        try {
            if (Build.VERSION.SDK_INT >= 34 && MediaRouter2.getInstance(ctx).showSystemOutputSwitcher()) {
                how = "system";
            }
        } catch (Exception ignored) { }
        if (how == null && Build.VERSION.SDK_INT >= 31) {
            try {
                Intent i = new Intent("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG");
                i.setPackage("com.android.systemui");
                i.putExtra("package_name", pkg);
                ctx.sendBroadcast(i);
                how = "system";
            } catch (Exception ignored) { }
        }
        if (how == null && Build.VERSION.SDK_INT == 30) {
            try {
                Intent i = new Intent("com.android.settings.panel.action.MEDIA_OUTPUT");
                i.putExtra("com.android.settings.panel.extra.PACKAGE_NAME", pkg);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                how = "system";
            } catch (Exception ignored) { }
        }
        if (how == null) {
            try {
                Intent i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                how = "bluetooth-settings";
            } catch (Exception e) {
                call.reject("Could not open the speaker picker");
                return;
            }
        }
        JSObject r = new JSObject();
        r.put("opened", how);
        call.resolve(r);
    }

    private JSObject snapshot() {
        JSObject out = new JSObject();
        JSArray list = new JSArray();
        JSObject active = null;
        if (audio != null) {
            Set<String> seen = new HashSet<>();
            AudioDeviceInfo best = null;
            int bestRank = -1;
            for (AudioDeviceInfo d : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                String kind = kindOf(d.getType());
                if (kind == null) continue;
                String key = kind + "|" + nameOf(d);
                if (!seen.add(key)) continue;
                list.put(describe(d));
                int rank = rankOf(kind);
                if (rank > bestRank) { bestRank = rank; best = d; }
            }
            AudioDeviceInfo playing = null;
            if (Build.VERSION.SDK_INT >= 33) {
                try {
                    AudioAttributes media = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build();
                    List<AudioDeviceInfo> routed = audio.getDevicesForAttributes(media);
                    for (AudioDeviceInfo d : routed) {
                        if (kindOf(d.getType()) != null) { playing = d; break; }
                    }
                } catch (Exception ignored) { }
            }
            if (playing == null) playing = best;
            if (playing != null) active = describe(playing);
        }
        out.put("outputs", list);
        out.put("active", active);
        return out;
    }

    private JSObject describe(AudioDeviceInfo d) {
        JSObject o = new JSObject();
        o.put("id", String.valueOf(d.getId()));
        o.put("kind", kindOf(d.getType()));
        o.put("name", nameOf(d));
        return o;
    }

    private String nameOf(AudioDeviceInfo d) {
        String kind = kindOf(d.getType());
        if ("speaker".equals(kind)) return "This phone";
        CharSequence n = d.getProductName();
        String name = n == null ? "" : n.toString().trim();
        if (name.isEmpty() || name.equalsIgnoreCase(android.os.Build.MODEL)) {
            if ("bluetooth".equals(kind)) return "Bluetooth device";
            if ("usb".equals(kind)) return "USB audio";
            return "Headphones";
        }
        return name;
    }

    /** Only the outputs a person would choose for music; null for everything else (earpiece, calls, HDMI...). */
    private static String kindOf(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                return "speaker";
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case 26: // TYPE_BLE_HEADSET
            case 27: // TYPE_BLE_SPEAKER
            case 30: // TYPE_BLE_BROADCAST
                return "bluetooth";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                return "wired";
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_DEVICE:
                return "usb";
            default:
                return null;
        }
    }

    /** Android sends music to the most recently connected external output; this mirrors that order. */
    private static int rankOf(String kind) {
        if ("bluetooth".equals(kind)) return 3;
        if ("usb".equals(kind)) return 2;
        if ("wired".equals(kind)) return 2;
        return 0;
    }
}
