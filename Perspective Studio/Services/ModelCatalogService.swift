//
//  ModelCatalogService.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

protocol ModelCatalogServiceProtocol {
    func loadInitialCatalog() -> [ModelMetadata]
    func refreshCatalog() async -> [ModelMetadata]
    func importModel(from url: URL) async throws -> ModelMetadata
}

final class ModelCatalogService: ModelCatalogServiceProtocol {
    private let storageURL: URL?

    init(storageURL: URL? = try? FileManager.default
        .url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        .appendingPathComponent("Perspective Studio/catalog.json")
    ) {
        self.storageURL = storageURL
    }

    func loadInitialCatalog() -> [ModelMetadata] {
        do {
            if let storageURL,
               FileManager.default.fileExists(atPath: storageURL.path) {
                let data = try Data(contentsOf: storageURL)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode([ModelMetadata].self, from: data)
            }
        } catch {
            NSLog("Failed to load catalog: \(error.localizedDescription)")
        }
        return ModelMetadata.placeholderCatalog
    }

    func refreshCatalog() async -> [ModelMetadata] {
        // TODO: integrate with remote catalog source once available.
        await persistCatalog(ModelMetadata.placeholderCatalog)
        return ModelMetadata.placeholderCatalog
    }

    func importModel(from url: URL) async throws -> ModelMetadata {
        // TODO: implement metadata extraction from user-provided file.
        throw NSError(domain: "ModelCatalogService", code: -1, userInfo: [
            NSLocalizedDescriptionKey: "User-import flow not yet implemented."
        ])
    }

    private func persistCatalog(_ catalog: [ModelMetadata]) async {
        guard let storageURL else { return }
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(catalog)
            try data.write(to: storageURL, options: .atomic)
        } catch {
            NSLog("Failed to persist catalog: \(error.localizedDescription)")
        }
    }
}
