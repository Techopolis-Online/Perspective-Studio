# UI Visual Description

## Model Catalog View

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Model Catalog                                                   │
│ Browse on-device ready models, manage downloads...              │
│ Detected system: 16 GB RAM, 8-core CPU                         │
│                                                                 │
│ [Search models.......]  [All runtimes ▼]  [All sources ▼]     │
│                         [All tags ▼]  [Refresh]                │
│                                                                 │
│ [All ▼]                                                        │
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│ │ Llama 3 8B   │  │ Vicuna 13B   │  │ Mistral 7B   │          │
│ │ Instruct  ⭐  │  │              │  │ Instruct     │          │
│ │ 4.5 GB       │  │ 12.1 GB      │  │ 3.4 GB       │          │
│ └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│ │ Phi-3 Mini   │  │ Gemma 2B     │  │ Code Llama   │          │
│ │              │  │              │  │ 7B           │          │
│ │ 2.1 GB       │  │ 1.7 GB       │  │ 6.5 GB       │          │
│ └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features
- **Adaptive Grid**: Automatically adjusts columns based on window width
- **Model Cards**: Each card shows:
  - Model name (headline font)
  - File size (caption font, gray)
  - Star icon (⭐) for preferred models
  - Light background color with subtle border
  - Accent color background when focused (keyboard navigation)
- **Filters**: Accessible dropdown menus for filtering by runtime, source, tags, and compatibility
- **Search**: Text field for searching model names and tags

## Model Detail View (Sheet Modal)

### Layout
```
┌───────────────────────────────────────────────────────────────┐
│ Llama 3 8B Instruct                              [X Close]    │
│ 🤗 Hugging Face  v1.1                                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ✓ Runs great on your device                                  │
│ Your Mac: 16 GB RAM, 8-core CPU                              │
│                                                               │
│ Balanced 8B chat assistant that handles everyday             │
│ questions with friendly, helpful replies.                     │
│                                                               │
│ Helpful Information                                           │
│ ╔═══════════════════════════════════════════════════════════╗ │
│ ║ 💡 Recommended RAM: 12 GB. Your Mac has 16 GB available  ║ │
│ ║ 💡 This version is quantized (compressed) so it saves     ║ │
│ ║    memory while keeping good quality.                     ║ │
│ ║ 💡 Works with runtimes: llama.cpp, ggml. Perspective     ║ │
│ ║    Studio will pick the best one automatically.          ║ │
│ ║ 💡 After downloading, you can reuse the model offline    ║ │
│ ║ ✓ Downloads are resumable and verified for integrity     ║ │
│ ╚═══════════════════════════════════════════════════════════╝ │
│                                                               │
│ Model ID         | Recommended RAM                            │
│ llama-3-8b-q4    | 12 GB recommended                         │
│                                                               │
│ File Size        | Runtimes                                   │
│ 4.5 GB           | llama.cpp, ggml                           │
│                                                               │
│ Tags                                                          │
│ [Featured] [Chat] [Balanced]                                  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │    ⬇ Download Model                                     │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │    Set as Preferred                                     │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │    🌐 Open on Hugging Face                              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Key Features
- **Header**: Model name, host icon and name, version, close button
- **Compatibility Badge**: Green "Runs great" or orange "May need more RAM"
- **Overview**: Beginner-friendly description
- **Helpful Information Section**: 
  - RAM comparison
  - Quantization explanation
  - Runtime information
  - Offline usage note
  - **NEW**: Download integrity information
- **Technical Specs Grid**: Model ID, RAM, Size, Runtimes
- **Tags**: Categorization badges
- **Action Buttons**:
  - **Download Model** (prominent blue button)
  - **Set as Preferred** (bordered button)
  - **Open on Hugging Face** (bordered button with Safari icon) - NEW prominent styling

## Accessibility Features

### VoiceOver Support
- Model cards announce: "Model name, file size, [preferred model]"
- Detail view announces all sections with proper headings
- Action buttons have descriptive hints
- Progress indicators announce percentage completion

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys navigate model grid
- Return/Space activate buttons
- Escape closes modal
- Cmd+R refreshes catalog
- Cmd+Shift+I for import (planned)

### Visual Accessibility
- High contrast mode support
- Adjustable text sizes follow system preferences
- Focus indicators clearly visible
- Color not sole indicator (icons + text)
- Proper semantic headings

## Download Manager View

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Downloads                                                       │
│ Monitor progress, pause/resume, and verify integrity...        │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Llama 3 8B Instruct              Downloading 45%          │  │
│ │ [═══════════════════════          ] 45%                   │  │
│ │ [Pause] [Cancel]                                          │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Mistral 7B Instruct              Completed                │  │
│ │ [═══════════════════════════════════] 100%               │  │
│ │ [Open in Finder]                                          │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Features
- Real-time progress bars
- Speed indicators (when downloading)
- Pause/Resume/Cancel controls
- Verification status
- Error messages with retry option
- "Open in Finder" when complete
