//
//  SystemInfo.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Foundation

struct SystemInfo: Codable {
    let totalMemoryBytes: UInt64
    let processorCount: Int
    let activeProcessorCount: Int
    let hostName: String
    let osVersion: String

    static var current: SystemInfo {
        let processInfo = ProcessInfo.processInfo
        let hostName = Host.current().localizedName ?? "Mac"
        let osVersion = processInfo.operatingSystemVersionString
        return SystemInfo(
            totalMemoryBytes: processInfo.physicalMemory,
            processorCount: processInfo.processorCount,
            activeProcessorCount: processInfo.activeProcessorCount,
            hostName: hostName,
            osVersion: osVersion
        )
    }

    var totalMemoryGigabytes: Double {
        Double(totalMemoryBytes) / 1_073_741_824.0
    }

    var totalMemoryGigabytesRounded: Int {
        max(1, Int((totalMemoryGigabytes).rounded()))
    }

    var memoryDescription: String {
        "\(totalMemoryGigabytesRounded) GB RAM"
    }

    var processorDescription: String {
        let cores = activeProcessorCount == processorCount
            ? "\(activeProcessorCount)-core CPU"
            : "\(activeProcessorCount) of \(processorCount) cores active"
        return "\(hostName) • \(cores) • \(osVersion)"
    }

    var processorSummary: String {
        activeProcessorCount == processorCount
            ? "\(activeProcessorCount)-core CPU"
            : "\(activeProcessorCount)/\(processorCount) cores in use"
    }
}
