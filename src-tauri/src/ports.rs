use std::collections::HashMap;
use std::net::IpAddr;

use netstat2::{
    get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState,
};
use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System, Users};

/// How widely a listener is exposed on the network.
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum BindScope {
    Localhost,
    AllInterfaces,
}

/// A single TCP listener plus the process behind it and whether the current
/// user is allowed to stop it. Serialized to the frontend as camelCase.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortProcess {
    pub id: String,
    pub port: u16,
    pub pid: u32,
    pub command: String,
    pub user: String,
    pub addresses: Vec<String>,
    pub display_name: String,
    pub is_killable: bool,
    pub protected_reason: Option<String>,
    pub bind_scope: BindScope,
    /// Current CPU utilization, normalized to a single core (100% = one core).
    pub cpu_percent: f32,
    /// Resident memory of the owning process, in bytes.
    pub memory_bytes: u64,
}

/// Enumerate every TCP socket in the LISTEN state, grouped by (pid, port),
/// returned in a stable default order (ascending by port). Uses native OS
/// socket APIs via `netstat2` and resolves process metadata via `sysinfo` — no
/// shelling out.
///
/// Takes a caller-owned `System` so CPU utilization can be computed as a delta
/// across successive refreshes of the *same* sampler. A fresh `System` would
/// always report 0% CPU.
pub fn list_ports(sys: &mut System) -> Vec<PortProcess> {
    let af = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let sockets = match get_sockets_info(af, ProtocolFlags::TCP) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    sys.refresh_processes(ProcessesToUpdate::All, true);
    let users = Users::new_with_refreshed_list();
    let current = current_username();

    let mut grouped: HashMap<(u32, u16), PortProcess> = HashMap::new();

    for si in sockets {
        let ProtocolSocketInfo::Tcp(tcp) = &si.protocol_socket_info else {
            continue;
        };
        if tcp.state != TcpState::Listen {
            continue;
        }

        let ip = tcp.local_addr;
        let port = tcp.local_port;
        let exposed = ip.is_unspecified();
        let addr_str = format_addr(ip, port);
        let pid = si.associated_pids.first().copied().unwrap_or(0);
        let key = (pid, port);

        match grouped.get_mut(&key) {
            Some(existing) => {
                if !existing.addresses.contains(&addr_str) {
                    existing.addresses.push(addr_str);
                }
                if exposed {
                    existing.bind_scope = BindScope::AllInterfaces;
                }
            }
            None => {
                let (command, user, display_name, resolved, cpu_percent, memory_bytes) =
                    resolve(sys, &users, pid);
                let (is_killable, protected_reason) = if resolved {
                    killability(&user, &current, &command)
                } else {
                    (
                        false,
                        Some(
                            "Owner could not be determined (may require elevated privileges)."
                                .to_string(),
                        ),
                    )
                };
                grouped.insert(
                    key,
                    PortProcess {
                        id: format!("{pid}-{port}"),
                        port,
                        pid,
                        command,
                        user,
                        addresses: vec![addr_str],
                        display_name,
                        is_killable,
                        protected_reason,
                        bind_scope: if exposed {
                            BindScope::AllInterfaces
                        } else {
                            BindScope::Localhost
                        },
                        cpu_percent,
                        memory_bytes,
                    },
                );
            }
        }
    }

    let mut out: Vec<PortProcess> = grouped.into_values().collect();
    out.sort_by(|a, b| a.port.cmp(&b.port).then(a.pid.cmp(&b.pid)));
    out
}

/// Re-validate, in the backend, that `pid` is something the current user is
/// actually allowed to stop. Never trust the frontend's claim.
pub fn ensure_killable(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("Invalid process.".to_string());
    }

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let users = Users::new_with_refreshed_list();
    let current = current_username();

    match sys.process(Pid::from_u32(pid)) {
        None => Err("Process is no longer running.".to_string()),
        Some(p) => {
            let command = p.name().to_string_lossy().to_string();
            let user = resolve_user(&users, p);
            let (killable, reason) = killability(&user, &current, &command);
            if killable {
                Ok(())
            } else {
                Err(reason.unwrap_or_else(|| "This process is protected.".to_string()))
            }
        }
    }
}

#[allow(clippy::type_complexity)]
fn resolve(
    sys: &System,
    users: &Users,
    pid: u32,
) -> (String, String, String, bool, f32, u64) {
    if pid != 0 {
        if let Some(p) = sys.process(Pid::from_u32(pid)) {
            let command = p.name().to_string_lossy().to_string();
            let user = resolve_user(users, p);
            let display_name = command.strip_suffix(".exe").unwrap_or(&command).to_string();
            return (command, user, display_name, true, p.cpu_usage(), p.memory());
        }
    }
    (
        String::new(),
        "unknown".to_string(),
        "Unknown process".to_string(),
        false,
        0.0,
        0,
    )
}

