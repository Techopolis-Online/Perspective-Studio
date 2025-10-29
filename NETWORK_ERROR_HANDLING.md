# Network Error Handling and Troubleshooting

## Overview
This document describes the network error handling implementation in Perspective Studio and provides solutions for common network-related issues.

## Error Handling Architecture

### NetworkError Enum
The `NetworkError` enum provides typed error cases for all network operations:
- `invalidURL`: The URL is malformed
- `noConnection`: No internet connection available
- `serverError(statusCode)`: HTTP error from server
- `badResponse`: Invalid response format
- `timeout`: Connection timeout
- `cancelled`: User cancelled operation
- `urlError(URLError)`: Wrapped URLError
- `unknown(Error)`: Unexpected errors

### NetworkService
The `NetworkService` class provides:
- Real-time network connectivity monitoring using `Network` framework
- Automatic retry logic with exponential backoff
- Proper timeout handling
- NSURLErrorDomain error translation

## Common Issues and Solutions

### NSURLErrorDomain error -1011
**Problem**: "Catalog refresh failed: The operation couldn't be completed. (NSURLErrorDomain error -1011.)"

**Cause**: HTTP status code indicating a bad response from the server. This typically occurs when:
- The server returned an error response (4xx or 5xx)
- The response format is invalid
- Network middleware (proxy, firewall) is blocking the request

**Solutions**:
1. Check your internet connection
2. Verify the catalog URL is accessible (default: GitHub API)
3. Disable VPN or proxy temporarily to test
4. Check firewall settings for the app
5. Try refreshing after a few minutes (server may be temporarily unavailable)

The app now handles this automatically by:
- Falling back to cached catalog when network fails
- Showing user-friendly error messages with retry option
- Logging detailed error information for debugging

### Task Port Error (os/kern) failure (0x5)
**Problem**: "Unable to obtain a task name port right for pid XXX: (os/kern) failure (0x5)"

**Important**: This is **NOT** a runtime application error. This is a **development/debugging environment issue**.

**Context**: This error occurs when:
- Using debuggers like GDB or LLDB without proper code signing
- System Integrity Protection (SIP) blocks debugger access
- The debugger certificate is not trusted

**This error does NOT affect**:
- End users running the application
- Normal application functionality
- Model downloads or catalog operations

**If you see this during development**:
1. This is a debugging permission issue, not an app bug
2. It does not prevent the app from running
3. It only affects debugging/development tools
4. Users will never see this error

**Solutions for developers**:
1. Use Xcode's built-in LLDB debugger (recommended)
2. Codesign your debugger with a trusted certificate
3. Adjust SIP settings if necessary (see Apple documentation)
4. Ensure Xcode and developer tools are up to date

## Network Permissions

### Info.plist Configuration
The app includes App Transport Security (ATS) settings for secure connections:
- Secure HTTPS connections to ollama.com
- Secure HTTPS connections to huggingface.co  
- Secure HTTPS connections to github.com (for catalog)
- No insecure HTTP loads allowed

### Required Entitlements
- Network client access (outgoing connections)
- Background downloads (for large model files)

## Testing Network Error Handling

### Simulating Network Errors
To test error handling during development:

1. **No Connection**: Turn off Wi-Fi/Ethernet
2. **Timeout**: Use Network Link Conditioner (Xcode > Developer Tools)
3. **Server Error**: Point catalog URL to non-existent endpoint
4. **Bad Response**: Use invalid catalog URL format

### Expected Behavior
When network errors occur:
1. User sees error banner with description
2. Cached catalog remains available
3. Retry button allows manual retry
4. VoiceOver announces errors
5. Downloads fail gracefully with error message

## Implementation Details

### Retry Logic
- Maximum 3 attempts for catalog refresh
- Exponential backoff: 0.5s, 1s, 2s delays
- No retry for user-cancelled operations

### Error Propagation
```swift
// ModelCatalogService throws NetworkError
func refreshCatalog() async throws -> [ModelMetadata]

// CatalogViewModel catches and exposes to UI
@Published var lastError: NetworkError?

// UI shows ErrorBanner when lastError is set
if let error = viewModel.lastError {
    ErrorBanner(error: error, ...)
}
```

### Download Error Handling
Downloads handle errors through `URLSessionDownloadDelegate`:
- Network errors → `DownloadError.network`
- Cancelled downloads → `DownloadError.cancelled`
- Checksum failures → `DownloadError.checksumMismatch`
- File system errors → `DownloadError.permissionDenied`

## User-Facing Error Messages

All errors include:
- **Description**: What went wrong
- **Recovery Suggestion**: How to fix it
- **Retry Option**: Try again button
- **Dismiss Option**: Close error banner

Example:
```
Network Error
Unable to connect to the server. Please check your internet connection.
Check your network connection and try refreshing the catalog.
[Retry] [Dismiss]
```

## Logging

Network operations log to console:
- Connection status changes
- Retry attempts with delay
- Success/failure of operations
- Detailed error descriptions

Use Console.app to view logs from running app:
```
log stream --predicate 'subsystem == "com.perspectiveStudio"'
```

## Future Improvements

Potential enhancements:
- SHA256 checksum verification implementation
- Resume data persistence for interrupted downloads
- Background refresh of catalog
- Offline mode indicators
- Network speed estimation for downloads
