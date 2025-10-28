//
//  ContentView.swift
//  Perspective Studio
//
//  Created by Taylor Arndt on 10/28/25.
//

import SwiftUI
import SwiftData
#if os(macOS)
import AppKit
#endif

// MARK: - Domain Models

enum FamiliarityLevel: String, CaseIterable, Identifiable {
    case beginner
    case intermediate
    case advanced
    
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .beginner: return "Beginner"
        case .intermediate: return "Intermediate"
        case .advanced: return "Advanced"
        }
    }
}

struct ChatMessage: Identifiable, Hashable {
    enum Role { case system, user, assistant }
    let id = UUID()
    let role: Role
    let content: String
    let createdAt: Date
}

// MARK: - Root

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var items: [Item] // currently unused; SwiftData kept for future persistence

    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding: Bool = false
    @AppStorage("familiarityLevel") private var familiarityLevelRaw: String = FamiliarityLevel.beginner.rawValue
    
    var familiarityLevel: FamiliarityLevel {
        FamiliarityLevel(rawValue: familiarityLevelRaw) ?? .beginner
    }

    var body: some View {
        Group {
            if !hasCompletedOnboarding {
                OnboardingView(
                    selectedLevel: familiarityLevel,
                    onComplete: { level in
                        familiarityLevelRaw = level.rawValue
                        hasCompletedOnboarding = true
                    }
                )
            } else {
                MainShellView(familiarityLevel: familiarityLevel)
            }
        }
        .frame(minWidth: 900, minHeight: 600)
    }
}

// MARK: - Main Shell (Tabs)

private struct MainShellView: View {
    let familiarityLevel: FamiliarityLevel
    
    @State private var selectedTab: Tab = .chat
    
    enum Tab: Hashable { case chat, models, settings }
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ChatView(familiarityLevel: familiarityLevel)
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
                .tag(Tab.chat)
            ModelCatalogView()
                .tabItem { Label("Models", systemImage: "shippingbox") }
                .tag(Tab.models)
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
                .tag(Tab.settings)
        }
        .accessibilityLabel("Main navigation")
        .accessibilityHint("Use Control+Tab to switch tabs, or click to select")
    }
}

// MARK: - Onboarding

private struct OnboardingView: View {
    @State var selectedLevel: FamiliarityLevel
    let onComplete: (FamiliarityLevel) -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            Text("Welcome to Perspective Studio")
                .font(.largeTitle).bold()
                .accessibilityAddTraits(.isHeader)
            
            Text("We’ll tailor the experience to your familiarity with AI.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            VStack(alignment: .leading, spacing: 12) {
                Text("How familiar are you with AI?")
                    .font(.headline)
                HStack(spacing: 12) {
                    FamiliarityButton(level: .beginner, selected: selectedLevel == .beginner) { selectedLevel = .beginner }
                    FamiliarityButton(level: .intermediate, selected: selectedLevel == .intermediate) { selectedLevel = .intermediate }
                    FamiliarityButton(level: .advanced, selected: selectedLevel == .advanced) { selectedLevel = .advanced }
                }
            }
            .padding(.horizontal)
            
            Button {
                onComplete(selectedLevel)
            } label: {
                Text("Continue")
                    .frame(maxWidth: .infinity)
            }
            .keyboardShortcut(.defaultAction)
            .buttonStyle(.borderedProminent)
            .padding(.horizontal)
            .accessibilityHint("Finish onboarding and enter the app")
            
            Spacer()
        }
        .padding(.top, 40)
        .accessibilityElement(children: .contain)
    }
}

private struct FamiliarityButton: View {
    let level: FamiliarityLevel
    let selected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                Text(level.displayName)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(selected ? Color.accentColor.opacity(0.15) : Color.gray.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.bordered)
        .accessibilityLabel(level.displayName)
        .accessibilityHint("Double-tap to choose this level")
        .accessibilityAddTraits(.isButton)
        .modifier(SelectedTraitModifier(isSelected: selected))
    }
}

private struct SelectedTraitModifier: ViewModifier {
    let isSelected: Bool
    func body(content: Content) -> some View {
        if isSelected {
            content.accessibilityAddTraits(.isSelected)
        } else {
            content
        }
    }
}


// MARK: - Chat

