import AppKit
import Combine
import Darwin
import Foundation

/// Observable state backing the menu bar UI: scans for listening ports on a
/// timer and terminates processes on request.
@MainActor
final class PortScannerModel: ObservableObject {

    @Published private(set) var ports: [PortProcess] = []
    @Published private(set) var isScanning = false
    /// Transient status line shown in the footer (kill progress / errors).
    @Published var statusMessage: String?
    /// Free-text filter applied to the visible list.
    @Published var searchText = ""

    private var timer: Timer?
    private let currentUID = UInt32(getuid())

    /// Number of listeners the current user is allowed to stop.
    var killableCount: Int {
        ports.filter(\.isKillable).count
    }

    /// Ports matching `searchText` (case-insensitive match on port, app name,
    /// command, or owner). Returns everything when the filter is empty.
    var filteredPorts: [PortProcess] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return ports }
        return ports.filter { proc in
            String(proc.port).contains(query)
                || proc.displayName.lowercased().contains(query)
                || proc.command.lowercased().contains(query)
                || proc.user.lowercased().contains(query)
        }
    }

    // MARK: - Refresh lifecycle

    func startAutoRefresh(interval: TimeInterval = 3.0) {
        refresh()
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    func stopAutoRefresh() {
        timer?.invalidate()
        timer = nil
    }

    func refresh() {
        guard !isScanning else { return }
        isScanning = true
        let uid = currentUID

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let output = PortScanner.runLsof()
            let parsed = PortScanner.parse(output, currentUID: uid)
            DispatchQueue.main.async {
                guard let self else { return }
                self.ports = self.enrich(parsed)
                self.isScanning = false
            }
        }
    }

    // MARK: - Killing

    /// Terminates the process behind a port. Sends `SIGTERM` first and escalates
    /// to `SIGKILL` if the process ignores it, then refreshes the list.
    func kill(_ target: PortProcess) {
        guard target.isKillable else {
            statusMessage = "\(target.displayName) can't be stopped from here."
            return
        }

        let pid = target.pid
        if Darwin.kill(pid, SIGTERM) != 0 {
            let err = errno
            switch err {
            case ESRCH:
                statusMessage = "\(target.displayName) had already stopped."
            case EPERM:
                statusMessage = "Not permitted to stop \(target.displayName)."
            default:
                statusMessage = "Failed to stop \(target.displayName): \(String(cString: strerror(err)))."
            }
            refresh()
            return
        }

        statusMessage = "Stopping \(target.displayName) on port \(target.port)…"

        // Give the process a moment to exit cleanly; force-kill if it lingers.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            if Darwin.kill(pid, 0) == 0 {
                _ = Darwin.kill(pid, SIGKILL)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self?.statusMessage = nil
                self?.refresh()
            }
        }
    }

    // MARK: - Helpers

    /// Replaces raw command names with friendly app names when the PID belongs
    /// to a running GUI application.
    private func enrich(_ ports: [PortProcess]) -> [PortProcess] {
        var nameByPID: [Int32: String] = [:]
        for app in NSWorkspace.shared.runningApplications {
            if let name = app.localizedName {
                nameByPID[app.processIdentifier] = name
            }
        }
        return ports.map { proc in
            var copy = proc
            if let appName = nameByPID[proc.pid] {
                copy.displayName = appName
            }
            return copy
        }
    }
}
