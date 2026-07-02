# Port Killer

A lightweight **menu-bar / system-tray app** that lists every process listening
on a TCP port and lets you stop it with one click — perfect for clearing a stuck
dev server (`3000`, `8080`, …). Cross-platform, built with
[Tauri 2](https://v2.tauri.app/) (Rust backend + web UI).

![macOS](https://img.shields.io/badge/macOS-supported-blue) ![Windows](https://img.shields.io/badge/Windows-supported-blue) ![Linux](https://img.shields.io/badge/Linux-fast--follow-lightgrey) ![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)

## Features

- **Lives in the menu bar** — no Dock icon, always one click away.
- **Custom power-symbol tray icon**, bundled as a template asset so it adapts
  to light/dark menus automatically on macOS.
- **Live list of listening ports**, sorted by port number, auto-refreshing
  every few seconds while open.
- **Search / filter box** — instantly narrow the list by port number, app name,
  command, or owner.
- **Friendly process labels** — shows the executable/process name behind each
  listener (e.g. `node`, `python`, `Code Helper`).
- **Trailing Kill button** on every row.
- **Confirmation alert** before anything is terminated.
- **Protected processes are greyed out** with a lock badge and a "Protected"
  label — covers both macOS system services (e.g. `rapportd`, `mDNSResponder`)
  and any process not owned by you (which you can't stop without elevated
  privileges).
- **Safe termination path** — Unix builds send `SIGTERM`, then escalate to
  `SIGKILL` only if the process refuses to exit; Windows uses a forceful stop.
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

## Releasing & installation

Releases are **tag-driven** and gated to the `release` branch:

1. Land release-ready code on the `release` branch (CI validates every push).
2. Cut a version — either run the **version** workflow (Actions ▸ *version* ▸
   choose `patch` / `minor` / `major`), or tag by hand on `release`:
   ```bash
   git tag v1.2.0 && git push origin v1.2.0
   ```
3. The **release** workflow verifies the tag is on `release`, builds macOS
   (universal), Windows, and Linux installers, stamps the version from the tag,
   and publishes a **draft** GitHub Release. A maintainer reviews and publishes it.

The git tag is the single source of truth for the version — the pipeline stamps
it into `package.json`, `Cargo.toml`, and `tauri.conf.json` at build time.

> To make the bump workflow's pushed tag auto-start a release, add a `RELEASE_PAT`
> repo secret (a fine-grained PAT with `contents: write`); the default token does
> not trigger downstream workflows.

### Installing unsigned builds

Current releases are **not yet code-signed**, so the OS warns on first launch:

- **macOS** — right-click *Port Killer.app* → **Open**, then confirm. Or clear the
  quarantine flag: `xattr -dr com.apple.quarantine "/Applications/Port Killer.app"`.
- **Windows** — SmartScreen shows "unknown publisher": **More info** → **Run anyway**.
- **Linux** — make the AppImage executable first: `chmod +x Port*.AppImage`.

Code signing / notarization (and package-manager channels like Homebrew Cask and
winget that depend on it) are a planned follow-up.

## How it works

| Concern            | Implementation                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| Discover ports     | Rust `netstat2` socket enumeration filtered to TCP `LISTEN`                 |
| Process metadata   | `sysinfo` resolves PID, command, owner, CPU, and memory                     |
| Filtering / sort   | Vanilla TypeScript UI filters by port, PID, name, command, owner, category  |
| Protection rule    | Backend checks ownership and per-OS system-service deny-lists               |
| Kill               | Unix `SIGTERM` then `SIGKILL`; Windows forceful process termination         |
| Tray / popover     | Tauri tray icon plus a borderless, always-on-top popover window             |
| Tray icon          | Bundled `src-tauri/icons/tray.png`, marked as a template image on macOS     |
| Launch at login    | `tauri-plugin-autostart`                                                    |
| Permissions        | Tauri v2 capabilities grant only core window APIs and autostart operations  |

## Project layout

```
src/
  main.ts                    # popover UI, filtering, sorting, IPC calls
  styles.css                 # popover styling and native material fallback
src-tauri/
  src/lib.rs                 # Tauri builder, commands, tray, popover behavior
  src/ports.rs               # TCP listener discovery, metadata, protection rules
  src/kill.rs                # process termination per OS
  src/main.rs                # thin desktop entry point
  capabilities/default.json  # locked-down Tauri permissions
  icons/                     # app and tray icon assets
  tauri.conf.json            # app, window, bundler, and security config
scripts/set-version.mjs      # release pipeline version stamping
```

## Notes & safety

- The deny-lists in `src-tauri/src/ports.rs` are conservative; add names there
  if you want extra processes protected.
- Local builds are unsigned/ad-hoc signed. On first launch macOS Gatekeeper may
  require right-click → **Open**.
- It only touches processes **you own** — it cannot kill root/system processes,
  and the backend revalidates that rule before every termination attempt.
