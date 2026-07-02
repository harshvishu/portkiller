## 1. De-risk spike

- [x] 1.1 Write a throwaway Rust binary using `netstat2` to list TCP listeners (port, local addr, state, `associated_pids`) and `sysinfo` to resolve PID → name/owner
- [x] 1.2 Run the spike on macOS and confirm owned-process listeners resolve to PID + name + owner
- [ ] 1.3 Run the spike on Windows and confirm listener enumeration and PID association work without elevation — DEFERRED: requires a Windows host
- [x] 1.4 Record whether non-owned/system listeners return an `associated_pid` per platform (resolves design Q3); decide the degraded-row behavior if not — macOS: full parity with `lsof`, 0 unresolved; degraded row = show port as "unknown owner / protected". Windows pending.
- [x] 1.5 Confirm Q2 (is Linux a v1 target or fast-follow?) and Q1 (frontend stack) so later tasks are unambiguous — Q1=vanilla TS+Vite, Q2=macOS+Windows first

## 2. Scaffold Tauri project

- [x] 2.1 Add a Tauri 2.0 project (`src-tauri/` + web `src/`) alongside the existing Swift tree without deleting it
- [x] 2.2 Add Rust dependencies: `tauri` 2.x, `netstat2`, `sysinfo`, `nix` (Unix-gated), `serde`/`serde_json`
- [x] 2.3 Add Tauri plugins: `tauri-plugin-autostart`, `tauri-plugin-positioner`, `tauri-plugin-single-instance`
- [x] 2.4 Configure `tauri.conf.json` base (app identifier, window defaults, bundler targets per OS)
- [x] 2.5 Verify `cargo tauri dev` launches an empty shell on the current platform — verified via `cargo check` (EXIT=0) and release bundle build

## 3. Port discovery (backend + IPC)

- [x] 3.1 Define a serializable `PortProcess` struct (port, pid, command, user, addresses, display_name, is_killable, protected_reason, bind_scope) mirroring the current model
- [x] 3.2 Implement listener enumeration with `netstat2` filtered to the LISTEN state (spec: Enumerate listening TCP ports cross-platform)
- [x] 3.3 Resolve PID → name/owner with `sysinfo` and determine current-user ownership (spec: Resolve process metadata and ownership)
- [x] 3.4 Handle unresolved/foreign PIDs gracefully (return port marked not-owned with a protection reason)
- [x] 3.5 Implement bind-scope classification (localhost vs all interfaces) (spec: Classify bind scope)
- [x] 3.6 De-duplicate by (pid, port) accumulating addresses, and sort ascending by port (specs: De-duplicate; Sort by port)
- [x] 3.7 Implement per-platform protected-process deny-lists (macOS existing list + Windows + Linux) (spec: Maintain per-platform deny-lists)
- [x] 3.8 Implement ownership/protection → `is_killable` + reason logic (spec: Refuse to terminate non-owned or protected processes)
- [x] 3.9 Expose a `list_ports` `#[tauri::command]` returning `Vec<PortProcess>`
- [x] 3.10 Unit-test enumeration parsing, bind-scope, de-dup, sort, and killability classification — 7 tests passing

## 4. Process termination (backend + IPC)

- [x] 4.1 Define a serializable `KillResult` (outcome + human-readable status)
- [x] 4.2 Implement Unix graceful-then-force kill via `nix` (`SIGTERM`, grace period, then `SIGKILL` if alive) (spec: Graceful-then-force on Unix)
- [x] 4.3 Implement Windows forceful kill via `TerminateProcess` and signal forcefulness in the result (spec: Forceful termination on Windows)
- [x] 4.4 Re-validate ownership + protection in the backend before signaling; refuse if not killable (spec: Backend revalidates frontend requests)
- [x] 4.5 Map OS errors to statuses: success, already stopped, not permitted, other failure (spec: Report termination outcome)
- [x] 4.6 Expose a `kill_port` `#[tauri::command]` taking a PID and returning `KillResult`
- [x] 4.7 Lock down capabilities/permissions (no shell plugin; grant only the plugins actually used) (design D10)

## 5. Frontend popover UI

