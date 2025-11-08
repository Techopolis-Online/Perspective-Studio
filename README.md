# Perspective Studio

Beginner-friendly, fully accessible local LLM desktop app inspired by LM Studio — built with Electron, React, Vite, and TypeScript.


## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Development](#development)
- [Building & Distribution](#building--distribution)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Chat](#chat)
  - [Models](#models)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Menus](#menus)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Community & Updates](#community--updates)
- [Donate](#donate)
- [Reporting Issues](#reporting-issues)
- [Contributing](#contributing)
- [Security](#security)
- [Code of Conduct](#code-of-conduct)
- [License](#license)


## Overview
Perspective Studio provides an approachable desktop experience for running and interacting with local LLMs. It focuses on accessibility, sensible defaults, and streamlined workflows for beginners and power users alike.


## Features
- Accessible UI with proper screen reader labels
- First-run onboarding (Beginner vs Power User)
- iMessage‑style chat with per‑conversation system prompt and temperature
- Local models via Ollama (pull/manage models with Ollama)
- Download manager with progress (optional TTS announcements)
- Ollama backend over local HTTP (only, for now)


## Requirements
- Node.js 18+ (20+ recommended)
- npm 9+
- Windows, macOS, or Linux
- Optional: [Ollama](https://ollama.com) for local models


## Installation
```bash
npm install
```


## Quick Start
```bash
npm run dev
```
This starts:
- TypeScript build for Electron main/preload (watch mode)
- Vite dev server for the renderer
- Electron pointed at the dev server


## Development
Common scripts:
- `npm run dev` — run Electron + Vite in development
- `npm run build` — type-check and build Electron and renderer
- `npm run start` — run Electron using built files in `dist/`
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks (all tsconfigs)


## Building & Distribution
The project uses `electron-builder` for packaging.

- Build and create installers (see `package.json > build`):
```bash
npm run dist:build
```

- Build unpacked directory only (no installer):
```bash
npm run dist:dir
```

Artifacts are written to `release/`.


## Project Structure
```
electron/           # main process, preload, IPC
src/                # React renderer
dist/               # build output (gitignored)
.github/workflows/  # CI
```


## Configuration
- Production builds apply a strict Content Security Policy (see `electron/main.ts`).
- External links open in the system browser.
- Node integration is disabled in the renderer; preload uses context isolation.


## Usage
### Chat
- Create new conversations, adjust per‑chat system prompt and temperature.
- Press Enter to send (Shift+Enter for newline).

### Models
- Integrates with Ollama over local HTTP. Ensure Ollama is installed and the desired models are available.

### Keyboard Shortcuts
- Ctrl+1: Chat
- Ctrl+2: Catalog
- Ctrl+3: Downloads
- Ctrl+4: Settings
- Ctrl/Cmd+N: New Chat

### Menus
- File: New Chat, Settings, Recent Chats
- View: Reload, Zoom controls, Fullscreen
- Window: Section navigation shortcuts
- Help: Documentation, Report an Issue


## Troubleshooting
- Ensure Ollama is running locally if you intend to use it.
- If the renderer fails to load during development, verify the Vite dev server is running and reachable (default `http://localhost:5173`).
- On production builds, CSP is enforced — avoid inline scripts/styles that violate CSP.


## FAQ
**Q: Where are conversations stored?**  
A: Conversations are currently stored locally (e.g., via `localStorage`) and not synced to the cloud.

**Q: Can I bring my own models?**  
A: Yes — install models via Ollama or supported backends and select them in the app.


## Community & Updates
Join our Discord to stay up to date, ask questions, and connect with the community.

- Invite: [Discord Invite](https://discord.com/invite/ugH9xwFd4N)
- Real-time repository activity in the `#community-commits` channel (new commits, PRs, releases)
- Note: The `#community-commits` channel can be high traffic. Feel free to mute or customize notifications per channel.


## Donate
If you’d like to support the project, you can donate here: [Donate via Square](https://square.link/u/llukFoWd).

## Reporting Issues
Please open issues here: [GitHub Issues](https://github.com/Techopolis-Online/Perspective-Studio/issues)


## Contributing
We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branching, PR guidelines, and code style.


## Security
If you discover a security vulnerability, please follow the process in [SECURITY.md](./SECURITY.md). Do not open public issues for security reports.


## Code of Conduct
This project follows the Contributor Covenant. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).


## License
MIT — see [LICENSE](./LICENSE).
