import Foundation

/// Stateless helpers that discover listening TCP ports by shelling out to
/// `lsof` and turn its field-mode output into `PortProcess` values.
enum PortScanner {

    /// macOS daemons / system services that should never be offered for killing,
    /// even when they happen to run under the current user account. Compared
    /// case-insensitively against the `lsof` command name (which may be
    /// truncated to nine characters).
    static let protectedProcessNames: Set<String> = [
        "launchd", "rapportd", "sharingd", "controlcenter", "controlce",
        "remoted", "configd", "mdnsresponder", "mdnsrespo", "netbiosd",
        "rpcbind", "sshd", "cupsd", "airplayxpchelper", "identityservicesd",
        "nsurlsessiond", "trustd", "secd", "cloudd", "apsd", "syslogd",
        "distnoted", "coreaudiod", "windowserver", "loginwindow",
        "systemuiserver", "spindump", "softwareupdated"
    ]

    private static let lsofCandidatePaths = [
        "/usr/sbin/lsof",
        "/usr/bin/lsof",
        "/opt/homebrew/bin/lsof"
    ]

    /// First existing `lsof` executable, defaulting to the standard location.
    static func lsofPath() -> String {
        for path in lsofCandidatePaths where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return "/usr/sbin/lsof"
    }

    /// Runs `lsof` in field-output mode and returns its raw stdout.
    static func runLsof() -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: lsofPath())
        // -iTCP -sTCP:LISTEN  -> only listening TCP sockets
        // -P -n               -> numeric ports / hosts (no DNS, no service names)
        // -FpcuLn             -> machine-readable fields: pid, command, uid, login, name
        process.arguments = ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "-FpcuLn"]

        let outPipe = Pipe()
        process.standardOutput = outPipe
        process.standardError = Pipe()

        do {
            try process.run()
        } catch {
            return ""
        }

        let data = outPipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return String(decoding: data, as: UTF8.self)
    }

    /// Parses `lsof -F` field output into a de-duplicated, port-sorted list.
    static func parse(_ output: String, currentUID: UInt32) -> [PortProcess] {
        var grouped: [String: PortProcess] = [:]

        var pid: Int32 = 0
        var command = ""
        var uid: UInt32 = 0
        var login = ""

        for rawLine in output.split(separator: "\n", omittingEmptySubsequences: true) {
            guard let tag = rawLine.first else { continue }
            let value = String(rawLine.dropFirst())

            switch tag {
            case "p":               // new process record
                pid = Int32(value) ?? 0
                command = ""
                uid = 0
                login = ""
            case "c":
                command = value
            case "u":
                uid = UInt32(value) ?? 0
            case "L":
                login = value
            case "n":               // a bound address for the current process
                guard pid > 0, let port = port(from: value) else { continue }
                let key = "\(pid)-\(port)"
                if var existing = grouped[key] {
                    if !existing.addresses.contains(value) {
                        existing.addresses.append(value)
                        grouped[key] = existing
                    }
                } else {
                    let (killable, reason) = killability(
                        uid: uid,
                        command: command,
                        currentUID: currentUID
                    )
                    grouped[key] = PortProcess(
                        id: key,
                        port: port,
                        pid: pid,
                        command: command,
                        uid: uid,
                        user: login.isEmpty ? "uid \(uid)" : login,
                        addresses: [value],
                        displayName: command,
                        isKillable: killable,
                        protectedReason: reason
                    )
                }
            default:
                break
            }
        }

        return grouped.values.sorted { $0.port < $1.port }
    }

    /// Extracts the trailing port number from an `lsof` address such as
    /// `*:3000`, `127.0.0.1:8080`, or `[::1]:5000`.
    static func port(from name: String) -> Int? {
        guard let colon = name.lastIndex(of: ":") else { return nil }
        let portPart = name[name.index(after: colon)...]
        return Int(portPart)
    }

    /// Decides whether the current user may stop a process, and why not.
    static func killability(
        uid: UInt32,
        command: String,
        currentUID: UInt32
    ) -> (isKillable: Bool, reason: String?) {
        if uid != currentUID {
            let owner = uid == 0 ? "root" : "user \(uid)"
            return (false, "Owned by \(owner) — requires elevated privileges to stop.")
        }
        if protectedProcessNames.contains(command.lowercased()) {
            return (false, "Protected macOS system service.")
        }
        return (true, nil)
    }
}
