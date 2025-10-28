//
//  OnboardingFlowView.swift
//  Perspective Studio
//
//  Created by Codex on 10/28/25.
//

import SwiftUI

struct OnboardingFlowView: View {
    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = min(proxy.size.width * 0.9, 720)
            let verticalPadding = max((proxy.size.height - 640) / 2, 32)

            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: verticalPadding)

                    VStack(alignment: .leading, spacing: 24) {
                        Text("Perspective Studio Setup")
                            .font(.largeTitle.bold())
                            .accessibilityAddTraits(.isHeader)

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Setup Progress")
                                    .font(.headline)
                                Spacer()
                                Text("\(Int(progress * 100))%")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .accessibilityHidden(true)
                            }

                            Text(viewModel.stepPositionDescription)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            ProgressView(value: progress)
                                .progressViewStyle(.linear)
                                .tint(.accentColor)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Onboarding progress")
                        .accessibilityValue(
                            Text("\(viewModel.stepPositionDescription), \(Int(progress * 100)) percent complete")
                        )

                        VStack(alignment: .leading, spacing: 16) {
                            switch viewModel.currentStep {
                            case .welcome:
                                OnboardingWelcomeStep()
                            case .experienceLevel:
                                OnboardingExperienceLevelStep(
                                    selectedLevel: $viewModel.selectedExperienceLevel
                                )
                            case .summary:
                                OnboardingSummaryStep(
                                    experienceLevel: viewModel.selectedExperienceLevel,
                                    systemInfo: viewModel.systemInfo
                                )
                            }
                        }

                        HStack {
                            Button("Back") {
                                viewModel.back()
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.large)
                            .disabled(!viewModel.canGoBack)
                            .keyboardShortcut(.cancelAction)
                            .help("Go back to the previous step")

                            Spacer()

                            Button(continueButtonTitle) {
                                viewModel.next()
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .keyboardShortcut(.defaultAction)
                            .help("Advance to the next step")
                            .accessibilityLabel(continueButtonAccessibilityLabel)
                        }
                    }
                    .padding(28)
                    .frame(maxWidth: cardWidth, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Color(NSColor.windowBackgroundColor))
                            .shadow(color: .black.opacity(0.12), radius: 18, x: 0, y: 8)
                    )
                    .padding(.horizontal, max((proxy.size.width - cardWidth) / 2, 16))

                    Spacer(minLength: max(verticalPadding, 32))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(
                LinearGradient(
                    colors: [
                        Color.accentColor.opacity(0.12),
                        Color(NSColor.windowBackgroundColor)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
        }
    }

    private var progress: Double {
        let total = Double(OnboardingViewModel.Step.allCases.count - 1)
        guard total > 0 else { return 1 }
        return Double(viewModel.currentStep.rawValue) / total
    }

    private var continueButtonTitle: String {
        if viewModel.currentStep == .summary {
            return "Finish Setup"
        }
        if let nextTitle = viewModel.nextStepTitle {
            return "Continue to \(nextTitle)"
        }
        return "Continue"
    }

    private var continueButtonAccessibilityLabel: String {
        if viewModel.currentStep == .summary {
            return "Finish setup"
        }
        if let nextTitle = viewModel.nextStepTitle {
            return "Continue to \(nextTitle)"
        }
        return "Continue to the next step"
    }
}

// MARK: - Step Views

private struct OnboardingWelcomeStep: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Welcome")
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)

            Text("Perspective Studio brings on-device AI to everyone with approachable controls and guidance tailored to your experience.")
                .font(.body)
            Text("We'll guide you through a brief setup to tailor the experience to your needs.")
                .font(.body)
        }
    }
}

private struct OnboardingExperienceLevelStep: View {
    @Binding var selectedLevel: UserSettings.ExperienceLevel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How experienced are you with AI tools?")
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)

            Text("Choose the description that feels closest to you and we'll match the interface and tips to that level.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            ForEach(UserSettings.ExperienceLevel.allCases) { level in
                Button {
                    selectedLevel = level
                    VoiceOverAnnouncer.announce("\(level.displayName) selected.")
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Image(systemName: selectedLevel == level ? "largecircle.fill.circle" : "circle")
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(level.displayName)
                                .font(.headline)
                            Text(level.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(level.displayName))
                .accessibilityValue(Text(selectedLevel == level ? "Selected" : "Not selected"))
                .accessibilityHint(Text(level.description))
            }
        }
    }
}

private struct OnboardingSummaryStep: View {
    let experienceLevel: UserSettings.ExperienceLevel
    let systemInfo: SystemInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ready to start")
                .font(.title2.bold())
                .accessibilityAddTraits(.isHeader)

            LabeledContent("Experience Level") {
                Text(experienceLevel.displayName)
            }

            Text(experienceSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            LabeledContent("System Overview") {
                VStack(alignment: .leading) {
                    Text("\(systemInfo.memoryDescription)")
                    Text("\(systemInfo.processorDescription)")
                        .foregroundStyle(.secondary)
                }
            }

            Text("You can switch experience levels or tweak preferences anytime from the app settings.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var experienceSummary: String {
        switch experienceLevel {
        case .beginner:
            return "We'll guide you one step at a time with simple explanations and safe defaults."
        case .intermediate:
            return "You'll get friendly defaults plus quick access to advanced options when you need them."
        case .expert:
            return "You're all set for full control over model runtimes, endpoints, and automation tools."
        }
    }
}
