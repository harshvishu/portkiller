import AppKit

/// Keeps the app out of the Dock and the Cmd-Tab switcher so it lives purely
/// in the menu bar.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }
}