fn resolve_user(users: &Users, p: &sysinfo::Process) -> String {
    p.user_id()
        .and_then(|uid| users.get_user_by_id(uid))
        .map(|u| u.name().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Decide whether the current user may stop a process, and why not.
fn killability(user: &str, current: &str, command: &str) -> (bool, Option<String>) {
    if current.is_empty() || user != current {
        let owner = if user == "root" {
            "root".to_string()
        } else {
            format!("user “{user}”")
        };
        return (
            false,
            Some(format!(
                "Owned by {owner} — requires elevated privileges to stop."
            )),
        );
    }
    if is_protected(command) {
        return (false, Some("Protected system service.".to_string()));
    }
    (true, None)
}

fn is_protected(command: &str) -> bool {
    let c = command.to_lowercase();
    PROTECTED.contains(&c.as_str())
}

fn format_addr(ip: IpAddr, port: u16) -> String {
    match ip {
        IpAddr::V4(v4) => format!("{v4}:{port}"),
        IpAddr::V6(v6) => format!("[{v6}]:{port}"),
    }
}

fn current_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_default()
}

/// System processes that should never be offered for killing, even when they
/// run under the current user account. Compared case-insensitively against the
/// process command name.
#[cfg(target_os = "macos")]
const PROTECTED: &[&str] = &[
    "launchd", "rapportd", "sharingd", "controlcenter", "controlce", "remoted", "configd",
    "mdnsresponder", "mdnsrespo", "netbiosd", "rpcbind", "sshd", "cupsd", "airplayxpchelper",
    "identityservicesd", "nsurlsessiond", "trustd", "secd", "cloudd", "apsd", "syslogd",
    "distnoted", "coreaudiod", "windowserver", "loginwindow", "systemuiserver", "spindump",
    "softwareupdated",
];

#[cfg(target_os = "windows")]
const PROTECTED: &[&str] = &[
    "system", "system idle process", "svchost.exe", "lsass.exe", "services.exe", "wininit.exe",
    "winlogon.exe", "csrss.exe", "smss.exe", "spoolsv.exe", "searchindexer.exe", "dwm.exe",
];

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const PROTECTED: &[&str] = &[
    "systemd", "init", "systemd-resolve", "systemd-resolved", "systemd-networkd", "cupsd",
    "sshd", "avahi-daemon", "dnsmasq", "rpcbind", "chronyd", "named",
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn formats_v4_and_v6_addresses() {
        assert_eq!(
            format_addr(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 3000),
            "127.0.0.1:3000"
        );
        assert_eq!(
            format_addr(IpAddr::V6(Ipv6Addr::LOCALHOST), 5000),
            "[::1]:5000"
        );
    }

    #[test]
    fn killable_when_owned_and_not_protected() {
        let (killable, reason) = killability("me", "me", "node");
        assert!(killable);
        assert!(reason.is_none());
    }

    #[test]
    fn not_killable_when_owned_by_another_user() {
        let (killable, reason) = killability("root", "me", "node");
        assert!(!killable);
        assert!(reason.unwrap().contains("root"));
    }

    #[test]
    fn not_killable_when_protected_even_if_owned() {
        let protected_name = PROTECTED[0];
        let (killable, reason) = killability("me", "me", protected_name);
        assert!(!killable);
        assert!(reason.unwrap().contains("Protected"));
    }

    #[test]
    fn protection_is_case_insensitive() {
        let upper = PROTECTED[0].to_uppercase();
        assert!(is_protected(&upper));
        assert!(!is_protected("definitely-not-a-system-process"));
    }

    #[test]
    fn unspecified_addresses_are_exposed() {
        assert!(IpAddr::V4(Ipv4Addr::UNSPECIFIED).is_unspecified());
        assert!(IpAddr::V6(Ipv6Addr::UNSPECIFIED).is_unspecified());
        assert!(!IpAddr::V4(Ipv4Addr::LOCALHOST).is_unspecified());
    }

    fn refreshed_system() -> System {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);
        sys
    }

    #[test]
    fn list_ports_returns_port_sorted_without_panicking() {
        let mut sys = refreshed_system();
        let ports = list_ports(&mut sys);
        let mut expected: Vec<u16> = ports.iter().map(|p| p.port).collect();
        expected.sort_unstable();
        let actual: Vec<u16> = ports.iter().map(|p| p.port).collect();
        assert_eq!(actual, expected);
    }

    #[test]
    fn list_ports_reports_non_negative_metrics() {
        let mut sys = refreshed_system();
        for p in list_ports(&mut sys) {
            assert!(p.cpu_percent >= 0.0, "cpu_percent must be non-negative");
            // memory_bytes is u64, so it is inherently non-negative; the field
            // simply being present and readable is the assertion here.
            let _ = p.memory_bytes;
        }
    }

    #[test]
    fn known_pid_yields_a_memory_value() {
        let sys = refreshed_system();
        let pid = std::process::id();
        let process = sys
            .process(Pid::from_u32(pid))
            .expect("current process should be visible to sysinfo");
        assert!(
            process.memory() > 0,
            "a running process should report non-zero resident memory"
        );
    }
}
