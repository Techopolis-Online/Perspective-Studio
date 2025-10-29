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
    @State private var selectedModel: ModelMetadata?
    @FocusState private var focusedModelID: ModelMetadata.ID?

    private let gridColumns = [
        GridItem(.flexible(), spacing: 12)
    ]

    init(viewModel: CatalogViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            filters
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: 20) {
                    ForEach(viewModel.filteredModels) { model in
                        CatalogRow(
                            model: model,
                            isPreferred: appViewModel.userSettings.preferredModelID == model.id,
                            isFocused: focusedModelID == model.id,
                            onActivate: { presentDetails(for: model) }
                        )
                        .focusable(true)
                        .focused($focusedModelID, equals: model.id)
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
        .sheet(item: $selectedModel) { model in
            ModelDetailView(
                model: model,
                systemInfo: appViewModel.systemInfo,
                isPreferred: appViewModel.userSettings.preferredModelID == model.id,
                onDownload: { viewModel.startDownload(model) },
                onSetPreferred: { viewModel.selectPreferred(model: model) },
                onOpenSource: {
#if os(macOS)
                    if let url = model.sourceURL {
                        NSWorkspace.shared.open(url)
                    }
#endif
                },
                onClose: {
                    selectedModel = nil
                }
            )
            .environmentObject(appViewModel)
        }
    }

    private func presentDetails(for model: ModelMetadata) {
        selectedModel = model
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

private struct CatalogRow: View {
    let model: ModelMetadata
    let isPreferred: Bool
    let isFocused: Bool
    let onActivate: () -> Void

    var body: some View {
        Button(action: onActivate) {
            Text(model.name)
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 14)
                .padding(.horizontal, 18)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isFocused ? Color.accentColor.opacity(0.18) : Color.clear)
                )
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
        .accessibilityHint("Opens detailed information for \(model.name)")
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        isPreferred ? "\(model.name), preferred model" : model.name
    }
}

