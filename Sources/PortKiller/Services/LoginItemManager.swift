import Foundation
import ServiceManagement

/// Wraps `SMAppService` to register/unregister Port Killer as a macOS login
/// item, exposing a simple observable on/off state for the UI toggle.
@MainActor
final class LoginItemManager: ObservableObject {

    @Published private(set) var isEnabled = false
    /// Populated when (un)registration fails, e.g. the app isn't signed.
    @Published var lastError: String?

    init() {
        refresh()
    }

    /// Re-reads the current login-item status from the system.
    func refresh() {
        isEnabled = SMAppService.mainApp.status == .enabled
    }

    /// Registers or unregisters the login item, reverting state on failure.
    func setEnabled(_ enabled: Bool) {
        do {
            if enabled {
                if SMAppService.mainApp.status != .enabled {
                    try SMAppService.mainApp.register()
                }
            } else if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            }
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        refresh()
    }
}
