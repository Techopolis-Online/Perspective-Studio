//
//  Perspective_StudioApp.swift
//  Perspective Studio
//
//  Created by Taylor Arndt on 10/28/25.
//

import SwiftUI

@main
struct Perspective_StudioApp: App {
    @StateObject private var appViewModel = AppViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appViewModel)
        }
        .commands {
            SidebarCommands()
            CommandGroup(replacing: .newItem) {
                Button("New Chat") {
                    appViewModel.activeChatSession = ChatSession(title: "New Chat")
                }
                .keyboardShortcut("N", modifiers: [.command])
                .help("Start a new chat session")
            }

            CommandGroup(after: .help) {
                Button("Keyboard Shortcuts…") {
                    appViewModel.presentKeyboardShortcuts()
                }
                .keyboardShortcut("K", modifiers: [.command])
                .help("Show keyboard shortcuts reference")
            }
        }
    }
}
