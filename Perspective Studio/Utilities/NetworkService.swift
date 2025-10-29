//
//  NetworkService.swift
//  Perspective Studio
//
//  Created by Copilot on 10/29/25.
//

import Foundation
import Network

/// Service to monitor network connectivity and perform network operations
final class NetworkService {
    static let shared = NetworkService()
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.perspectiveStudio.networkMonitor")
    private(set) var isConnected = true
    
    private init() {
        startMonitoring()
    }
    
    deinit {
        stopMonitoring()
    }
    
    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isConnected = path.status == .satisfied
            if path.status == .satisfied {
                NSLog("Network connection available")
            } else {
                NSLog("Network connection lost")
            }
        }
        monitor.start(queue: queue)
    }
    
    private func stopMonitoring() {
        monitor.cancel()
    }
    
    /// Perform a network request with retry logic and proper error handling
    func performRequest(
        url: URL,
        maxRetries: Int = 3,
        timeout: TimeInterval = 30
    ) async throws -> Data {
        // Check network connectivity first
        guard isConnected else {
            throw NetworkError.noConnection
        }
        
        var lastError: NetworkError?
        
        for attempt in 0..<maxRetries {
            do {
                let configuration = URLSessionConfiguration.default
                configuration.timeoutIntervalForRequest = timeout
                configuration.timeoutIntervalForResource = timeout * 2
                
                let session = URLSession(configuration: configuration)
                
                let (data, response) = try await session.data(from: url)
                
                // Validate response
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw NetworkError.badResponse
                }
                
                // Handle HTTP status codes
                switch httpResponse.statusCode {
                case 200...299:
                    return data
                case 400...499:
                    throw NetworkError.serverError(statusCode: httpResponse.statusCode)
                case 500...599:
                    throw NetworkError.serverError(statusCode: httpResponse.statusCode)
                default:
                    throw NetworkError.badResponse
                }
                
            } catch {
                lastError = NetworkError.from(error)
                
                // Don't retry on certain errors
                if case .cancelled = lastError {
                    throw lastError!
                }
                
                // Log retry attempt
                if attempt < maxRetries - 1 {
                    NSLog("Network request failed (attempt \(attempt + 1)/\(maxRetries)): \(error.localizedDescription)")
                    // Exponential backoff
                    let delay = pow(2.0, Double(attempt)) * 0.5
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                } else {
                    NSLog("Network request failed after \(maxRetries) attempts: \(error.localizedDescription)")
                }
            }
        }
        
        throw lastError ?? NetworkError.unknown(NSError(domain: "NetworkService", code: -1, userInfo: nil))
    }
}
