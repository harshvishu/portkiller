#!/bin/bash
#
# Builds PortKiller as a release binary and wraps it in a proper
# "Port Killer.app" bundle (menu-bar only, no Dock icon).
#
set -euo pipefail

APP_NAME="Port Killer"
EXECUTABLE="PortKiller"
BUNDLE_ID="com.portkiller.app"
VERSION="1.0"
BUILD="1"

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "▶ Building release binary…"
swift build -c release

BIN_PATH="$(swift build -c release --show-bin-path)"
APP_DIR="$ROOT/dist/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"

echo "▶ Assembling app bundle…"
rm -rf "$APP_DIR"
mkdir -p "$CONTENTS/MacOS"
mkdir -p "$CONTENTS/Resources"

cp "$BIN_PATH/$EXECUTABLE" "$CONTENTS/MacOS/$EXECUTABLE"

cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$BUILD</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
PLIST

echo "▶ Code signing (ad-hoc)…"
codesign --force --sign - "$APP_DIR" >/dev/null 2>&1 || true

echo "✅ Built: $APP_DIR"
echo "   Launch with:  open \"$APP_DIR\""
echo "   Or install:   cp -R \"$APP_DIR\" /Applications/"
