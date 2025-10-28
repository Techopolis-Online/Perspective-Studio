//
//  ChatSession.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

struct ChatSession: Identifiable, Codable, Hashable {
    struct Settings: Codable, Hashable {
        var systemPrompt: String
        var temperature: Double
        var topP: Double
        var maxTokens: Int
        var selectedModelID: String?

        static let `default` = Settings(
            systemPrompt: "You are Perspective Studio, an accessible macOS AI companion.",
            temperature: 0.7,
            topP: 0.95,
            maxTokens: 2048,
            selectedModelID: nil
        )
    }

    let id: UUID
    var title: String
    var createdAt: Date
    var messages: [ChatMessage]
    var settings: Settings

    init(
        id: UUID = UUID(),
        title: String,
        createdAt: Date = .init(),
        messages: [ChatMessage] = [],
        settings: Settings = .default
    ) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.messages = messages
        self.settings = settings
    }
}

extension ChatSession {
    static let sample = ChatSession(
        title: "Welcome",
        messages: [
            ChatMessage(role: .system, content: "Provide accurate and accessible answers."),
            ChatMessage(role: .assistant, content: "Welcome to Perspective Studio! I'm ready when you are.")
        ]
    )
}
