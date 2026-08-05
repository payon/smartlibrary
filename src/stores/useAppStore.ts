import { create } from 'zustand'
import type { FontSize, ViewName } from '@/lib/constants'

export interface SimUser {
  id: string
  name: string
  birthDate: string
  phone: string
  address: string
  cardType: string
  cardNumber: string
  cardIssued: string
  pin: string
  isActive: boolean
  createdAt: string
}

export interface BookItem {
  id: string
  isbn: string
  title: string
  author: string
  publisher: string
  publishYear: number
  category: string
  shelfLocation: string
  totalCopies: number
  availableCopies: number
  coverUrl: string | null
}

export interface LoanItem {
  id: string
  userId: string
  bookId: string
  loanDate: string
  dueDate: string
  returnDate: string | null
  status: string
  method: string
  extended: boolean
  book?: BookItem
}

export interface ScenarioItem {
  id: string
  title: string
  description: string | null
  difficulty: string
  category: string | null
  orderIndex: number
  stepsJson: string
}

export interface ProgressItem {
  id: string
  userId: string
  scenarioId: string
  stepIndex: number
  completed: boolean
  attempts: number
  bestTimeSec: number | null
  stars: number
}

export interface ScenarioStep {
  step: number
  title: string
  description: string
}

interface AppState {
  // Navigation
  currentView: ViewName
  viewHistory: ViewName[]
  setView: (view: ViewName) => void
  goBack: () => void

  // User
  currentUser: SimUser | null
  setCurrentUser: (user: SimUser | null) => void

  // Accessibility
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  highContrast: boolean
  setHighContrast: (enabled: boolean) => void
  ttsEnabled: boolean
  setTtsEnabled: (enabled: boolean) => void

  // Onboarding
  hasCompletedOnboarding: boolean
  setHasCompletedOnboarding: (completed: boolean) => void

  // Kiosk
  kioskTimeoutSeconds: number
  setKioskTimeout: (seconds: number) => void

  // Learning
  isMissionMode: boolean
  currentMissionScenarioId: string | null
  currentMissionStep: number
  setMission: (scenarioId: string | null, step?: number) => void
  setIsMissionMode: (enabled: boolean) => void
  completeMissionStep: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'onboarding',
  viewHistory: [],
  setView: (view) =>
    set((state) => ({
      currentView: view,
      viewHistory: [...state.viewHistory, state.currentView],
    })),
  goBack: () => {
    const { viewHistory } = get()
    if (viewHistory.length > 0) {
      const newHistory = [...viewHistory]
      const prevView = newHistory.pop()!
      set({ currentView: prevView, viewHistory: newHistory })
    }
  },

  // User
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // Accessibility
  fontSize: 'normal',
  setFontSize: (size) => set({ fontSize: size }),
  highContrast: false,
  setHighContrast: (enabled) => set({ highContrast: enabled }),
  ttsEnabled: true,
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),

  // Onboarding
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),

  // Kiosk
  kioskTimeoutSeconds: 60,
  setKioskTimeout: (seconds) => set({ kioskTimeoutSeconds: seconds }),

  // Learning
  isMissionMode: false,
  currentMissionScenarioId: null,
  currentMissionStep: 0,
  setMission: (scenarioId, step = 0) =>
    set({ currentMissionScenarioId: scenarioId, currentMissionStep: step }),
  setIsMissionMode: (enabled) => set({ isMissionMode: enabled }),
  completeMissionStep: () =>
    set((state) => ({ currentMissionStep: state.currentMissionStep + 1 })),
}))
