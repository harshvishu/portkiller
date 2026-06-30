import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

// The translucent window material is delivered by the OS (macOS vibrancy). Mark
// the root so CSS can layer over the material on macOS and fall back to a solid
// opaque background everywhere else (Windows/Linux, or any no-material case).
if (/Macintosh|Mac OS X/.test(navigator.userAgent)) {
  document.documentElement.classList.add("has-material");
}

type BindScope = "localhost" | "allInterfaces";

interface PortProcess {
  id: string;
  port: number;
  pid: number;
  command: string;
  user: string;
  addresses: string[];
  displayName: string;
  isKillable: boolean;
  protectedReason: string | null;
  bindScope: BindScope;
  cpuPercent: number;
  memoryBytes: number;
}

interface SystemInfo {
  totalMemory: number;
}

interface KillResult {
  ok: boolean;
  status: string;
}

type SortKey = "port" | "pid" | "name" | "cpu" | "memory";
type SortDir = "asc" | "desc";
type Category = "all" | "killable" | "protected" | "exposed";

const REFRESH_MS = 3000;

let ports: PortProcess[] = [];
let scanning = false;
let statusMessage: string | null = null;
let pendingKill: PortProcess | null = null;
let refreshTimer: number | undefined;
let killing = false;

// Total physical RAM, used to normalize the memory bars. Fetched once at start.
let totalMemory = 0;
// Number of completed scans this session. CPU% needs two samples of the same
// backend sampler before it reflects a real delta, so the first scan shows a
// placeholder instead of a misleading 0%.
let scanCount = 0;

// Presentation state (reset to defaults each launch — not persisted, by design).
let sortKey: SortKey = "port";
let sortDir: SortDir = "asc";
let category: Category = "all";
// Whether the collapsible filter panel (chips + sort) is expanded.
let filtersOpen = false;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const refs = {
  spinner: el("spinner"),
  count: el("count"),
  refresh: el<HTMLButtonElement>("refresh"),
  searchBar: el("search-bar"),
  search: el<HTMLInputElement>("search"),
  searchClear: el<HTMLButtonElement>("search-clear"),
  filterToggle: el<HTMLButtonElement>("filter-toggle"),
  controls: el("controls"),
  sortKey: el<HTMLSelectElement>("sort-key"),
  sortDir: el<HTMLButtonElement>("sort-dir"),
  content: el("content"),
  status: el("status"),
  autostart: el<HTMLInputElement>("autostart"),
  quit: el<HTMLButtonElement>("quit"),
};

function matchesQuery(p: PortProcess, q: string): boolean {
  if (!q) return true;
  return (
    String(p.port).includes(q) ||
    String(p.pid).includes(q) ||
    p.displayName.toLowerCase().includes(q) ||
    p.command.toLowerCase().includes(q) ||
    p.user.toLowerCase().includes(q)
  );
}

function matchesCategory(p: PortProcess): boolean {
  switch (category) {
    case "killable":
      return p.isKillable;
    case "protected":
      return !p.isKillable;
    case "exposed":
      return p.bindScope === "allInterfaces";
    default:
      return true;
  }
}

function sortComparator(a: PortProcess, b: PortProcess): number {
  const dir = sortDir === "asc" ? 1 : -1;
  switch (sortKey) {
    case "pid":
      return (a.pid - b.pid || a.port - b.port) * dir;
    case "name":
      return (a.displayName.localeCompare(b.displayName) || a.port - b.port) * dir;
    case "cpu":
      return (a.cpuPercent - b.cpuPercent || a.port - b.port) * dir;
    case "memory":
      return (a.memoryBytes - b.memoryBytes || a.port - b.port) * dir;
    default:
      return (a.port - b.port || a.pid - b.pid) * dir;
  }
}

function visibleRows(): PortProcess[] {
  const q = refs.search.value.trim().toLowerCase();
  return ports
    .filter((p) => matchesCategory(p) && matchesQuery(p, q))
    .sort(sortComparator);
}

async function refresh(): Promise<void> {
  if (scanning || pendingKill) return;
  scanning = true;
  refs.spinner.classList.remove("hidden");
  try {
    ports = await invoke<PortProcess[]>("list_ports");
    scanCount += 1;
  } catch (e) {
    statusMessage = `Scan failed: ${String(e)}`;
  } finally {
    scanning = false;
    refs.spinner.classList.add("hidden");
    render();
  }
}

function scopeLabel(scope: BindScope): string {
  return scope === "localhost" ? "🔒 localhost" : "🌐 all interfaces";
}

