import SwiftUI

/// A single row describing one listening port and the process behind it.
struct PortRowView: View {
    let process: PortProcess
    let onKill: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("\(process.port)")
                        .font(.system(.body, design: .monospaced).weight(.semibold))

                    if !process.isKillable {
                        Image(systemName: "lock.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Label(process.bindScope.label, systemImage: process.bindScope.systemImage)
                        .font(.caption2)
                        .labelStyle(.titleAndIcon)
                        .foregroundStyle(.secondary)
                }

                Text(process.displayName)
                    .font(.callout)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .foregroundStyle(process.isKillable ? .primary : .secondary)

                Text("PID \(process.pid) • \(process.user)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            killButton
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .help(process.protectedReason ?? "Listening on port \(process.port)")
    }

    @ViewBuilder
    private var killButton: some View {
        if process.isKillable {
            Button(action: onKill) {
                Text("Kill")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 5)
                    .background(Color.red, in: Capsule())
            }
            .buttonStyle(.plain)
            .help("Stop this process")
        } else {
            Text("Protected")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.quaternary, in: Capsule())
                .help(process.protectedReason ?? "This process can't be stopped from here.")
        }
    }
}
