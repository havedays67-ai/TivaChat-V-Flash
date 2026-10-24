#!/usr/bin/env bash
# Refresh every download link after a release so the site never points at a stale APK.
set -euo pipefail
VERSION="${1:?version required}"
ASSET="${2:?asset name required}"
OWNER="havedays67-ai"; REPO="TivaChat-V-Flash"
URL="https://github.com/${OWNER}/${REPO}/releases/download/v${VERSION}/${ASSET}"
SHA="$(sha256sum "$ASSET" | cut -d' ' -f1)"
SIZE="$(stat -c%s "$ASSET")"
mkdir -p apk public/download
cp "$ASSET" "apk/$ASSET"; cp "$ASSET" "public/download/$ASSET"
cp SHA256SUMS.txt public/download/ || true
python3 tools/update_download_links.py --version "$VERSION" --asset "$ASSET" --url "$URL" --sha256 "$SHA" --size "$SIZE"
echo "download link -> $URL"
