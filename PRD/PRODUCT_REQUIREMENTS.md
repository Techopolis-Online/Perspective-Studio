## Perspective Studio — Product Requirements Document

Last updated: 2025-10-28

## 1. Introduction
Perspective Studio is a native macOS desktop application that democratizes access to LLMs by providing a fully accessible, beginner-friendly, and powerful on-device AI experience. The app focuses on accessibility (WCAG + VoiceOver), simplicity for new users, and advanced capabilities for power users (model management, local endpoints, RAG, and safe code execution).

This document captures product goals, technical constraints, accessibility acceptance criteria, architecture choices (explicit: NO Core ML conversion requirement), and operational policies (model catalog, third-party downloads).

## 2. Goals & Objectives
- Primary Goal: Deliver a superior, fully accessible, beginner-friendly on-device LLM experience on macOS.
- Objective 1: Full WCAG 2.1 AA mapping and VoiceOver compatibility across the app UI.
- Objective 2: Gentle, contextual onboarding for novices and fast paths for power users.
- Objective 3: Robust model catalog with third-party-hosted downloads and a secure, resumable download manager.
- Objective 4: Local LLM runtime support (Llama.cpp / GGML / ONNX / similar) without requiring Core ML conversions.
- Objective 5: Advanced tools including RAG, sandboxed code execution, Siri Shortcuts intents, and iCloud metadata sync.

## 3. Target Audience & Personas
- Beginners to AI: expect guided onboarding, safe defaults, short explanations, and accessible UI.
- Developers & Researchers: need direct control of model selection, endpoints, and advanced settings.
- Accessibility-first users: VoiceOver and keyboard-only workflows must be first-class.
- macOS Users: native macOS app (SwiftUI primary) — support Apple Silicon & Intel as feasible.

## 4. Non-functional Constraints & Key Decisions
- Model Delivery: Perspective Studio will NOT bundle model binaries. Models are acquired from third-party hosts (official checkpoints or community hosts). The app will provide a curated catalog of metadata and direct/managed downloads from third-party hosts or permit user-imported model files.
- No Core ML Conversion: The app will not require converting models to Core ML as a mandatory workflow. Instead, the app will primarily support Llama.cpp/GGML-style runtimes and ONNX where applicable. Core ML support may be added later as an optional path but is explicitly out of scope for initial release.
- Broad Runtime Support: Prioritize support for Llama.cpp / GGML, standard ONNX runtimes, and other popular on-device runtimes. Provide a pluggable runtime adapter interface so additional runtimes can be integrated later.
- Security & Sandboxing: Model inference must run in a hardened runtime (XPC/helper or in-process library with strict permissioning). Code execution (if offered) must be sandboxed and limited.

## 5. Key Features

### 5.1 Core UX
- Beginner-friendly onboarding: Ask about AI experience, show recommended models and quick-start prompts.
- Chat interface: iMessage-like conversational UI with system prompts, adjustable temperature, and inline model mention via `@model-name`.
- Accessibility-first UI: VoiceOver labels, announcements for new messages, keyboard shortcuts, adjustable text size, high contrast mode.

### 5.2 Model Catalog & Downloads
- Curated catalog: app displays model metadata (name, size, quantization, license summary, host URL, checksum, recommended RAM, supported runtimes).
- Download manager: uses `URLSession` background/resumable downloads with integrity checks (SHA256) and visible progress bars; supports pause/resume/cancel. Downloads stored in app container or user-designated folder (not in-app bundle).
- Third-party host policy: the app only downloads from external hosts when a user consents and when the model's license allows. The app will not redistribute restricted models.
- User-import flow: support drag/drop or 'Import Model' to allow users to add local model files (with checksum verification and metadata extraction).

