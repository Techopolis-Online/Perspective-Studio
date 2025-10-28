//
//  DownloadManagerView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI
#if os(macOS)
import AppKit
#endif

struct DownloadManagerView: View {
    @EnvironmentObject private var appViewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            if appViewModel.downloads.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No downloads yet")
                        .font(.headline)
                    Text("Start a download from the catalog to see progress and manage tasks here.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 320)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(appViewModel.downloads) { download in
                        DownloadRow(download: download, appViewModel: appViewModel)
                    }
                }
                .listStyle(.inset)
            }
        }
        .padding()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Downloads")
                .font(.largeTitle.bold())
            Text("Monitor progress, pause/resume, and verify integrity for each model download.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

private struct DownloadRow: View {
    let download: ModelDownload
    let appViewModel: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(download.model.name)
                    .font(.headline)
                Spacer()
                Text(statusText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: download.state.progressValue) {
                Text("Progress")
            }
            .progressViewStyle(.linear)
            .accessibilityLabel("Download progress for \(download.model.name)")
            .accessibilityValue("\(Int(download.state.progressValue * 100)) percent")

            HStack(spacing: 12) {
                switch download.state {
                case .inProgress:
                    Button("Pause") {
                        appViewModel.pauseDownload(download)
                    }
                    Button("Cancel") {
                        appViewModel.cancelDownload(download)
                    }
                case .paused:
                    Button("Resume") {
                        appViewModel.resumeDownload(download)
                    }
                case .completed(let url):
                    Button("Open in Finder") {
#if os(macOS)
                        NSWorkspace.shared.activateFileViewerSelecting([url])
#endif
                    }
                case .failed(let error):
                    Text(error.localizedDescription)
                        .font(.caption)
                        .foregroundStyle(.red)
                    Button("Retry") {
                        appViewModel.startDownload(for: download.model)
                    }
                default:
                    EmptyView()
                }
            }
            .buttonStyle(.link)
        }
        .padding(.vertical, 6)
    }

    private var statusText: String {
        switch download.state {
        case .notStarted: return "Waiting"
        case .inProgress(let progress, _): return "Downloading \(Int(progress * 100))%"
        case .paused: return "Paused"
        case .verifying: return "Verifying checksum"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }
}
