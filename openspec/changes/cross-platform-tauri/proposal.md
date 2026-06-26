## Why

Port Killer is currently a macOS-only menu bar app built on Swift/SwiftUI and AppKit, with its core logic (`lsof`, `SMAppService`, `NSWorkspace`, `MenuBarExtra`) bound to Apple frameworks. Developers on Windows and Linux have the same "a stuck dev server is holding port 3000" problem but no way to use the tool. Porting to Tauri 2.0 lets one Rust core + web UI ship to macOS, Windows, and Linux, while replacing the brittle `lsof` text parsing with native per-OS socket APIs that are more robust than the current shell-out.

## What Changes

- **BREAKING**: Replace the entire Swift/SwiftUI/AppKit implementation with a Tauri 2.0 app (Rust backend + web frontend). The `Sources/PortKiller/*` tree and `build_app.sh` are retired in favor of `src-tauri/` + a web `src/`.
- Replace the `lsof` shell-out with native cross-platform socket enumeration (`netstat2`) plus process metadata (`sysinfo`), removing all text-parsing of `lsof -F` output.
- Make process termination cross-platform: graceful `SIGTERM` → `SIGKILL` on macOS/Linux, forceful `TerminateProcess` on Windows (where no `SIGTERM` equivalent exists for arbitrary processes).
- Replace macOS-only protection logic (`getuid()` + one daemon deny-list) with per-OS ownership checks and per-OS system-process deny-lists (macOS / Windows / Linux).
- Replace `MenuBarExtra` with a Tauri tray icon + anchored borderless popover window, running as a background app with no Dock/taskbar entry on all three platforms.
- Replace `SMAppService` launch-at-login with `tauri-plugin-autostart` (macOS / Windows / Linux).
- Replace the programmatically-drawn `NSImage` tray glyph with shipped icon assets (template image on macOS).
- Replace ad-hoc `.app` packaging with the Tauri bundler producing `.dmg`/`.app`, `.msi`/NSIS `.exe`, and `.deb`/`.rpm`/`.AppImage`.

Preserved behavior (feature parity target): live auto-refreshing list of listening ports, search/filter, friendly process names, bind-scope hint (localhost vs all interfaces), protected/greyed-out processes, kill confirmation, and one-click launch-at-login.

## Capabilities

### New Capabilities
- `port-discovery`: Enumerate listening TCP ports cross-platform with process name, owner, PID, bind scope, and ownership/protection classification; supports auto-refresh and search/filter.
- `process-termination`: Terminate the process behind a selected port with confirmation, using graceful-then-force on Unix and forceful termination on Windows, while refusing to kill processes the user does not own or that are on a protected-process deny-list.
- `menu-bar-presence`: Run as a background tray/menu-bar app (no Dock/taskbar entry) with an anchored popover window across macOS, Windows, and Linux.
- `launch-at-login`: Provide a one-click toggle to start the app automatically at user login on all supported platforms.

### Modified Capabilities
<!-- None: openspec/specs/ is currently empty; the existing macOS app has no documented specs, so all behavior is captured as new capabilities. -->

## Impact

- **Replaced code**: `Sources/PortKiller/**` (Swift), `Package.swift`, `build_app.sh`.
- **New code**: `src-tauri/` (Rust: commands, tray, config) and a web `src/` (popover UI).
- **New dependencies**: Rust crates `tauri` (2.x), `netstat2`, `sysinfo`, `nix` (Unix), `tauri-plugin-autostart`; a JS/HTML frontend (framework TBD in design).
- **Toolchain**: adds Rust + Node toolchains and the Tauri CLI; per-OS signing (macOS notarization, Windows Authenticode) replaces ad-hoc signing.
- **Behavioral deltas to call out for users**: Windows termination is force-only; tray visibility on Linux depends on the desktop environment (AppIndicator support); "friendly app name" fidelity is reduced to executable name on non-macOS platforms.
- **Key risk to de-risk first**: whether `netstat2` returns owning PIDs for processes the user does not own (macOS/Windows) without elevation.
