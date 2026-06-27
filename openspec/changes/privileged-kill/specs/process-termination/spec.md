## ADDED Requirements

### Requirement: Offer privilege escalation for non-owned processes

The system SHALL offer an explicit, opt-in action to terminate a listener owned by another user (but not on the protected-process deny-list) by escalating privileges through the operating system's native authorization mechanism.

#### Scenario: Non-owned, non-protected listener

- **WHEN** a listener is owned by another user and is not on the protected deny-list
- **THEN** the system offers a distinct "terminate as administrator" action in addition to showing it as not killable by the normal path

#### Scenario: Protected listener is not offered escalation

- **WHEN** a listener is on the protected deny-list
- **THEN** the system does not offer an escalation action and the listener remains fully locked

### Requirement: Require explicit consent for escalation

The system SHALL require an explicit confirmation, distinct from the ordinary kill confirmation, before initiating a privileged termination, and the operating system's authentication prompt SHALL act as the final consent gate.

#### Scenario: User confirms and authenticates

- **WHEN** the user confirms the escalation and completes the operating system authentication prompt
- **THEN** the system proceeds to terminate the process with elevated privileges

#### Scenario: User cancels the authentication prompt

- **WHEN** the user dismisses the operating system authentication prompt
- **THEN** no process is terminated and the outcome is reported as authentication cancelled without error styling

### Requirement: Terminate a non-owned process with elevated privileges

On request and after consent, the system SHALL terminate a non-owned, non-protected listener's process using the platform's native escalation mechanism, applying graceful-then-force termination on macOS and Linux and forceful termination on Windows.

#### Scenario: Elevated termination succeeds

- **WHEN** escalation is authorized for a non-owned, non-protected process
- **THEN** the process is terminated with elevated privileges and the freed port no longer appears in the refreshed list

#### Scenario: Graceful-then-force under elevation on Unix

- **WHEN** an elevated termination is performed on macOS or Linux and the process survives the graceful signal
- **THEN** the system escalates to a forceful signal under the same elevation

#### Scenario: Escalation mechanism unavailable

- **WHEN** no native escalation mechanism is available on the current platform
- **THEN** the system reports that escalation is unavailable and terminates nothing

### Requirement: Re-validate before privileged termination

Before constructing any privileged command, the system SHALL re-validate in the backend that the target PID still corresponds to a live listening process and is not on the protected-process deny-list, and SHALL never interpolate untrusted input into a shell invocation.

#### Scenario: Backend re-validates the privileged request

- **WHEN** the frontend requests an elevated termination
- **THEN** the backend re-checks liveness and protection before escalating and refuses if either check fails, without trusting the frontend's claim

#### Scenario: PID is treated as an integer

- **WHEN** an elevated termination is constructed
- **THEN** the target PID is validated as an integer and passed as a fixed argument, never assembled into a formatted shell string from untrusted input

### Requirement: Report privileged termination outcome

The system SHALL report the outcome of a privileged termination attempt using a human-readable status that additionally covers "authentication cancelled" and "escalation unavailable" alongside the existing success, already-stopped, not-permitted, and other-failure outcomes.

#### Scenario: Authentication cancelled

- **WHEN** the user cancels the authentication prompt
- **THEN** the system reports that authentication was cancelled and that nothing was terminated

#### Scenario: Escalation unavailable

- **WHEN** the platform offers no escalation mechanism
- **THEN** the system reports that escalation is unavailable

## MODIFIED Requirements

### Requirement: Refuse to terminate non-owned or protected processes

The system SHALL refuse, on the ordinary (non-privileged) termination path, to terminate any process that is not owned by the current user or that appears on the platform's protected-process deny-list, and SHALL enforce this in the backend regardless of what the frontend requests. A process that is not owned by the current user but is not on the protected deny-list MAY instead be terminated through the explicit privilege-escalation path; a process on the protected deny-list SHALL NOT be terminable through any path, including escalation.

#### Scenario: Process owned by another user

- **WHEN** an ordinary termination is requested for a process not owned by the current user
- **THEN** the system refuses on the ordinary path and reports that elevated privileges are required, offering the explicit escalation path instead

#### Scenario: Protected system process

- **WHEN** a termination is requested for a process on the platform's protected-process deny-list
- **THEN** the system refuses on every path, including privilege escalation, and reports that the process is protected

#### Scenario: Backend revalidates frontend requests

- **WHEN** the frontend requests termination of a PID that is not killable on the requested path
- **THEN** the backend re-validates ownership and protection and refuses, without trusting the frontend's claim
