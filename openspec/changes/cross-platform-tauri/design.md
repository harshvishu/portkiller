## Context

Port Killer today is a macOS-only menu bar app. Its core is small — essentially "list listening TCP ports" and "kill the process behind a port" — but every layer is bound to Apple frameworks:

- Discovery shells out to `lsof -iTCP -sTCP:LISTEN -P -n -FpcuLn` and parses the `-F` field output (`PortScanner`).
- Friendly names come from `NSWorkspace.runningApplications` (AppKit).
- Termination uses `Darwin.kill` with `SIGTERM`→`SIGKILL`.
- Ownership/protection uses `getuid()` plus a hardcoded macOS daemon deny-list.
- The shell is a SwiftUI `MenuBarExtra(.window)` with `.accessory` activation policy.
- Launch-at-login uses `SMAppService`.

The goal is to make this run on macOS, Windows, and Linux from a single codebase using Tauri 2.0 (Rust backend + web frontend), preserving the macOS feature set while adding the other two platforms. Crucially, the part that looks hardest to port — port/process discovery — is the part with the most mature cross-platform Rust crates, so the discovery layer becomes *more* robust than today's `lsof` text-parsing.

## Goals / Non-Goals

**Goals:**
- Single Rust core that enumerates listeners and terminates processes on macOS, Windows, and Linux.
- Feature parity with the current macOS app: live auto-refresh, search/filter, friendly names, bind-scope hint, protected/greyed processes, kill confirmation, launch-at-login.
- Tray/menu-bar presence with an anchored popover and no Dock/taskbar entry.
- Replace `lsof` parsing with native socket APIs (`netstat2`) and process metadata (`sysinfo`).
- Reproducible cross-platform packaging via the Tauri bundler.

**Non-Goals:**
- Mobile (iOS/Android) targets.
- Privilege escalation / killing processes the user does not own (same constraint as today — those stay greyed out).
- Managing UDP listeners or remote/SSH ports (TCP-listen only, as today).
- A redesigned UX; this is a port, not a redesign. Visual polish beyond parity is out of scope.

## Decisions

