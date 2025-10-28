import Foundation

enum HuggingFaceClientError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case decodingFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Could not build the Hugging Face API request."
        case .invalidResponse:
            return "Received an unexpected response from the Hugging Face API."
        case .httpError(let statusCode):
            return "The Hugging Face API returned an error (status code \(statusCode))."
        case .decodingFailed(let underlying):
            return "Failed to decode models from the Hugging Face API: \(underlying.localizedDescription)"
        }
    }
}

struct HuggingFaceModel: Decodable {
    let modelId: String
    let author: String?
    let likes: Int?
    let downloads: Int?
    let pipelineTag: String?
    let libraryName: String?
    let tags: [String]?
    let isPrivate: Bool
    let lastModified: Date?
    let createdAt: Date?
    let gated: Bool?

    private enum CodingKeys: String, CodingKey {
        case modelId
        case author
        case likes
        case downloads
        case pipelineTag = "pipeline_tag"
        case libraryName = "library_name"
        case tags
        case isPrivate = "private"
        case lastModified
        case createdAt
        case gated
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        modelId = try container.decode(String.self, forKey: .modelId)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        likes = try container.decodeIfPresent(Int.self, forKey: .likes)
        downloads = try container.decodeIfPresent(Int.self, forKey: .downloads)
        pipelineTag = try container.decodeIfPresent(String.self, forKey: .pipelineTag)
        libraryName = try container.decodeIfPresent(String.self, forKey: .libraryName)
        tags = try container.decodeIfPresent([String].self, forKey: .tags)
        isPrivate = try container.decodeIfPresent(Bool.self, forKey: .isPrivate) ?? false
        lastModified = try container.decodeIfPresent(Date.self, forKey: .lastModified)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        gated = try container.decodeIfPresent(Bool.self, forKey: .gated)
    }
}

struct HuggingFaceClient {
    enum SortOption: String {
        case downloads
        case likes
        case lastModified
        case trendingScore = "trending"
        case recentlyCreated = "createdAt"
    }

    static let shared = HuggingFaceClient()

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func fetchModels(limit: Int = 200, sort: SortOption = .downloads, searchQuery: String? = nil) async throws -> [HuggingFaceModel] {
        var components = URLComponents(string: "https://huggingface.co/api/models")
        let resolvedLimit = max(1, min(limit, 500))
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: "\(resolvedLimit)"),
            URLQueryItem(name: "sort", value: sort.rawValue),
            URLQueryItem(name: "direction", value: "-1")
        ]
        if let searchQuery, !searchQuery.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: searchQuery))
        }
        // Including config helps capture metadata like library and pipeline tags without the heavy siblings payload.
        queryItems.append(URLQueryItem(name: "config", value: "true"))
        queryItems.append(URLQueryItem(name: "full", value: "0"))
        components?.queryItems = queryItems

        guard let url = components?.url else {
            throw HuggingFaceClientError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HuggingFaceClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw HuggingFaceClientError.httpError(statusCode: httpResponse.statusCode)
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom(Self.decodeISO8601Date)
            return try decoder.decode([HuggingFaceModel].self, from: data)
        } catch {
            throw HuggingFaceClientError.decodingFailed(underlying: error)
        }
    }

    private static func decodeISO8601Date(from decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let dateString = try container.decode(String.self)
        if let date = Self.iso8601WithFractional.date(from: dateString) ?? Self.iso8601Plain.date(from: dateString) {
            return date
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date: \(dateString)")
    }

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
