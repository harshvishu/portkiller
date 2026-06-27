## ADDED Requirements

### Requirement: Report per-process CPU and memory usage

The system SHALL report, for each listener, the owning process's current CPU utilization and resident memory usage, using a sampler that is retained across scans so that CPU utilization reflects a delta between successive samples rather than a single instantaneous reading.

#### Scenario: Metrics accompany each listener

- **WHEN** the listener list is requested and the owning process can be resolved
- **THEN** each entry includes the process's CPU utilization and memory usage

#### Scenario: First sample after startup

- **WHEN** the listener list is requested before any prior sample exists for a process
- **THEN** the entry still returns, reporting zero (or an unknown placeholder) CPU utilization while still reporting memory usage

#### Scenario: Subsequent samples reflect change

- **WHEN** the list is re-scanned on the recurring interval after an initial sample
- **THEN** the reported CPU utilization reflects the process activity between the two most recent samples

### Requirement: Visualize per-process resource usage

The system SHALL present each listener's CPU and memory usage both as a proportional visual indicator and as a human-readable value.

#### Scenario: Proportional indicators

- **WHEN** a listener row is displayed
- **THEN** its CPU and memory usage are shown as proportional bars alongside their numeric values, with memory normalized against total system memory and CPU normalized against a single core

#### Scenario: Usage exceeding a single core

- **WHEN** a process consumes more than one core's worth of CPU
- **THEN** the numeric value reflects the true utilization and the bar is clamped to its maximum rather than misrepresenting the value

### Requirement: Sort listeners by a selectable key

The system SHALL allow the user to choose the sort key and direction for the visible listeners among at least port, PID, process name, CPU usage, and memory usage, and SHALL default to ascending by port.

#### Scenario: User selects a sort key

- **WHEN** the user selects a sort key and direction
- **THEN** the visible listeners are reordered accordingly

#### Scenario: Default ordering

- **WHEN** the user has not chosen a sort
- **THEN** the listeners are ordered ascending by port

### Requirement: Filter listeners by category

The system SHALL provide structured category filters that narrow the visible listeners to all listeners, only killable listeners, only protected listeners, or only externally exposed listeners, and SHALL apply the chosen category together with the free-text query.

#### Scenario: Category filter applied

- **WHEN** the user selects a category filter other than "all"
- **THEN** only listeners matching that category remain visible

#### Scenario: Category composes with text query

- **WHEN** a category filter and a non-empty text query are both active
- **THEN** only listeners matching both the category and the text query remain visible

## MODIFIED Requirements

### Requirement: Sort listeners by port

The system SHALL return listeners in a stable default order, ascending by port number. This default order MAY be overridden by a user-selected sort key and direction at the presentation layer.

#### Scenario: Multiple listeners on different ports

- **WHEN** several processes listen on different ports and no user sort is selected
- **THEN** the returned list is ordered from lowest to highest port number

### Requirement: Search and filter listeners

The system SHALL allow the user to filter the visible listeners by a free-text query matched case-insensitively against the port, PID, process name, command, and owner, and SHALL show all listeners when the query is empty.

#### Scenario: Query matches some listeners

- **WHEN** the user types a query that matches the port, PID, name, command, or owner of some listeners
- **THEN** only the matching listeners remain visible

#### Scenario: Query matches a PID

- **WHEN** the user types a process identifier
- **THEN** the listener whose owning process has that PID remains visible

#### Scenario: Query is empty

- **WHEN** the filter query is empty
- **THEN** all listeners are shown
