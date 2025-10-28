//
//  SettingsView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appViewModel: AppViewModel

    var body: some View {
        Form {
            Section("General") {
                Text("Perspective Studio mirrors your macOS accessibility preferences automatically, including VoiceOver, appearance, and text settings.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Runtime") {
                if let preferredID = appViewModel.userSettings.preferredModelID,
                   let model = appViewModel.catalog.first(where: { $0.id == preferredID }) {
                    LabeledContent("Preferred model") {
                        Text(model.name)
                    }
                } else {
                    Text("No preferred model selected yet.")
                        .foregroundStyle(.secondary)
                }

                Button("Clear preferred model") {
                    appViewModel.userSettings.preferredModelID = nil
                }
                .disabled(appViewModel.userSettings.preferredModelID == nil)
            }

            Section("Cloud & Shortcuts") {
                Text("Toggle VoiceOver, display, or input preferences from System Settings to have Perspective Studio adapt automatically.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Toggle("Sync metadata via iCloud", isOn: .constant(false))
                    .disabled(true)
                    .help("Coming soon. Metadata will sync via your private CloudKit store.")

                Toggle("Enable Siri Shortcuts", isOn: .constant(false))
                    .disabled(true)
                    .help("Shortcut donation planned for a future release.")
            }
        }
        .formStyle(.grouped)
        .padding()
        .navigationTitle("Settings")
    }
}
