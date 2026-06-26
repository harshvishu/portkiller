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
}

interface KillResult {
  ok: boolean;
  status: string;
}

const REFRESH_MS = 3000;

let ports: PortProcess[] = [];
let scanning = false;
let statusMessage: string | null = null;
let pendingKill: PortProcess | null = null;
let refreshTimer: number | undefined;
let killing = false;

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
  content: el("content"),
  status: el("status"),
  autostart: el<HTMLInputElement>("autostart"),
  quit: el<HTMLButtonElement>("quit"),
};

function filtered(): PortProcess[] {
  const q = refs.search.value.trim().toLowerCase();
  if (!q) return ports;
  return ports.filter(
    (p) =>
      String(p.port).includes(q) ||
      p.displayName.toLowerCase().includes(q) ||
      p.command.toLowerCase().includes(q) ||
      p.user.toLowerCase().includes(q),
  );
}

async function refresh(): Promise<void> {
  if (scanning || pendingKill) return;
  scanning = true;
  refs.spinner.classList.remove("hidden");
  try {
    ports = await invoke<PortProcess[]>("list_ports");
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
  const visible = filtered();
  refs.count.textContent = String(visible.length);
  refs.searchBar.classList.toggle("hidden", ports.length === 0);
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
    refs.content.appendChild(rowFor(p));
    if (pendingKill && pendingKill.id === p.id) {
      refs.content.appendChild(confirmRowFor(p));
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
    text.textContent = `No ports match “${refs.search.value}”`;
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

  main.append(top, name, meta);

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
    row.addEventListener("transitionend", () => row.remove(), { once: true });
  }
  refs.content.querySelector(".row.armed")?.classList.remove("armed");
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
startAutoRefresh();
