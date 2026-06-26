# Port Killer

A lightweight macOS **menu bar app** that lists every process listening on a TCP
port and lets you stop it with one click — perfect for clearing a stuck dev
server (`3000`, `8080`, …).

![menu bar](https://img.shields.io/badge/macOS-13%2B-blue) ![swift](https://img.shields.io/badge/Swift-5.9-orange)

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
- **Launch at login** — a one-click toggle (via `SMAppService`) to start Port
  Killer automatically when you sign in.

## Requirements

- macOS 13 (Ventura) or later
- Swift toolchain (Xcode or Command Line Tools)

## Build & run

```bash
./build_app.sh
open "dist/Port Killer.app"
```

Look for the ⚡️ plug icon in your menu bar. Click it to see the list.

To install it permanently:

```bash
cp -R "dist/Port Killer.app" /Applications/
```

### Launch at login (optional)

System Settings → General → Login Items → **+** → choose
`/Applications/Port Killer.app`.

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
