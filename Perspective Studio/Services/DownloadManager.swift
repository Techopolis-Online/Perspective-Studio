//
//  DownloadManager.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import CryptoKit
import Foundation

protocol DownloadManaging {
    var downloadsPublisher: AnyPublisher<[ModelDownload], Never> { get }

    func enqueueDownload(_ model: ModelMetadata)
    func pause(_ download: ModelDownload)
    func resume(_ download: ModelDownload)
    func cancel(_ download: ModelDownload)
}

final class DownloadManager: NSObject, DownloadManaging {
    static let shared = DownloadManager()

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.allowsExpensiveNetworkAccess = true
        configuration.allowsCellularAccess = true
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForRequest = 60
        configuration.timeoutIntervalForResource = 60 * 60
        var headers = configuration.httpAdditionalHeaders ?? [:]
        headers["User-Agent"] = NetworkEnvironment.userAgent
        configuration.httpAdditionalHeaders = headers
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    private let subject = CurrentValueSubject<[ModelDownload], Never>([])
    private var records: [UUID: DownloadRecord] = [:]

    private var downloads: [ModelDownload] = [] {
        didSet { subject.send(downloads) }
    }

    private let fileManager = FileManager.default
    private lazy var downloadsDirectory: URL = {
        let roots = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = roots.first?.appendingPathComponent("Perspective Studio", isDirectory: true) ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let directory = appSupport.appendingPathComponent("models", isDirectory: true)
        if !fileManager.fileExists(atPath: directory.path) {
            try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory
    }()

    private override init() {
        super.init()
    }

    var downloadsPublisher: AnyPublisher<[ModelDownload], Never> {
        subject.eraseToAnyPublisher()
    }

    func enqueueDownload(_ model: ModelMetadata) {
        // Avoid enqueuing duplicates of the same model that are already active.
        if let existing = downloads.first(where: { $0.model.id == model.id && !$0.state.isActive && $0.state != .failed(error: .cancelled) }) {
            // If previously completed, remove to re-download.
            removeDownload(existing.id)
        }

        let download = ModelDownload(
            model: model,
            state: .inProgress(progress: 0, speedBytesPerSecond: nil),
            startedAt: Date(),
            updatedAt: Date()
        )
        let record = DownloadRecord(download: download)
        records[download.id] = record
        downloads.append(download)

        startTask(for: download.id, with: model.downloadURL, resumeData: nil)
    }

    func pause(_ download: ModelDownload) {
        guard var record = records[download.id], let task = record.task else { return }
        task.cancel(byProducingResumeData: { data in
            Task { @MainActor in
                record.resumeData = data
                record.download.state = .paused(progress: record.download.state.progressValue)
                record.download.updatedAt = Date()
                record.task = nil
                self.records[download.id] = record
                self.replaceDownload(record.download)
            }
        })
    }

    func resume(_ download: ModelDownload) {
        guard let record = records[download.id] else {
            enqueueDownload(download.model)
            return
        }
        startTask(for: download.id, with: download.model.downloadURL, resumeData: record.resumeData)
    }

    func cancel(_ download: ModelDownload) {
        if let task = records[download.id]?.task {
            task.cancel()
        }
        records.removeValue(forKey: download.id)
        removeDownload(download.id)
    }

    // MARK: - Internal helpers

    private func startTask(for id: UUID, with url: URL, resumeData: Data?) {
        var record = records[id]
        guard record != nil else { return }

        let task: URLSessionDownloadTask
        if let resumeData {
            task = session.downloadTask(withResumeData: resumeData)
        } else {
            var request = URLRequest(url: url)
            request.timeoutInterval = 60 * 5
            request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")
            if isHuggingFace(url: url), let token = NetworkEnvironment.huggingFaceToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            task = session.downloadTask(with: request)
        }
        task.taskDescription = id.uuidString
        record?.task = task
        // Reset tracking metrics
        record?.lastProgressBytes = 0
        record?.lastUpdate = Date()
        record?.resumeData = nil
        records[id] = record

        Task { @MainActor in
            if var download = record?.download {
                download.state = .inProgress(progress: download.state.progressValue, speedBytesPerSecond: nil)
                download.updatedAt = Date()
                replaceDownload(download)
                records[id]?.download = download
            }
            task.resume()
        }
    }

    private func replaceDownload(_ updated: ModelDownload) {
        if let idx = downloads.firstIndex(where: { $0.id == updated.id }) {
            downloads[idx] = updated
        } else {
            downloads.append(updated)
        }
    }

    private func removeDownload(_ id: UUID) {
        downloads.removeAll { $0.id == id }
    }

    private func finalizeDownload(id: UUID, tempURL: URL) {
        guard var record = records[id] else { return }
        let model = record.download.model

        Task {
            await MainActor.run {
                record.download.state = .verifying
                record.download.updatedAt = Date()
                replaceDownload(record.download)
                records[id] = record
            }

            do {
                let destination = try prepareDestination(for: model)
                if fileManager.fileExists(atPath: destination.path) {
                    try fileManager.removeItem(at: destination)
                }

                if !model.sha256.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let checksum = try computeSHA256(for: tempURL)
                    guard checksum.caseInsensitiveCompare(model.sha256) == .orderedSame else {
                        try? fileManager.removeItem(at: tempURL)
                        await MainActor.run {
                            self.handleFailure(id: id, error: .checksumMismatch)
                        }
                        return
                    }
                }

                try fileManager.moveItem(at: tempURL, to: destination)

                await MainActor.run {
                    record.download.state = .completed(url: destination)
                    record.download.updatedAt = Date()
                    record.task = nil
                    records[id] = record
                    replaceDownload(record.download)
                }
            } catch let error as DownloadError {
                await MainActor.run {
                    self.handleFailure(id: id, error: error)
                }
            } catch {
                await MainActor.run {
                    self.handleFailure(id: id, error: .unknown)
                }
            }
        }
    }

