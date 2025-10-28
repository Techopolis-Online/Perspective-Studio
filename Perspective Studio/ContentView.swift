//
//  ContentView.swift
//  Perspective Studio
//
//  Created by Taylor Arndt on 10/28/25.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appViewModel: AppViewModel

    var body: some View {
        Group {
            switch appViewModel.phase {
            case .onboarding:
                OnboardingFlowHost(appViewModel: appViewModel)
            case .ready:
                MainWindowView()
            }
        }
        .sheet(isPresented: $appViewModel.showKeyboardShortcuts) {
            KeyboardShortcutsView()
                .environmentObject(appViewModel)
                .frame(minWidth: 500, minHeight: 400)
        }
    }
}

private struct OnboardingFlowHost: View {
    @StateObject private var viewModel: OnboardingViewModel

    init(appViewModel: AppViewModel) {
        _viewModel = StateObject(wrappedValue: OnboardingViewModel(appViewModel: appViewModel))
    }

    var body: some View {
        OnboardingFlowView(viewModel: viewModel)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppViewModel(phase: .ready))
}
