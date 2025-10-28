//
//  OnboardingViewModel.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import Combine
import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case welcome
        case experienceLevel
        case summary

        var title: String {
            switch self {
            case .welcome:
                return "Welcome"
            case .experienceLevel:
                return "Experience Level"
            case .summary:
                return "Summary"
            }
        }
    }

    @Published var currentStep: Step = .welcome
    @Published var selectedExperienceLevel: UserSettings.ExperienceLevel = .beginner

    private let appViewModel: AppViewModel

    init(appViewModel: AppViewModel) {
        self.appViewModel = appViewModel
    }

    var canGoBack: Bool {
        currentStep != .welcome
    }

    var canAdvance: Bool {
        true
    }

    var stepPositionDescription: String {
        "Step \(currentStep.rawValue + 1) of \(Step.allCases.count)"
    }

    var nextStepTitle: String? {
        Step(rawValue: currentStep.rawValue + 1)?.title
    }

    var systemInfo: SystemInfo {
        appViewModel.systemInfo
    }

    func next() {
        guard let nextStep = Step(rawValue: currentStep.rawValue + 1) else {
            applySelections()
            return
        }
        currentStep = nextStep
    }

    func back() {
        guard let prevStep = Step(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = prevStep
    }

    private func applySelections() {
        appViewModel.updateExperienceLevel(selectedExperienceLevel)
        appViewModel.completeOnboarding()
        VoiceOverAnnouncer.announce("Onboarding complete. Welcome to Perspective Studio.")
    }
}
