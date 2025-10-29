//
//  ModelDetailView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI
#if os(macOS)
import AppKit
#endif

struct ModelDetailView: View {
    let model: ModelMetadata
    let systemInfo: SystemInfo
    let isPreferred: Bool
    let onDownload: () -> Void
    let onSetPreferred: () -> Void
    let onOpenSource: () -> Void
    let onClose: () -> Void
    @AccessibilityFocusState private var isHeaderFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
            overviewSection
            compatibilitySection
            tipsSection
            infoGrid
            tagSection
            actionsSection
                }
                .padding(24)
            }
        }
        .frame(minWidth: 520, idealWidth: 560, maxWidth: 600, minHeight: 420)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .onAppear {
            isHeaderFocused = true
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text(model.name)
                    .font(.largeTitle.bold())
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($isHeaderFocused)

                HStack(spacing: 8) {
                    Label(model.host.displayName, systemImage: model.host.iconSystemName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(model.version)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .font(.system(size: 24))
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Close")
            }
            .buttonStyle(.plain)
        }
        .padding([.top, .horizontal], 24)
        .padding(.bottom, 12)
    }

    private var compatibilitySection: some View {
        let status = model.compatibility(for: systemInfo)
        return VStack(alignment: .leading, spacing: 8) {
            Label(status.message, systemImage: status.iconSystemName)
                .font(.title3.weight(.semibold))
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(
                    Capsule()
                        .fill(status == .compatible ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                )
                .foregroundStyle(status == .compatible ? Color.green : Color.orange)

            Text("Your Mac: \(systemInfo.memoryDescription), \(systemInfo.processorSummary)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    private var overviewSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(model.beginnerSummary(for: systemInfo))
                .font(.title3)
                .fontWeight(.semibold)
                .fixedSize(horizontal: false, vertical: true)
            Text("Designed to feel welcoming even if this is your first time using on-device AI.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Overview: \(model.beginnerSummary(for: systemInfo))")
    }

    private var tipsSection: some View {
        let tips = model.beginnerTips(for: systemInfo)
        return VStack(alignment: .leading, spacing: 8) {
            Text("Helpful Information")
                .font(.headline)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(tips, id: \.self) { tip in
                    Label(tip, systemImage: "lightbulb.fill")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(tip)
                }
                
                // Add download information
                Label("Downloads are resumable and verified for integrity", systemImage: "checkmark.shield.fill")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Downloads are resumable and verified for integrity")
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.accentColor.opacity(0.08))
            )
        }
    }

    private var infoGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 10) {
                GridRow {
                    infoItem(title: "Model ID", value: model.id)
                    infoItem(title: "Recommended RAM", value: model.memorySummary)
                }
                GridRow {
                    infoItem(title: "File Size", value: model.formattedSize)
                    infoItem(title: "Runtimes", value: model.supportedRuntimes.map { $0.rawValue }.joined(separator: ", "))
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Model information")
        }
    }

    private func infoItem(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
                .textSelection(.enabled)
        }
    }

    private var tagSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tags")
                .font(.headline)
            if model.tags.isEmpty {
                Text("No tags provided")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], spacing: 8) {
                    ForEach(model.tags, id: \.self) { tag in
                        TagPill(text: tag)
                            .accessibilityLabel("Tag \(tag)")
                    }
                }
            }
        }
    }

    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                onDownload()
            } label: {
                Label("Download Model", systemImage: "arrow.down.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityHint("Starts downloading this model into your library")

            Button(isPreferred ? "Already Preferred" : "Set as Preferred") {
                onSetPreferred()
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(isPreferred)
            .accessibilityHint("Marks this model as your default choice")

            if model.host == .huggingFace, let sourceURL = model.sourceURL {
                Button {
                    onOpenSource()
                } label: {
                    Label("Open on Hugging Face", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .accessibilityHint("Opens the model page on Hugging Face in your browser")
            } else if let sourceURL = model.sourceURL {
                Button {
                    onOpenSource()
                } label: {
                    Label("Open Model Page", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .accessibilityHint("Opens the model page in your browser")
            }
        }
        .padding(.top, 12)
    }
}

private struct TagPill: View {
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
