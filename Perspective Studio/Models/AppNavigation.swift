//
//  AppNavigation.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

enum SidebarDestination: Hashable {
    case chats
    case catalog
    case downloads
    case settings

    var title: String {
        switch self {
        case .chats: return "Chat"
        case .catalog: return "Model Catalog"
        case .downloads: return "Downloads"
        case .settings: return "Settings"
        }
    }

    var accessibilityHint: String {
        switch self {
        case .chats:
            return "Open your current chat sessions."
        case .catalog:
            return "Browse and manage available models."
        case .downloads:
            return "View download progress and manage tasks."
        case .settings:
            return "Adjust preferences and runtime options."
        }
    }
}
