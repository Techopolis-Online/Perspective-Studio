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
    private let session: URLSession

    init(
        storageURL: URL? = try? FileManager.default
            .url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            .appendingPathComponent("Perspective Studio/catalog.json"),
        session: URLSession = ModelCatalogService.makeSession()
    ) {
        self.storageURL = storageURL
        self.session = session
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 120
        var headers = configuration.httpAdditionalHeaders ?? [:]
        headers["User-Agent"] = NetworkEnvironment.userAgent
        configuration.httpAdditionalHeaders = headers
        return URLSession(configuration: configuration)
    }

    private static func previewBody(_ data: Data) -> String? {
        guard !data.isEmpty, let raw = String(data: data, encoding: .utf8) else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let maxLength = 240
        if trimmed.count > maxLength {
            let index = trimmed.index(trimmed.startIndex, offsetBy: maxLength)
            return String(trimmed[..<index]) + "…"
        }
        return trimmed
    }

    private static func recommendedRam(forModelSize sizeBytes: Int64) -> Int {
        guard sizeBytes > 0 else { return 4 }
        let gibibytes = Double(sizeBytes) / Double(1_073_741_824)
        return max(4, Int(ceil(gibibytes) * 2))
    }

    private static func cleanDigest(_ digest: String?) -> String {
        guard let digest, !digest.isEmpty else { return "" }
        if digest.lowercased().hasPrefix("sha256:") {
            return String(digest.dropFirst("sha256:".count))
        }
        return digest
    }

    private static func parseOllamaIdentifier(_ identifier: String) -> (repositorySegments: [String], tag: String, baseName: String) {
        let parts = identifier.split(separator: ":")
        let repositoryPart = String(parts.first ?? Substring(identifier))
        let tag = parts.count > 1 ? parts.dropFirst().joined(separator: ":") : "latest"
        let baseSegments = repositoryPart.split(separator: "/").map(String.init)
        let repositorySegments: [String]
        if baseSegments.isEmpty {
            repositorySegments = ["library", repositoryPart]
        } else if baseSegments.count == 1 {
            repositorySegments = ["library", baseSegments[0]]
        } else {
            repositorySegments = baseSegments
        }
        let baseName = baseSegments.isEmpty ? repositoryPart : baseSegments.joined(separator: "/")
        return (repositorySegments, tag, baseName)
    }

    private static func displayName(forOllama identifier: String) -> String {
        let components = parseOllamaIdentifier(identifier)
        guard !components.baseName.isEmpty else { return identifier }
        return components.baseName
            .split(separator: "/")
            .map { component in
                component
                    .replacingOccurrences(of: "-", with: " ")
                    .replacingOccurrences(of: "_", with: " ")
                    .split(separator: " ")
                    .map { word in
                        guard let first = word.first else { return "" }
                        return String(first).uppercased() + word.dropFirst()
                    }
                    .joined(separator: " ")
            }
            .joined(separator: " / ")
    }

    private static func extractMetaDescription(from html: String) -> String? {
        guard let regex = try? NSRegularExpression(
            pattern: "<meta\\s+name=[\"']description[\"']\\s+content=[\"']([^\"']+)[\"']",
            options: [.caseInsensitive]
        ) else {
            return nil
        }
        let range = NSRange(html.startIndex..<html.endIndex, in: html)
        if let match = regex.firstMatch(in: html, options: [], range: range),
           match.numberOfRanges > 1,
           let descriptionRange = Range(match.range(at: 1), in: html) {
            return String(html[descriptionRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return nil
    }

    private static func makeOllamaURL(repositorySegments: [String], trailingSegments: [String]) -> URL? {
        var url = URL(string: "https://registry.ollama.ai")
        for segment in ["v2"] + repositorySegments + trailingSegments {
            url = url?.appendingPathComponent(segment)
        }
        return url
    }

    private static func ollamaTags(from config: OllamaConfig) -> [String] {
        var tags: [String] = []

        func appendUnique(_ value: String?) {
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return }
            if !tags.contains(value) {
                tags.append(value)
            }
        }

        appendUnique(config.modelType?.uppercased())
        appendUnique(config.fileType?.uppercased())
        appendUnique(config.modelFormat?.uppercased())

        if let families = config.modelFamilies, !families.isEmpty {
            for family in families {
                appendUnique(family.capitalized)
            }
        } else {
            appendUnique(config.modelFamily?.capitalized)
        }

        return tags
    }

    private static func makeHuggingFaceURL(parameters: [String: String]) -> URL? {
        var components = URLComponents(string: "https://huggingface.co/api/models")
        components?.queryItems = parameters
            .sorted(by: { $0.key < $1.key })
            .map { URLQueryItem(name: $0.key, value: $0.value) }
        return components?.url
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
            if let storageURL {
                try? FileManager.default.removeItem(at: storageURL)
            }
        }
        return ModelMetadata.placeholderCatalog
    }

    func refreshCatalog() async -> [ModelMetadata] {
        var aggregated: [ModelMetadata] = []

        do {
            let huggingFaceModels = try await fetchHuggingFaceModels(limit: 400)
            aggregated.append(contentsOf: huggingFaceModels)
            NSLog("Successfully fetched \(huggingFaceModels.count) models from Hugging Face")
        } catch let error as RemoteCatalogError {
            NSLog("Hugging Face catalog fetch failed: \(error.localizedDescription)")
        } catch {
            NSLog("Hugging Face catalog fetch failed: \(error.localizedDescription)")
        }

        do {
            let ollamaModels = try await fetchOllamaModels(limit: 60)
            aggregated.append(contentsOf: ollamaModels)
            NSLog("Successfully fetched \(ollamaModels.count) models from Ollama")
        } catch let error as RemoteCatalogError {
            NSLog("Ollama catalog fetch failed: \(error.localizedDescription)")
        } catch {
            NSLog("Ollama catalog fetch failed: \(error.localizedDescription)")
        }

        if aggregated.isEmpty {
            NSLog("Catalog refresh failed: remote sources returned empty results. Falling back to placeholder catalog.")
            await persistCatalog(ModelMetadata.placeholderCatalog)
            return ModelMetadata.placeholderCatalog
        }

        let deduped = deduplicate(aggregated)
        await persistCatalog(deduped)
        return deduped
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
            let parentDirectory = storageURL.deletingLastPathComponent()
            if !FileManager.default.fileExists(atPath: parentDirectory.path) {
                try FileManager.default.createDirectory(at: parentDirectory, withIntermediateDirectories: true)
            }

            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(catalog)
            try data.write(to: storageURL, options: .atomic)
        } catch {
            NSLog("Failed to persist catalog: \(error.localizedDescription)")
        }
    }

    private func deduplicate(_ models: [ModelMetadata]) -> [ModelMetadata] {
        var seen: Set<String> = []
        var result: [ModelMetadata] = []
        for model in models {
            guard !seen.contains(model.id) else { continue }
            seen.insert(model.id)
            result.append(model)
        }
        return result
    }

    private func fetchHuggingFaceModels(limit: Int) async throws -> [ModelMetadata] {
        guard limit > 0 else { return [] }

        struct HuggingFaceQuery {
            let label: String
            let parameters: [String: String]
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        let queries: [HuggingFaceQuery] = [
            .init(label: "top-downloads", parameters: [
                "sort": "downloads",
                "direction": "-1",
                "pipeline_tag": "text-generation",
                "full": "1"
            ]),
            .init(label: "trending", parameters: [
                "sort": "trending",
                "direction": "-1",
                "pipeline_tag": "text-generation",
                "full": "1"
            ]),
            .init(label: "gguf-filter", parameters: [
                "filter": "gguf",
                "pipeline_tag": "text-generation",
                "full": "1"
            ]),
            .init(label: "search-gguf", parameters: [
                "search": "GGUF",
                "pipeline_tag": "text-generation",
                "full": "1"
            ]),
            .init(label: "thebloke", parameters: [
                "author": "TheBloke",
                "sort": "downloads",
                "direction": "-1",
                "pipeline_tag": "text-generation",
                "full": "1"
            ]),
            .init(label: "lmstudio", parameters: [
                "author": "lmstudio-ai",
                "sort": "downloads",
                "direction": "-1",
                "pipeline_tag": "text-generation",
                "full": "1"
            ])
        ]

        var results: [ModelMetadata] = []
        var seenModelIDs: Set<String> = []

        for query in queries {
            var skip = 0

            while results.count < limit {
                let remaining = limit - results.count
                let pageSize = min(100, remaining)

                var parameters = query.parameters
                parameters["limit"] = "\(pageSize)"
                parameters["skip"] = "\(skip)"
                if parameters["full"] == nil {
                    parameters["full"] = "1"
                }

                guard let url = Self.makeHuggingFaceURL(parameters: parameters) else {
                    break
                }

                var request = URLRequest(url: url)
                request.timeoutInterval = 30
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                if let token = NetworkEnvironment.huggingFaceToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }

                let (data, response) = try await session.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw URLError(.badServerResponse)
                }
                guard (200..<300).contains(httpResponse.statusCode) else {
                    throw RemoteCatalogError.httpStatus(code: httpResponse.statusCode, bodySnippet: Self.previewBody(data))
                }

                let models = try decoder.decode([HuggingFaceModel].self, from: data)
                if models.isEmpty {
                    break
                }

                let startCount = results.count

                for model in models {
                    guard seenModelIDs.insert(model.id).inserted else { continue }
                    guard model.privateModel != true, model.gated != true else { continue }
                    guard let file = model.primaryFileCandidate else { continue }
                    guard let downloadURL = file.downloadURL(for: model.id), let size = file.sizeInBytes else { continue }

                    let recommendedRam = Self.recommendedRam(forModelSize: size)
                    let metadata = ModelMetadata(
                        id: model.id,
                        name: model.displayName,
                        version: model.revision ?? "latest",
                        sizeBytes: size,
                        quantized: QuantizationGuesser.quantization(from: file.rfilename ?? downloadURL.lastPathComponent),
                        recommendedRamGB: recommendedRam,
                        supportedRuntimes: [.llamaCpp, .ggml],
                        downloadURL: downloadURL,
                        sha256: file.sha256 ?? "",
                        provenance: .init(source: "huggingface", mirrorContact: nil),
                        tags: model.tags ?? [],
                        thumbnailSymbolName: ThumbnailPicker.symbol(for: model.tags ?? []),
                        host: .huggingFace,
                        sourceURL: URL(string: "https://huggingface.co/\(model.id)"),
                        summary: model.friendlySummary
                    )
                    results.append(metadata)

                    if results.count >= limit {
                        break
                    }
                }

                let addedAny = results.count > startCount

                if results.count >= limit {
                    break
                }

                skip += models.count
                if models.count < pageSize || !addedAny {
                    break
                }

                // Be courteous to Hugging Face if we need additional pages.
                try await Task.sleep(nanoseconds: 150_000_000)
            }

            if results.count >= limit {
                break
            }
        }

        return results
    }

    private func fetchOllamaModels(limit: Int) async throws -> [ModelMetadata] {
        guard let url = URL(string: "https://registry.ollama.ai/v1/models") else {
            return []
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw RemoteCatalogError.httpStatus(code: httpResponse.statusCode, bodySnippet: Self.previewBody(data))
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let list = try decoder.decode(OllamaListResponse.self, from: data)

        if list.data.isEmpty { return [] }

        var results: [ModelMetadata] = []
        for entry in list.data.prefix(limit) {
            do {
                if let metadata = try await makeOllamaMetadata(for: entry.id) {
                    results.append(metadata)
                }
            } catch let error as RemoteCatalogError {
                NSLog("Ollama catalog entry \(entry.id) failed: \(error.localizedDescription)")
            } catch {
                NSLog("Ollama catalog entry \(entry.id) failed: \(error.localizedDescription)")
            }
        }

        return results
    }

    private func makeOllamaMetadata(for identifier: String) async throws -> ModelMetadata? {
        let components = Self.parseOllamaIdentifier(identifier)
        let manifest = try await fetchOllamaManifest(repositorySegments: components.repositorySegments, tag: components.tag)
        guard let modelLayer = manifest.layers.first(where: { $0.mediaType.contains("model") }) else { return nil }
        guard let downloadURL = Self.makeOllamaURL(repositorySegments: components.repositorySegments, trailingSegments: ["blobs", modelLayer.digest]) else { return nil }

        let config = try await fetchOllamaConfig(repositorySegments: components.repositorySegments, digest: manifest.config.digest)
        async let summaryTask = fetchOllamaSummary(for: components.baseName)

        let quantizationHint = config.fileType ?? identifier
        let tags = Self.ollamaTags(from: config)
        let metadata = ModelMetadata(
            id: "ollama/\(identifier)",
            name: Self.displayName(forOllama: identifier),
            version: components.tag,
            sizeBytes: modelLayer.size,
            quantized: QuantizationGuesser.quantization(from: quantizationHint),
            recommendedRamGB: Self.recommendedRam(forModelSize: modelLayer.size),
            supportedRuntimes: Set([ModelMetadata.Runtime.llamaCpp, .ggml]),
            downloadURL: downloadURL,
            sha256: Self.cleanDigest(modelLayer.digest),
            provenance: .init(source: "ollama", mirrorContact: nil),
            tags: tags,
            thumbnailSymbolName: ThumbnailPicker.symbol(for: tags),
            host: .ollama,
            sourceURL: makeOllamaSourceURL(baseName: components.baseName),
            summary: await summaryTask
        )
        return metadata
    }

    private func fetchOllamaManifest(repositorySegments: [String], tag: String) async throws -> OllamaManifest {
        guard let url = Self.makeOllamaURL(repositorySegments: repositorySegments, trailingSegments: ["manifests", tag]) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/vnd.oci.image.manifest.v1+json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw RemoteCatalogError.httpStatus(code: httpResponse.statusCode, bodySnippet: Self.previewBody(data))
        }

        let decoder = JSONDecoder()
        return try decoder.decode(OllamaManifest.self, from: data)
    }

    private func fetchOllamaConfig(repositorySegments: [String], digest: String) async throws -> OllamaConfig {
        guard !digest.isEmpty else { throw URLError(.badURL) }
        guard let url = Self.makeOllamaURL(repositorySegments: repositorySegments, trailingSegments: ["blobs", digest]) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/vnd.ollama.image.config.v1+json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw RemoteCatalogError.httpStatus(code: httpResponse.statusCode, bodySnippet: Self.previewBody(data))
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(OllamaConfig.self, from: data)
    }

    private func fetchOllamaSummary(for baseName: String) async -> String? {
        guard !baseName.isEmpty else { return nil }
        var url = URL(string: "https://ollama.com/library")
        for segment in baseName.split(separator: "/") {
            url = url?.appendingPathComponent(String(segment))
        }
        guard let finalURL = url else { return nil }

        var request = URLRequest(url: finalURL)
        request.timeoutInterval = 20
        request.setValue("text/html,application/xhtml+xml", forHTTPHeaderField: "Accept")
        request.setValue(NetworkEnvironment.userAgent, forHTTPHeaderField: "User-Agent")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
                return nil
            }
            guard let html = String(data: data, encoding: .utf8) else { return nil }
            return Self.extractMetaDescription(from: html)
        } catch {
            NSLog("Ollama summary fetch failed for \(baseName): \(error.localizedDescription)")
            return nil
        }
    }

    private func makeOllamaSourceURL(baseName: String) -> URL? {
        guard !baseName.isEmpty else { return nil }
        var url = URL(string: "https://ollama.com/library")
        for segment in baseName.split(separator: "/") {
            url = url?.appendingPathComponent(String(segment))
        }
        return url
    }
}

