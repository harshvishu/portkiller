import SwiftUI

@main
struct PortKillerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = PortScannerModel()

    var body: some Scene {
        MenuBarExtra {
            PortListView(model: model)
        } label: {
            Image(nsImage: MenuBarIcon.image())
        }
        .menuBarExtraStyle(.window)
    }
}
