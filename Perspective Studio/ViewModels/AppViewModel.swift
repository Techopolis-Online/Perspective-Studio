//
//  AppViewModel.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation
import SwiftUI

enum AppPhase {
    case onboarding
    case ready
}

/// Root state container shared across the application.
@MainActor
final class AppViewModel: ObservableObject {
    @Published var phase: AppPhase
    @Published var userSettings: UserSettings
    @Published var catalog: [ModelMetadata]
    @Published var downloads: [ModelDownload] = []
    @Published var activeChatSession: ChatSession = .sample
    @Published var recentlyUsedModels: [ModelMetadata] = []
    @Published var showKeyboardShortcuts: Bool = false
    @Published var selectedDestination: SidebarDestination? = .catalog

    let systemInfo: SystemInfo

    private let defaults = UserDefaults.standard
    private enum StorageKeys {
        static let hasCompletedOnboarding = "PerspectiveStudio.hasCompletedOnboarding"
        static let experienceLevel = "PerspectiveStudio.experienceLevel"
        static let preferredModelID = "PerspectiveStudio.preferredModelID"
    }

    private let catalogService: ModelCatalogServiceProtocol
    private let downloadManager: DownloadManaging
    private let runtimeManager: RuntimeManaging

    init(
        phase: AppPhase = .onboarding,
        userSettings: UserSettings = .init(),
        catalogService: ModelCatalogServiceProtocol = ModelCatalogService(),
        downloadManager: DownloadManaging = DownloadManager.shared,
        runtimeManager: RuntimeManaging = RuntimeManager.shared
    ) {
        self.phase = phase
        self.userSettings = userSettings
        self.catalogService = catalogService
        self.downloadManager = downloadManager
        self.runtimeManager = runtimeManager
        self.catalog = catalogService.loadInitialCatalog()
        self.systemInfo = SystemInfo.current

        restorePersistedState()
        observeDownloads()
    }

    func completeOnboarding() {
        withAnimation {
            phase = .ready
            selectedDestination = .catalog
        }
        defaults.set(true, forKey: StorageKeys.hasCompletedOnboarding)
    }

    func updateExperienceLevel(_ level: UserSettings.ExperienceLevel) {
        userSettings.experienceLevel = level
        defaults.set(level.rawValue, forKey: StorageKeys.experienceLevel)
    }

    func setPreferredModel(_ model: ModelMetadata) {
        userSettings.preferredModelID = model.id
        if !recentlyUsedModels.contains(model) {
            recentlyUsedModels.insert(model, at: 0)
        }
        defaults.set(model.id, forKey: StorageKeys.preferredModelID)
    }

    func refreshCatalog() {
        Task {
            let entries = await catalogService.refreshCatalog()
            await MainActor.run {
                catalog = entries
            }
        }
    }

    func presentKeyboardShortcuts() {
        showKeyboardShortcuts = true
    }

    func startDownload(for model: ModelMetadata) {
        downloadManager.enqueueDownload(model)
    }

    func pauseDownload(_ download: ModelDownload) {
        downloadManager.pause(download)
    }

    func resumeDownload(_ download: ModelDownload) {
        downloadManager.resume(download)
    }

    func cancelDownload(_ download: ModelDownload) {
        downloadManager.cancel(download)
    }

    private func observeDownloads() {
        downloadManager.downloadsPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$downloads)
    }

    private func restorePersistedState() {
        if let storedLevel = defaults.string(forKey: StorageKeys.experienceLevel),
           let level = UserSettings.ExperienceLevel(rawValue: storedLevel) {
            userSettings.experienceLevel = level
        }

        if let storedModelID = defaults.string(forKey: StorageKeys.preferredModelID) {
            userSettings.preferredModelID = storedModelID
        }

        if defaults.bool(forKey: StorageKeys.hasCompletedOnboarding) {
            phase = .ready
            selectedDestination = .catalog
        }
    }
}
