import AppKit
import SwiftUI

/// Content shown inside the menu bar popover: a header, a scrolling list of
/// listening ports, and a footer with status + quit.
struct PortListView: View {
    @ObservedObject var model: PortScannerModel
    @StateObject private var loginManager = LoginItemManager()
    @State private var pendingKill: PortProcess?

    var body: some View {
        VStack(spacing: 0) {
            header
            if !model.ports.isEmpty {
                searchBar
            }
            Divider()
            content
            Divider()
            footer
        }
        .frame(width: 380)
        .onAppear {
            model.startAutoRefresh()
            loginManager.refresh()
        }
        .onDisappear { model.stopAutoRefresh() }
        .alert(
            "Kill this process?",
            isPresented: showKillAlert,
            presenting: pendingKill
        ) { proc in
            Button("Kill", role: .destructive) { model.kill(proc) }
            Button("Cancel", role: .cancel) { }
        } message: { proc in
            Text("This terminates “\(proc.displayName)” (PID \(proc.pid)) listening on port \(proc.port). Unsaved work in that process may be lost.")
        }
    }

    private var showKillAlert: Binding<Bool> {
        Binding(
            get: { pendingKill != nil },
            set: { if !$0 { pendingKill = nil } }
        )
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "powerplug.fill")
                .foregroundStyle(.tint)
            Text("Port Killer")
                .font(.headline)

            Spacer()

            if model.isScanning {
                ProgressView()
                    .controlSize(.small)
            }
            Text("\(model.filteredPorts.count)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.quaternary, in: Capsule())

            Button {
                model.refresh()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("Refresh now")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    // MARK: - Search

    private var searchBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("Filter by port, app, or owner", text: $model.searchText)
                .textFieldStyle(.plain)
                .font(.callout)
            if !model.searchText.isEmpty {
                Button {
                    model.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Clear filter")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        let visible = model.filteredPorts
        if visible.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: emptyStateSymbol)
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                Text(emptyStateText)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
            .padding(.horizontal, 16)
        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(visible) { proc in
                        PortRowView(process: proc) {
                            pendingKill = proc
                        }
                        if proc.id != visible.last?.id {
                            Divider().padding(.leading, 12)
                        }
                    }
                }
            }
            .frame(minHeight: 264, maxHeight: 460)
        }
    }

    private var emptyStateSymbol: String {
        if model.ports.isEmpty {
            return model.isScanning ? "hourglass" : "checkmark.seal"
        }
        return "magnifyingglass"
    }

    private var emptyStateText: String {
        if model.ports.isEmpty {
            return model.isScanning ? "Scanning…" : "No listening ports found"
        }
        return "No ports match “\(model.searchText)”"
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 6) {
            if let message = model.statusMessage {
                HStack {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                }
            }
            HStack(spacing: 8) {
                Toggle(isOn: loginBinding) {
                    Text("Launch at login")
                        .font(.caption)
                }
                .toggleStyle(.checkbox)
                .controlSize(.small)
                .help("Start Port Killer automatically when you log in")

                Spacer()

                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .help("Quit Port Killer")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var loginBinding: Binding<Bool> {
        Binding(
            get: { loginManager.isEnabled },
            set: { loginManager.setEnabled($0) }
        )
    }
}
