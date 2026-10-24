#!/usr/bin/env bash
# TivaChat V Flash — reproducible release build.
# Requires: JDK 17, Android SDK build-tools 34 (aapt, d8, zipalign, apksigner)
# Requires secrets: KEYSTORE_BASE64 + KEYSTORE_PASSWORD + KEY_ALIAS + KEY_PASSWORD
# The keystore MUST be the original release key, otherwise v1.0.2 cannot update v1.0.1.
set -euo pipefail

VERSION="${1:-1.0.2}"
ASSET="TivaChat-V-Flash-v${VERSION}.apk"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[ -n "$SDK" ] || { echo "ERROR: ANDROID_SDK_ROOT/ANDROID_HOME is not set"; exit 1; }
BUILD_TOOLS="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
for bin in aapt d8 zipalign apksigner; do
  [ -x "$BUILD_TOOLS/$bin" ] || { echo "ERROR: missing $BUILD_TOOLS/$bin"; exit 1; }
done
[ -f "$ANDROID_JAR" ] || { echo "ERROR: missing $ANDROID_JAR"; exit 1; }
[ -f release.keystore ] || { echo "ERROR: release.keystore missing (decode KEYSTORE_BASE64 first)"; exit 1; }
[ -n "${KEYSTORE_PASSWORD:-}" ] || { echo "ERROR: KEYSTORE_PASSWORD missing"; exit 1; }
[ -n "${KEY_ALIAS:-}" ] || { echo "ERROR: KEY_ALIAS missing"; exit 1; }

rm -rf build && mkdir -p build/classes build/dex dist
mapfile -t SOURCES < <(find android/java -name '*.java')
echo "== javac ${#SOURCES[@]} files"
javac -source 17 -target 17 -encoding UTF-8 -d build/classes -classpath "$ANDROID_JAR" "${SOURCES[@]}"
echo "== d8 -> classes.dex (min-api 28)"
"$BUILD_TOOLS/d8" --min-api 28 --lib "$ANDROID_JAR" --output build/dex $(find build/classes -name '*.class')
cp build/dex/classes.dex build/classes.dex

echo "== aapt package"
"$BUILD_TOOLS/aapt" package -f -M android/AndroidManifest.xml -S android/res -A android/assets \
  -I "$ANDROID_JAR" -F build/unsigned.apk
( cd build && zip -q -9 unsigned.apk classes.dex )

echo "== zipalign"
"$BUILD_TOOLS/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk

echo "== apksigner sign (v1+v2+v3)"
"$BUILD_TOOLS/apksigner" sign \
  --ks release.keystore --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$KEYSTORE_PASSWORD" --key-pass "pass:${KEY_PASSWORD:-$KEYSTORE_PASSWORD}" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --min-sdk-version 28 --out "dist/$ASSET" build/aligned.apk

echo "== apksigner verify"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs --min-sdk-version 21 "dist/$ASSET" | tee apksigner-verify.txt

echo "== integrity gate"
grep -q "Verified using v1 scheme (JAR signing): true" apksigner-verify.txt
grep -q "Verified using v2 scheme (APK Signature Scheme v2): true" apksigner-verify.txt
grep -q "Verified using v3 scheme (APK Signature Scheme v3): true" apksigner-verify.txt
CERT_SHA256=$(grep "certificate SHA-256 digest" apksigner-verify.txt | head -1 | sed 's/.*: //')
PREV_CERT="2e3eee11ae6276418d17085fc6a39373ea9c811c2b5c62bc1c7f64b42ffa46b7"
NORMALIZED=$(echo "$CERT_SHA256" | tr -d ':' | tr 'A-F' 'a-f')
if [ "$NORMALIZED" != "$PREV_CERT" ]; then
  echo "::error::certificate SHA-256 = $NORMALIZED but the v1.0.1 signer was $PREV_CERT — this key cannot update the installed app."
  exit 1
fi
echo "certificate matches v1.0.1 signer ($CERT_SHA256)"

cp "dist/$ASSET" .
sha256sum "$ASSET" > SHA256SUMS.txt
cat SHA256SUMS.txt
ls -l "$ASSET"
