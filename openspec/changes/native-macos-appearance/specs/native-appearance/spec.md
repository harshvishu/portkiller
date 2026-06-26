## ADDED Requirements

### Requirement: Translucent macOS window material

On macOS the popover SHALL use the system window vibrancy material as its background — translucent and blurring the desktop/content behind the window — rather than an opaque fill, delivered by the operating system (not emulated in CSS).

#### Scenario: Popover shown on macOS

- **WHEN** the popover is opened on macOS
- **THEN** its background is the translucent system material and content behind the window is visibly blurred through it

#### Scenario: Light and dark adaptation

- **WHEN** the system appearance is light or dark
- **THEN** the material and the foreground text/controls adapt so the popover matches the current appearance

### Requirement: Rounded popover with system shadow

On macOS the popover SHALL have rounded corners with the system drop shadow following the rounded shape and a hairline edge, matching a native menu-bar popover.

#### Scenario: Rounded glass popover

- **WHEN** the popover is visible on macOS
- **THEN** its corners are rounded, a soft system shadow follows the rounded outline, and the window has no square/opaque edges

### Requirement: Vibrancy-aware, legible styling

Foreground text, dividers, rows, and the inline confirmation SHALL remain clearly legible over the translucent material in both light and dark appearances, including protected/greyed rows and the destructive (red) confirmation tint.

#### Scenario: Text over a busy backdrop

- **WHEN** the popover is shown over a bright or busy desktop background
- **THEN** primary and secondary text, the protected-row treatment, and the kill confirmation remain readable with sufficient contrast

### Requirement: Native-style controls

The popover SHALL present native-feeling controls: a macOS-style switch for the launch-at-login toggle, capsule-shaped primary/destructive buttons, and a visible focus indicator on focusable controls.

#### Scenario: Launch-at-login control

- **WHEN** the user views the footer
- **THEN** the launch-at-login control is rendered as a macOS-style switch reflecting the current state

#### Scenario: Keyboard focus

- **WHEN** the user moves keyboard focus to a control
- **THEN** a visible focus ring matching the system accent is shown

### Requirement: Preserve emoji iconography

The popover SHALL continue to use emoji glyphs for its icons and SHALL NOT depend on SF Symbols or bundled icon fonts.

#### Scenario: Icons after the redesign

- **WHEN** the redesigned popover is displayed
- **THEN** the power, lock, globe, refresh, and related glyphs are still emoji, sized and aligned to sit cleanly on the material

### Requirement: Graceful fallback without a window material

WHEN no system window material is available (non-macOS platforms, or any case where the material cannot be applied), the popover SHALL render on a solid, fully opaque background that keeps all content legible.

#### Scenario: No material available

- **WHEN** the app runs where the translucent material is unavailable (e.g. Linux, or material application fails)
- **THEN** the popover uses an opaque solid background and remains fully readable, with no text rendered over transparency

### Requirement: No change to functionality

The appearance change SHALL NOT alter any existing behavior — port discovery, filtering, the kill/confirmation flow, autostart, tray, and window dismissal SHALL behave exactly as before.

#### Scenario: Behavior preserved

- **WHEN** the user lists ports, filters, confirms a kill, toggles launch-at-login, or dismisses the popover
- **THEN** every action behaves identically to before the visual redesign
