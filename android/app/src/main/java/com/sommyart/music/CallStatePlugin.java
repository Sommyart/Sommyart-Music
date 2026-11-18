package com.sommyart.music;

import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the app whether the phone is on a call (or ringing), so music that a call
 * paused can carry on by itself once the call is over. It only reads the phone's
 * sound mode, which needs no permission and reveals nothing about the call itself.
 */
@CapacitorPlugin(name = "CallState")
public class CallStatePlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int mode = audio == null ? AudioManager.MODE_NORMAL : audio.getMode();
        boolean inCall =
            mode == AudioManager.MODE_IN_CALL
                || mode == AudioManager.MODE_IN_COMMUNICATION
                || mode == AudioManager.MODE_RINGTONE;
        JSObject result = new JSObject();
        result.put("inCall", inCall);
        call.resolve(result);
    }
}
