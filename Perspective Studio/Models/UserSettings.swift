//
//  UserSettings.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

struct UserSettings: Codable {
    enum ExperienceLevel: String, Codable, CaseIterable, Identifiable {
        case beginner
        case intermediate
        case expert

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .beginner: return "Beginner"
            case .intermediate: return "Intermediate"
            case .expert: return "Power User"
            }
        }

        var description: String {
            switch self {
            case .beginner:
                return "Step-by-step guidance with plain-language tips."
            case .intermediate:
                return "Familiar layout with optional advanced controls when you want them."
            case .expert:
                return "Full control over runtimes, endpoints, and automation tools."
            }
        }
    }

    var experienceLevel: ExperienceLevel = .beginner
    var preferredModelID: String?
}
