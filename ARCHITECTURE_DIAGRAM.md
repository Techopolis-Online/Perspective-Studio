# Network Error Handling Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐         ┌──────────────────────┐         │
│  │ ModelCatalogView     │         │ DownloadManagerView  │         │
│  │ ┌──────────────────┐ │         │ ┌──────────────────┐ │         │
│  │ │  ErrorBanner     │ │         │ │  DownloadRow     │ │         │
│  │ │  - Description   │ │         │ │  - Progress      │ │         │
│  │ │  - Retry         │ │         │ │  - Status        │ │         │
│  │ │  - Dismiss       │ │         │ │  - Actions       │ │         │
│  │ └──────────────────┘ │         │ └──────────────────┘ │         │
│  │  Loading Indicator   │         │                      │         │
│  └──────────────────────┘         └──────────────────────┘         │
│           │                                   │                      │
└───────────┼───────────────────────────────────┼──────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ViewModel Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐         ┌──────────────────────┐         │
│  │ CatalogViewModel     │         │ AppViewModel         │         │
│  │ • models             │         │ • downloads          │         │
│  │ • isRefreshing       │◄────────┤ • catalog            │         │
│  │ • lastError          │         │ • userSettings       │         │
│  │ refresh()            │         │ refreshCatalog()     │         │
│  │ dismissError()       │         │ startDownload()      │         │
│  └──────────────────────┘         └──────────────────────┘         │
│           │                                   │                      │
└───────────┼───────────────────────────────────┼──────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ ModelCatalogService                                       │      │
│  │ • loadInitialCatalog() -> [ModelMetadata]                │      │
│  │ • refreshCatalog() async throws -> [ModelMetadata]       │      │
│  │   ├─ Check connectivity (NetworkService)                 │      │
│  │   ├─ Perform request with retry                          │      │
│  │   ├─ Parse response (JSON/GitHub API)                    │      │
│  │   ├─ Cache to disk                                        │      │
│  │   └─ Fallback to cached on error                         │      │
│  └──────────────────────────────────────────────────────────┘      │
│                              │                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ DownloadManager (URLSessionDownloadDelegate)             │      │
│  │ • enqueueDownload(_ model)                               │      │
│  │   ├─ Check connectivity (NetworkService)                 │      │
│  │   ├─ Create download task                                │      │
│  │   └─ Track progress                                       │      │
│  │ • pause(_ download)                                       │      │
│  │ • resume(_ download)                                      │      │
│  │ • cancel(_ download)                                      │      │
│  │                                                           │      │
│  │ Delegate Methods:                                         │      │
│  │ • didFinishDownloading() - Move file, verify checksum    │      │
│  │ • didWriteData() - Update progress                        │      │
│  │ • didCompleteWithError() - Handle failure                 │      │
│  └──────────────────────────────────────────────────────────┘      │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Utility Layer                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ NetworkService                                            │      │
│  │ • monitor: NWPathMonitor                                  │      │
│  │ • isConnected: Bool                                       │      │
│  │ • performRequest(url, maxRetries, timeout)               │      │
│  │   ├─ Check isConnected                                    │      │
│  │   ├─ Create URLSession with timeout                       │      │
│  │   ├─ Attempt request                                      │      │
│  │   ├─ Validate HTTP status                                 │      │
│  │   ├─ On failure: exponential backoff retry               │      │
│  │   └─ Return data or throw NetworkError                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                              │                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ NetworkError (enum)                                       │      │
│  │ • invalidURL                                              │      │
│  │ • noConnection                                            │      │
│  │ • serverError(statusCode)                                 │      │
│  │ • badResponse                                             │      │
│  │ • timeout                                                 │      │
│  │ • cancelled                                               │      │
│  │ • urlError(URLError)                                      │      │
│  │ • unknown(Error)                                          │      │
│  │                                                           │      │
│  │ Methods:                                                  │      │
│  │ • errorDescription → User-friendly message               │      │
│  │ • recoverySuggestion → How to fix                         │      │
│  │ • from(Error) → Convert NSError/URLError                 │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Error Flow

```
Network Operation
        │
        ▼
   Try Request ─────────────┐
        │                   │
        │ Success           │ Failure
        ▼                   ▼
   Return Data      Convert to NetworkError
                            │
                            ▼
                    Log & Propagate to ViewModel
                            │
                            ▼
                    Set @Published var lastError
                            │
                            ▼
                    UI Updates (ErrorBanner)
                            │
                            ▼
                    VoiceOver Announcement
                            │
                    ┌───────┴───────┐
                    │               │
              User Retries    User Dismisses
                    │               │
                    ▼               ▼
              Try Again       Clear Error
```

## Retry Logic

```
Attempt 1
    │
    ▼ Fail
Wait 0.5s
    │
    ▼
Attempt 2
    │
    ▼ Fail
Wait 1.0s
    │
    ▼
Attempt 3
    │
    ▼ Fail
Show Error
```

## Download State Machine

```
                    ┌──────────────┐
                    │  notStarted  │
                    └──────┬───────┘
                           │ enqueue()
                           ▼
    ┌─────────────► ┌────────────┐
    │ resume()      │ inProgress │
    │               └──────┬─────┘
    │                      │ progress updates
    │                      │
    │               ┌──────┴──────────┬──────────┐
    │               │                 │          │
    │        pause()│          cancel()│    complete()
    │               ▼                 ▼          ▼
    │          ┌────────┐      ┌─────────┐  ┌──────────┐
    └──────────┤ paused │      │cancelled│  │verifying │
               └────────┘      └─────────┘  └────┬─────┘
                                                  │
                                      ┌───────────┴──────────┐
                                      │ checksum ok          │ checksum fail
                                      ▼                      ▼
                                ┌───────────┐         ┌──────────┐
                                │ completed │         │  failed  │
                                └───────────┘         └──────────┘
```

## Configuration

### Info.plist (App Transport Security)

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>ollama.com</key>        <!-- HTTPS only -->
        <key>huggingface.co</key>    <!-- HTTPS only -->
        <key>github.com</key>        <!-- HTTPS only -->
    </dict>
</dict>
```

## Key Improvements

### Before
- ❌ Simulated downloads
- ❌ No error handling
- ❌ No retry logic
- ❌ No user feedback on errors
- ❌ No network monitoring

### After
- ✅ Real URLSession downloads
- ✅ Comprehensive error handling
- ✅ Automatic retry with backoff
- ✅ User-friendly error messages
- ✅ Real-time network monitoring
- ✅ Progress tracking
- ✅ Pause/resume/cancel
- ✅ VoiceOver support
- ✅ Offline mode with cache
- ✅ Security (ATS enforced)