// MARK: - Remote Catalog Models

private struct HuggingFaceModel: Decodable {
    let id: String
    let gated: Bool?
    let privateModel: Bool?
    let tags: [String]?
    let downloads: Int?
    let siblings: [HuggingFaceSibling]?
    let sha: String?
    let revision: String?
    let cardData: HuggingFaceCardData?
    let modelCardData: HuggingFaceCardData?
    let description: String?

    enum CodingKeys: String, CodingKey {
        case id
        case gated
        case privateModel = "private"
        case tags
        case downloads
        case siblings
        case sha
        case revision
        case cardData
        case modelCardData
        case description
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        gated = container.decodeLossyBoolIfPresent(forKey: .gated)
        privateModel = container.decodeLossyBoolIfPresent(forKey: .privateModel)
        tags = try container.decodeIfPresent([String].self, forKey: .tags)
        downloads = try container.decodeIfPresent(Int.self, forKey: .downloads)
        siblings = try container.decodeIfPresent([HuggingFaceSibling].self, forKey: .siblings)
        sha = try container.decodeIfPresent(String.self, forKey: .sha)
        revision = try container.decodeIfPresent(String.self, forKey: .revision)
        cardData = try container.decodeIfPresent(HuggingFaceCardData.self, forKey: .cardData)
        modelCardData = try container.decodeIfPresent(HuggingFaceCardData.self, forKey: .modelCardData)
        description = try container.decodeIfPresent(String.self, forKey: .description)
    }

