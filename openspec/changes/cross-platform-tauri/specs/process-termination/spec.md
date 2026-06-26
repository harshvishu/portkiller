## ADDED Requirements

### Requirement: Terminate the process behind a port

The system SHALL terminate the process that owns a selected listening port on request, and SHALL refresh the listener list afterward so the freed port is no longer shown.

#### Scenario: Killable process is terminated

- **WHEN** the user confirms termination of a listener owned by the current user and not protected
- **THEN** the system terminates the owning process and the port no longer appears in the refreshed list

### Requirement: Require confirmation before terminating

The system SHALL require explicit user confirmation before terminating any process.

#### Scenario: User confirms

- **WHEN** the user requests a kill and confirms the confirmation prompt
- **THEN** the system proceeds to terminate the process

#### Scenario: User cancels

- **WHEN** the user requests a kill and dismisses the confirmation prompt
- **THEN** no process is terminated

### Requirement: Graceful-then-force termination on Unix

On macOS and Linux the system SHALL first request graceful termination via `SIGTERM`, and SHALL escalate to `SIGKILL` only if the process is still alive after a short grace period.

#### Scenario: Process exits gracefully

- **WHEN** a process exits in response to `SIGTERM` within the grace period
- **THEN** the system does not send `SIGKILL`

#### Scenario: Process ignores graceful signal

- **WHEN** a process is still alive after the grace period following `SIGTERM`
- **THEN** the system sends `SIGKILL` to force termination

### Requirement: Forceful termination on Windows

On Windows the system SHALL terminate the process forcefully (there is no `SIGTERM` equivalent for arbitrary processes) and SHALL make the forceful nature of the action evident to the user.

#### Scenario: Windows termination

- **WHEN** the user confirms termination on Windows
- **THEN** the system terminates the process forcefully and the user-facing messaging reflects that the action is immediate/forceful

### Requirement: Refuse to terminate non-owned or protected processes

The system SHALL refuse to terminate any process that is not owned by the current user or that appears on the platform's protected-process deny-list, and SHALL enforce this in the backend regardless of what the frontend requests.

#### Scenario: Process owned by another user

- **WHEN** a termination is requested for a process not owned by the current user
- **THEN** the system refuses and reports that elevated privileges would be required

#### Scenario: Protected system process

- **WHEN** a termination is requested for a process on the platform's protected-process deny-list
- **THEN** the system refuses and reports that the process is protected

#### Scenario: Backend revalidates frontend requests

- **WHEN** the frontend requests termination of a PID that is not killable
- **THEN** the backend re-validates ownership and protection and refuses, without trusting the frontend's claim

### Requirement: Maintain per-platform protected-process deny-lists

The system SHALL maintain a deny-list of protected system process names for each supported platform (macOS, Windows, Linux) and SHALL treat matching processes as not killable.

#### Scenario: Platform-appropriate protection

- **WHEN** the application runs on a given platform and encounters a process named in that platform's deny-list
- **THEN** the listener is marked not killable with a protection reason

### Requirement: Report termination outcome

The system SHALL report the outcome of a termination attempt with a human-readable status covering success, "already stopped", "not permitted", and other failures.

#### Scenario: Process already exited

- **WHEN** the targeted process has already exited before the signal is delivered
- **THEN** the system reports that the process had already stopped

#### Scenario: Permission denied

- **WHEN** the operating system denies permission to terminate the process
- **THEN** the system reports that it was not permitted to stop the process
