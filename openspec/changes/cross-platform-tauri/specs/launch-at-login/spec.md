## ADDED Requirements

### Requirement: Toggle launch at login

The system SHALL provide a single user-facing toggle to enable or disable starting the application automatically at user login, and SHALL apply the change on macOS, Windows, and Linux using the platform's native autostart mechanism.

#### Scenario: Enable launch at login

- **WHEN** the user turns the launch-at-login toggle on
- **THEN** the application registers itself to start automatically at the next user login

#### Scenario: Disable launch at login

- **WHEN** the user turns the launch-at-login toggle off
- **THEN** the application unregisters itself so it no longer starts at login

### Requirement: Reflect the current autostart state

The system SHALL reflect the actual system autostart registration state in the toggle when the UI is shown.

#### Scenario: Toggle reflects system state

- **WHEN** the popover is shown
- **THEN** the launch-at-login toggle reflects whether the application is currently registered to start at login

### Requirement: Handle autostart failures without misreporting

WHEN enabling or disabling autostart fails, the system SHALL surface an error to the user and SHALL NOT report a state that differs from the actual system registration.

#### Scenario: Registration fails

- **WHEN** an attempt to enable or disable launch at login fails
- **THEN** the system shows an error and the toggle reverts to the actual current registration state
