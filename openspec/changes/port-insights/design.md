## Context

`cross-platform-tauri` established a Rust core that enumerates LISTEN-state TCP sockets via `netstat2`, resolves PID → name/owner/RSS via `sysinfo`, and returns a `Vec<PortProcess>` over a `list_ports` command. The frontend polls every ~3s while the popover is open and filters client-side over a free-text query. Two facts shape this change:

1. `list_ports` builds a fresh `System::new()` each call and takes a single `refresh_processes`. `sysinfo` computes CPU% as the delta between two refreshes of the **same** `System`, so a stateless sampler can only ever report `0.0`. Memory (RSS) is instantaneous and already available.
2. Sort and filter today are effectively fixed: the backend sorts ascending by port, and the search box matches port/name/command/owner but not PID.

## Goals / Non-Goals

**Goals:**
- Real per-process CPU% and memory, shown as compact bars + text in each row.
- User-selectable sort key (port, PID, name, CPU, memory) and direction.
- PID-aware free-text search plus structured quick-filter chips that compose.
- Keep the change read-only/presentation — no change to which processes are killable or how they die.

**Non-Goals:**
- Privilege escalation or any change to termination (see `privileged-kill`).
- Time-series/history, sparklines, per-thread or disk/network IO metrics.
- Server-push metrics; polling stays the transport.

## Decisions

### D1: Stateful `Mutex<System>` in Tauri state for CPU deltas
Move from a per-call `System::new()` to a single `System` owned by the app and stored via `.manage(Mutex<AppMetrics>)`. Each `list_ports` call locks it, calls `refresh_processes`, reads CPU% (which is now a delta against the previous refresh), then returns. The existing 3s poll provides the inter-sample window — no separate timer needed.

*Alternative considered:* take two back-to-back refreshes with a `MINIMUM_CPU_UPDATE_INTERVAL` sleep inside one `list_ports` call. Rejected: it blocks the command for the sleep duration on every scan and wastes work the auto-refresh already does.

### D2: New fields on `PortProcess`, not a parallel struct
Add `cpu_percent: f32` and `memory_bytes: u64` to the existing serialized struct (camelCase `cpuPercent`, `memoryBytes`). Keeps one IPC shape; the frontend reads new fields and ignores them where not rendered. `memory_bytes` replaces/augments any prior RSS handling.

### D3: Bar normalization
- **Memory**: normalize against total system RAM (`sysinfo` `total_memory`), display absolute value as text (MB/GB). A near-zero process still shows a sliver.
- **CPU**: normalize against one core (100%). A multi-core-bound process can exceed 100%; the bar clamps visually but the text shows the true value. This matches how `top`/Activity Monitor report per-process CPU on Unix.

### D4: Sort is client-side over the in-memory list
The backend keeps returning port-ascending as a stable default; the frontend re-sorts the already-fetched array by the chosen key/direction. The dataset is tiny (tens of rows) so this is instant and avoids round-trips on sort changes. The previously fixed backend ordering is relaxed in spec to "a stable default order," with user choice layered on top in the UI.

### D5: Filtering = text (now incl. PID) + composable category chips
- Extend the existing case-insensitive text match to include the stringified PID.
- Add chips: **All**, **Killable** (`isKillable`), **Protected** (`!isKillable` / has `protectedReason`), **Exposed** (`bindScope == allInterfaces`). Chips AND with the text query. Default chip is **All**.

### D6: Sort/filter selection is not persisted in this change
The chosen sort key/direction and active chip reset to their defaults (port-ascending, "All") each time the popover opens. Persisting them via `localStorage` is a trivial, backend-free follow-up, but it is kept out of scope here so the change stays focused on the four core features. Revisit once the controls have settled.

## Risks / Trade-offs

- **Cold-start 0% CPU**: the first scan after launch has no prior sample, so CPU reads 0% for one cycle. Acceptable; resolves on the next poll. UI can show a subtle "—" until a real sample exists.
- **Retained `System` growth**: holding one `System` across the app lifetime means relying on `sysinfo`'s incremental refresh to prune dead PIDs. Mitigate by using `ProcessesToUpdate::All` with the remove-dead flag already used today.
- **CPU >100% confusion**: per-core normalization can surprise users. Mitigate with a tooltip/text value and clamped bar rather than renormalizing to total cores (which would make busy single-threaded servers look idle).
- **Lock contention**: `list_ports` now takes a mutex; calls are serialized, but at a 3s cadence with one window this is negligible.

## Resolved Decisions

- Q1 (memory bar scale): **Linear against total system RAM**, with an always-visible minimum sliver so small dev servers remain distinguishable. Log scale rejected as harder to read at a glance.
- Q2 (chip behavior): **Single-select chip group** — All / Killable / Protected / Exposed are mutually exclusive, and the active chip composes (AND) with the text query. Multi-select rejected for first-cut simplicity.
