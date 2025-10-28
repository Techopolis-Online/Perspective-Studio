//
//  ChatViewModel.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var session: ChatSession
    @Published var inputText: String = ""
    @Published var isStreamingResponse: Bool = false
    @Published var runtimeState: RuntimeState = .idle

    private let runtimeManager: RuntimeManaging
    private var cancellables = Set<AnyCancellable>()

    init(
        session: ChatSession,
        runtimeManager: RuntimeManaging = RuntimeManager.shared
    ) {
        self.session = session
        self.runtimeManager = runtimeManager
        observeRuntime()
    }

    func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let message = ChatMessage(role: .user, content: trimmed)
        session.messages.append(message)
        inputText = ""

        // TODO: integrate with actual inference pipeline.
        synthesizeAssistantReply(for: message)
    }

    func updateTemperature(_ value: Double) {
        session.settings.temperature = value
    }

    func selectModel(_ model: ModelMetadata) {
        session.settings.selectedModelID = model.id
        runtimeManager.load(model: model)
    }

    private func observeRuntime() {
        runtimeManager.statePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.runtimeState = state
            }
            .store(in: &cancellables)
    }

    private func synthesizeAssistantReply(for message: ChatMessage) {
        isStreamingResponse = true
        let initial = ChatMessage(role: .assistant, content: "Thinking…")
        session.messages.append(initial)
        let replyIndex = session.messages.count - 1

        Task {
            try await Task.sleep(nanoseconds: 750_000_000)
            let responseText = "Here's a placeholder response to “\(message.content)”. Runtime integration is coming soon."
            await MainActor.run {
                session.messages[replyIndex].content = responseText
                isStreamingResponse = false
                VoiceOverAnnouncer.announce("Assistant response ready.")
            }
        }
    }
}
