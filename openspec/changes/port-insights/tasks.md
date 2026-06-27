## 1. Backend: stateful metrics sampler

- [x] 1.1 Introduce an app-managed metrics holder (e.g. `struct AppMetrics { sys: Mutex<System> }`) and register it with `.manage(...)` in `lib.rs` (design D1)
- [x] 1.2 Initialize the `System` once at startup with an initial `refresh_processes` so the first user-triggered scan has a prior CPU sample (design D1, Risks: cold-start)
- [x] 1.3 Refactor `list_ports` to lock the shared `System`, `refresh_processes(ProcessesToUpdate::All, true)`, and read metrics from it instead of `System::new()` (design D1)

## 2. Backend: CPU + memory fields

- [x] 2.1 Add `cpu_percent: f32` and `memory_bytes: u64` to `PortProcess` (camelCase serialization) (design D2; spec: Report per-process CPU and memory usage)
- [x] 2.2 Populate `cpu_percent` from `Process::cpu_usage()` and `memory_bytes` from `Process::memory()` for each resolved PID (spec: Report per-process CPU and memory usage)
- [x] 2.3 Capture total system RAM for memory normalization and expose it (field on payload or a small `system_info` command) (design D3)
- [x] 2.4 Update unit tests to assert the new fields are present and non-negative; add a test that a known PID yields a memory value (design D2)

## 3. Backend: stable default ordering

- [x] 3.1 Keep `list_ports` returning a stable default order (port-ascending) and document it as a default, not a guarantee of final display order (spec: Provide a stable default order)

## 4. Frontend: resource bars

- [x] 4.1 Render a CPU bar + text per row, normalized to one core (100%), clamping the bar but showing the true value (design D3; spec: Visualize per-process resource usage)
- [x] 4.2 Render a memory bar + text per row, normalized to total RAM, with an always-visible minimum sliver and human-readable value (MB/GB) (design D3)
- [x] 4.3 Show a placeholder (e.g. "—") for CPU on the first sample before a real delta exists (Risks: cold-start)
- [x] 4.4 Add styles for the bars in `styles.css` consistent with the existing row layout

## 5. Frontend: selectable sort

- [x] 5.1 Add a sort control (key: port / pid / name / cpu / memory; direction: asc / desc) to the header (spec: Sort listeners by a selectable key)
- [x] 5.2 Sort the in-memory list client-side by the chosen key/direction; default to port-ascending (design D4; spec: Sort listeners by a selectable key)

## 6. Frontend: filtering

- [x] 6.1 Extend the case-insensitive text filter to also match the stringified PID (spec: Search and filter listeners)
- [x] 6.2 Add composable quick-filter chips: All / Killable / Protected / Exposed (design D5; spec: Filter listeners by category)
- [x] 6.3 Compose the active chip with the text query (AND) and reflect the result count (spec: Filter listeners by category)

## 7. Verify

- [x] 7.1 `cargo check` / `cargo test` pass for the backend changes
- [ ] 7.2 On-device check: CPU% becomes non-zero after the second poll; memory bars scale sensibly; sort and chips behave and compose with search
