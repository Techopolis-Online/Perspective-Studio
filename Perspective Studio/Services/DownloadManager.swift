//
//  DownloadManager.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

protocol DownloadManaging {
    var downloadsPublisher: AnyPublisher<[ModelDownload], Never> { get }

    func enqueueDownload(_ model: ModelMetadata)
    func pause(_ download: ModelDownload)
    func resume(_ download: ModelDownload)
    func cancel(_ download: ModelDownload)
}

/// Basic download manager scaffolding using URLSession background tasks.
/// TODO: Replace simulated state machine with real networking implementation.
final class DownloadManager: NSObject, DownloadManaging {
    static let shared = DownloadManager()

    private let session: URLSession
    private let subject = CurrentValueSubject<[ModelDownload], Never>([])
    private var tasks: [UUID: URLSessionDownloadTask] = [:]

    var downloadsPublisher: AnyPublisher<[ModelDownload], Never> {
        subject.eraseToAnyPublisher()
    }

    private override init() {
        let configuration = URLSessionConfiguration.background(withIdentifier: "com.perspectiveStudio.downloads")
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        session = URLSession(configuration: configuration, delegate: nil, delegateQueue: .main)
        super.init()
    }

    func enqueueDownload(_ model: ModelMetadata) {
        var downloads = subject.value
        let download = ModelDownload(model: model, state: .inProgress(progress: 0, speedBytesPerSecond: nil))
        downloads.append(download)
        subject.send(downloads)

        // Simulate progress while networking implementation is pending.
        simulateDownloadProgress(for: download.id)
    }

    func pause(_ download: ModelDownload) {
        updateDownload(download.id) { modelDownload in
            ModelDownload(
                id: modelDownload.id,
                model: modelDownload.model,
                state: .paused(progress: modelDownload.state.progressValue),
                startedAt: modelDownload.startedAt,
                updatedAt: .init()
            )
        }
    }

    func resume(_ download: ModelDownload) {
        updateDownload(download.id) { modelDownload in
            ModelDownload(
                id: modelDownload.id,
                model: modelDownload.model,
                state: .inProgress(progress: modelDownload.state.progressValue, speedBytesPerSecond: nil),
                startedAt: modelDownload.startedAt,
                updatedAt: .init()
            )
        }
        simulateDownloadProgress(for: download.id)
    }

    func cancel(_ download: ModelDownload) {
        var downloads = subject.value
        downloads.removeAll { $0.id == download.id }
        subject.send(downloads)
        tasks[download.id]?.cancel()
        tasks.removeValue(forKey: download.id)
    }

    private func simulateDownloadProgress(for id: UUID) {
        Task.detached { [subject] in
            for step in 1...10 {
                try await Task.sleep(nanoseconds: 400_000_000)
                let progress = min(Double(step) / 10.0, 1.0)
                await MainActor.run {
                    var downloads = subject.value
                    guard let index = downloads.firstIndex(where: { $0.id == id }) else { return }
                    let current = downloads[index]
                    guard case .inProgress = current.state else { return }
                    downloads[index] = ModelDownload(
                        id: current.id,
                        model: current.model,
                        state: progress >= 1.0
                            ? .verifying
                            : .inProgress(progress: progress, speedBytesPerSecond: nil),
                        startedAt: current.startedAt,
                        updatedAt: .init()
                    )
                    subject.send(downloads)
                }
            }

            try await Task.sleep(nanoseconds: 500_000_000)
            await MainActor.run {
                var downloads = subject.value
                guard let index = downloads.firstIndex(where: { $0.id == id }) else { return }
                let current = downloads[index]
                downloads[index] = ModelDownload(
                    id: current.id,
                    model: current.model,
                    state: .completed(url: URL(fileURLWithPath: "/tmp/\(current.model.id).bin")),
                    startedAt: current.startedAt,
                    updatedAt: .init()
                )
                subject.send(downloads)
            }
        }
    }

    private func updateDownload(_ id: UUID, transform: (ModelDownload) -> ModelDownload) {
        var downloads = subject.value
        guard let index = downloads.firstIndex(where: { $0.id == id }) else { return }
        downloads[index] = transform(downloads[index])
        subject.send(downloads)
    }
}
