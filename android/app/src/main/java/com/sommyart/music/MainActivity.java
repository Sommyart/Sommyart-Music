package com.sommyart.music;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugin must be registered before the bridge starts.
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(CallStatePlugin.class);
        registerPlugin(SharedFilesPlugin.class);
        registerPlugin(AudioOutputsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
