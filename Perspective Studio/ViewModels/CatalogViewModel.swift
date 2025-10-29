//
//  CatalogViewModel.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

@MainActor
final class CatalogViewModel: ObservableObject {
    @Published var searchText: String = ""
    @Published var filterRuntime: ModelMetadata.Runtime?
    @Published var selectedTag: String?
    @Published var selectedHost: ModelMetadata.HostProvider?
    @Published var compatibilityFilter: CompatibilityFilter = .all
    @Published var models: [ModelMetadata]
    @Published var isRefreshing: Bool = false
    @Published var lastError: NetworkError?

    private let catalogService: ModelCatalogServiceProtocol
    private let appViewModel: AppViewModel
    private var cancellables = Set<AnyCancellable>()

    init(
        catalogService: ModelCatalogServiceProtocol = ModelCatalogService(),
        appViewModel: AppViewModel
    ) {
        self.catalogService = catalogService
        self.appViewModel = appViewModel
        self.models = appViewModel.catalog

        observeCatalog()
    }

    var availableTags: [String] {
        let tags = models.flatMap { $0.tags }
        let unique = Set(tags)
        return unique.sorted()
    }

    var filteredModels: [ModelMetadata] {
        models.filter { model in
            let matchesSearch = searchText.isEmpty
                || model.name.localizedCaseInsensitiveContains(searchText)
                || model.tags.contains(where: { $0.localizedCaseInsensitiveContains(searchText) })
            let matchesRuntime = filterRuntime.map { model.supportedRuntimes.contains($0) } ?? true
            let matchesTag = selectedTag.map { selected in
                model.tags.contains(where: { $0.caseInsensitiveCompare(selected) == .orderedSame })
            } ?? true
            let matchesHost = selectedHost.map { model.host == $0 } ?? true
            let matchesCompatibility: Bool
            switch compatibilityFilter {
            case .all:
                matchesCompatibility = true
            case .recommended:
                matchesCompatibility = model.compatibility(for: appViewModel.systemInfo) == .compatible
            case .needsMoreMemory:
                matchesCompatibility = model.compatibility(for: appViewModel.systemInfo) == .needsMoreMemory
            }

            return matchesSearch && matchesRuntime && matchesTag && matchesHost && matchesCompatibility
        }
    }

    func refresh() {
        isRefreshing = true
        lastError = nil
        
        Task {
            do {
                let catalog = try await catalogService.refreshCatalog()
                await MainActor.run {
                    models = catalog
                    isRefreshing = false
                    VoiceOverAnnouncer.announce("Catalog refreshed with \(catalog.count) models.")
                }
            } catch let error as NetworkError {
                await MainActor.run {
                    lastError = error
                    isRefreshing = false
                    VoiceOverAnnouncer.announce("Catalog refresh failed: \(error.errorDescription ?? "Unknown error")")
                }
            } catch {
                await MainActor.run {
                    lastError = NetworkError.from(error)
                    isRefreshing = false
                    VoiceOverAnnouncer.announce("Catalog refresh failed.")
                }
            }
        }
    }
    
    func dismissError() {
        lastError = nil
    }

    func startDownload(_ model: ModelMetadata) {
        appViewModel.startDownload(for: model)
    }

    func selectPreferred(model: ModelMetadata) {
        appViewModel.setPreferredModel(model)
        VoiceOverAnnouncer.announce("\(model.name) set as preferred model.")
    }

    private func observeCatalog() {
        appViewModel.$catalog
            .receive(on: DispatchQueue.main)
            .sink { [weak self] newCatalog in
                self?.models = newCatalog
            }
            .store(in: &cancellables)
    }
}

extension CatalogViewModel {
    enum CompatibilityFilter: String, CaseIterable, Identifiable {
        case all
        case recommended
        case needsMoreMemory

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .all: return "All"
            case .recommended: return "Works well"
            case .needsMoreMemory: return "Needs more RAM"
            }
        }
    }
}
