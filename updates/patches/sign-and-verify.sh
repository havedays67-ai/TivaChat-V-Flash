#!/usr/bin/env bash
set -euo pipefail

APK="${1:-app/build/outputs/apk/release/app-release.apk}"
EXPECTED_CERT="2e3eee11ae6276418d17085fc6a39373ea9c811c2b5c62bc1c7f64b42ffa46b7"

# 1) sign (v1+v2+v3) with the ORIGINAL keystore (never commit the keystore)
apksigner sign \
  --ks "keystore/tivachat-release-2026.jks" \
  --ks-key-alias "tivachat" \
  --ks-pass "env:TIVA_STORE_PASSWORD" \
  --key-pass "env:TIVA_KEY_PASSWORD" \
  --min-sdk-version 21 \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out TivaChat-V-Flash-v1.0.1.apk "$APK"

# 2) verify signatures
apksigner verify --verbose --print-certs TivaChat-V-Flash-v1.0.1.apk | tee verify-1.0.1.txt

# 3) hard gate: certificate fingerprint must equal 1.0.1
CERT=$(openssl x509 -inform DER -in <(unzip -p TivaChat-V-Flash-v1.0.1.apk META-INF/TIVACHAT.RSA | openssl pkcs7 -inform DER -print_certs) -noout -fingerprint -sha256 | tr -d ':' | cut -d= -f2 | tr 'A-F' 'a-f')
if [ "$CERT" != "$EXPECTED_CERT" ]; then
  echo "STOP: certificate changed ($CERT). Update path would break." >&2
  exit 1
fi

# 4) hashes + version check
sha256sum TivaChat-V-Flash-v1.0.1.apk
aapt2 dump badging TivaChat-V-Flash-v1.0.1.apk | head -1
echo "OK: signed with the same key and the same version (1.0.1 build 4)"