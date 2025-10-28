//
//  ChatView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var scrollID: UUID?

    var body: some View {
        VStack(spacing: 0) {
            chatTranscript
            Divider()
            inputArea
        }
        .background(Color(NSColor.textBackgroundColor))
        .navigationTitle(viewModel.session.title)
    }

    private var chatTranscript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(viewModel.session.messages) { message in
                        ChatBubbleView(message: message)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .background(Color(NSColor.windowBackgroundColor))
            .onChange(of: viewModel.session.messages.last?.id) { id in
                guard let id else { return }
                withAnimation {
                    proxy.scrollTo(id, anchor: .bottom)
                }
            }
        }
    }

    private var inputArea: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                TextEditor(text: $viewModel.inputText)
                    .font(.body)
                    .frame(minHeight: 80, maxHeight: 140)
                    .scrollContentBackground(.hidden)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(NSColor.textBackgroundColor)))
                    .accessibilityLabel("Prompt input")
                    .accessibilityHint("Type your message and press Command+Return to send.")
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.secondary.opacity(0.2))
                    )

                Button {
                    viewModel.sendMessage()
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.title2)
                        .padding(10)
                        .background(Circle().fill(Color.accentColor))
                        .foregroundStyle(Color.white)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.return, modifiers: [.command])
                .help("Send prompt")
                .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if viewModel.isStreamingResponse {
                ProgressView("Generating response…")
                    .progressViewStyle(.linear)
                    .transition(.opacity)
                    .accessibilityLabel("Generating response")
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
    }
}

private struct ChatBubbleView: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .assistant || message.role == .system {
                bubble
            } else {
                Spacer(minLength: 70)
                bubble
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(message.role.displayName) says \(accessibleText)")
    }

    private var bubble: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(message.role.displayName)
                .font(.caption)
                .foregroundStyle(.secondary)
            MarkdownText(message.content)
                .textSelection(.enabled)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(messageBackgroundColor)
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var accessibleText: String {
        (try? AttributedString(markdown: message.content).description) ?? message.content
    }

    private var messageBackgroundColor: Color {
        switch message.role {
        case .user:
            return Color.accentColor.opacity(0.2)
        case .assistant:
            return Color.blue.opacity(0.15)
        case .system:
            return Color.secondary.opacity(0.15)
        }
    }
}

private struct MarkdownText: View {
    private let attributedString: AttributedString

    init(_ markdown: String) {
        if let parsed = try? AttributedString(markdown: markdown) {
            self.attributedString = parsed
        } else {
            self.attributedString = AttributedString(markdown)
        }
    }

    var body: some View {
        Text(attributedString)
    }
}
