//
//  ChatMessage.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

enum ChatRole: String, Codable, CaseIterable, Identifiable {
    case system
    case user
    case assistant

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .user: return "You"
        case .assistant: return "Assistant"
        }
    }
}

struct ChatMessage: Identifiable, Codable, Hashable {
    let id: UUID
    var role: ChatRole
    var content: String
    var timestamp: Date

    init(id: UUID = UUID(), role: ChatRole, content: String, timestamp: Date = .init()) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }
}
