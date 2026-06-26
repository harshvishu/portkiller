## 1. Material spike (de-risk)

- [x] 1.1 Flip the window to `transparent: true` + `app.macOSPrivateApi: true` and add `windowEffects: { effects: ["popover"], state: "active", radius: 12 }`; make `#app` background transparent
- [x] 1.2 Build on macOS Tahoe and confirm the desktop blurs through the popover (real material, not a CSS fake)
- [x] 1.3 Compare materials — `popover`, `hudWindow`, `menu`, `sidebar`, `underWindowBackground` — and pick the best-looking one (resolves design Q1)
- [x] 1.4 Grep `window-vibrancy`'s material enum for any refractive/Tahoe "glass" variant to confirm whether true Liquid Glass is reachable (resolves design Q2)

## 2. Window configuration

- [x] 2.1 Add the `macos-private-api` feature to the `tauri` dependency in `Cargo.toml`
- [x] 2.2 Set `transparent: true`, `macOSPrivateApi: true`, and the chosen `windowEffects` (with `radius` matching the CSS corner radius) in `tauri.conf.json`
- [x] 2.3 Verify the system shadow follows the rounded alpha and there are no square/opaque edges

## 3. Base styling over the material

- [x] 3.1 Make `html`, `body`, and `#app` transparent so the material shows through (spec: Translucent macOS window material)
- [x] 3.2 Round the `#app` corners to match the material radius and add a hairline edge (spec: Rounded popover with system shadow)
- [x] 3.3 Introduce vibrancy-aware label colors (primary / secondary / tertiary) for light and dark (spec: Vibrancy-aware, legible styling)

## 4. Panels, list & confirmation

- [x] 4.1 Replace opaque panel fills (header, search field, footer) with thin translucent fills + hairline borders (no `backdrop-filter` over the void)
- [x] 4.2 Restyle rows: inset rounded hover/selection, hairline inset dividers, refined metrics
- [x] 4.3 Tune the protected/greyed row treatment and the red inline-confirmation tint to stay legible on glass (spec: Vibrancy-aware, legible styling)
- [x] 4.4 Tune emoji glyph size/opacity/alignment to sit cleanly on the material (spec: Preserve emoji iconography)

## 5. Native-style controls

- [x] 5.1 Replace the launch-at-login checkbox with a CSS macOS-style switch reflecting state (spec: Native-style controls)
- [x] 5.2 Style primary/destructive actions as capsule buttons
- [x] 5.3 Add a `:focus-visible` focus ring matching the system accent (spec: Native-style controls)

## 6. Fallback & verification

- [x] 6.1 Implement an opaque solid-background fallback path for non-macOS / no-material cases (spec: Graceful fallback without a window material)
- [x] 6.2 Verify legibility in both light and dark appearances over bright/busy desktops (spec: Vibrancy-aware, legible styling)
- [x] 6.3 Verify all functionality is unchanged — list, filter, kill/confirm, autostart, dismissal (spec: No change to functionality)
- [x] 6.4 Confirm Windows/Linux fall back to a clean opaque background (Windows/Linux verification may be deferred to those hosts)
