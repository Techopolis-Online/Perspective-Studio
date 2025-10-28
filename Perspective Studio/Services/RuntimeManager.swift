//
//  RuntimeManager.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

enum RuntimeState: Equatable {
    case idle
    case loading(model: ModelMetadata)
    case ready(model: ModelMetadata)
    case error(message: String)
}

protocol RuntimeManaging {
    var statePublisher: AnyPublisher<RuntimeState, Never> { get }
    func load(model: ModelMetadata)
    func unloadCurrentModel()
}

final class RuntimeManager: RuntimeManaging {
    static let shared = RuntimeManager()

    private let stateSubject = CurrentValueSubject<RuntimeState, Never>(.idle)

    var statePublisher: AnyPublisher<RuntimeState, Never> {
        stateSubject.eraseToAnyPublisher()
    }

    func load(model: ModelMetadata) {
        stateSubject.send(.loading(model: model))

        // Placeholder implementation. Wire to concrete runtime (e.g., llama.cpp) later.
        let subject = stateSubject
        Task.detached {
            try await Task.sleep(nanoseconds: 1_000_000_000)
            await MainActor.run {
                subject.send(.ready(model: model))
            }
        }
    }

    func unloadCurrentModel() {
        stateSubject.send(.idle)
    }
}
