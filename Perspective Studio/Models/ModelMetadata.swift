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
    var summary: String?

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

    func beginnerSummary(for systemInfo: SystemInfo) -> String {
        if let summary, !summary.isEmpty {
            return summary
        }
        if isRecommended(for: systemInfo) {
            return "This model is a comfortable fit for your Mac and works well for everyday chat tasks."
        }
        return "This model is larger and may need extra memory. Try closing other apps or pick a lighter model if things feel slow."
    }

    func beginnerTips(for systemInfo: SystemInfo) -> [String] {
        var tips: [String] = []
        tips.append("Recommended RAM: \(recommendedRamGB) GB. Your Mac has \(systemInfo.totalMemoryGigabytesRounded) GB available.")
        switch quantized {
        case .q4_0, .q4_1:
            tips.append("This version is quantized (compressed) so it saves memory while keeping good quality.")
        case .unknown:
            break
        default:
            tips.append("This version keeps more detail, so it uses a bit more memory than smaller builds.")
        }
        if !supportedRuntimes.isEmpty {
            let runtimeList = supportedRuntimes.map { $0.rawValue }.joined(separator: ", ")
            tips.append("Works with runtimes: \(runtimeList). Perspective Studio will pick the best one automatically.")
        }
        tips.append("After downloading, you can reuse the model offline—no need to stay connected.")
        return tips
    }
}

enum ModelCompatibilityStatus: String, Codable {
    case compatible
    case needsMoreMemory

    var message: String {
        switch self {
        case .compatible: return "Works on your device"
        case .needsMoreMemory: return "Needs more memory"
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
            downloadURL: URL(string: "https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "meta", mirrorContact: "ops@ollama.com"),
            tags: ["Featured", "Chat", "Balanced"],
            thumbnailSymbolName: "sparkles",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct-GGUF"),
            summary: "Balanced 8B chat assistant that handles everyday questions with friendly, helpful replies."
        ),
        ModelMetadata(
            id: "vicuna-13b-v1",
            name: "Vicuna 13B",
            version: "1.5",
            sizeBytes: 13_000_000_000,
            quantized: .q6_0,
            recommendedRamGB: 24,
            supportedRuntimes: [.llamaCpp, .ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/lmsys/vicuna-13b-v1.5-16k-GGUF/resolve/main/vicuna-13b-v1.5-16k.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "lmsys", mirrorContact: nil),
            tags: ["Research", "Extended"],
            thumbnailSymbolName: "brain.head.profile",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/lmsys/vicuna-13b-v1.5-16k-GGUF"),
            summary: "Vicuna delivers thoughtful, research-style answers and handles longer documents comfortably."
        ),
        ModelMetadata(
            id: "mistral-7b-int4",
            name: "Mistral 7B Instruct",
            version: "0.2",
            sizeBytes: 3_700_000_000,
            quantized: .q4_0,
            recommendedRamGB: 8,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "mistral.ai", mirrorContact: nil),
            tags: ["Lightweight", "Chat"],
            thumbnailSymbolName: "wind",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF"),
            summary: "Fast 7B chat model that feels snappy on most Macs—great for first-time local AI sessions."
        ),
        ModelMetadata(
            id: "phi-3-mini-4k",
            name: "Phi-3 Mini",
            version: "4K Instruct",
            sizeBytes: 2_200_000_000,
            quantized: .q4_1,
            recommendedRamGB: 6,
            supportedRuntimes: [.ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "microsoft", mirrorContact: nil),
            tags: ["Lightweight", "Instruction"],
            thumbnailSymbolName: "text.book.closed",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-GGUF"),
            summary: "Tiny instruction model that’s ideal for summaries, brainstorming, and quick answers on low-spec machines."
        ),
        ModelMetadata(
            id: "gemma-2-2b-it",
            name: "Gemma 2B",
            version: "Instruct",
            sizeBytes: 1_800_000_000,
            quantized: .q4_0,
            recommendedRamGB: 4,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/google/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "google", mirrorContact: nil),
            tags: ["Mobile", "Fast", "Chat"],
            thumbnailSymbolName: "globe.europe.africa.fill",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/google/gemma-2b-it-GGUF"),
            summary: "Gemma is a compact assistant—perfect when you want a gentle, low-memory chat companion."
        ),
        ModelMetadata(
            id: "codellama-7b",
            name: "Code Llama 7B",
            version: "0.1",
            sizeBytes: 7_000_000_000,
            quantized: .q4_1,
            recommendedRamGB: 14,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "meta", mirrorContact: nil),
            tags: ["Coding", "Tools"],
            thumbnailSymbolName: "chevron.left.forwardslash.chevron.right",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF"),
            summary: "Code Llama helps you write, explain, and refactor code snippets in many languages."
        ),
        ModelMetadata(
            id: "llava-1.5-7b",
            name: "LLaVA 1.5",
            version: "7B",
            sizeBytes: 7_600_000_000,
            quantized: .q4_1,
            recommendedRamGB: 16,
            supportedRuntimes: [.custom],
            downloadURL: URL(string: "https://huggingface.co/liuhaotian/llava-v1.5-7b-GGUF/resolve/main/llava-v1.5-7b.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "research", mirrorContact: nil),
            tags: ["Vision", "Multimodal"],
            thumbnailSymbolName: "eye.circle.fill",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/liuhaotian/llava-v1.5-7b-GGUF"),
            summary: "LLaVA can look at pictures and describe them in natural language alongside your prompts."
        ),
        ModelMetadata(
            id: "qwen2-1.5b",
            name: "Qwen2 1.5B",
            version: "Instruction",
            sizeBytes: 1_400_000_000,
            quantized: .q4_0,
            recommendedRamGB: 4,
            supportedRuntimes: [.ggml, .onnx],
            downloadURL: URL(string: "https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF/resolve/main/Qwen2-1.5B-Instruct-Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "alibaba", mirrorContact: nil),
            tags: ["Assistant", "Lightweight"],
            thumbnailSymbolName: "sparkle.magnifyingglass",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF"),
            summary: "Qwen2 is a pocket-sized helper—handy for short instructions and quick chats on most hardware."
        ),
        ModelMetadata(
            id: "stablelm2-zephyr",
            name: "StableLM 2 Zephyr",
            version: "1.0",
            sizeBytes: 5_300_000_000,
            quantized: .q4_1,
            recommendedRamGB: 10,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b-GGUF/resolve/main/stablelm-2-zephyr-1_6b.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "stability.ai", mirrorContact: nil),
            tags: ["Balanced", "Assistant"],
            thumbnailSymbolName: "sparkles.rectangle.stack",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/stabilityai/stablelm-2-zephyr-1_6b-GGUF"),
            summary: "StableLM 2 Zephyr offers balanced conversation with smooth tone and good everyday knowledge."
        ),
        ModelMetadata(
            id: "deepseek-coder-6.7b",
            name: "DeepSeek Coder",
            version: "6.7B",
            sizeBytes: 6_700_000_000,
            quantized: .q5_0,
            recommendedRamGB: 12,
            supportedRuntimes: [.llamaCpp, .ggml],
            downloadURL: URL(string: "https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf?download=1")!,
            sha256: "",
            provenance: .init(source: "deepseek", mirrorContact: nil),
            tags: ["Coding", "Assistant"],
            thumbnailSymbolName: "curlybraces.square",
            host: .huggingFace,
            sourceURL: URL(string: "https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-instruct-GGUF"),
            summary: "DeepSeek Coder is tuned for development tasks—great for explaining snippets and drafting functions."
        )
    ]
}