function render(): void {
  const visible = visibleRows();
  refs.count.textContent = String(visible.length);
  refs.searchBar.classList.toggle("hidden", ports.length === 0);
  const showControls = ports.length > 0 && filtersOpen;
  refs.controls.classList.toggle("open", showControls);
  refs.filterToggle.classList.toggle("active", showControls);
  refs.filterToggle.setAttribute("aria-expanded", String(showControls));
  refs.searchClear.classList.toggle("hidden", refs.search.value.length === 0);

  if (statusMessage) {
    refs.status.textContent = statusMessage;
    refs.status.classList.remove("hidden");
  } else {
    refs.status.classList.add("hidden");
  }

  refs.content.replaceChildren();
  if (visible.length === 0) {
    refs.content.appendChild(emptyState());
    return;
  }
  for (const p of visible) {
    if (pendingKill && pendingKill.id === p.id) {
      const group = document.createElement("div");
      group.className = "confirm-group";
      group.append(rowFor(p), confirmRowFor(p));
      refs.content.appendChild(group);
    } else {
      refs.content.appendChild(rowFor(p));
    }
  }

  const confirmEl = refs.content.querySelector<HTMLElement>(".confirm-row");
  if (confirmEl) {
    requestAnimationFrame(() => {
      confirmEl.classList.add("open");
      confirmEl.scrollIntoView({ block: "nearest" });
    });
  }
}

function emptyState(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "empty";
  const glyph = document.createElement("div");
  glyph.className = "empty-glyph";
  const text = document.createElement("div");
  if (ports.length === 0) {
    glyph.textContent = scanning ? "⏳" : "✓";
    text.textContent = scanning ? "Scanning…" : "No listening ports found";
  } else {
    glyph.textContent = "⌕";
    const q = refs.search.value.trim();
    if (q) {
      text.textContent = `No ports match “${q}”`;
    } else {
      text.textContent = "No ports match this filter";
    }
  }
  wrap.append(glyph, text);
  return wrap;
}

function rowFor(p: PortProcess): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  if (pendingKill && pendingKill.id === p.id) {
    row.classList.add("armed");
  }

  const main = document.createElement("div");
  main.className = "row-main";

  const top = document.createElement("div");
  top.className = "row-top";

  const port = document.createElement("span");
  port.className = "port";
  port.textContent = String(p.port);
  top.appendChild(port);

  if (!p.isKillable) {
    const lock = document.createElement("span");
    lock.className = "lock";
    lock.textContent = "🔒";
    top.appendChild(lock);
  }

  const scopeEl = document.createElement("span");
  scopeEl.className = "scope";
  scopeEl.textContent = scopeLabel(p.bindScope);
  top.appendChild(scopeEl);

  const name = document.createElement("div");
  name.className = p.isKillable ? "row-name" : "row-name protected";
  name.textContent = p.displayName;
  name.title = p.protectedReason ?? `Listening on port ${p.port}`;

  const meta = document.createElement("div");
  meta.className = "row-meta";
  meta.textContent = `PID ${p.pid} • ${p.user}`;

  main.append(top, name, meta, metricsFor(p));

  let control: HTMLElement;
  if (p.isKillable) {
    const btn = document.createElement("button");
    btn.className = "kill-btn";
    btn.textContent = "Kill";
    btn.addEventListener("click", () => promptKill(p));
    control = btn;
  } else {
    const chip = document.createElement("span");
    chip.className = "protected-chip";
    chip.textContent = "Protected";
    chip.title = p.protectedReason ?? "";
    control = chip;
  }

  row.append(main, control);
  return row;
}

/** Compact CPU + memory bars stacked under the row's metadata. */
function metricsFor(p: PortProcess): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "row-metrics";

  // CPU: normalized to a single core (100%); the bar clamps but the text shows
  // the true value. The first sample has no real delta yet, so show a dash.
  const cpuKnown = scanCount >= 2;
  const cpuText = cpuKnown ? `${formatPercent(p.cpuPercent)}%` : "—";
  const cpuFill = cpuKnown ? clamp(p.cpuPercent, 0, 100) : 0;
  wrap.appendChild(metricBar("CPU", cpuText, cpuFill, "cpu"));

  // Memory: normalized to total RAM, with an always-visible sliver so small
  // dev servers stay distinguishable. Text shows the absolute value.
  const ratio = totalMemory > 0 ? (p.memoryBytes / totalMemory) * 100 : 0;
  const memFill = p.memoryBytes > 0 ? Math.max(clamp(ratio, 0, 100), 2) : 0;
  wrap.appendChild(metricBar("Mem", formatBytes(p.memoryBytes), memFill, "mem"));

  return wrap;
}

