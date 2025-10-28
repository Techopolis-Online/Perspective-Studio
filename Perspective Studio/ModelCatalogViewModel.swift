import Combine
import Foundation
import SwiftUI

@MainActor
final class ModelCatalogViewModel: ObservableObject {
    @Published private(set) var models: [ModelInfo] = []
    @Published private(set) var filteredModels: [ModelInfo] = []
    @Published var searchQuery: String = "" {
        didSet { applyFilters() }
    }
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let client: HuggingFaceClient
    private let recommendedDownloadsThreshold = 200_000
    private let recommendedLikesThreshold = 1_000

    init(client: HuggingFaceClient = .shared) {
        self.client = client
    }

    func loadInitialModels() async {
        guard models.isEmpty else { return }
        await refresh()
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let remoteModels = try await client.fetchModels(limit: 200, sort: .downloads)
            let mapped = remoteModels
                .filter { !$0.isPrivate }
                .map(Self.mapToModelInfo)
                .sorted { lhs, rhs in
                    if lhs.downloads == rhs.downloads {
                        return lhs.likes > rhs.likes
                    }
                    return lhs.downloads > rhs.downloads
                }
            models = mapped
            applyFilters()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func isRecommended(_ model: ModelInfo) -> Bool {
        model.downloads >= recommendedDownloadsThreshold || model.likes >= recommendedLikesThreshold
    }

    private func applyFilters() {
        let trimmedQuery = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            filteredModels = models
            return
        }

        let query = trimmedQuery.lowercased()
        filteredModels = models.filter { model in
            if model.fullName.lowercased().contains(query) { return true }
            if model.owner.lowercased().contains(query) { return true }
            if model.name.lowercased().contains(query) { return true }
            if model.pipelineTag?.lowercased().contains(query) == true { return true }
            if model.libraryName?.lowercased().contains(query) == true { return true }
            return model.tags.contains { $0.lowercased().contains(query) }
        }
    }

    private static func mapToModelInfo(_ remote: HuggingFaceModel) -> ModelInfo {
        let parts = remote.modelId.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: true)
        let owner = parts.first.map(String.init) ?? remote.author ?? "Unknown"
        let name = parts.count == 2 ? String(parts[1]) : remote.modelId

        return ModelInfo(
            id: remote.modelId,
            owner: owner,
            name: name,
            likes: remote.likes ?? 0,
            downloads: remote.downloads ?? 0,
            pipelineTag: remote.pipelineTag,
            libraryName: remote.libraryName,
            tags: remote.tags ?? [],
            lastModified: remote.lastModified,
            createdAt: remote.createdAt,
            isGated: remote.gated ?? false
        )
    }
}
