#!/usr/bin/env bash
# Build Ajira companion APK on the DigitalOcean droplet and publish to public/app/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT/android-app"
OUT_DIR="$ROOT/public/app"
FLUTTER_BIN="${FLUTTER_BIN:-/opt/flutter/bin/flutter}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$(dirname "$FLUTTER_BIN"):$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$FLUTTER_BIN" ]]; then
  echo "Flutter not found at $FLUTTER_BIN" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK not found at $ANDROID_HOME" >&2
  exit 1
fi

cd "$APP_DIR"
echo "==> flutter pub get"
"$FLUTTER_BIN" pub get

echo "==> flutter build apk --release"
# Cap Gradle workers on the 2GB droplet
export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=384m -Dorg.gradle.daemon=false}"
"$FLUTTER_BIN" build apk --release

APK_SRC="$APP_DIR/build/app/outputs/flutter-apk/app-release.apk"
if [[ ! -f "$APK_SRC" ]]; then
  echo "APK missing: $APK_SRC" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp -f "$APK_SRC" "$OUT_DIR/ajira.apk"
chmod 644 "$OUT_DIR/ajira.apk"

SIZE="$(du -h "$OUT_DIR/ajira.apk" | awk '{print $1}')"
echo "==> Published $OUT_DIR/ajira.apk ($SIZE)"
echo "    https://ajira.online/app/ajira.apk"