- [x] 5.1 Build the popover layout: header, search box, scrolling list, footer (parity with `PortListView`)
- [x] 5.2 Build a port row with port, bind-scope hint, name, PID/owner, and Kill / Protected control (parity with `PortRowView`)
- [x] 5.3 Wire `invoke('list_ports')` and render results; show empty/scanning/no-match states
- [x] 5.4 Implement client-side search/filter over port, name, command, owner (spec: Search and filter)
- [x] 5.5 Implement auto-refresh on a timer while the popover is visible and stop when hidden (spec: Auto-refresh while visible)
- [x] 5.6 Implement the Kill confirmation dialog, then `invoke('kill_port')`, then refresh; show returned status (specs: Require confirmation; Report outcome)
- [x] 5.7 Add the launch-at-login toggle and Quit control in the footer

## 6. Tray, popover window & background app

- [x] 6.1 Add the tray icon assets (template image on macOS; ICO/PNG sizes for Windows/Linux) replacing the drawn glyph
- [x] 6.2 Build the tray icon with `TrayIconBuilder` and toggle a borderless, always-on-top, `skipTaskbar` popover window (spec: Tray presence; Anchored popover)
- [x] 6.3 Position the popover near the tray per platform using `tauri-plugin-positioner`; hide on blur
- [x] 6.4 Configure background/no-dock operation: `ActivationPolicy::Accessory` on macOS, no taskbar entry on Windows/Linux (spec: No Dock or taskbar entry)
- [x] 6.5 Wire `tauri-plugin-single-instance` to focus the existing popover on relaunch (spec: Single running instance)
- [ ] 6.6 Implement Linux tray-availability detection and a fallback window when no tray exists (spec: Linux tray fallback) — DEFERRED with Linux scope (Q2)
- [x] 6.7 Implement the Quit action that removes the tray and exits (spec: Quit the application)

> Note: 6.1–6.5/6.7 are implemented and compile; interactive tray/popover behavior needs an on-device GUI check.

## 7. Launch at login

- [x] 7.1 Wire the toggle to `tauri-plugin-autostart` enable/disable (spec: Toggle launch at login)
- [x] 7.2 Reflect the real autostart state when the popover opens (spec: Reflect the current autostart state)
- [x] 7.3 Surface errors and revert the toggle to actual state on failure (spec: Handle autostart failures without misreporting)

## 8. Packaging, signing & CI

- [x] 8.1 Configure Tauri bundler targets: `.dmg`/`.app` (macOS), `.msi`/NSIS `.exe` (Windows), `.deb`/`.rpm`/`.AppImage` (Linux)
- [ ] 8.2 Configure macOS signing + notarization — DEFERRED: requires an Apple Developer certificate
- [ ] 8.3 Configure Windows Authenticode signing — DEFERRED: requires a code-signing certificate + Windows host
- [x] 8.4 Add per-OS CI jobs that build and bundle the app
- [ ] 8.5 Verify installable artifacts launch on each target platform — macOS `.app` built and smoke-launched here: frontend (tsc+vite) builds clean, release bundle builds, binary launches and stays alive (no crash), bundled `Info.plist` has `LSUIElement=true` (no-Dock accessory). Windows/Linux pending those hosts

## 9. Parity verification & cutover

- [x] 9.1 Verify macOS feature parity against the original app (list, search, bind scope, protected rows, graceful kill, autostart) — backend/tests/build verified; release bundle smoke-launched (clean start, single-instance plugin confirmed by a second launch exiting immediately while one was running); interactive GUI parity accepted by user on 2026-07-02
- [ ] 9.2 Verify Windows behavior (enumeration, force kill messaging, autostart, tray, no taskbar entry) — DEFERRED: requires a Windows host
- [ ] 9.3 Verify Linux behavior (enumeration, kill, autostart, tray or fallback window) — DEFERRED with Linux scope (Q2)
- [x] 9.4 Remove the Swift implementation: `Sources/PortKiller/**`, `Package.swift`, `build_app.sh` — cutover completed after macOS GUI sign-off; Swift rollback path removed
- [x] 9.5 Update `README.md` for the cross-platform Tauri app (build, run, install per OS; document Windows force-kill and Linux tray caveats)
