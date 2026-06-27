## Why

The Tauri port list (from `cross-platform-tauri`) shows *which* processes hold ports but not *how heavy* they are, only sorts ascending by port, and filters via a single free-text box that does not even match the PID. In a menu-bar tool whose whole job is "find the runaway dev server and kill it," the most useful signals — which process is burning CPU/RAM, and a fast way to isolate one PID or just the killable/exposed rows — are missing. This change adds resource insight, selectable sort, and richer filtering without touching the termination path.

## What Changes

- **Resource metrics**: report per-process CPU% and memory (RSS) for each listener and surface them as compact inline bars plus a text value in each row.
- **Selectable sort**: replace the fixed port-ascending order with a user-chosen sort key (port, PID, name, CPU, memory), ascending or descending, defaulting to port-ascending for parity.
- **Filtering**: extend the free-text search to also match the PID, and add structured quick-filter chips (All / Killable / Protected / Exposed) that compose with the text query.
- **Stateful sampling**: introduce a persistent, app-managed `System` sampler in Tauri state so CPU% can be computed as a delta across the existing auto-refresh interval (a single stateless sample always reports 0% CPU).

Non-goals: changing termination behavior, privilege escalation (see the separate `privileged-kill` change), per-thread/IO metrics, or historical/graph views. Bars are point-in-time, not time-series.

## Capabilities

### Modified Capabilities
- `port-discovery`: Listeners now carry CPU% and memory usage; the sort order becomes a user-selectable key/direction rather than fixed port-ascending; the filter matches PID in addition to port/name/command/owner and adds structured category filters.

## Impact

- **Backend** (`src-tauri/src/ports.rs`, `lib.rs`): `PortProcess` gains `cpu_percent: f32` and `memory_bytes: u64`; a shared `Mutex<System>` is added to Tauri state and refreshed between scans so CPU deltas are real; `list_ports` reads metrics from the retained sampler instead of a fresh `System::new()`.
- **Frontend** (`src/main.ts`, `styles.css`): each row renders CPU and memory bars + text; a sort control and filter chips are added to the header; sort/filter run client-side over the in-memory list.
- **Behavioral deltas**: first scan after launch may show 0% CPU until a second sample exists; memory bars normalize against total system RAM, CPU bars against a single core (so a multi-core-bound process can read >100%, shown as a clamped/overflowing bar).
- **Risk to de-risk**: confirm `sysinfo` CPU deltas are meaningful at a 3s cadence and that retaining one `System` across calls does not leak or grow unbounded.
