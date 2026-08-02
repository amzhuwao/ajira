# Ajira Android companion

Flutter WebView shell for [https://ajira.online](https://ajira.online).

- **Package ID:** `online.ajira.app`
- **Min SDK:** 24 · **Target SDK:** 35

## Local develop

```bash
cd android-app
flutter pub get
flutter run
```

## Build on the droplet

The DigitalOcean host already has Flutter (`/opt/flutter`) and Android SDK (`/opt/android-sdk`).

```bash
# from repo root on the droplet
./android-app/scripts/build-on-droplet.sh
```

The script runs `flutter build apk --release` and copies the APK to:

- Direct file: [https://ajira.online/app/ajira.apk](https://ajira.online/app/ajira.apk)
- Landing page: [https://ajira.online/download](https://ajira.online/download)

## Notes

- Release builds currently use the debug keystore for internal distribution.
- For Play Store, create a keystore outside git and wire `signingConfigs` in `android/app/build.gradle.kts`.
- Digital Asset Links for verified App Links can be added later at `/.well-known/assetlinks.json`.
