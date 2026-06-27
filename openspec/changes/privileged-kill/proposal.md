## Why

Today the app refuses to terminate any process the current user does not own: such listeners are shown with a lock and the user is told that "elevated privileges would be required," with no way to act. In practice the runaway port holder is frequently a root- or other-user-owned daemon (a stray `node` under `sudo`, a Docker-proxied port, a system service a developer intentionally wants to stop). This change turns that dead-end lock into an explicit, opt-in "Kill as administrator" action that escalates privileges through the operating system's own authorization mechanism — while keeping protected system processes hard-blocked even with elevation.

## What Changes

- **Escalated termination**: add a path to terminate a non-owned process by elevating through the OS-native authorization flow — `osascript ... with administrator privileges` on macOS, `pkexec`/`sudo` (polkit) on Linux, the `runas` UAC verb on Windows.
- **Relax the ownership refusal only**: the "refuse non-owned" rule becomes "offer to escalate"; the protected-process deny-list refusal is **unchanged** — core OS processes stay un-killable even as administrator.
- **Explicit, separate consent**: escalation requires its own confirmation distinct from the normal kill confirmation, and surfaces the OS auth prompt; cancelling the OS prompt is a clean no-op.
- **Backend re-validation**: the backend re-checks that the target is a live listener and is not on the protected deny-list before constructing any privileged command, and never interpolates untrusted strings into a shell invocation (PID is validated as an integer).

Non-goals: a persistent privileged helper/daemon (e.g. macOS `SMJobBless`), caching credentials across kills, escalating to kill protected processes, or changing how owned-process kills work.

## Capabilities

### Modified Capabilities
- `process-termination`: Non-owned processes are no longer a hard refusal; they become eligible for an explicit privilege-escalated termination via the OS authorization mechanism. Protected-process refusal and backend re-validation are retained and extended to the privileged path.

## Impact

- **Backend** (`src-tauri/src/kill.rs`, `lib.rs`, capabilities): a new `kill_port_elevated` command (or an `elevated: bool` argument) that runs the platform escalation. This **introduces a subprocess invocation** (`osascript`/`pkexec`/`runas`), deliberately breaking the codebase's "no shelling out" property for this one guarded path — documented in design.
- **Security surface**: running a command as root from user input. Mitigated by: integer-only PID, backend liveness + protected-list re-validation, no string interpolation into the shell line, and the OS auth dialog as the trust boundary.
- **Frontend** (`src/main.ts`): locked rows that are non-owned (but not protected) gain a "Kill as administrator" affordance with its own confirmation; protected rows stay fully locked.
- **Per-platform behavior**: macOS uses `osascript` (no helper, native auth dialog); Linux depends on polkit/`pkexec` being present (fallback messaging if absent); Windows elevates via UAC and is force-only.
- **Risk to de-risk first**: confirm `osascript "do shell script ... with administrator privileges"` reliably elevates and returns a usable status without a signed helper, and define behavior when the user cancels the auth dialog.
