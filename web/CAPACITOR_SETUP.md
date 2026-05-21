# Capacitor Android Setup (Windows)

One-time setup, then a clean two-command build loop.

## 1. Prerequisites (install once)

### Java JDK 17 or 21
Capacitor 6 / Android Gradle Plugin 8.x needs Java 17+.

- Download **Microsoft Build of OpenJDK 21** from
  https://learn.microsoft.com/en-us/java/openjdk/download
  (or `winget install Microsoft.OpenJDK.21`)
- Reboot the terminal and verify: `java -version`

### Android Studio
Required for first build (downloads the SDK + accepts licenses).

- Download from https://developer.android.com/studio
- Run the installer with defaults — it pulls down Android SDK 34 automatically
- First-run wizard: accept the licenses, let it download SDK platform-tools + emulator

After Android Studio is set up, set two environment variables (User scope):
```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Microsoft\jdk-21
```
Then add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%JAVA_HOME%\bin
```

Verify: `adb --version` and `javac --version` should both print versions.

## 2. Install Capacitor packages

```
cd D:\Dev\MedMeAI\web
npm install
```

## 3. Add the Android platform (once)

```
npx cap add android
```

This creates `D:\Dev\MedMeAI\web\android\` — the native Android project.

## 4. Build → sync → run

The "real" build loop:

```
# Set the backend URL so the APK knows where to hit Flask.
# Replace the IP with your laptop's LAN IP (ipconfig -> IPv4 Address).
$env:VITE_API_BASE_URL = "http://192.168.100.180:5000/api/v1"

# Build web bundle + sync into Android project + open Android Studio
npm run cap:android
```

This:
1. Runs `npm run build` → produces `dist/`
2. Runs `cap sync android` → copies `dist/` into `android/app/src/main/assets/public/`
3. Runs `cap open android` → opens Android Studio with the project

### In Android Studio

- Wait for Gradle sync to finish (bottom-right shows progress)
- Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Click the "locate" link in the toast → opens
  `android\app\build\outputs\apk\debug\app-debug.apk`

Transfer that `.apk` to your phone (USB, Drive, Dropbox, whatever) and
tap to install. Enable "Install unknown apps" for whichever app you used
to transfer.

## 5. Live-reload during development (super fast)

Plug phone into PC via USB, enable USB debugging on the phone, then:

```
npm run cap:android:live
```

This builds, installs the APK, launches it, and points it at your Vite
dev server. Edit React code → app updates in seconds.

## Tips

- **Backend reachability**: the APK needs to reach Flask. If your laptop's
  IP changes (new Wi-Fi network), rebuild with the new
  `VITE_API_BASE_URL`. Or run Flask publicly via cloudflared tunnel.
- **HTTPS in production**: Capacitor's `allowMixedContent: true` (in
  `capacitor.config.ts`) is dev-only convenience. For app store
  releases, point at an HTTPS backend and remove that flag.
- **App icon + splash**: replace `android/app/src/main/res/mipmap-*/`
  files. The Capacitor docs have a tool: `npm i -D @capacitor/assets`,
  then `npx capacitor-assets generate --android`.