### 5.3 Local Endpoint Creation & Model Management
- Local endpoint: provide an option to create a local Llama-compatible endpoint (in-app service or XPC helper exposing a tidy inference API). This enables other apps or internal UI layers to communicate with a stable API.
- Model lifecycle: install, update (if host supports), remove, and view provenance (host URL, checksum, license). Allow organizing by tags/folders.
- Resource-aware recommendations: show per-model recommended RAM and prompt lightweight models on low-memory systems.

### 5.4 Advanced Tools
- Code running: optional, sandboxed execution of user code using a separate helper process (XPC) or WASM runtime. Timeouts, CPU/memory quotas, and FS access controls required.
- RAG: local vector store using an on-disk HNSW index or SQLite-backed vector approach. Provide small local embedding models (GGML/ONNX) or let users provide embeddings. Index metadata stored separately from model binaries.
- Siri Shortcuts: donate NSUserActivity / Intents for common tasks (open model, run prompt) — support macOS versions where Intents is available.
- iCloud/CloudKit: sync metadata (settings, model metadata, favorites) via the user's private CloudKit database. Explicitly DO NOT sync model binaries.

## 6. Accessibility Requirements (Acceptance Criteria)
All acceptance criteria should be testable and have pass/fail outcomes.

- WCAG mapping: ensure UI elements map to WCAG 2.1 AA concepts: color contrast, focus indicators, and clear semantics for interactive controls.
- VoiceOver:
  - All UI elements must have explicit accessibility labels or values; no raw markdown should be spoken.
  - Render markdown into attributed strings for display and for VoiceOver to read with appropriate emphasis (bold, italics, lists) — i.e., a single accessible element per message, not raw markdown characters.
  - Live region announcements: new chat responses must be announced by VoiceOver upon arrival using accessibility notifications.
  - Provide detailed VoiceOver hints for all interactive controls (download, cancel, import, start endpoint) and for model catalog items.
- Keyboard:
  - Full keyboard access for all actions (tab navigation, arrow keys in lists, Cmd+K for focus search, Cmd+N new chat, etc.).
  - Provide a discoverable shortcuts guide (Help > Keyboard Shortcuts) and ensure commands work with macOS Command-menu system.
- Adjustable text sizes, high-contrast theme, and logical tab/focus order for all windows and dialogs.

## 7. Architecture & Technical Details

### 7.1 Runtime Choices (explicit constraints)
- Primary: Llama.cpp / GGML-style runtimes for in-process inference (works cross-CPU/GPU on macOS). Support quantized model formats (4-bit/8-bit) to reduce memory usage.
- ONNX: support ONNX backends where models are available in that format.
- NO mandatory Core ML conversion: The app won't require converting models to Core ML for initial functionality. If/when Core ML is supported later, it will be an optional runtime adapter.

