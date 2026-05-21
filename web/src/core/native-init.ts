/**
 * One-time native initialisation. Runs on app boot when Capacitor is detected.
 * Safe to import on web — every call is a no-op there.
 */
import { isNative, platform } from "./native";

export async function initNative(navigate: (path: string) => void, goBack: () => boolean): Promise<void> {
  if (!isNative) return;

  // Splash: hide once React is up so the first paint is the real UI.
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Slight delay so the React tree gets a chance to mount its initial route
    setTimeout(() => SplashScreen.hide().catch(() => {}), 250);
  } catch {}

  // Status bar — translucent on Android, dark icons on light background.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    if (platform === "android") {
      await StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(() => {});
    }
  } catch {}

  // Soft keyboard: animate body resize so inputs stay visible above keyboard.
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    // No-op subscription — touching Keyboard ensures the plugin is registered.
    Keyboard.addListener("keyboardWillShow", () => {}).catch(() => {});
  } catch {}

  // Hardware back button (Android) → React Router pop, or exit at root.
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      // canGoBack reflects the native WebView's history. We prefer to ask
      // React Router first — most navigation is client-side.
      const popped = goBack();
      if (popped) return;
      if (!canGoBack) {
        // We're at the root; let the user exit the app.
        App.exitApp();
      }
    });
  } catch {}
}
