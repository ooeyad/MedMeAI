/**
 * Tiny native-bridge helpers.
 *
 * Most of the app should not need to import these directly — they exist so
 * specific surfaces (auth storage, file pickers, push notifications) can
 * lean on native APIs when running inside the Capacitor shell, while still
 * working as a normal web app in the browser.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

/** Async wrapper that picks the best storage backend at runtime. */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const { Preferences } = await import("@capacitor/preferences");
      const r = await Preferences.get({ key });
      return r.value ?? null;
    }
    return window.localStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (isNative) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value });
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (isNative) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key });
      return;
    }
    window.localStorage.removeItem(key);
  },
};

/** Fire a short haptic tap when running natively. No-op on web. */
export async function hapticTap(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* plugin not available */ }
}
