//
//  NetworkError.swift
//  Perspective Studio
//
//  Created by Copilot on 10/29/25.
//

import Foundation

/// Represents network-related errors that can occur during model catalog operations
enum NetworkError: LocalizedError {
    case invalidURL
    case noConnection
    case serverError(statusCode: Int)
    case badResponse
    case timeout
    case cancelled
    case urlError(URLError)
    case unknown(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The URL is invalid or malformed."
        case .noConnection:
            return "Unable to connect to the server. Please check your internet connection."
        case .serverError(let statusCode):
            return "Server returned an error (HTTP \(statusCode)). Please try again later."
        case .badResponse:
            return "Received an invalid response from the server."
        case .timeout:
            return "The connection timed out. Please try again."
        case .cancelled:
            return "The operation was cancelled."
        case .urlError(let error):
            return error.localizedDescription
        case .unknown(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }
    
    var recoverySuggestion: String? {
        switch self {
        case .invalidURL:
            return "Please contact support if this problem persists."
        case .noConnection:
            return "Check your network connection and try refreshing the catalog."
        case .serverError:
            return "The server may be temporarily unavailable. Try again in a few minutes."
        case .badResponse:
            return "Try refreshing the catalog. If the problem continues, contact support."
        case .timeout:
            return "Check your network connection and try again."
        case .cancelled:
            return nil
        case .urlError:
            return "Check your network settings and try again."
        case .unknown:
            return "Please try again or contact support if the problem persists."
        }
    }
    
    /// Convert NSError or URLError to NetworkError
    static func from(_ error: Error) -> NetworkError {
        if let urlError = error as? URLError {
            return .from(urlError)
        }
        
        let nsError = error as NSError
        
        // Check for NSURLErrorDomain errors
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost:
                return .noConnection
            case NSURLErrorTimedOut:
                return .timeout
            case NSURLErrorCancelled:
                return .cancelled
            case NSURLErrorBadServerResponse:
                return .badResponse
            default:
                return .urlError(URLError(URLError.Code(rawValue: nsError.code)))
            }
        }
        
        return .unknown(error)
    }
    
    /// Convert URLError to NetworkError
    static func from(_ error: URLError) -> NetworkError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost:
            return .noConnection
        case .timedOut:
            return .timeout
        case .cancelled:
            return .cancelled
        case .badServerResponse:
            return .badResponse
        case .badURL:
            return .invalidURL
        default:
            return .urlError(error)
        }
    }
}
