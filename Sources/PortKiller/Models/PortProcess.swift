import Foundation

/// A single TCP listener discovered on the machine, together with the process
/// that owns it and whether the current user is allowed to stop that process.
struct PortProcess: Identifiable, Hashable {
    /// Stable identity used by SwiftUI lists (`"<pid>-<port>"`).
    let id: String
    /// The TCP port the process is listening on.
    let port: Int
    /// Process identifier.
    let pid: Int32
    /// Raw command name reported by `lsof`.
    let command: String
    /// Numeric owner of the process.
    let uid: UInt32
    /// Login name of the owner (falls back to `uid <n>`).
    let user: String
    /// Every bound address for this (pid, port) pair, e.g. `*:3000`, `127.0.0.1:3000`.
    var addresses: [String]
    /// Friendly name shown in the UI (app name when known, otherwise `command`).
    var displayName: String
    /// `true` when the current user may terminate this process.
    let isKillable: Bool
    /// Human-readable reason the process is protected, or `nil` when killable.
    let protectedReason: String?

    /// Whether the listener is reachable from other machines or local-only.
    var bindScope: BindScope {
        let exposed = addresses.contains { address in
            address.hasPrefix("*")
                || address.hasPrefix("0.0.0.0")
                || address.hasPrefix("[::]")
        }
        return exposed ? .allInterfaces : .localhost
    }
}

/// Describes how widely a listener is exposed on the network.
enum BindScope {
    case localhost
    case allInterfaces

    var label: String {
        switch self {
        case .localhost: return "localhost"
        case .allInterfaces: return "all interfaces"
        }
    }

    var systemImage: String {
        switch self {
        case .localhost: return "lock"
        case .allInterfaces: return "globe"
        }
    }
}
