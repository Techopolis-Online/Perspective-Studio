//
//  ModelMetadata.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

/// Represents a downloadable or user-imported model entry in the catalog.
struct ModelMetadata: Identifiable, Codable, Hashable {
    enum Quantization: String, Codable {
        case q4_0 = "q4_0"
        case q4_1 = "q4_1"
        case q5_0 = "q5_0"
        case q6_0 = "q6_0"
        case q8_0 = "q8_0"
        case fp16 = "fp16"
        case unknown
    }

    enum Runtime: String, Codable, CaseIterable, Hashable {
        case llamaCpp = "llama.cpp"
        case ggml = "ggml"
        case onnx = "onnx"
        case custom = "custom"
    }

    enum HostProvider: String, Codable, CaseIterable, Hashable {
        case ollama = "ollama.com"
        case huggingFace = "huggingface.co"
        case community = "community"
        case other = "other"

        var displayName: String {
            switch self {
            case .ollama: return "Ollama"
            case .huggingFace: return "Hugging Face"
            case .community: return "Community"
            case .other: return "Other"
            }
        }

        var iconSystemName: String {
            switch self {
            case .ollama: return "o.circle.fill"
            case .huggingFace: return "face.smiling"
            case .community: return "person.3.fill"
            case .other: return "globe"
            }
        }
    }

    struct Provenance: Codable, Hashable {
        var source: String
        var mirrorContact: String?
    }

    let id: String
    var name: String
    var version: String
    var sizeBytes: Int64
    var quantized: Quantization
    var recommendedRamGB: Int
    var supportedRuntimes: Set<Runtime>
    var downloadURL: URL
    var sha256: String
    var provenance: Provenance
    var tags: [String] = []
    var thumbnailSymbolName: String = "sparkles"
    var host: HostProvider = .other
    var sourceURL: URL?

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .binary)
    }

    var formattedRecommendedRAM: String {
        "\(recommendedRamGB) GB RAM"
    }

    var memorySummary: String {
        "\(recommendedRamGB) GB recommended"
    }

    func isRecommended(for systemInfo: SystemInfo) -> Bool {
        systemInfo.totalMemoryGigabytesRounded >= recommendedRamGB
    }

    func compatibility(for systemInfo: SystemInfo) -> ModelCompatibilityStatus {
        isRecommended(for: systemInfo) ? .compatible : .needsMoreMemory
    }
}

enum ModelCompatibilityStatus: String, Codable {
    case compatible
    case needsMoreMemory

    var message: String {
        switch self {
        case .compatible: return "Runs great on your device"
        case .needsMoreMemory: return "May need more RAM"
        }
    }

    var iconSystemName: String {
        switch self {
        case .compatible: return "checkmark.circle.fill"
        case .needsMoreMemory: return "exclamationmark.triangle.fill"
        }
    }
}

