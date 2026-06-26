use serde::Serialize;

/// Outcome of a termination attempt, surfaced to the UI.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillResult {
    pub ok: bool,
    pub status: String,
}

impl KillResult {
    pub fn ok(msg: impl Into<String>) -> Self {
        Self {
            ok: true,
            status: msg.into(),
        }
    }

    pub fn fail(msg: impl Into<String>) -> Self {
        Self {
            ok: false,
            status: msg.into(),
        }
    }

    pub fn denied(msg: impl Into<String>) -> Self {
        Self::fail(msg)
    }
}

/// Unix: graceful `SIGTERM`, escalate to `SIGKILL` only if the process ignores
/// it after a short grace period.
#[cfg(unix)]
pub fn terminate(pid: u32) -> KillResult {
    use nix::errno::Errno;
    use nix::sys::signal::{kill, Signal};
    use nix::unistd::Pid;
    use std::{thread::sleep, time::Duration};

    let target = Pid::from_raw(pid as i32);

    match kill(target, Signal::SIGTERM) {
        Ok(()) => {}
        Err(Errno::ESRCH) => return KillResult::ok("The process had already stopped."),
        Err(Errno::EPERM) => return KillResult::fail("Not permitted to stop this process."),
        Err(e) => return KillResult::fail(format!("Failed to stop process: {e}")),
    }

    // Give it up to ~0.6s to exit cleanly, then force-kill if it lingers.
    for _ in 0..6 {
        sleep(Duration::from_millis(100));
        if kill(target, None::<Signal>).is_err() {
            return KillResult::ok("Process stopped.");
        }
    }
    let _ = kill(target, Some(Signal::SIGKILL));
    KillResult::ok("Process force-stopped.")
}

/// Windows: no `SIGTERM` for arbitrary processes — `TerminateProcess` (via
/// sysinfo) is forceful only.
#[cfg(windows)]
pub fn terminate(pid: u32) -> KillResult {
    use sysinfo::{Pid, ProcessesToUpdate, System};

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    match sys.process(Pid::from_u32(pid)) {
        None => KillResult::ok("The process had already stopped."),
        Some(p) => {
            if p.kill() {
                KillResult::ok("Process stopped (forced).")
            } else {
                KillResult::fail("Not permitted to stop this process.")
            }
        }
    }
}
