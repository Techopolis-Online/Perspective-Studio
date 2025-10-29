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
        do {
            var aggregated: [ModelMetadata] = []
            async let huggingFace = fetchHuggingFaceModels(limit: 60)
            async let ollama = fetchOllamaModels(limit: 40)
            let (hfResults, ollamaResults) = try await (huggingFace, ollama)
            aggregated.append(contentsOf: hfResults)
            aggregated.append(contentsOf: ollamaResults)

            if aggregated.isEmpty {
                aggregated = ModelMetadata.placeholderCatalog
            } else {
                aggregated = deduplicate(aggregated)
            }

            await persistCatalog(aggregated)
            return aggregated
        } catch let error as RemoteCatalogError {
            NSLog("Catalog refresh failed: \(error.localizedDescription)")
            await persistCatalog(ModelMetadata.placeholderCatalog)
            return ModelMetadata.placeholderCatalog
        } catch {
            NSLog("Catalog refresh failed: \(error.localizedDescription)")
            await persistCatalog(ModelMetadata.placeholderCatalog)
            return ModelMetadata.placeholderCatalog
        }
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
        guard let url = URL(string: "https://huggingface.co/api/models?sort=downloads&direction=-1&limit=\(limit)&full=1&pipeline_tag=text-generation") else {
            return []
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

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let models = try decoder.decode([HuggingFaceModel].self, from: data)

        var results: [ModelMetadata] = []
        for model in models {
            guard model.privateModel != true, model.gated != true else { continue }
            guard let file = model.primaryFileCandidate else { continue }
            guard let downloadURL = file.downloadURL(for: model.id), let size = file.sizeInBytes else { continue }

            let recommendedRam = max(4, Int(ceil(Double(size) / Double(1_073_741_824)) * 2))
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
        }

        return results
    }

    private func fetchOllamaModels(limit: Int) async throws -> [ModelMetadata] {
        guard let url = URL(string: "https://ollama.com/library.json") else { return [] }
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let payload = try decoder.decode(OllamaLibrary.self, from: data)

        var results: [ModelMetadata] = []
        for model in payload.models.prefix(limit) {
            let sizeBytes = model.sizeBytes ?? (model.approximateSizeBytes ?? 0)
            guard sizeBytes > 0 else { continue }
            let recommendedRam = max(4, Int(ceil(Double(sizeBytes) / Double(1_073_741_824)) * 2))
            let identifier = model.identifier
            let downloadURL = model.downloadURL

            let metadata = ModelMetadata(
                id: identifier,
                name: model.displayName,
                version: model.version ?? "latest",
                sizeBytes: sizeBytes,
                quantized: QuantizationGuesser.quantization(from: downloadURL.lastPathComponent),
                recommendedRamGB: recommendedRam,
                supportedRuntimes: [.llamaCpp, .ggml],
                downloadURL: downloadURL,
                sha256: "",
                provenance: .init(source: "ollama", mirrorContact: nil),
                tags: model.tags ?? [],
                thumbnailSymbolName: ThumbnailPicker.symbol(for: model.tags ?? []),
                host: .ollama,
                sourceURL: URL(string: "https://ollama.com/library/\(identifier)"),
                summary: model.friendlySummary
            )
            results.append(metadata)
        }

        return results
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
        let preferredExtensions = [".gguf", ".bin", ".pt"]
        return siblings?
            .filter { sibling in
                guard let filename = sibling.rfilename?.lowercased() else { return false }
                return preferredExtensions.contains(where: { filename.hasSuffix($0) })
            }
            .sorted { ($0.sizeInBytes ?? 0) < ($1.sizeInBytes ?? 0) }
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

private struct OllamaLibrary: Decodable {
    let models: [OllamaModel]
}

private struct OllamaModel: Decodable {
    let name: String
    let description: String?
    let updatedAt: String?
    let size: String?
    let sizeBytes: Int64?
    let downloads: Int?
    let tags: [String]?
    let version: String?

    var identifier: String { name }

    var displayName: String {
        name.components(separatedBy: "/").last ?? name
    }

    var downloadURL: URL {
        if let url = URL(string: "https://ollama.com/library/\(identifier)/download") {
            return url
        }
        return URL(string: "https://ollama.com/library/\(identifier)")!
    }

    var approximateSizeBytes: Int64? {
        guard let size else { return nil }
        let trimmed = size.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let numberCharacters = CharacterSet(charactersIn: "0123456789.")
        let numericString = trimmed.unicodeScalars
            .filter { numberCharacters.contains($0) }
            .map { String($0) }
            .joined()
        guard let value = Double(numericString) else { return nil }

        let unit: Double
        if trimmed.contains("mb") {
            unit = 1_048_576
        } else if trimmed.contains("kb") {
            unit = 1_024
        } else {
            unit = 1_073_741_824
        }
        return Int64(value * unit)
    }

    var friendlySummary: String? {
        description
    }
}

private enum QuantizationGuesser {
    static func quantization(from filename: String) -> ModelMetadata.Quantization {
        let lower = filename.lowercased()
        if lower.contains("q4") { return .q4_0 }
        if lower.contains("q5") { return .q5_0 }
        if lower.contains("q6") { return .q6_0 }
        if lower.contains("q8") { return .q8_0 }
        if lower.contains("fp16") { return .fp16 }
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
