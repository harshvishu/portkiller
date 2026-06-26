## Context

The popover is a fixed-size borderless Tauri window (`380×540`, `decorations:false`, `shadow:true`) rendering a vanilla-TS frontend. Today it's deliberately opaque: `transparent:false`, `#app { background: var(--bg) }`, square corners — chosen during the initial port to avoid transparency config risk. The machine targeted is macOS 26.5 (Tahoe), which renders the system materials in the Liquid Glass design language.

The goal is to make the popover read as a native SwiftUI menu-bar app by using the OS window material and SwiftUI-like styling, keeping emoji icons, and not breaking non-macOS platforms.

## Goals / Non-Goals

**Goals:**
- A translucent macOS popover backed by the **system window material** (not a CSS fake), with rounded corners, system shadow, and a hairline edge.
- SwiftUI-like polish: vibrancy-aware colors, inset rounded selection/hover, hairline dividers, a macOS-style switch, capsule buttons, focus rings.
- Preserve emoji iconography and all existing functionality.
- Graceful, legible solid-background fallback where no material exists.

**Non-Goals:**
- SF Symbols / custom SVG iconography (emoji stays).
- Windows Mica / Acrylic styling (may follow later; this change is macOS-first with a safe fallback elsewhere).
- Any change to discovery, termination, autostart, or tray *behavior*.
- Pixel-perfect parity with AppKit (a webview can't match scroll physics / control rendering exactly).

## Decisions

### D1: The glass comes from the OS, not from CSS
A webview's `backdrop-filter` can only sample pixels *inside the page* — it cannot blur the desktop behind the window. The frosted-glass-over-wallpaper effect must come from an `NSVisualEffectView` provided by the OS. Therefore the base material is delivered via Tauri's `windowEffects` over a transparent window; CSS is used only for *in-page* layering (thin translucent fills, borders, shadows), never to fake the desktop blur. *Alternative considered:* all-CSS glass — rejected because it physically cannot blur the desktop.

### D2: Material = system vibrancy (`popover`), spike alternatives
Use Tauri `windowEffects` with the `popover` material as the default — it's literally what AppKit menu-bar popovers use, and on Tahoe it renders in Liquid Glass. Spike `hudWindow`, `menu`, `sidebar`, and `underWindowBackground` to pick the best-looking option. *Alternative:* the new refractive `NSGlassEffectView` — see Risks; almost certainly not exposed by wry/`window-vibrancy` yet, so it's an Open Question, not a dependency.

### D3: Accept `macOSPrivateApi` for transparency
`transparent: true` on macOS requires `app.macOSPrivateApi: true` and the `tauri` crate's `macos-private-api` feature. This precludes Mac App Store distribution, which is not a target. *Alternative:* opaque window with a fake gradient — rejected; defeats the purpose.

### D4: CSS layering strategy over the material
Make `html/body/#app` transparent. Build depth with **thin rgba fills + hairline borders + soft shadows**, not `backdrop-filter` (which would sample the transparent void). Adopt vibrancy-aware label semantics (primary / secondary / tertiary) and pick opacities that stay legible over a moving backdrop — especially the greyed "protected" rows and the red danger tint on the inline confirmation.

### D5: Keep emoji (per product decision)
No SF Symbols (licensing) and no SVG redraw. Emoji glyphs stay; we only tune their size/opacity/alignment so they sit well on glass.

### D6: Native-style controls in CSS
Replace the default checkbox with a macOS-style **switch** for "Launch at login"; use capsule buttons for primary/destructive actions; add a `:focus-visible` ring matching the system accent. Pure CSS, no new dependencies.

### D7: Graceful fallback
Transparency/material is macOS-only here. On Windows/Linux (and if the material fails to apply), the window stays opaque and `#app` falls back to a solid `--bg`. Drive this with a root state (e.g. a `has-material` class toggled for macOS, or a `@supports`/platform guard) so the translucent path never leaves text floating on nothing.

## Risks / Trade-offs

- **Refractive Liquid Glass may be unreachable** → The new `NSGlassEffectView` (edge lensing/specular) is brand-new and likely not surfaced by wry/`window-vibrancy`. **Mitigation:** ship the classic vibrancy material (already Liquid-Glass-styled on Tahoe); treat true refractive glass as a follow-up gated on toolchain support (Open Question).
- **Legibility over translucency** → moving backdrops reduce contrast. **Mitigation:** tune fill opacities, keep a slightly more opaque content layer behind text, verify protected rows + danger tint in light and dark.
- **`macOSPrivateApi` → no Mac App Store** → **Mitigation:** accepted; not a target. Document it.
- **Transparent + `alwaysOnTop` + tray-positioned window interplay** → transparency can expose edge artifacts or shadow seams. **Mitigation:** set the material `radius` to match the CSS corner radius; verify the system shadow follows the rounded alpha.
- **Material differs across macOS versions** → pre-Tahoe renders the same material less "glassy." **Mitigation:** acceptable; it still looks native on older macOS.
- **Fallback regressions** → a transparency-only stylesheet could leave non-macOS unreadable. **Mitigation:** explicit opaque fallback path, verified.

## Migration Plan

1. **Spike:** flip `transparent:true` + `macOSPrivateApi` + `windowEffects:{effects:["popover"],radius:12}`, transparent `#app`; build on Tahoe; compare `popover`/`hudWindow`/`menu`/`sidebar`; grep `window-vibrancy` for any glass/Tahoe material variant.
2. **Config:** apply chosen material + feature flag.
3. **CSS base:** transparency, rounded root, hairline edge, vibrancy colors.
4. **CSS panels/list:** translucent fills, inset selection/hover, dividers.
5. **Controls:** switch, capsule buttons, focus rings.
6. **Fallback:** opaque solid path for non-macOS / no-material.
7. **Verify:** light + dark, readability, kill/confirm flow unaffected; confirm Windows/Linux fall back cleanly.

## Open Questions

- **Q1:** Which exact material reads best on Tahoe — `popover`, `hudWindow`, `menu`, or `sidebar`? (Spike outcome.)
- **Q2:** Is the refractive `NSGlassEffectView` reachable through Tauri/wry today, or do we stay on classic vibrancy?
- **Q3:** Do we also apply Windows `mica`/`acrylic` in this change, or keep it macOS-only with a solid Windows fallback for now?
- **Q4:** Switch vs. native checkbox for "Launch at login" — is the macOS switch the right metaphor here (it implies an immediate on/off, which matches)?