    var displayName: String {
        id.components(separatedBy: "/").last ?? id
    }

    var primaryFileCandidate: HuggingFaceSibling? {
        let preferredExtensions = [
            ".gguf",
            ".ggml",
            ".safetensors",
            ".bin",
            ".pt",
            ".onnx"
        ]
        guard let siblings else { return nil }

        if let match = siblings
            .filter({ sibling in
                guard let filename = sibling.rfilename?.lowercased() else { return false }
                return preferredExtensions.contains(where: { filename.hasSuffix($0) })
            })
            .sorted(by: { ($0.sizeInBytes ?? Int64.max) < ($1.sizeInBytes ?? Int64.max) })
            .first {
            return match
        }
        return siblings
            .sorted(by: { ($0.sizeInBytes ?? Int64.max) < ($1.sizeInBytes ?? Int64.max) })
            .first
    }

    var friendlySummary: String? {
        cardData?.summary ?? modelCardData?.summary ?? description
    }
}

private struct HuggingFaceCardData: Decodable {
    let summary: String?
}

private struct HuggingFaceSibling: Decodable {
    let rfilename: String?
    private let sizeValue: Int64?
    private let lfsInfo: LFSInfo?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        rfilename = try container.decodeIfPresent(String.self, forKey: .rfilename)
        sizeValue = container.decodeLossyInt64IfPresent(forKey: .size)
        lfsInfo = try container.decodeIfPresent(LFSInfo.self, forKey: .lfs)
    }

    private enum CodingKeys: String, CodingKey {
        case rfilename
        case size
        case lfs
    }

    struct LFSInfo: Decodable {
        let oid: String?
        let size: Int64?

        init(from decoder: Decoder) throws {
            if let container = try? decoder.container(keyedBy: CodingKeys.self) {
                oid = try container.decodeIfPresent(String.self, forKey: .oid)
                size = container.decodeLossyInt64IfPresent(forKey: .size)
                return
            }

            let single = try decoder.singleValueContainer()
            if single.decodeNil() || (try? single.decode(Bool.self)) != nil {
                oid = nil
                size = nil
                return
            }

            throw DecodingError.dataCorruptedError(in: single, debugDescription: "Unexpected LFS payload")
        }

        private enum CodingKeys: String, CodingKey {
            case oid
            case size
        }
    }

    var sizeInBytes: Int64? {
        if let lfsSize = lfsInfo?.size { return lfsSize }
        return sizeValue
    }

    var sha256: String? {
        guard let value = lfsInfo?.oid else { return nil }
        if value.hasPrefix("sha256:") {
            return String(value.dropFirst("sha256:".count))
        }
        return value
    }

    func downloadURL(for modelId: String) -> URL? {
        guard let filename = rfilename else { return nil }
        let encodedFilename = filename.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? filename
        let escapedModelId = modelId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? modelId
        let urlString = "https://huggingface.co/\(escapedModelId)/resolve/main/\(encodedFilename)?download=1"
        return URL(string: urlString)
    }
}


