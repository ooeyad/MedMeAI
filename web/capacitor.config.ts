import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.medme.app",
  appName: "MedMeAI",
  // The folder Vite outputs to. `cap sync` copies its contents into the
  // native project so the APK bundles a fully self-contained web build.
  webDir: "dist",
  // Use Android's modern SDK 34 base.
  android: {
    allowMixedContent: true,           // dev: lets HTTPS app talk to HTTP backend
    captureInput: true,
    webContentsDebuggingEnabled: true, // chrome://inspect debugging
  },
  // Server section is only used when `livereload` is enabled (cap run --livereload)
  // or you point at a hosted URL. Leaving cleartext on for dev convenience.
  server: {
    androidScheme: "https",            // app's internal scheme — required for many Capacitor APIs
    cleartext: true,                   // allow http://laptop-ip:5000 in dev
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0ea5a8",      // brand teal
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",                   // dark icons on light bg
      backgroundColor: "#ffffff",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#0ea5a8",
      sound: "default",
    },
  },
};

export default config;
