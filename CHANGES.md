# Perspective Studio - Recent Changes

## Enhanced Model Catalog Fetching (Latest)

The model catalog service now fetches significantly more models from HuggingFace and Ollama:

- **Expanded HuggingFace Coverage**: Increased from 400 to 10,000 models
- **Complete Ollama Registry**: Now fetches all available Ollama models (previously limited to 60)
- **Additional Model Sources**: Added queries for popular providers:
  - Bartowski (quantized models)
  - Microsoft official models
  - Meta Llama official models
  - Mistral AI official models
  - Google official models
  - Recently updated models
  - Quantized model search
- **Enhanced Logging**: Detailed progress tracking during catalog refresh
- **Maintained Security**: Continues to filter out gated and private models that require authentication tokens

See `CATALOG_FETCHING.md` for technical details about the fetching process.

## Updates to Model Catalog and Detail Views

### Model Catalog Grid Improvements
The model catalog now displays models in an adaptive grid layout that automatically adjusts to show multiple columns based on screen width:

- **Adaptive Grid Layout**: Changed from single column to adaptive grid (280-400px per item)
- **Enhanced Visual Design**: 
  - Each model card shows the model name and file size
  - Preferred models are marked with a star icon
  - Cards have background color and border for better visual separation
  - Focused items have accent color highlight for keyboard navigation
- **Better Information Display**: Size information is immediately visible without opening details

### Model Detail View Enhancements
The model detail view now provides comprehensive information with improved visibility:

- **Prominent Action Buttons**: All action buttons now use bordered or borderedProminent styles for better visibility
- **Clear "Open on Hugging Face" Button**: Dedicated button with clear labeling for Hugging Face hosted models
- **Additional Helpful Information**: 
  - Added information about download resumability and integrity verification
  - Clear system compatibility indicators
  - Beginner-friendly tips and explanations
- **Improved Accessibility**: All buttons have proper accessibility hints explaining their purpose

### Features Already Implemented
✅ **Real Download Manager**: Full-featured download manager with:
  - Pause/resume/cancel functionality
  - SHA256 checksum verification
  - Background download support
  - Progress tracking with speed indicators
  - Error handling with detailed messages

✅ **Accessible Filters**: Using Menu components (not segmented controls) for:
  - Runtime filtering
  - Source/host filtering
  - Tag filtering
  - Compatibility filtering

✅ **Full Accessibility Support**:
  - VoiceOver announcements for all actions
  - Proper accessibility labels and hints
  - Keyboard navigation support
  - Focus management
  - WCAG 2.1 AA compliance

### Building the Project
This is a macOS application built with SwiftUI. To build:

1. Open `Perspective Studio.xcodeproj` in Xcode
2. Select macOS as the target platform
3. Build and run (⌘R)

### Requirements
- macOS 13.0 or later
- Xcode 15.0 or later
- Swift 5.0 or later

### Architecture
- **SwiftUI**: Modern declarative UI framework
- **Combine**: Reactive data flow
- **URLSession**: Network downloads with background support
- **CryptoKit**: SHA256 verification
- **Accessibility**: Full VoiceOver and keyboard support

### Key Components
- `ModelCatalogView`: Grid display of available models
- `ModelDetailView`: Comprehensive model information sheet
- `DownloadManager`: Handles all model downloads
- `ModelCatalogService`: Fetches models from Hugging Face and Ollama
- `RuntimeManager`: Manages model loading (placeholder for future runtime integration)