private struct OllamaListResponse: Decodable {
    struct Entry: Decodable {
        let id: String
    }

    let data: [Entry]
}

private struct OllamaManifest: Decodable {
    struct Config: Decodable {
        let mediaType: String
        let digest: String
        let size: Int
    }

    struct Layer: Decodable {
        let mediaType: String
        let digest: String
        let size: Int64
    }

    let schemaVersion: Int
    let mediaType: String
    let config: Config
    let layers: [Layer]
}

private struct OllamaConfig: Decodable {
    let modelFormat: String?
    let modelFamily: String?
    let modelFamilies: [String]?
    let modelType: String?
    let fileType: String?
}


private enum QuantizationGuesser {
    static func quantization(from filename: String) -> ModelMetadata.Quantization {
        let lower = filename.lowercased()
        if lower.contains("q4_0") { return .q4_0 }
        if lower.contains("q4_1") { return .q4_1 }
        if lower.contains("q5_0") { return .q5_0 }
        if lower.contains("q6_0") { return .q6_0 }
        if lower.contains("q8_0") { return .q8_0 }
        if lower.contains("fp16") || lower.contains("f16") { return .fp16 }
        return .unknown
    }
}

private enum ThumbnailPicker {
    static func symbol(for tags: [String]) -> String {
        let lowerTags = tags.map { $0.lowercased() }
        if lowerTags.contains(where: { $0.contains("vision") || $0.contains("multimodal") }) {
            return "eye"
        }
        if lowerTags.contains(where: { $0.contains("code") || $0.contains("program") }) {
            return "chevron.left.forwardslash.chevron.right"
        }
        if lowerTags.contains(where: { $0.contains("assistant") }) {
            return "sparkles"
        }
        if lowerTags.contains(where: { $0.contains("chat") || $0.contains("conversation") }) {
            return "bubble.left.and.bubble.right"
        }
        return "sparkles"
    }
}