function metricBar(
  label: string,
  value: string,
  fillPercent: number,
  kind: "cpu" | "mem",
): HTMLElement {
  const row = document.createElement("div");
  row.className = `metric metric-${kind}`;
  row.title = `${label}: ${value}`;

  const tag = document.createElement("span");
  tag.className = "metric-label";
  tag.textContent = label;

  const track = document.createElement("div");
  track.className = "metric-track";
  const fill = document.createElement("div");
  fill.className = "metric-fill";
  fill.style.width = `${fillPercent}%`;
  track.appendChild(fill);

  const val = document.createElement("span");
  val.className = "metric-val";
  val.textContent = value;

  row.append(tag, track, val);
  return row;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function formatPercent(pct: number): string {
  return pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function promptKill(p: PortProcess): void {
  pendingKill = p;
  syncAutohide();
  render();
}

function cancelKill(): void {
  pendingKill = null;
  syncAutohide();
  const row = refs.content.querySelector<HTMLElement>(".confirm-row.open");
  if (row) {
    row.classList.remove("open");
    let didRender = false;
    const finish = () => {
      if (didRender) return;
      didRender = true;
      render();
    };
    row.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, 240);
  }
}

function confirmRowFor(p: PortProcess): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "confirm-row";

  const inner = document.createElement("div");
  inner.className = "confirm-row-inner";

  const text = document.createElement("div");
  text.className = "confirm-text";
  text.textContent = `Kill “${p.displayName}” (PID ${p.pid}) on port ${p.port}? Unsaved work in it may be lost.`;

  const actions = document.createElement("div");
  actions.className = "confirm-row-actions";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => cancelKill());

  const kill = document.createElement("button");
  kill.className = "btn btn-danger";
  kill.textContent = "Kill";
  kill.addEventListener("click", () => void doKill());

  actions.append(cancel, kill);
  inner.append(text, actions);
  wrap.append(inner);
  return wrap;
}

async function doKill(): Promise<void> {
  if (!pendingKill) return;
  const target = pendingKill;
  pendingKill = null;
  killing = true;
  syncAutohide();
  statusMessage = `Stopping ${target.displayName} on port ${target.port}…`;
  render();
  try {
    const result = await invoke<KillResult>("kill_port", { pid: target.pid });
    statusMessage = result.status;
  } catch (e) {
    statusMessage = `Failed to stop ${target.displayName}: ${String(e)}`;
  }
  render();
  await refresh();
  killing = false;
  syncAutohide();
  window.setTimeout(() => {
    statusMessage = null;
    render();
  }, 2500);
}

async function initAutostart(): Promise<void> {
  try {
    refs.autostart.checked = await isEnabled();
  } catch {
    refs.autostart.checked = false;
  }
}

/// Fetch total physical RAM once so the memory bars can be normalized. Failure
/// is non-fatal: bars simply render empty until a value is known.
async function initSystemInfo(): Promise<void> {
  try {
    const info = await invoke<SystemInfo>("system_info");
    totalMemory = info.totalMemory;
  } catch {
    totalMemory = 0;
  }
}

function selectCategory(next: Category): void {
  category = next;
  for (const chip of document.querySelectorAll<HTMLButtonElement>(".chip")) {
    const active = chip.dataset.category === next;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  }
  render();
}

async function toggleAutostart(): Promise<void> {
  const want = refs.autostart.checked;
  try {
    if (want) await enable();
    else await disable();
    refs.autostart.checked = await isEnabled();
  } catch (e) {
    statusMessage = `Launch at login failed: ${String(e)}`;
    try {
      refs.autostart.checked = await isEnabled();
    } catch {
      refs.autostart.checked = !want;
    }
    render();
  }
}

/// Tell the backend whether a click-away may dismiss the popover. Dismissal is
/// blocked while a kill confirmation is open or a kill is in flight; the native
/// focus-loss handler in Rust does the actual hiding.
function syncAutohide(): void {
  void invoke("set_autohide_blocked", {
    blocked: pendingKill !== null || killing,
  });
}

function startAutoRefresh(): void {
  stopAutoRefresh();
  void refresh();
  refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
}

function stopAutoRefresh(): void {
  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

function wire(): void {
  refs.refresh.addEventListener("click", () => void refresh());
  refs.search.addEventListener("input", () => render());
  refs.searchClear.addEventListener("click", () => {
    refs.search.value = "";
    render();
  });
  refs.filterToggle.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    render();
  });
  for (const chip of document.querySelectorAll<HTMLButtonElement>(".chip")) {
    chip.addEventListener("click", () => {
      selectCategory((chip.dataset.category as Category) ?? "all");
    });
  }
  refs.sortKey.addEventListener("change", () => {
    sortKey = refs.sortKey.value as SortKey;
    render();
  });
  refs.sortDir.addEventListener("click", () => {
    sortDir = sortDir === "asc" ? "desc" : "asc";
    refs.sortDir.textContent = sortDir === "asc" ? "\u2191" : "\u2193";
    refs.sortDir.classList.toggle("desc", sortDir === "desc");
    render();
  });
  refs.autostart.addEventListener("change", () => void toggleAutostart());
  refs.quit.addEventListener("click", () => void invoke("quit_app"));
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (pendingKill) {
      cancelKill();
    }
  });

  // Refresh while the popover is focused; pause when it loses focus. The
  // click-away dismissal itself is handled natively in Rust (window focus
  // loss), which is reliable for a transparent, vibrancy-backed popover.
  window.addEventListener("focus", () => startAutoRefresh());
  window.addEventListener("blur", () => stopAutoRefresh());
}

wire();
void initAutostart();
void initSystemInfo();
startAutoRefresh();