private struct ChatView: View {
    let familiarityLevel: FamiliarityLevel
    
    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @FocusState private var isInputFocused: Bool
    @State private var pendingAnnouncement: String? = nil
    
    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                                .accessibilityElement(children: .combine)
                                .accessibilityHint(message.role == .assistant ? "Assistant message" : (message.role == .user ? "Your message" : "System"))
                        }
                    }
                    .padding(16)
                }
                .background(Color(NSColor.textBackgroundColor))
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        pendingAnnouncement = accessiblePlainText(from: last.content)
                    }
                }
            }
            Divider()
            HStack(alignment: .bottom, spacing: 12) {
                AccessibleTextEditor(text: $inputText)
                    .frame(minHeight: 44, maxHeight: 120)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
                    .focused($isInputFocused)
                    .accessibilityLabel("Message input")
                    .accessibilityHint("Type your message. Press Command-Return to send")
                Button(action: send) {
                    Label("Send", systemImage: "paperplane.fill")
                }
                .keyboardShortcut(.return, modifiers: [.command])
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityHint("Send the current message")
            }
            .padding(12)
        }
        .onAppear(perform: bootstrap)
        .accessibilityElement(children: .contain)
        .onChange(of: pendingAnnouncement) { _, newValue in
            guard let announcement = newValue else { return }
            #if os(macOS)
            NSAccessibility.post(element: NSApp as Any, notification: .announcementRequested, userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement])
            #endif
            pendingAnnouncement = nil
        }
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                Button("New Chat", action: newChat)
                    .keyboardShortcut("n")
                    .help("Start a new conversation")
                Button("Focus Input") { isInputFocused = true }
                    .keyboardShortcut("l")
                    .help("Move focus to message input")
            }
        }
    }
    
    private func bootstrap() {
        guard messages.isEmpty else { return }
        let intro: String
        switch familiarityLevel {
        case .beginner:
            intro = "Welcome! I’m your on‑device AI. Ask me anything — I’ll keep explanations simple and clear."
        case .intermediate:
            intro = "Welcome back. I can help with brainstorming, writing, and light coding."
        case .advanced:
            intro = "Ready. You can set system prompts, mention models with @, and adjust temperature."
        }
        messages = [
            ChatMessage(role: .system, content: intro, createdAt: Date())
        ]
    }
    
    private func newChat() {
        messages.removeAll()
        bootstrap()
        isInputFocused = true
    }
    
    private func send() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let user = ChatMessage(role: .user, content: trimmed, createdAt: Date())
        messages.append(user)
        inputText = ""
        
        // Placeholder assistant reply; LLM integration will replace this
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            let replyText = "Thanks! I’ll soon reply using your chosen local model."
            let assistant = ChatMessage(role: .assistant, content: replyText, createdAt: Date())
            messages.append(assistant)
        }
    }
    
    private func accessiblePlainText(from markdown: String) -> String {
        // Produce a single, screen‑reader friendly string
        if let attributed = try? AttributedString(markdown: markdown) {
            return String(attributed.characters)
        }
        return markdown
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ChatMessage
    
    var isUser: Bool { message.role == .user }
    var isSystem: Bool { message.role == .system }
    
    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 6) {
                if isSystem {
                    Text("System")
                        .font(.caption).foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
                AccessibleMarkdownText(message.content)
                    .padding(10)
                    .background(isUser ? Color.accentColor.opacity(0.15) : Color.gray.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            if !isUser { Spacer(minLength: 40) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(isUser ? "You" : (isSystem ? "System" : "Assistant"))
    }
}

// MARK: - Accessible Markdown Rendering

private struct AccessibleMarkdownText: View {
    let markdown: String
    
    init(_ markdown: String) { self.markdown = markdown }
    
    var body: some View {
        let attributed = (try? AttributedString(markdown: markdown, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnly))) ?? AttributedString(markdown)
        Text(attributed)
            .textSelection(.enabled)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(String(attributed.characters))
    }
}

private struct AccessibleTextEditor: View {
    @Binding var text: String
    var body: some View {
        TextEditor(text: $text)
            .font(.body)
            .accessibilityElement(children: .contain)
    }
}

// MARK: - Model Catalog

private struct ModelCatalogView: View {
    @StateObject private var viewModel = ModelCatalogViewModel()
    @State private var progressByModel: [ModelInfo.ID: Double] = [:]
    
    var body: some View {
        NavigationStack {
            catalogContent
                .navigationTitle("Models")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            Task { await viewModel.refresh() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        .disabled(viewModel.isLoading)
                        .accessibilityHint("Reload models from Hugging Face")
                    }
                }
        }
        .task { await viewModel.loadInitialModels() }
        .refreshable { await viewModel.refresh() }
        .searchable(text: $viewModel.searchQuery, prompt: "Search models or tags")
    }
    
    @ViewBuilder
    private var catalogContent: some View {
        if viewModel.isLoading && viewModel.filteredModels.isEmpty {
            VStack(spacing: 12) {
                ProgressView()
                Text("Fetching models from Hugging Face…")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else if let error = viewModel.errorMessage, viewModel.filteredModels.isEmpty {
            VStack(spacing: 12) {
                Label("We couldn’t load the catalog", systemImage: "exclamationmark.triangle")
                    .font(.headline)
                Text(error)
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                Button("Try Again") {
                    Task { await viewModel.refresh() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding()
        } else if viewModel.filteredModels.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "shippingbox")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                Text("No models match your search.")
                Text("Try a different keyword or refresh the catalog.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .padding()
        } else {
            List {
                if let error = viewModel.errorMessage {
                    Section {
                        Label {
                            Text("Some models may be missing. \(error)")
                                .font(.callout)
                        } icon: {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                }
                
                ForEach(viewModel.filteredModels) { model in
                    modelRow(for: model)
                }
                
                if viewModel.isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            }
            .listStyle(.plain)
            .accessibilityLabel("Model catalog")
            .accessibilityHint("Browse and download models from Hugging Face")
        }
    }
    
    private func modelRow(for model: ModelInfo) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(model.name)
                        .font(.headline)
                    if viewModel.isRecommended(model) {
                        Text("Popular")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .clipShape(Capsule())
                            .accessibilityLabel("Popular choice")
                    }
                    if model.isGated {
                        Image(systemName: "lock.fill")
                            .foregroundStyle(.orange)
                            .font(.caption)
                            .accessibilityLabel("Requires access approval")
                    }
                }
                Text(model.owner)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                detailLine(for: model)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let progress = progressByModel[model.id] {
                    ProgressView(value: progress)
                        .progressViewStyle(.linear)
                        .accessibilityLabel("Download progress")
                        .accessibilityValue("\(Int(progress * 100)) percent")
                }
            }
            Spacer()
            trailingControls(for: model)
        }
        .padding(.vertical, 6)
    }
    
    @ViewBuilder
    private func detailLine(for model: ModelInfo) -> some View {
        let formattedDownloads = formattedCount(model.downloads)
        let formattedLikes = formattedCount(model.likes)
        HStack(spacing: 12) {
            if model.downloads > 0 {
                Label("\(formattedDownloads) downloads", systemImage: "arrow.down.circle")
            }
            if model.likes > 0 {
                Label("\(formattedLikes) likes", systemImage: "heart.fill")
            }
            if let tag = model.primaryTag?.replacingOccurrences(of: "_", with: " ") {
                Label(tag, systemImage: "tag")
            } else if let library = model.libraryName {
                Label(library, systemImage: "shippingbox")
            }
            if let relativeDate = relativeDateString(for: model) {
                Label(relativeDate, systemImage: "clock")
            }
        }
        .lineLimit(1)
    }
    
    @ViewBuilder
    private func trailingControls(for model: ModelInfo) -> some View {
        VStack(alignment: .trailing, spacing: 8) {
            if let url = URL(string: "https://huggingface.co/\(model.fullName)") {
                Link("View", destination: url)
                    .accessibilityHint("Open this model on Hugging Face")
            }
            if !model.isGated {
                if let progress = progressByModel[model.id], progress < 1.0 {
                    Button("Pause") { }
                        .disabled(true)
                } else if let progress = progressByModel[model.id], progress >= 1.0 {
                    Button("Downloaded") { }
                        .disabled(true)
                } else {
                    Button("Download") {
                        startDownload(for: model)
                    }
                    .accessibilityHint("Begin downloading this model")
                }
            } else {
                Text("Access required")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.orange.opacity(0.15))
                    .clipShape(Capsule())
            }
        }
    }
    
    private func startDownload(for model: ModelInfo) {
        progressByModel[model.id] = 0.0
        Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { timer in
            let next = min(1.0, (progressByModel[model.id] ?? 0.0) + 0.01)
            progressByModel[model.id] = next
            if next >= 1.0 { timer.invalidate() }
        }
    }
    
    private func formattedCount(_ value: Int) -> String {
        value.formatted(.number.notation(.compactName))
    }
    
    private func relativeDateString(for model: ModelInfo) -> String? {
        guard let date = model.lastModified ?? model.createdAt else { return nil }
        return ModelCatalogView.relativeFormatter.localizedString(for: date, relativeTo: Date())
    }
    
    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()
}

// MARK: - Settings (Scaffold)

private struct SettingsView: View {
    @AppStorage("temperature") private var temperature: Double = 0.7
    @AppStorage("systemPrompt") private var systemPrompt: String = ""
    
    var body: some View {
        Form {
            Section("Behavior") {
                HStack {
                    Text("Temperature")
                    Slider(value: $temperature, in: 0...1, step: 0.05)
                        .accessibilityLabel("Temperature")
                        .accessibilityHint("Lower for deterministic, higher for creative responses")
                    Text(String(format: "%.2f", temperature)).monospaced().frame(width: 50, alignment: .trailing)
                        .accessibilityHidden(true)
                }
                TextEditor(text: $systemPrompt)
                    .frame(height: 100)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
                    .accessibilityLabel("System prompt")
                    .accessibilityHint("Persistent instructions the assistant should follow")
            }
        }
        .padding()
        .navigationTitle("Settings")
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .modelContainer(for: Item.self, inMemory: true)
}