private enum RemoteCatalogError: LocalizedError {
    case httpStatus(code: Int, bodySnippet: String?)

    var errorDescription: String? {
        switch self {
        case let .httpStatus(code, snippet):
            if let snippet, !snippet.isEmpty {
                return "HTTP \(code): \(snippet)"
            }
            return "HTTP \(code) response from remote catalog."
        }
    }
}

enum NetworkEnvironment {
    private static let huggingFaceTokenKeys = [
        "PERSPECTIVE_STUDIO_HF_TOKEN",
        "HF_API_TOKEN",
        "HF_TOKEN",
        "HUGGING_FACE_TOKEN"
    ]

    static var huggingFaceToken: String? {
        let env = ProcessInfo.processInfo.environment
        for key in huggingFaceTokenKeys {
            if let value = env[key]?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty {
                return value
            }
        }
        return nil
    }

    static var userAgent: String {
        let os = ProcessInfo.processInfo.operatingSystemVersionString
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            ?? bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String
            ?? "dev"
        return "Perspective Studio/\(version) (macOS; \(os); contact: support@techopolisonline.com)"
    }
}

private extension KeyedDecodingContainer where Key: CodingKey {
    func decodeLossyBoolIfPresent(forKey key: Key) -> Bool? {
        guard contains(key) else { return nil }
        if let value = try? decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return value != 0
        }
        if let value = try? decode(Double.self, forKey: key) {
            return value != 0
        }
        if let value = try? decode(String.self, forKey: key) {
            let lowered = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["true", "yes", "y", "1"].contains(lowered) { return true }
            if ["false", "no", "n", "0"].contains(lowered) { return false }
        }
        return nil
    }

    func decodeLossyInt64IfPresent(forKey key: Key) -> Int64? {
        guard contains(key) else { return nil }
        if let value = try? decode(Int64.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return Int64(value)
        }
        if let value = try? decode(Double.self, forKey: key) {
            return Int64(value)
        }
        if let value = try? decode(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if let direct = Int64(trimmed) {
                return direct
            }
            let digits = trimmed.compactMap { $0.wholeNumberValue }.map { String($0) }.joined()
            if !digits.isEmpty {
                return Int64(digits)
            }
        }
        return nil
    }
}
