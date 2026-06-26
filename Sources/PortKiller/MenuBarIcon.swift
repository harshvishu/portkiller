import AppKit

/// Draws the menu-bar glyph programmatically as a template image so it adapts
/// to light/dark menus and the highlighted state automatically — no asset
/// catalog required. The glyph is a bold "power" symbol (a broken ring with a
/// stem) signalling "stop / power off".
enum MenuBarIcon {

    static func image(pointSize: CGFloat = 18) -> NSImage {
        let size = NSSize(width: pointSize, height: pointSize)

        let image = NSImage(size: size, flipped: false) { rect in
            let w = rect.width
            let h = rect.height
            let lineWidth = w * 0.135

            NSColor.black.setStroke()

            // Centre the ring slightly low to leave headroom for the stem.
            let center = NSPoint(x: w * 0.5, y: h * 0.46)
            let radius = w * 0.30

            // Broken ring: full circle minus a ~40° gap at the very top.
            let ring = NSBezierPath()
            ring.appendArc(
                withCenter: center,
                radius: radius,
                startAngle: 110,
                endAngle: 70,
                clockwise: false
            )
            ring.lineWidth = lineWidth
            ring.lineCapStyle = .round
            ring.stroke()

            // Vertical stem rising through the gap.
            let stem = NSBezierPath()
            stem.move(to: NSPoint(x: center.x, y: center.y + radius * 0.05))
            stem.line(to: NSPoint(x: center.x, y: center.y + radius + lineWidth * 0.9))
            stem.lineWidth = lineWidth
            stem.lineCapStyle = .round
            stem.stroke()

            return true
        }

        image.isTemplate = true
        return image
    }
}
