//
//  VoiceOverAnnouncer.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation
import SwiftUI

/// Helper for posting VoiceOver announcements when new content arrives.
struct VoiceOverAnnouncer {
    static func announce(_ message: String) {
#if os(macOS)
        NSAccessibility.post(
            element: NSApp,
            notification: .announcementRequested,
            userInfo: [
                NSAccessibility.NotificationUserInfoKey.announcement: message,
                NSAccessibility.NotificationUserInfoKey.priority: NSAccessibilityPriorityLevel.high.rawValue
            ]
        )
#endif
    }
}
