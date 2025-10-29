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
    func refreshCatalog() async throws -> [ModelMetadata]
    func importModel(from url: URL) async throws -> ModelMetadata
}

final class ModelCatalogService: ModelCatalogServiceProtocol {
    private let storageURL: URL?
    private let networkService: NetworkService
    private let catalogURL: URL?

    init(
        storageURL: URL? = try? FileManager.default
            .url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            .appendingPathComponent("Perspective Studio/catalog.json"),
        catalogURL: URL? = URL(string: "https://api.github.com/repos/Techopolis-Online/Perspective-Studio/contents/catalog.json"),
        networkService: NetworkService = .shared
    ) {
        self.storageURL = storageURL
        self.catalogURL = catalogURL
        self.networkService = networkService
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

    func refreshCatalog() async throws -> [ModelMetadata] {
        // Check network connectivity
        guard networkService.isConnected else {
            NSLog("Network not available, using cached catalog")
            // Return cached catalog if available
            return loadInitialCatalog()
        }
        
        // Try to fetch from remote catalog
        if let catalogURL = catalogURL {
            do {
                NSLog("Fetching model catalog from remote source...")
                let data = try await networkService.performRequest(url: catalogURL, maxRetries: 3, timeout: 30)
                
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                
                // Try to decode as array directly
                if let catalog = try? decoder.decode([ModelMetadata].self, from: data) {
                    NSLog("Successfully fetched catalog with \(catalog.count) models")
                    await persistCatalog(catalog)
                    return catalog
                }
                
                // If that fails, try to decode GitHub API response structure
                if let jsonObject = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let content = jsonObject["content"] as? String,
                   let decodedData = Data(base64Encoded: content.replacingOccurrences(of: "\n", with: "")),
                   let catalog = try? decoder.decode([ModelMetadata].self, from: decodedData) {
                    NSLog("Successfully fetched catalog from GitHub API with \(catalog.count) models")
                    await persistCatalog(catalog)
                    return catalog
                }
                
                NSLog("Failed to parse catalog data, using placeholder")
            } catch let error as NetworkError {
                NSLog("Network error fetching catalog: \(error.localizedDescription)")
                throw error
            } catch {
                NSLog("Unexpected error fetching catalog: \(error.localizedDescription)")
                throw NetworkError.from(error)
            }
        }
        
        // Fallback to placeholder catalog
        NSLog("Using placeholder catalog")
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