### 7.2 Process & Endpoint Model
- Model runtime will be exposed via one of these patterns (prioritizing security):
  1. XPC helper process that runs the model runtime and exposes an IPC API for commands (preferred for sandboxing).
  2. In-process library with strict capability checks (only if XPC isn't feasible for some runtimes).
  3. Lightweight local HTTP/gRPC endpoint as an opt-in feature for advanced users (restrict to localhost, require confirmation, and careful firewalling).

### 7.3 Storage & Downloads
- Store models in user container (~/Library/Application Support/Perspective Studio/models) or user-designated folder.
- Use memory-mapped IO where supported for model weights to reduce peak RAM usage.
- Downloads use `URLSession` with resumable background tasks and persist `resumeData`. Verify file integrity (SHA256) and present the license and checksum to user before installing.

### 7.4 Security & Privacy
- Threat model: untrusted model files, remote-hosted payloads, and optional code execution. Mitigations: checksum/signature verification, least-privilege helper processes, signed code, sandboxing, and explicit user consents.
- Do not execute arbitrary native binaries downloaded from hosts. Support only model files consumed by known runtimes.
- Telemetry must be opt-in. Do not upload user prompts or proprietary data without explicit consent.

## 8. Quality Gates & Test Plan

- Accessibility tests:
  - Manual VoiceOver script covering onboarding, catalog browsing, download & install, chat interaction, RAG retrieval, and local endpoint creation.
  - Automated UI tests (XCTest) asserting accessibility labels, focus order, and presence of announcements for live updates where possible.
- Security audits: threat model review, static dependency scan, and a security review for the code-execution paths and download manager.
- Performance benchmarks (per supported hardware type): memory at model load, inference throughput (tokens/sec), model load time, and UI responsiveness. Define budgets per model class (small/medium/large).
- Licensing/compliance: legal sign-off for model catalog entries. The app must display license summaries when a user attempts to download.

## 9. UX Flows (high-level)

- Onboarding: choose experience level → recommendations shown → quick demo chat with sample prompts.
- Model discovery: search/sort/filter catalog → view metadata and host link → user chooses Download or Import.
- Download flow: confirm license & checksum → start download → accessible progress UI → install → option to create local endpoint.
- Chat & inference: open or create chat → pick model via inline `@model-name` or model picker → run prompt → receive response (VoiceOver announces result).

## 10. Rollout & Roadmap
- Phase 1 (Alpha): core chat UI, model catalog UI, downloads from third-party hosts, local runtime with a single supported runtime (Llama.cpp/GGML), accessibility validation.
- Phase 2 (Beta): local endpoint creation (XPC), RAG basics, code-run sandbox proof-of-concept, CloudKit metadata sync, Siri Shortcuts donation.
- Phase 3 (General): expanded runtime adapters (ONNX), more model catalog entries, improved performance tuning, optional Core ML conversion as an extra adapter (if product decides later).

## 11. Open Questions & Decisions (for stakeholders)
1. Minimum supported macOS version and hardware floor (recommend macOS 13/14+, support Apple Silicon and Intel where feasible). This choice affects available APIs (Shortcuts, SwiftUI features) and runtime/tooling.
2. Model hosting relationships: Are there preferred third-party hosts or official mirrors we want to include? Who will maintain the curated catalog?
3. Telemetry policy and opt-in wording for user data and performance telemetry.

## 12. Appendices

### A. Model Catalog Template (example)
```json
{
  "id": "vicuna-13b-v1",
  "name": "Vicuna 13B",
  "version": "1.0",
  "size_bytes": 42000000000,
  "quantized": "4-bit",
  "recommended_ram_gb": 16,
  "supported_runtimes": ["llama.cpp", "ggml", "onnx"],
  "license_summary": "Research license - non-commercial use only",
  "license_url": "https://example.com/license",
  "download_url": "https://third-party-host.example.com/vicuna-13b-ggml.bin",
  "sha256": "<hex-sha256-checksum>",
  "provenance": { "source": "official-mirror", "mirror_contact": "ops@example.com" }
}
```

Notes: The app should display license_summary and license_url before download. If license prohibits redistribution, the app must not host or redistribute the binary.

### B. VoiceOver Test Script (short)
1. Launch app, ensure VoiceOver is enabled.
2. Navigate onboarding: ensure each screen has a helpful label and next button announced.
3. Open Model Catalog: VoiceOver reads model name, license summary, recommended RAM, and 'Download' button.
4. Start a download: VoiceOver announces progress updates and completion.
5. Open a chat: send prompt, ensure response is announced and read as an accessible attributed string.

### C. Acceptance Criteria Checklist (summary)
- All screens pass automated AX label checks.
- VoiceOver manual script passes (no missing labels, news announcements present).
- Model downloads resume after interruption and checksum verified on install.
- Local endpoint can be created and responds to test prompt within the performance budget.

---

## Completion & Next Steps
- File: `PRD/PRODUCT_REQUIREMENTS.md` (this document).
- Next: review open questions (macOS min, catalog maintainers, telemetry). After review, I will add or expand the Model Catalog (appendix B) and acceptance test artifacts (VoiceOver scripts and sample XCTest cases) as requested.

Contact: add engineering and legal reviewer names in the review step when ready.