### D1: Tauri 2.0 over Electron / native-per-OS / Flutter
Tauri uses the system webview (≈600 KB baseline vs Electron's bundled Chromium), gives a Rust backend ideal for native socket/process APIs, and has first-class tray + autostart support. Native-per-OS (SwiftUI + WinUI + GTK) triples UI work; Flutter would still need FFI for socket/process APIs and has weaker tray/background-app support. The user has already chosen Tauri; this design commits to it.

### D2: `netstat2` + `sysinfo` instead of shelling out
Rather than shell to `lsof` (macOS/Linux) and `netstat`/`Get-NetTCPConnection` (Windows) and parse three text formats, use:
- **`netstat2`** — enumerates TCP sockets via native APIs (`sysctl`/`libproc` on macOS, netlink/procfs on Linux, IP Helper `GetExtendedTcpTable` on Windows), returning local addr/port, state, and `associated_pids`. Filter to `TcpState::Listen`.
- **`sysinfo`** — resolves PID → process name, exe, and `user_id`; provides the current user for ownership checks.

This removes all text parsing, avoids a `lsof` dependency on Windows entirely, and keeps the per-OS differences inside well-maintained crates. *Alternative considered:* keep shelling out via the Tauri shell plugin — rejected because it requires `lsof`/equivalent to exist, is fragile to parse, and widens the permission surface.

### D3: Graceful-then-force on Unix, force-only on Windows
- macOS/Linux: `nix::sys::signal::kill(pid, SIGTERM)`, check liveness after a short delay, escalate to `SIGKILL` — matching today's behavior.
- Windows: no `SIGTERM` semantics for arbitrary processes; use `TerminateProcess` (forceful, ≈`SIGKILL`). A "polite" close would require posting `WM_CLOSE`/`GenerateConsoleCtrlEvent`, which is unreliable for arbitrary dev servers and out of scope.

The kill command returns a structured result so the UI can show the same status messages as today. *Alternative considered:* `sysinfo::Process::kill()` everywhere — rejected because it is forceful on all platforms, losing the graceful path on Unix.

### D4: Tray icon + borderless popover window
Use Tauri 2.0 `TrayIconBuilder` for the tray/menu-bar item and a single borderless, always-on-top, `skipTaskbar` window for the popover. Toggle visibility on tray click and position the window near the tray using `tauri-plugin-positioner` (`TrayCenter`/`TrayBottomCenter`): top-anchored on macOS, bottom-right on Windows, DE-dependent on Linux. *Alternative considered:* a native tray context menu — rejected because it can't render the rich list/search/kill UI.

### D5: `tauri-plugin-autostart` for launch-at-login
One plugin covers all three platforms (LaunchAgent on macOS, `Run` registry key on Windows, `.desktop` autostart entry on Linux), replacing `SMAppService`. The UI toggle calls the plugin's enable/disable/`is_enabled` APIs.

### D6: Frontend = lightweight web UI, framework TBD
The UI is two views (list + row) plus a header/search/footer — small. Prefer vanilla TS or a minimal framework (Svelte/Solid) to keep bundle size and complexity low. Final pick deferred (Open Question Q1); the IPC contract below is framework-agnostic.

### D7: IPC = `invoke` commands + frontend-driven polling
Expose Rust commands `list_ports() -> Vec<PortProcess>` and `kill_port(pid) -> KillResult`. The frontend polls `list_ports` on a timer (default 3s, matching today's `startAutoRefresh`) while the popover is open, and stops when hidden. *Alternative considered:* backend `emit`/channel push — deferred; polling is simpler and the dataset is tiny. The serialized `PortProcess` mirrors today's struct (port, pid, command, user, addresses, displayName, isKillable, protectedReason, bindScope).

### D8: Per-OS ownership + protection
Ownership: compare process `user_id` to the current user (`sysinfo`). Protection: keep a per-OS deny-list of system processes — the existing macOS daemon list, plus Windows (`System`, `svchost.exe`, `lsass.exe`, `services.exe`, …) and Linux (`systemd`, `cupsd`, …). Non-owned or deny-listed processes are returned as `isKillable = false` with a reason, exactly as today.

### D9: Background app with no Dock/taskbar entry
- macOS: `app.set_activation_policy(ActivationPolicy::Accessory)` (and/or `LSUIElement`).
- Windows/Linux: main window `skipTaskbar: true`, no visible primary window; tray is the entry point.
- Add `tauri-plugin-single-instance` so re-launching focuses the existing tray app rather than spawning a second.

### D10: Locked-down Tauri capabilities
No shell plugin. The only privileged operations are our own `kill_port`/`list_ports` commands. Capabilities grant only the autostart, positioner, and single-instance plugin permissions actually used. The kill command validates `isKillable` server-side (never trusts the frontend) before signaling.

## Risks / Trade-offs

- **Foreign-PID visibility without elevation** → The current app shows root/other-user listeners greyed out because `lsof` surfaces them. Whether `netstat2` returns `associated_pids` for non-owned processes on macOS/Windows without admin is unverified. **Mitigation:** spike this first (Q3); worst case, show the port with an "unknown owner / protected" row instead of a process name — still greyed out, so only cosmetic. **Spike result (macOS):** `netstat2` + `sysinfo` reached full parity with the app's `lsof` query — identical 8 listeners, every one with a resolvable `associated_pid` and owner, zero unresolved. Unelevated `lsof` likewise surfaces no root-owned listener details, so there is no regression. Windows half still pending verification on a Windows host.
- **Linux tray is desktop-environment dependent** → Tauri tray needs `libayatana-appindicator`; GNOME needs the AppIndicator extension to show it. **Mitigation:** detect tray availability; fall back to a normal window when absent; document the Linux requirement. Decide whether Linux is v1 or fast-follow (Q2).
- **Windows force-only kill** → loses the graceful path. **Mitigation:** keep graceful on Unix; label Windows kills clearly in the UI/confirmation so behavior is honest.
- **Popover positioning isn't natively anchored** → the borderless-window approach won't feel 100% native on every OS. **Mitigation:** `tauri-plugin-positioner` + per-OS anchor; accept minor differences.
- **Friendly-name fidelity loss off macOS** → no `NSWorkspace` localized app names; only the executable name is available. **Mitigation:** acceptable for a dev tool (the command is usually what you want); keep the macOS niceness via `sysinfo`/optional platform code if cheap.
- **Per-OS signing/notarization overhead** → macOS notarization + Windows Authenticode replace ad-hoc signing. **Mitigation:** automate in CI per OS; ad-hoc/unsigned dev builds remain possible locally.
- **Security: kill is a powerful capability** → **Mitigation:** restrict to user-owned, non-protected processes; validate server-side; no shell plugin; minimal capability grants (OWASP: avoid broad command execution surface).

## Migration Plan

1. **Spike (de-risk):** small Rust binary using `netstat2` + `sysinfo` on macOS *and* Windows to confirm listener enumeration and PID association for owned and non-owned processes (resolves Q3).
2. **Scaffold** the Tauri 2.0 project (`src-tauri/` + web `src/`) alongside the existing Swift tree during the transition.
3. **Port discovery** (`list_ports`) to parity, then **termination** (`kill_port`).
4. **Tray + popover** shell, background/no-dock config, single-instance.
5. **Autostart** toggle via plugin.
6. **Packaging + signing** per OS through the Tauri bundler; wire CI.
7. **Cutover (completed 2026-07-02):** macOS parity accepted; removed `Sources/PortKiller/**`, `Package.swift`, and `build_app.sh`; updated README.

**Rollback:** the Swift rollback path was intentionally removed after Tauri acceptance. Future rollback should revert the cutover commit or ship a previous Tauri artifact.

## Open Questions

- **Q1 (RESOLVED):** Frontend stack — **vanilla TS + Vite**, chosen for the smallest bundle and fewest dependencies.
- **Q2 (RESOLVED):** Linux scope — **macOS + Windows first, Linux fast-follow.** Code stays cross-platform (the crates support Linux), but Linux tray/packaging/testing are deferred.
- **Q3 (OPEN — spike):** Does `netstat2` return owning PIDs for non-owned processes without elevation on macOS/Windows? Resolvable on macOS now; the Windows half must be verified on a Windows host.
- **Q4:** Keep TCP-listen-only, or is enumerating UDP listeners in scope later?
- **Q5:** Do we need a fallback main window on Linux when no system tray is available, and should that ship in v1? (Deferred with Q2.)
