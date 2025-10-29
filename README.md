# Perspective Studio

<div align="center">

**A Fully Accessible, Native macOS LLM Application**

[![macOS](https://img.shields.io/badge/macOS-13.0+-blue.svg)](https://www.apple.com/macos/)
[![Swift](https://img.shields.io/badge/Swift-5.0+-orange.svg)](https://swift.org/)
[![License](https://img.shields.io/badge/License-Open_Source-green.svg)](LICENSE)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG-2.1_AA-success.svg)](https://www.w3.org/WAI/WCAG21/quickref/)

*Bringing the power of local LLMs to everyone, with accessibility at the core.*

[Getting Started](#getting-started) • [Features](#features) • [Contributing](#contributing) • [Roadmap](#roadmap)

</div>

---

## What is Perspective Studio?

**Perspective Studio** is a native macOS desktop application that democratizes access to Large Language Models (LLMs) by providing a fully accessible, beginner-friendly, and powerful on-device AI experience. Run cutting-edge AI models locally on your Mac with no cloud required, no subscriptions, and complete privacy.

### Why Perspective Studio?

- **Accessibility First**: Full WCAG 2.1 AA compliance with comprehensive VoiceOver support
- **Privacy-Focused**: All processing happens locally on your device; your data never leaves your Mac
- **Free and Open Source**: The code is open source and always will be
- **Beginner-Friendly**: Gentle onboarding with contextual help for AI newcomers
- **Power User Ready**: Advanced features for developers and researchers
- **Native macOS**: Built with SwiftUI for a true Mac experience on Apple Silicon and Intel

> **Coming Soon to the App Store**  
> While Perspective Studio will eventually be available on the Mac App Store for easy installation, the source code will always remain open and free. We believe in transparency and community-driven development.

---

## Features

### Currently Implemented

#### Model Management
- **Curated Model Catalog**: Browse AI models from Hugging Face with detailed metadata
  - Model size, quantization type, and recommended RAM requirements
  - License information and source links
  - Host provider indicators (Hugging Face, Ollama, Community)
  - Compatibility filtering based on your Mac's hardware
- **Smart Filtering**: Filter by runtime, tags, host provider, or compatibility
- **Search**: Quick search across model names and tags

#### Advanced Download Manager
- **Resumable Downloads**: Pause, resume, or cancel downloads at any time
- **Progress Tracking**: Real-time speed indicators and progress bars
- **Integrity Verification**: Automatic SHA256 checksum verification
- **Background Support**: Downloads continue even when the application is in the background
- **Error Handling**: Clear error messages with actionable solutions

#### Accessibility Excellence
- **Full VoiceOver Support**: Every element has proper labels and context
- **Keyboard Navigation**: Complete keyboard access with discoverable shortcuts
- **Live Announcements**: VoiceOver announces download progress and new messages
- **High Contrast Support**: Works seamlessly with system accessibility settings
- **Adjustable Text Sizes**: Respects system text size preferences
- **WCAG 2.1 AA Compliant**: Proper focus indicators, color contrast, and semantic markup

#### Modern Native UI
- **Adaptive Grid Layout**: Model catalog automatically adjusts to screen size
- **Drag and Drop Support**: Import local model files (coming soon)
- **Context Menus**: Right-click actions for quick access
- **Native macOS Controls**: Feels at home on your Mac

### In Active Development

#### Chat Interface (Phase 1)
- iMessage-like conversational UI
- System prompt customization
- Temperature and parameter controls
- Inline model switching with `@model-name` mentions
- Markdown rendering for rich responses
- Chat history and session management

#### Local Runtime Support (Phase 1)
- **Llama.cpp/GGML**: Primary runtime for quantized models (4-bit, 8-bit)
- **ONNX Support**: For models in ONNX format
- **XPC Helper Process**: Sandboxed, secure model inference
- **Memory-Mapped I/O**: Efficient memory usage for large models

#### Local Endpoint Creation (Phase 2)
- Expose local API for other applications
- Localhost-only with explicit user consent
- Compatible with OpenAI-style endpoints
- Perfect for development and testing

#### Retrieval-Augmented Generation (RAG) (Phase 2)
- Local vector store with HNSW indexing
- Support for custom document collections
- Privacy-preserving document search
- Integrated embedding models

#### Sandboxed Code Execution (Phase 2)
- Safe execution of code snippets
- XPC-based sandboxing with strict limits
- CPU/memory quotas and timeouts
- File system access controls

#### CloudKit Sync (Phase 2)
- Sync settings and preferences across devices
- Model metadata and favorites sync
- **Note**: Model binaries are never synced (too large and unnecessary)
- Private CloudKit database; your data stays yours

#### Siri Shortcuts Integration (Phase 2)
- Run prompts via Shortcuts
- Open specific models
- Automate workflows with Shortcuts application

---

## Getting Started

### Prerequisites

- **macOS 13.0** or later (macOS 14 or higher recommended)
- **Xcode 15.0** or later
- **Swift 5.0** or later
- **8GB RAM minimum** (16GB or more recommended for larger models)
- **20GB or more free disk space** (for model downloads)

### Installation

#### Option 1: Build from Source (Current)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Techopolis-Online/Perspective-Studio.git
   cd Perspective-Studio
   ```

2. **Open in Xcode**:
   ```bash
   open "Perspective Studio.xcodeproj"
   ```

3. **Configure signing** (for local development):
   - Select the project in Xcode's navigator
   - Choose your development team under "Signing & Capabilities"
   - Xcode will automatically create a provisioning profile

4. **Build and run**:
   - Press `⌘R` or choose Product → Run
   - The app will launch and begin onboarding

#### Option 2: Mac App Store (Coming Soon)

We're working towards an App Store release for easy installation and automatic updates. Stay tuned!

### First Launch

1. **Welcome Screen**: Choose your AI experience level (Beginner, Intermediate, or Expert)
2. **Model Catalog**: Browse available models with recommendations for your Mac
3. **Download a Model**: Select a model and click Download
4. **Start Chatting**: Once downloaded, start your first conversation

---

## Architecture

### Technology Stack

- **SwiftUI**: Modern declarative UI framework
- **Combine**: Reactive data flow and state management
- **URLSession**: Network layer with background download support
- **CryptoKit**: SHA256 verification and security
- **XPC**: Sandboxed process isolation (coming soon)
- **CloudKit**: Private database sync (coming soon)

### Project Structure

```
Perspective Studio/
  Models/              # Data models and state
    ModelMetadata.swift
    ModelDownload.swift
    ChatMessage.swift
    UserSettings.swift
  Services/            # Business logic layer
    ModelCatalogService.swift
    DownloadManager.swift
    RuntimeManager.swift
  ViewModels/          # View state management
    AppViewModel.swift
    CatalogViewModel.swift
    ChatViewModel.swift
  Views/               # SwiftUI views
    Catalog/           # Model catalog UI
    Chat/              # Chat interface
    Downloads/         # Download manager UI
    Settings/          # Settings screens
    Onboarding/        # First-run experience
  Utilities/           # Helpers and extensions
    SystemInfo.swift
    VoiceOverAnnouncer.swift
```

### Key Design Decisions

- **No Core ML Requirement**: Models run via Llama.cpp/GGML with no conversion needed
- **No Bundled Models**: Application size stays small; users download only what they need
- **Security First**: XPC sandboxing and strict permissions for model execution
- **Accessibility First**: WCAG compliance and VoiceOver support built in from day one

---

## Contributing

We welcome contributions from everyone. Perspective Studio follows **Git Flow** for a clean, organized development process.

### Git Flow Workflow

We use Git Flow to manage releases and features:

```
main              # Production-ready code (App Store releases)
  ├── develop     # Integration branch for features
       ├── feature/chat-interface
       ├── feature/rag-support
       └── feature/local-endpoint
```

#### Branch Types

- **`main`**: Production releases only—always stable
- **`develop`**: Active development integration branch
- **`feature/*`**: New features (branch from `develop`)
- **`bugfix/*`**: Bug fixes for `develop`
- **`hotfix/*`**: Critical fixes for `main`
- **`release/*`**: Release preparation branches

### How to Contribute

#### 1. Report Bugs and Issues

Found a bug? We want to know.

**Before creating an issue**, please:
- Search existing issues to avoid duplicates
- Use our issue templates (Bug Report, Feature Request, Accessibility Issue)
- Provide clear reproduction steps
- Include your macOS version and Mac hardware

**Create an issue**: [GitHub Issues](https://github.com/Techopolis-Online/Perspective-Studio/issues/new/choose)

#### 2. Suggest Features

Have an idea? Open a **Feature Request** issue.

Please include:
- Clear description of the feature
- Use cases and benefits
- Any accessibility considerations
- Mockups or examples (if applicable)

#### 3. Improve Documentation

Documentation improvements are always welcome:
- Fix typos or clarify instructions
- Add code examples
- Improve accessibility documentation
- Translate documentation (future)

#### 4. Contribute Code

**Step-by-step guide:**

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/Perspective-Studio.git
   cd Perspective-Studio
   ```

3. **Set up the upstream remote:**
   ```bash
   git remote add upstream https://github.com/Techopolis-Online/Perspective-Studio.git
   ```

4. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes:**
   - Follow Swift style conventions
   - Add comments for complex logic
   - Ensure accessibility (proper labels, VoiceOver hints)
   - Test with VoiceOver enabled
   - Verify keyboard navigation works

6. **Commit with clear messages:**
   ```bash
   git add .
   git commit -m "feat: Add new model filtering option"
   ```
   
   Use conventional commit prefixes:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style/formatting
   - `refactor:` Code restructuring
   - `test:` Adding tests
   - `chore:` Maintenance tasks
   - `a11y:` Accessibility improvements

7. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request:**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select `develop` as the base branch
   - Select your feature branch
   - Fill out the pull request template completely
   - Link any related issues

### Code Review Process

1. **Automated Checks**: GitHub Actions will run builds and tests
2. **Accessibility Review**: We verify VoiceOver compatibility
3. **Code Review**: Maintainers will review within 3-5 business days
4. **Feedback & Iteration**: Address any requested changes
5. **Approval**: Once approved, we'll merge to `develop`
6. **Release**: Changes go to `main` in the next release

### Contribution Guidelines

#### Code Standards
- **Swift Style**: Follow [Swift.org API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)
- **SwiftUI**: Use declarative patterns, avoid UIKit unless necessary
- **Accessibility**: Every UI element MUST have proper accessibility labels
- **Comments**: Explain *why*, not *what* (code should be self-documenting)
- **Tests**: Add unit tests for business logic

#### Accessibility Requirements (MUST PASS)
- All interactive elements have accessibility labels
- VoiceOver can navigate entire feature
- Keyboard navigation works without mouse
- Color contrast meets WCAG 2.1 AA (4.5:1)
- Focus indicators are visible
- Live regions announce dynamic content

#### Testing Checklist
- [ ] Build succeeds without warnings
- [ ] Tested on macOS 13.0+
- [ ] VoiceOver tested (enable with Cmd+F5)
- [ ] Keyboard navigation tested (Tab, arrow keys)
- [ ] Works on both Apple Silicon and Intel (if possible)
- [ ] No memory leaks or crashes

### Areas Needing Help

We especially welcome contributions in these areas:

#### High Priority
- **Chat Interface**: Core chat UI and message rendering
- **Llama.cpp Integration**: Runtime adapter implementation
- **Model Import**: Drag and drop local model files
- **Performance Optimization**: Reduce memory usage
- **Testing**: Unit tests and UI tests

#### Design and User Experience
- **Iconography**: Custom SF Symbols for model types
- **Dark Mode**: Ensure perfect dark mode support
- **Animations**: Smooth transitions and micro-interactions
- **Onboarding**: Improve first-run experience

#### Accessibility
- **VoiceOver Scripts**: Automated test scripts
- **Accessibility Audit**: WCAG 2.1 AAA compliance
- **Keyboard Shortcuts**: More discoverable shortcuts
- **Documentation**: Accessibility best practices guide

#### Documentation
- **Code Comments**: Improve inline documentation
- **API Documentation**: Generate with DocC
- **User Guide**: Beginner tutorials
- **Video Tutorials**: Screen recordings

---

## Roadmap

### Phase 1: Foundation (Current - Q4 2025)
- [x] Model catalog with Hugging Face integration
- [x] Download manager with pause and resume functionality
- [x] Accessibility infrastructure
- [ ] Chat interface MVP
- [ ] Llama.cpp runtime integration
- [ ] Basic settings and preferences
- [ ] **First TestFlight beta**

### Phase 2: Power Features (Q1 2026)
- [ ] Local endpoint creation (XPC)
- [ ] RAG with vector search
- [ ] Code execution sandbox
- [ ] CloudKit metadata sync
- [ ] Siri Shortcuts integration
- [ ] Multi-model conversation support
- [ ] **Public beta on TestFlight**

### Phase 3: Polish and Release (Q2 2026)
- [ ] ONNX runtime support
- [ ] Advanced model management
- [ ] Performance profiling tools
- [ ] Expanded model catalog
- [ ] Comprehensive documentation
- [ ] **Mac App Store release**

### Future Ideas (Community Input Welcome)
- [ ] Optional Core ML adapter
- [ ] Multi-language UI support
- [ ] Plugin system for extensions
- [ ] Model fine-tuning tools
- [ ] Team collaboration features
- [ ] iOS and iPadOS companion application

---

## Testing

### Manual Testing

1. **Build the application** in Xcode (⌘R)
2. **Enable VoiceOver** (Cmd+F5) and navigate the UI
3. **Test keyboard navigation:** Use Tab and arrow keys exclusively
4. **Download a model:** Verify progress, pause, resume, and cancel functionality
5. **Check accessibility:** Open Accessibility Inspector (Xcode → Open Developer Tool)

### Automated Testing (Coming Soon)

```bash
# Run unit tests
xcodebuild test -scheme "Perspective Studio" -destination "platform=macOS"

# Run UI tests
xcodebuild test -scheme "Perspective Studio UI Tests"
```

---

## License

Perspective Studio is open source software. License details are forthcoming. We are committed to keeping the code free and accessible.

---

## Acknowledgments

- **Hugging Face:** For their incredible model hub and community
- **Ollama:** For inspiration in local LLM hosting
- **Llama.cpp:** For efficient on-device inference
- **Open Source Community:** For making projects like this possible
- **Accessibility Advocates:** For helping us build inclusively

---

## Support and Community

- **Issues:** [GitHub Issues](https://github.com/Techopolis-Online/Perspective-Studio/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Techopolis-Online/Perspective-Studio/discussions)
- **Email:** support@techopolisonline.com
- **Website:** [techopolisonline.com](https://techopolisonline.com)

---

## Project Status

This project is in **active development**. We are building in the open and welcome your feedback, bug reports, and contributions.

Current focus: **Chat interface and Llama.cpp runtime integration**

---

<div align="center">

**Made with care and accessibility in mind**

[Back to Top](#perspective-studio)

</div>
