## 1. De-risk spike (macOS first)

- [ ] 1.1 Confirm `osascript -e 'do shell script "kill -TERM <pid>" with administrator privileges'` elevates and returns a usable exit status on supported macOS versions (design D1)
- [ ] 1.2 Confirm the cancel case (user dismisses the auth dialog) is distinguishable from other failures and terminates nothing (design D5)
- [ ] 1.3 Record Linux escalation availability assumptions (`pkexec`/polkit present?) and the "escalation unavailable" fallback (design D1, Q1)

## 2. Backend: privileged termination path

- [ ] 2.1 Add an escalation function confined to one module with a fixed argument vector and integer-only PID — no shell string assembled from input (design D2; spec: Terminate a non-owned process with elevated privileges)
- [ ] 2.2 Implement the macOS escalation via `osascript ... with administrator privileges`, `SIGTERM`→`SIGKILL` graceful-then-force (design D1, D6)
- [ ] 2.3 Implement the Linux escalation via `pkexec` with an "escalation unavailable" result when absent (design D1, D5)
- [ ] 2.4 Implement the Windows escalation via the `runas` UAC verb, force-only (design D1)
- [ ] 2.5 Re-validate before escalating: PID still maps to a live LISTEN process AND is not on the protected deny-list; refuse otherwise (design D3; spec: Re-validate before privileged termination, Protected processes remain un-killable under elevation)

## 3. Backend: result vocabulary + command surface

- [ ] 3.1 Extend `KillResult` statuses with "authentication cancelled" and "escalation unavailable" (design D5; spec: Report privileged termination outcome)
- [ ] 3.2 Expose the privileged termination via a `kill_port_elevated` command (or an `elevated` flag on `kill_port`) (spec: Terminate a non-owned process with elevated privileges)
- [ ] 3.3 Widen Tauri capabilities only enough to spawn the specific escalation invocation; do NOT enable a general shell plugin (design D2)
- [ ] 3.4 Unit-test: protected PID is refused on the privileged path; non-owned/non-protected PID reaches the escalation call; cancelled auth yields the cancelled status

## 4. Frontend: opt-in escalation UX

- [ ] 4.1 On non-owned but non-protected (locked) rows, show a "Kill as administrator" affordance; keep protected rows fully locked (design D4; spec: Offer privilege escalation for non-owned processes)
- [ ] 4.2 Add a distinct escalation confirmation stating the process is owned by another user and that an auth prompt will follow (design D4; spec: Require explicit consent for escalation)
- [ ] 4.3 Invoke the privileged command, then refresh; render success / already-stopped / not-permitted / authentication-cancelled / escalation-unavailable statuses (design D5; spec: Report privileged termination outcome)
- [ ] 4.4 Treat auth-dialog cancellation as a clean no-op with no error styling (design D5)

## 5. Verify

- [ ] 5.1 `cargo check` / `cargo test` pass, including the protected-under-elevation refusal test
- [ ] 5.2 On-device macOS check: escalating a non-owned dev server prompts for auth and terminates it; cancelling leaves it running
- [ ] 5.3 Confirm a protected process (e.g. `launchd`) never exposes the "Kill as administrator" affordance and is refused by the backend even if requested
