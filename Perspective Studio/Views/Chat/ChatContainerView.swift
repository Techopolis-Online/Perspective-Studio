//
//  ChatContainerView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct ChatContainerView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @StateObject private var chatViewModel = ChatViewModel(session: .sample)

    var body: some View {
        ChatView(viewModel: chatViewModel)
            .task {
                chatViewModel.session = appViewModel.activeChatSession
            }
            .onReceive(appViewModel.$activeChatSession) { session in
                chatViewModel.session = session
            }
            .onChange(of: chatViewModel.session) { session in
                appViewModel.activeChatSession = session
            }
            .toolbar {
                ToolbarItemGroup(placement: .automatic) {
                    Picker("Temperature", selection: $chatViewModel.session.settings.temperature) {
                        Text("Cool (0.3)").tag(0.3)
                        Text("Balanced (0.7)").tag(0.7)
                        Text("Creative (0.9)").tag(0.9)
                    }
                    .onChange(of: chatViewModel.session.settings.temperature) { newValue in
                        chatViewModel.updateTemperature(newValue)
                    }
                    .help("Adjust model creativity")
                }
            }
    }
}
