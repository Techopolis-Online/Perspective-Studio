//
//  KeyboardShortcutsView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct KeyboardShortcutsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Keyboard Shortcuts")
                .font(.largeTitle.bold())
                .accessibilityAddTraits(.isHeader)

            shortcutsSection(title: "General", shortcuts: [
                ("Toggle sidebar", "⌘⌥S"),
                ("Show keyboard shortcuts", "⌘K")
            ])

            shortcutsSection(title: "Chats", shortcuts: [
                ("New chat", "⌘N"),
                ("Send prompt", "⌘↩︎")
            ])

            shortcutsSection(title: "Catalog & Downloads", shortcuts: [
                ("Refresh catalog", "⌘R"),
                ("Download selected model", "⌘D"),
                ("Import model", "⇧⌘I")
            ])

            Spacer()
        }
        .padding()
    }

    private func shortcutsSection(title: String, shortcuts: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            ForEach(shortcuts, id: \.0) { item in
                HStack {
                    Text(item.0)
                    Spacer()
                    Text(item.1)
                        .monospaced()
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(item.0) \(item.1)")
            }
        }
    }
}
