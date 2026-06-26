## Why

On macOS Tahoe (26), the Port Killer popover still reads as a generic web app — an opaque solid background, square corners, and flat panels — even though the OS can give us a genuine translucent **Liquid Glass** window for free. Using the system material (plus rounded corners, vibrancy-aware colors, and native-feeling controls) makes the popover look like a real SwiftUI menu-bar app, while keeping the existing playful emoji identity. This is purely a presentation upgrade; no behavior changes.

## What Changes

- Make the macOS popover window **translucent** using the system vibrancy/Liquid Glass material (`transparent: true` + `windowEffects`), so it blurs the desktop behind it like a native popover.
- **BREAKING (config)**: enable `macOSPrivateApi` + the `macos-private-api` Cargo feature, which transparency requires (this rules out Mac App Store distribution — not a current target).
- Round the popover corners with the system drop shadow following the rounded shape, plus a hairline edge.
- Rework the CSS to layer over the material: transparent `#app`, thin translucent fills for panels/rows, vibrancy-aware label colors, inset rounded hover/selection, hairline dividers.
- Give controls a native feel: a macOS-style **switch** for "Launch at login", capsule primary/destructive buttons, and visible focus rings.
- **Keep the emoji glyphs** (⏻ 🔒 🌐 ⟳ …) — no SF Symbols / SVG icon work.
- Add a **graceful fallback** to a solid, fully-legible background when no window material is available (Linux, or any unsupported case), so non-macOS platforms don't break.

Explicitly preserved: all functionality — port discovery, filtering, kill/confirm flow, autostart, tray behavior — is unchanged.

## Capabilities

### New Capabilities
- `native-appearance`: The popover adopts the native macOS translucent window material and SwiftUI-like styling (rounded glass, vibrancy-aware colors, native-style controls) while preserving emoji iconography and degrading gracefully to a solid background where the material is unavailable.

### Modified Capabilities
<!-- None. This is a presentation layer over the existing menu-bar-presence / port-discovery capabilities; their behavioral requirements are unchanged. -->

## Impact

- **Config**: `src-tauri/tauri.conf.json` (window `transparent`, `windowEffects`, `macOSPrivateApi`), `src-tauri/Cargo.toml` (`tauri` feature `macos-private-api`).
- **Frontend**: `src/styles.css` (translucency, rounded root, vibrancy colors, controls, fallback), possibly small `index.html` tweaks.
- **No backend logic changes** — Rust commands, discovery, and termination are untouched.
- **Distribution note**: `macOSPrivateApi` precludes Mac App Store submission (acceptable; not targeted).
- **Key unknown**: whether the new refractive Liquid Glass material (`NSGlassEffectView`, Tahoe) is reachable through Tauri/wry yet, or whether we use the classic vibrancy material (which already renders in the Tahoe design language).
