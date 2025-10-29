//
//  ModelCatalogView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI
#if os(macOS)
import AppKit
#endif

struct ModelCatalogView: View {
    @StateObject private var viewModel: CatalogViewModel
    @EnvironmentObject private var appViewModel: AppViewModel

    private let gridColumns = [
        GridItem(.adaptive(minimum: 260, maximum: 320), spacing: 20)
    ]

    init(viewModel: CatalogViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            
            // Error banner
            if let error = viewModel.lastError {
                ErrorBanner(
                    error: error,
                    onDismiss: { viewModel.dismissError() },
                    onRetry: { viewModel.refresh() }
                )
            }
            
            filters
            
            // Loading indicator
            if viewModel.isRefreshing {
                HStack {
                    ProgressView()
                        .controlSize(.small)
                    Text("Refreshing catalog...")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }
            
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: 20) {
                    ForEach(viewModel.filteredModels) { model in
                        ModelCatalogCard(
                            model: model,
                            systemInfo: appViewModel.systemInfo,
                            isPreferred: appViewModel.userSettings.preferredModelID == model.id,
                            onDownload: { viewModel.startDownload(model) },
                            onSetPreferred: { viewModel.selectPreferred(model: model) }
                        )
                    }
                }
                .padding(.bottom, 12)
            }
        }
        .padding()
        .toolbar {
            ToolbarItemGroup {
                Button("Import Model…") {
                    // TODO: implement import workflow
                }
                .keyboardShortcut("I", modifiers: [.command, .shift])
                .help("Import a local model file")
                .disabled(true)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Model Catalog")
                .font(.largeTitle.bold())
                .accessibilityAddTraits(.isHeader)
            Text("Browse on-device ready models, manage downloads, and pin your favorites for quick access.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Detected system: \(appViewModel.systemInfo.memoryDescription), \(appViewModel.systemInfo.processorSummary).")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                TextField("Search models", text: $viewModel.searchText)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Search models")

                Menu {
                    Button("All Runtimes") {
                        viewModel.filterRuntime = nil
                    }
                    ForEach(ModelMetadata.Runtime.allCases.sorted { $0.rawValue < $1.rawValue }, id: \.self) { runtime in
                        Button(runtime.rawValue) {
                            viewModel.filterRuntime = runtime
                        }
                    }
                } label: {
                    Label(viewModel.filterRuntime?.rawValue.capitalized ?? "All runtimes", systemImage: "cpu")
                }
                .menuStyle(.borderlessButton)
                .accessibilityLabel("Filter by runtime")

                Menu {
                    Button("All sources") {
                        viewModel.selectedHost = nil
                    }
                    ForEach(ModelMetadata.HostProvider.allCases, id: \.self) { host in
                        Button(host.displayName) {
                            viewModel.selectedHost = host
                        }
                    }
                } label: {
                    Label(viewModel.selectedHost?.displayName ?? "All sources", systemImage: "externaldrive.connected.to.line.below")
                }
                .menuStyle(.borderlessButton)
                .accessibilityLabel("Filter by source")

                Menu {
                    Button("All tags") {
                        viewModel.selectedTag = nil
                    }
                    ForEach(viewModel.availableTags, id: \.self) { tag in
                        Button(tag) {
                            viewModel.selectedTag = tag
                        }
                    }
                } label: {
                    Label(viewModel.selectedTag ?? "All tags", systemImage: "line.3.horizontal.decrease.circle")
                }
                .menuStyle(.borderlessButton)
                .accessibilityLabel("Filter by tag")

                Spacer()

                Button("Refresh") {
                    viewModel.refresh()
                }
                .keyboardShortcut("R", modifiers: [.command])
                .help("Refresh catalog")
            }

            HStack(spacing: 12) {
                Menu {
                    ForEach(CatalogViewModel.CompatibilityFilter.allCases) { option in
                        Button(option.displayName) {
                            viewModel.compatibilityFilter = option
                        }
                    }
                } label: {
                    Label(viewModel.compatibilityFilter.displayName, systemImage: "checkmark.circle")
                }
                .menuStyle(.borderlessButton)
                .accessibilityLabel("Filter by compatibility")
                Spacer(minLength: 0)
            }

            if let selectedTag = viewModel.selectedTag {
                Text("Filtered by “\(selectedTag)”.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let selectedHost = viewModel.selectedHost {
                Text("Source: \(selectedHost.displayName)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if viewModel.compatibilityFilter != .all {
                Text("Compatibility: \(viewModel.compatibilityFilter.displayName)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ModelCatalogCard: View {
    let model: ModelMetadata
    let systemInfo: SystemInfo
    let isPreferred: Bool
    let onDownload: () -> Void
    let onSetPreferred: () -> Void

    private var compatibilityStatus: ModelCompatibilityStatus {
        model.compatibility(for: systemInfo)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(LinearGradient(
                        colors: [Color.accentColor.opacity(0.25), Color.accentColor.opacity(0.05)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(height: 140)

                Image(systemName: model.thumbnailSymbolName)
                    .font(.system(size: 54, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
                    .symbolRenderingMode(.hierarchical)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(model.name)
                        .font(.headline)
                    Spacer()
                    if isPreferred {
                        Label("Preferred", systemImage: "star.fill")
                            .labelStyle(.iconOnly)
                            .foregroundStyle(.yellow)
                            .accessibilityLabel("Preferred model")
                    }
                }

                Text(model.version)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Label(model.host.displayName, systemImage: model.host.iconSystemName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                Label(compatibilityStatus.message, systemImage: compatibilityStatus.iconSystemName)
                    .font(.subheadline)
                    .padding(8)
                    .background(
                        Capsule()
                            .fill(compatibilityStatus == .compatible ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                    )
                    .foregroundStyle(compatibilityStatus == .compatible ? Color.green : Color.orange)

                Spacer()

                Text(model.memorySummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 6) {
                TagChip(text: model.quantized.rawValue.uppercased())
                TagChip(text: model.formattedSize)
                ForEach(model.tags.prefix(3), id: \.self) { tag in
                    TagChip(text: tag)
                }
            }

            HStack(spacing: 12) {
                Button("Download") {
                    onDownload()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button(isPreferred ? "Preferred" : "Set Preferred") {
                    onSetPreferred()
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isPreferred)
            }

            if let sourceURL = model.sourceURL {
                Button {
#if os(macOS)
                    NSWorkspace.shared.open(sourceURL)
#endif
                } label: {
                    Label("Open on \(model.host.displayName)", systemImage: model.host.iconSystemName)
                }
                .buttonStyle(.link)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(NSColor.windowBackgroundColor))
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 6)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(model.name). \(compatibilityStatus.message). \(model.memorySummary).")
    }
}

private struct TagChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.accentColor.opacity(0.12))
            )
            .foregroundStyle(.primary)
    }
}

private struct ErrorBanner: View {
    let error: NetworkError
    let onDismiss: () -> Void
    let onRetry: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title2)
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Network Error")
                    .font(.headline)
                    .foregroundStyle(.primary)
                
                if let description = error.errorDescription {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                if let suggestion = error.recoverySuggestion {
                    Text(suggestion)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                }
            }
            
            Spacer()
            
            VStack(spacing: 8) {
                Button("Retry") {
                    onRetry()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                
                Button("Dismiss") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.orange.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Error: \(error.errorDescription ?? "Network error occurred")")
    }
}