extension ModelMetadata {
    static let placeholderCatalog: [ModelMetadata] = [
        ModelMetadata(
            id: "llama-3-8b-q4",
            name: "Llama 3 8B Instruct",
            version: "1.1",
            sizeBytes: 4_800_000_000,
            quantized: .q4_1,
            recommendedRamGB: 12,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://ollama.com/library/llama3")!,
            sha256: String(repeating: "0", count: 64),
            provenance: .init(source: "meta", mirrorContact: "ops@ollama.com"),
            tags: ["Featured", "Chat", "Balanced"],
            thumbnailSymbolName: "sparkles",
            host: .ollama,
            sourceURL: URL(string: "https://ollama.com/library/llama3")
        ),
        ModelMetadata(
            id: "vicuna-13b-v1",
            name: "Vicuna 13B",
            version: "1.5",
            sizeBytes: 13_000_000_000,
            quantized: .q6_0,
            recommendedRamGB: 24,
            supportedRuntimes: [.llamaCpp, .ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/lmsys/vicuna-13b-v1.5-16k-GGUF")!,
            sha256: String(repeating: "f", count: 64),
            provenance: .init(source: "lmsys", mirrorContact: nil),
            tags: ["Research", "Extended"],
            thumbnailSymbolName: "brain.head.profile",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/lmsys/vicuna-13b-v1.5-16k-GGUF")
        ),
        ModelMetadata(
            id: "mistral-7b-int4",
            name: "Mistral 7B Instruct",
            version: "0.2",
            sizeBytes: 3_700_000_000,
            quantized: .q4_0,
            recommendedRamGB: 8,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://ollama.com/library/mistral")!,
            sha256: String(repeating: "a", count: 64),
            provenance: .init(source: "mistral.ai", mirrorContact: nil),
            tags: ["Lightweight", "Chat"],
            thumbnailSymbolName: "wind",
            host: .ollama,
            sourceURL: URL(string: "https://ollama.com/library/mistral")
        ),
        ModelMetadata(
            id: "phi-3-mini-4k",
            name: "Phi-3 Mini",
            version: "4K Instruct",
            sizeBytes: 2_200_000_000,
            quantized: .q4_1,
            recommendedRamGB: 6,
            supportedRuntimes: [.ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-GGUF")!,
            sha256: String(repeating: "b", count: 64),
            provenance: .init(source: "microsoft", mirrorContact: nil),
            tags: ["Lightweight", "Instruction"],
            thumbnailSymbolName: "text.book.closed",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-GGUF")
        ),
        ModelMetadata(
            id: "gemma-2-2b-it",
            name: "Gemma 2B",
            version: "Instruct",
            sizeBytes: 1_800_000_000,
            quantized: .q4_0,
            recommendedRamGB: 4,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/google/gemma-2b-it-GGUF")!,
            sha256: String(repeating: "c", count: 64),
            provenance: .init(source: "google", mirrorContact: nil),
            tags: ["Mobile", "Fast", "Chat"],
            thumbnailSymbolName: "globe.europe.africa.fill",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/google/gemma-2b-it-GGUF")
        ),
        ModelMetadata(
            id: "codellama-7b",
            name: "Code Llama 7B",
            version: "0.1",
            sizeBytes: 7_000_000_000,
            quantized: .q4_1,
            recommendedRamGB: 14,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://ollama.com/library/codellama")!,
            sha256: String(repeating: "d", count: 64),
            provenance: .init(source: "meta", mirrorContact: nil),
            tags: ["Coding", "Tools"],
            thumbnailSymbolName: "chevron.left.forwardslash.chevron.right",
            host: .ollama,
            sourceURL: URL(string: "https://ollama.com/library/codellama")
        ),
        ModelMetadata(
            id: "llava-1.5-7b",
            name: "LLaVA 1.5",
            version: "7B",
            sizeBytes: 7_600_000_000,
            quantized: .q4_1,
            recommendedRamGB: 16,
            supportedRuntimes: [.custom],
            downloadURL: URL(string: "https://huggingface.co/liuhaotian/llava-v1.5-7b-GGUF")!,
            sha256: String(repeating: "e", count: 64),
            provenance: .init(source: "research", mirrorContact: nil),
            tags: ["Vision", "Multimodal"],
            thumbnailSymbolName: "eye.circle.fill",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/liuhaotian/llava-v1.5-7b-GGUF")
        ),
        ModelMetadata(
            id: "qwen2-1.5b",
            name: "Qwen2 1.5B",
            version: "Instruction",
            sizeBytes: 1_400_000_000,
            quantized: .q4_0,
            recommendedRamGB: 4,
            supportedRuntimes: [.ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF")!,
            sha256: String(repeating: "9", count: 64),
            provenance: .init(source: "alibaba", mirrorContact: nil),
            tags: ["Assistant", "Lightweight"],
            thumbnailSymbolName: "sparkle.magnifyingglass",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF")
        ),
        ModelMetadata(
            id: "stablelm2-zephyr",
            name: "StableLM 2 Zephyr",
            version: "1.0",
            sizeBytes: 5_300_000_000,
            quantized: .q4_1,
            recommendedRamGB: 10,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://ollama.com/library/stablelm2")!,
            sha256: String(repeating: "8", count: 64),
            provenance: .init(source: "stability.ai", mirrorContact: nil),
            tags: ["Balanced", "Assistant"],
            thumbnailSymbolName: "sparkles.rectangle.stack",
            host: .ollama,
            sourceURL: URL(string: "https://ollama.com/library/stablelm2")
        ),
        ModelMetadata(
            id: "deepseek-coder-6.7b",
            name: "DeepSeek Coder",
            version: "6.7B",
            sizeBytes: 6_700_000_000,
            quantized: .q5_0,
            recommendedRamGB: 12,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-instruct-GGUF")!,
            sha256: String(repeating: "7", count: 64),
            provenance: .init(source: "deepseek", mirrorContact: nil),
            tags: ["Coding", "Assistant"],
            thumbnailSymbolName: "curlybraces.square",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-instruct-GGUF")
        )
    ]
}
