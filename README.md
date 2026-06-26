# Port Killer

A lightweight **menu-bar / system-tray app** that lists every process listening
on a TCP port and lets you stop it with one click — perfect for clearing a stuck
dev server (`3000`, `8080`, …). Cross-platform, built with
[Tauri 2](https://v2.tauri.app/) (Rust backend + web UI).

![macOS](https://img.shields.io/badge/macOS-supported-blue) ![Windows](https://img.shields.io/badge/Windows-supported-blue) ![Linux](https://img.shields.io/badge/Linux-fast--follow-lightgrey) ![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)

## Features

- **Lives in the menu bar** — no Dock icon, always one click away.
- **Custom power-symbol icon**, drawn in code as a template image so it adapts
  to light/dark menus automatically.
- **Live list of listening ports**, sorted by port number, auto-refreshing
  every few seconds while open.
- **Search / filter box** — instantly narrow the list by port number, app name,
  command, or owner.
- **Friendly names** — shows the app name when available, otherwise the process
  command (e.g. `node`, `Python`, `Code Helper`).
- **Trailing Kill button** on every row.
- **Confirmation alert** before anything is terminated.
- **Protected processes are greyed out** with a lock badge and a "Protected"
  label — covers both macOS system services (e.g. `rapportd`, `mDNSResponder`)
  and any process not owned by you (which you can't stop without elevated
  privileges).
- **Graceful kill** — sends `SIGTERM`, then escalates to `SIGKILL` only if the
  process refuses to exit, so the port is reliably freed.
- **Bind-scope hint** — shows whether a port is `localhost`-only or exposed on
  `all interfaces`.
- **Launch at login** — a one-click, cross-platform toggle to start Port Killer
  automatically when you sign in.

## Requirements

To build from source you need the
[Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/):

- **Rust** (stable) and **Node.js 18+**
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools + WebView2 (preinstalled on Windows 10/11)
- Linux: WebKitGTK + AppIndicator (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, …)

## Run & build

```bash
npm install            # install frontend deps + the Tauri CLI
npm run tauri dev      # run the app with hot-reloading
npm run tauri build    # release bundle -> src-tauri/target/release/bundle/
```

`tauri dev`/`build` invoke Vite automatically. The app lives in the macOS menu
bar or the Windows/Linux system tray — look for the ⏻ power icon and click it to
open the popover.

### Regenerating icons

```bash
npm run tauri icon app-icon.png   # regenerate src-tauri/icons/ from the source PNG
```

## How it works

| Concern            | Implementation                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| Discover ports     | `lsof -iTCP -sTCP:LISTEN -P -n -FpcuLn` parsed in `PortScanner`             |
| Friendly app names | `NSWorkspace.runningApplications` matched by PID                            |
| Filtering          | Case-insensitive match on port / name / command / owner in `filteredPorts` |
| Protection rule    | Not owned by you **or** in a system-service deny-list ⇒ greyed out          |
| Kill               | `SIGTERM`, then `SIGKILL` after 0.5 s if still alive                        |
| Menu bar UI        | SwiftUI `MenuBarExtra` with `.menuBarExtraStyle(.window)`                   |
| Menu bar icon      | Template `NSImage` drawn with `NSBezierPath` in `MenuBarIcon`               |
| Launch at login    | `SMAppService.mainApp` register/unregister in `LoginItemManager`           |

## Project layout

```
Sources/PortKiller/
  PortKillerApp.swift        # @main MenuBarExtra scene
  AppDelegate.swift          # accessory (menu-bar-only) activation policy
  MenuBarIcon.swift          # custom template image for the menu bar
  Models/PortProcess.swift   # one listener + ownership/scope info
  Services/PortScanner.swift # lsof invocation + parsing + protection rules
  Services/LoginItemManager.swift    # launch-at-login via SMAppService
  ViewModels/PortScannerModel.swift  # observable state, refresh timer, kill, filter
  Views/PortListView.swift   # popover: header, search, list, footer, confirm alert
  Views/PortRowView.swift    # single row + Kill / Protected control
build_app.sh                 # builds the .app bundle (ad-hoc signed)
```

## Notes & safety

- The deny-list in `PortScanner.protectedProcessNames` is conservative; add
  names there if you want extra processes protected.
- The app is **ad-hoc signed**. On first launch macOS Gatekeeper may require
  right-click → **Open**.
- It only touches processes **you own** — it cannot kill root/system processes,
  which is why those are shown greyed out rather than offered for termination.
