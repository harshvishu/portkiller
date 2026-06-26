## ADDED Requirements

### Requirement: Enumerate listening TCP ports cross-platform

The system SHALL enumerate all TCP sockets in the LISTEN state on macOS, Windows, and Linux using native operating-system socket APIs (not by shelling out to external tools), returning at minimum the port number, owning process identifier (PID), process command/executable name, and owner for each listener.

#### Scenario: Listeners are present

- **WHEN** one or more processes are listening on TCP ports and the list is requested
- **THEN** the system returns an entry for each listener including its port, PID, command name, and owner

#### Scenario: No listeners are present

- **WHEN** no process is listening on any TCP port
- **THEN** the system returns an empty list without error

#### Scenario: Platform parity

- **WHEN** the application runs on macOS, Windows, or Linux
- **THEN** listener enumeration uses that platform's native socket API and produces entries in the same shape on every platform

### Requirement: Resolve process metadata and ownership

The system SHALL resolve each listener's PID to a process name and owner, and SHALL determine whether the current user owns the process.

#### Scenario: Process owned by the current user

- **WHEN** a listener belongs to a process owned by the current user
- **THEN** the entry shows the process name and owner and is marked as owned by the current user

#### Scenario: Owning process cannot be resolved without elevation

- **WHEN** a listener's owning process cannot be resolved because it is owned by another user or a system account and elevation is not available
- **THEN** the system still returns the port entry, marks it as not owned by the current user, and provides a protection reason instead of failing

### Requirement: Classify bind scope

The system SHALL classify each listener as either localhost-only or exposed on all interfaces based on its bound address(es).

#### Scenario: Localhost-only listener

- **WHEN** a listener is bound only to loopback addresses (e.g. `127.0.0.1` or `::1`)
- **THEN** the entry is classified as localhost

#### Scenario: Externally exposed listener

- **WHEN** a listener is bound to a wildcard or any-interface address (e.g. `0.0.0.0`, `*`, or `[::]`)
- **THEN** the entry is classified as all interfaces

### Requirement: De-duplicate listeners per process and port

The system SHALL group multiple bound addresses for the same process-and-port pair into a single entry that records every bound address.

#### Scenario: Same port bound on IPv4 and IPv6

- **WHEN** a single process listens on the same port via both an IPv4 and an IPv6 address
- **THEN** the system returns one entry for that process-and-port pair containing both addresses

### Requirement: Sort listeners by port

The system SHALL return listeners sorted in ascending order by port number.

#### Scenario: Multiple listeners on different ports

- **WHEN** several processes listen on different ports
- **THEN** the returned list is ordered from lowest to highest port number

### Requirement: Auto-refresh while visible

The system SHALL refresh the listener list on a recurring interval while the popover is visible and SHALL stop refreshing when the popover is hidden.

#### Scenario: Popover is open

- **WHEN** the popover is visible
- **THEN** the listener list is re-scanned automatically on a recurring interval

#### Scenario: Popover is hidden

- **WHEN** the popover becomes hidden
- **THEN** automatic re-scanning stops until the popover is shown again

### Requirement: Search and filter listeners

The system SHALL allow the user to filter the visible listeners by a free-text query matched case-insensitively against the port, process name, command, and owner, and SHALL show all listeners when the query is empty.

#### Scenario: Query matches some listeners

- **WHEN** the user types a query that matches the port, name, command, or owner of some listeners
- **THEN** only the matching listeners remain visible

#### Scenario: Query is empty

- **WHEN** the filter query is empty
- **THEN** all listeners are shown
