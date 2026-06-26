## ADDED Requirements

### Requirement: Tray / menu-bar presence

The system SHALL place an icon in the platform's tray area — the macOS menu bar, the Windows system tray, and the Linux tray — when the application is running.

#### Scenario: Application launched

- **WHEN** the application starts on any supported platform
- **THEN** a tray icon for the application appears in that platform's tray area

### Requirement: Anchored popover toggled from the tray

The system SHALL show the main UI in a borderless popover window anchored near the tray icon, toggled by interacting with the tray icon, and SHALL hide it again on a subsequent toggle or when it loses focus.

#### Scenario: Open the popover

- **WHEN** the user activates the tray icon while the popover is hidden
- **THEN** the popover window appears positioned near the tray icon

#### Scenario: Dismiss the popover

- **WHEN** the user activates the tray icon again or the popover loses focus
- **THEN** the popover window is hidden

### Requirement: Run as a background app with no Dock or taskbar entry

The system SHALL run as a background/accessory application with no Dock icon on macOS and no taskbar entry on Windows and Linux.

#### Scenario: No primary window in the Dock or taskbar

- **WHEN** the application is running
- **THEN** it does not appear in the macOS Dock or app switcher, nor in the Windows/Linux taskbar; the tray icon is the entry point

### Requirement: Single running instance

The system SHALL ensure only one instance runs at a time; launching the application again SHALL surface the existing instance instead of starting a second one.

#### Scenario: Second launch attempt

- **WHEN** the application is launched while an instance is already running
- **THEN** the existing instance's popover is shown/focused and no second instance starts

### Requirement: Linux tray fallback

WHEN the application runs on Linux in an environment without a usable system tray, the system SHALL provide a fallback window so the application remains usable.

#### Scenario: Linux without a system tray

- **WHEN** the application starts on a Linux desktop environment that does not expose a usable system tray
- **THEN** the application presents a fallback window granting access to the same functionality

### Requirement: Quit the application

The system SHALL provide a user-accessible action to quit the application, which removes the tray icon and stops background activity.

#### Scenario: User quits

- **WHEN** the user chooses the quit action
- **THEN** the application exits and its tray icon is removed
