# AURUM AI — Android APK build (GitHub Actions)

This project builds an installable Android **APK** with GitHub Actions, wrapping
the AURUM AI web app in a native shell using **Capacitor**.

The workflow is stored at **`mobile/build-apk.yml`** (see the one-step install
below). It produces a **debug APK** that installs on any Android device with no
signing key required.

---

## 0. One required manual step (30 seconds)

GitHub only runs workflow files from `.github/workflows/`. The Base44 GitHub sync
can’t write into that folder, so add the workflow once by copy-paste:

1. In your GitHub repo, click **Add file → Create new file**.
2. Name it exactly: `.github/workflows/build-apk.yml`
3. Paste the entire contents of **`mobile/build-apk.yml`** from this repo.
4. Commit.

That’s it — the pipeline is live from then on.

---

## 1. Required GitHub secrets

Add these in the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name                 | Value                                       |
| --------------------------- | ------------------------------------------- |
| `VITE_BASE44_APP_ID`        | `6aaff96c746d1c99ddd73156`                  |
| `VITE_BASE44_APP_BASE_URL`  | `https://wild-aurum-quant-flow.base44.app`  |

These are baked into the web bundle so the APK can reach your Base44 backend
(live price, economic calendar, Telegram alerts, trade journal database).

> Without them the build still compiles, but the app inside the APK can’t reach
> the backend. Set both before running.

---

## 2. Build the APK

1. **Actions** tab → **Build Android APK** → **Run workflow**
   (it also auto-runs on every push to `main`).
2. Wait ~5–8 minutes for the green check.
3. Open the run → **Artifacts** → download **`aurum-ai-apk`**.
4. Unzip → **`app-debug.apk`**.

Install on a phone: enable “Install unknown apps” for your browser/Files app,
then open `app-debug.apk`.

---

## 3. What the workflow does

1. Ubuntu runner · **Node 20** · **JDK 17** · **Android SDK 34**.
2. `npm ci` installs app dependencies from the lockfile.
3. Installs Capacitor 6 tooling (build-time only, not saved to `package.json`).
4. `npm run build` builds the web bundle with your two VITE secrets.
5. `npx cap add android` + `npx cap sync android` scaffold the native project.
6. `./gradlew assembleDebug` produces `app-debug.apk`.
7. Uploads the APK as a downloadable artifact.

`capacitor.config.json` (repo root) defines app id `com.aurumai.trading`,
name “AURUM AI”, `webDir: dist`, and the dark `#0B0D11` launch background.

---

## 4. Optional — signed *release* APK / Play Store

A debug APK is fine for testing and sideloading. For a signed release build,
generate a keystore once:

```bash
keytool -genkey -v -keystore aurum-release.keystore \
  -alias aurum -keyalg RSA -keysize 2048 -validity 10000
```

Base64-encode it and add these **four** secrets:

| Secret              | Value                            |
| ------------------- | -------------------------------- |
| `KEYSTORE_BASE64`   | `base64 aurum-release.keystore`  |
| `KEYSTORE_PASSWORD` | keystore password                |
| `KEY_ALIAS`         | `aurum`                          |
| `KEY_PASSWORD`      | key password                     |

Then add a `signingConfigs` block and a `./gradlew assembleRelease` step.

> Simpler alternative: Base44 can generate **AAB/APK** directly from the
> **Publish → Mobile app** tab (requires Builder plan or higher).