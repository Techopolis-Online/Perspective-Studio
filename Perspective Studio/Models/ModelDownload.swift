//
//  ModelDownload.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

enum DownloadState: Equatable, Hashable {
    case notStarted
    case inProgress(progress: Double, speedBytesPerSecond: Double?)
    case paused(progress: Double)
    case verifying
    case completed(url: URL)
    case failed(error: DownloadError)

    var progressValue: Double {
        switch self {
        case .notStarted: return 0
        case .inProgress(let progress, _): return progress
        case .paused(let progress): return progress
        case .verifying: return 1.0
        case .completed: return 1.0
        case .failed: return 0
        }
    }

    var isActive: Bool {
        switch self {
        case .inProgress, .paused, .verifying: return true
        case .notStarted, .completed, .failed: return false
        }
    }
}

struct ModelDownload: Identifiable, Hashable {
    let id: UUID
    let model: ModelMetadata
    var state: DownloadState
    var startedAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        model: ModelMetadata,
        state: DownloadState = .notStarted,
        startedAt: Date = .init(),
        updatedAt: Date = .init()
    ) {
        self.id = id
        self.model = model
        self.state = state
        self.startedAt = startedAt
        self.updatedAt = updatedAt
    }
}

enum DownloadError: Error, Equatable {
    case network
    case checksumMismatch
    case permissionDenied
    case cancelled
    case unknown

    var localizedDescription: String {
        switch self {
        case .network: return "Network error. Check your connection and try again."
        case .checksumMismatch: return "File integrity check failed. The downloaded file may be corrupted."
        case .permissionDenied: return "Permission denied while saving the download."
        case .cancelled: return "Download cancelled."
        case .unknown: return "Unknown error occurred during download."
        }
    }
}