    @MainActor
    private func handleFailure(id: UUID, error: DownloadError) {
        guard var record = records[id] else { return }
        record.download.state = .failed(error: error)
        record.download.updatedAt = Date()
        record.task = nil
        records[id] = record
        replaceDownload(record.download)
    }

    private func prepareDestination(for model: ModelMetadata) throws -> URL {
        let filename = model.downloadURL.lastPathComponent.isEmpty
            ? "\(model.id).bin"
            : model.downloadURL.lastPathComponent
        let destination = downloadsDirectory.appendingPathComponent(filename)
        let parent = destination.deletingLastPathComponent()
        if !fileManager.fileExists(atPath: parent.path) {
            try fileManager.createDirectory(at: parent, withIntermediateDirectories: true)
        }
        return destination
    }

    private func computeSHA256(for url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while autoreleasepool(invoking: {
            do {
                if let data = try handle.read(upToCount: 1_048_576), !data.isEmpty {
                    hasher.update(data: data)
                    return true
                }
                return false
            } catch {
                return false
            }
        }) {}
        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func lookupRecord(for task: URLSessionTask) -> (UUID, DownloadRecord)? {
        guard let idString = task.taskDescription, let uuid = UUID(uuidString: idString), let record = records[uuid] else {
            return nil
        }
        return (uuid, record)
    }

    private func mapHTTPStatus(_ statusCode: Int, url: URL?) -> DownloadError {
        if (statusCode == 401 || statusCode == 403), isHuggingFace(url: url) {
            return .requiresAuthorization
        }
        if statusCode == 404 {
            return .notFound
        }
        if (400..<500).contains(statusCode) {
            return .permissionDenied
        }
        if (500..<600).contains(statusCode) {
            return .server(statusCode: statusCode)
        }
        return .unknown
    }

    private func isHuggingFace(url: URL?) -> Bool {
        guard let host = url?.host?.lowercased() else { return false }
        return host.contains("huggingface.co")
    }
}

// MARK: - URLSessionDownloadDelegate

extension DownloadManager: URLSessionDownloadDelegate {
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard var (id, record) = lookupRecord(for: downloadTask) else { return }
        let expected = totalBytesExpectedToWrite
        let progress: Double
        if expected > 0 {
            progress = Double(totalBytesWritten) / Double(expected)
        } else {
            progress = 0
        }

        let now = Date()
        let timeDelta = now.timeIntervalSince(record.lastUpdate)
        var speed: Double?
        if timeDelta > 0 {
            let byteDelta = Double(totalBytesWritten - record.lastProgressBytes)
            speed = byteDelta / timeDelta
        }

        record.lastProgressBytes = totalBytesWritten
        record.lastUpdate = now
        record.download.state = .inProgress(progress: progress, speedBytesPerSecond: speed)
        record.download.updatedAt = now
        record.task = downloadTask
        records[id] = record
        replaceDownload(record.download)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let (id, record) = lookupRecord(for: downloadTask) else { return }
        records[id]?.task = nil
        finalizeDownload(id: id, tempURL: location)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let (id, _) = lookupRecord(for: task) else { return }
        if let urlError = error as? URLError {
            if urlError.code == .cancelled {
                // Cancel handled separately; no additional state update necessary.
                return
            }
            if urlError.code == .badServerResponse,
               let response = task.response as? HTTPURLResponse {
                let mappedError = mapHTTPStatus(response.statusCode, url: response.url)
                NSLog("Download failed for \(response.url?.absoluteString ?? "<unknown>"): HTTP \(response.statusCode)")
                Task { @MainActor in
                    self.handleFailure(id: id, error: mappedError)
                }
                return
            }

            let downloadError: DownloadError
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost, .dnsLookupFailed:
                downloadError = .network
            case .userAuthenticationRequired, .noPermissionsToReadFile:
                downloadError = .permissionDenied
            default:
                downloadError = .unknown
            }

            Task { @MainActor in
                self.handleFailure(id: id, error: downloadError)
            }
        } else if error != nil {
            Task { @MainActor in
                self.handleFailure(id: id, error: .unknown)
            }
        }
    }
}

// MARK: - Download Record

private struct DownloadRecord {
    var download: ModelDownload
    var task: URLSessionDownloadTask?
    var resumeData: Data?
    var lastProgressBytes: Int64 = 0
    var lastUpdate: Date = Date()
}
