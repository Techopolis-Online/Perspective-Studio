//
//  MainWindowView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct MainWindowView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    var body: some View {
        NavigationSplitView {
            List(selection: $appViewModel.selectedDestination) {
                Section("Workspace") {
                    NavigationLink(value: SidebarDestination.chats) {
                        Label(SidebarDestination.chats.title, systemImage: "bubble.left.and.bubble.right")
                    }
                    .accessibilityHint(SidebarDestination.chats.accessibilityHint)

                    NavigationLink(value: SidebarDestination.catalog) {
                        Label(SidebarDestination.catalog.title, systemImage: "square.stack.3d.up")
                    }
                    .accessibilityHint(SidebarDestination.catalog.accessibilityHint)

                    NavigationLink(value: SidebarDestination.downloads) {
                        Label(SidebarDestination.downloads.title, systemImage: "arrow.down.circle")
                    }
                    .accessibilityHint(SidebarDestination.downloads.accessibilityHint)
                }

                Section("Preferences") {
                    NavigationLink(value: SidebarDestination.settings) {
                        Label(SidebarDestination.settings.title, systemImage: "slider.horizontal.3")
                    }
                    .accessibilityHint(SidebarDestination.settings.accessibilityHint)
                }
            }
            .listStyle(.sidebar)
            .frame(minWidth: 220)
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    Button(action: toggleSidebar, label: {
                        Image(systemName: "sidebar.leading")
                    })
                    .help("Toggle sidebar")
                }
            }
        } detail: {
            if let destination = appViewModel.selectedDestination {
                destinationView(for: destination)
            } else {
                Text("Select an area to get started.")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 980, minHeight: 640)
    }

    private func toggleSidebar() {
#if os(macOS)
        NSApp.keyWindow?.firstResponder?.tryToPerform(#selector(NSSplitViewController.toggleSidebar(_:)), with: nil)
#endif
    }

    @ViewBuilder
    private func destinationView(for destination: SidebarDestination) -> some View {
        switch destination {
        case .chats:
            ChatContainerView()
                .navigationTitle(destination.title)
        case .catalog:
            ModelCatalogView(viewModel: CatalogViewModel(appViewModel: appViewModel))
                .navigationTitle(destination.title)
        case .downloads:
            DownloadManagerView()
                .navigationTitle(destination.title)
        case .settings:
            SettingsView()
                .navigationTitle(destination.title)
        }
    }
}
