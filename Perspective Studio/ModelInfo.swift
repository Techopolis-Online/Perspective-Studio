import Foundation

struct ModelInfo: Identifiable, Hashable {
    let id: String
    let owner: String
    let name: String
    let likes: Int
    let downloads: Int
    let pipelineTag: String?
    let libraryName: String?
    let tags: [String]
    let lastModified: Date?
    let createdAt: Date?
    let isGated: Bool

    var fullName: String { id }
    var primaryTag: String? { pipelineTag ?? tags.first }
}
