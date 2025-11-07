# Perspective Studio (Electron + React + Vite)

Beginner-friendly, fully accessible local LLM desktop app inspired by LM Studio.

## Features
- Accessible UI with proper screen reader labels
- Onboarding: Beginner vs Power User
- iMessage-style chat UI with system prompt and temperature per conversation
- Hugging Face model catalog (search, view details)
- Download manager with progress and optional TTS announcements
- Pluggable LLM backend (Ollama via local HTTP, more to come)

## Prerequisites
- Node.js 18+ (or 20+ recommended)
- npm 9+
- Windows, macOS, or Linux

## Getting Started
```bash
npm install
npm run dev
```
This starts:
- TypeScript build for Electron main/preload (watch)
- Vite dev server for the renderer
- Electron pointing to the dev server

## Scripts
- `npm run dev`: run Electron + Vite in development
- `npm run build`: type-check/build Electron and renderer
- `npm run dist`: build and package installer via electron-builder
- `npm run start`: run Electron using built files in `dist/`

## Packaging
```bash
npm run dist
```
Artifacts are written under `release/` (see `package.json > build`).

## Project Structure
```
electron/           # main process, preload, IPC
src/                # React renderer
dist/               # build output (gitignored)
.github/workflows/  # CI
```

## Security Notes
- Production builds apply a strict Content Security Policy (see `electron/main.ts`).
- External links are opened in the system browser.
- Node integration is disabled in the renderer; preload is isolated.

## License
MIT — see `LICENSE`.
