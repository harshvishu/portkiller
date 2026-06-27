## Context

`cross-platform-tauri` deliberately constrains termination: `kill_port` re-validates ownership and the protected deny-list server-side and **refuses** anything the current user does not own, reporting that elevation "would be required." The whole core is also built on a "no shelling out" principle — discovery uses `netstat2`, kills use `nix` signals / `TerminateProcess`, and the Tauri capabilities grant no shell plugin. This change is the one place that principle must bend: there is no portable, dependency-free way to gain root from an unprivileged process without invoking an OS authorization mechanism, all of which are subprocesses.

The design problem is therefore less "how do we kill" and more "how do we escalate safely, per platform, without a persistent helper, while keeping the existing safety guarantees intact."

```
   row is locked (isKillable == false)
        │
        ├── protectedReason set?  ──► STAY LOCKED (never escalate)
        │
        └── non-owned only?       ──► offer "Kill as administrator"
                                          │
                                          ▼
                                   OS auth dialog (trust boundary)
                                          │
                              ┌───────────┴───────────┐
                          confirmed                  cancelled
                              │                          │
                     backend re-validates          clean no-op
                     (live + not protected)
                              │
                     escalate & terminate
```

## Goals / Non-Goals

**Goals:**
- Let the user terminate a non-owned (but not protected) listener via an explicit, opt-in escalation.
- Use each OS's native authorization flow as the trust boundary; no bundled credential handling.
- Preserve every existing guarantee: protected processes stay un-killable, backend re-validates, frontend is never trusted.
- Keep the privileged code path small, auditable, and injection-free.

**Non-Goals:**
- A persistent privileged helper/daemon (`SMJobBless`, a systemd unit, a Windows service).
- Credential caching or "don't ask again" across kills.
- Escalating to kill protected/system-critical processes.
- Changing owned-process termination, which keeps using the existing non-privileged path.

## Decisions

### D1: OS-native escalation, no persistent helper
- **macOS**: `osascript -e 'do shell script "kill -TERM <pid>" with administrator privileges'`, escalating to `-KILL` if still alive. This triggers the native authentication dialog and runs the command as root with no installed helper. *Alternative considered:* an `SMJobBless` privileged helper — rejected for v1: it requires a signed, notarized helper tool and a much larger trust/packaging surface for a single action.
- **Linux**: `pkexec kill -TERM <pid>` (polkit GUI prompt). `sudo` is not used (it may require a terminal/askpass and breaks the GUI-clean flow). If `pkexec` is unavailable, report that escalation is unavailable.
- **Windows**: re-invoke the kill via the `runas` ShellExecute verb (UAC elevation); force-only, consistent with existing Windows termination.

### D2: Bend "no shelling out" for exactly one guarded path
Escalation inherently requires a subprocess. Confine it to a single function with a fixed argument vector — never a formatted shell string built from user input. The PID is parsed as an integer before use; the command name/path is a constant. The Tauri capability surface is widened only as much as required to spawn that specific invocation, not a general shell plugin.

### D3: Re-validate in the backend before escalating
Before constructing any privileged command the backend MUST: (a) confirm the PID still corresponds to a live LISTEN-state process, and (b) confirm it is **not** on the protected deny-list. The protected check is identical to the non-privileged path — elevation relaxes *ownership* only, never protection. The frontend's request is never trusted.

### D4: Separate, explicit consent
The escalation action is visually and behaviorally distinct from the ordinary kill: a "Kill as administrator" control on non-owned/non-protected rows, with its own confirmation copy that states the process is owned by another user and that an authentication prompt will follow. The OS auth dialog is the final consent gate.

### D5: Cancellation and failure are first-class outcomes
Map the escalation result into the existing `KillResult` status vocabulary, extended with:
- **authentication cancelled** — user dismissed the OS auth dialog; nothing was terminated.
- **escalation unavailable** — no escalation mechanism present (e.g. no polkit on Linux).
These join the existing success / already-stopped / not-permitted / other-failure statuses.

### D6: Graceful-then-force is preserved under elevation on Unix
The privileged path still sends `SIGTERM` first, checks liveness, then `SIGKILL` — matching the non-privileged Unix behavior. Windows remains force-only.

## Risks / Trade-offs

- **Subprocess + root execution is the highest-risk code in the app.** Mitigations: integer-only PID, constant command name, fixed argument vector (no shell string assembly), backend re-validation of liveness + protection, and the OS auth dialog as the human trust boundary. This path must be reviewed independently of the rest of the app.
- **`osascript` reliability**: behavior of `do shell script ... with administrator privileges` and its exit/error reporting must be confirmed on supported macOS versions, including the cancel case.
- **Linux fragmentation**: `pkexec`/polkit availability varies by distro/DE; the feature degrades to "escalation unavailable" rather than failing opaquely.
- **Scope creep toward a helper**: if v1 escalation proves too limited, a signed privileged helper is the natural follow-up — explicitly out of scope here to keep the trust surface minimal.
- **Protection bypass would be catastrophic**: a bug that let escalation reach a protected process could let a user `kill -9 launchd`. The protected re-check on the privileged path is therefore a hard requirement with its own scenario and test.

## Resolved Decisions

- Q1 (Linux mechanism): **`pkexec`/polkit only.** `sudo` is not attempted, as it may require a terminal/askpass and breaks the GUI-clean flow. When `pkexec` is absent, the result is "escalation unavailable."
- Q2 (credential memory): **Always re-prompt.** A successful escalation is not remembered for the session and no credentials are cached; every privileged kill goes through a fresh OS authentication prompt. Safety is chosen over convenience.
