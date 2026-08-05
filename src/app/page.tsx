'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import OnboardingView from '@/components/OnboardingView'
import HomeView from '@/components/HomeView'
import SettingsView from '@/components/SettingsView'
import RegistrationView from '@/components/RegistrationView'
import CardIssuanceView from '@/components/CardIssuanceView'
import BookSearchView from '@/components/BookSearchView'
import CounterLoanView from '@/components/CounterLoanView'
import CounterReturnView from '@/components/CounterReturnView'
import KioskLoanView from '@/components/KioskLoanView'
import KioskReturnView from '@/components/KioskReturnView'
import LearningProgressView from '@/components/LearningProgressView'
import CompletionView from '@/components/CompletionView'

export default function Home() {
  const { currentView, fontSize, highContrast, hasCompletedOnboarding, setView } = useAppStore()
  const seededRef = useRef(false)

  // Font size class mapping
  const fontClass = fontSize === 'large' ? 'font-large' : fontSize === 'xlarge' ? 'font-xlarge' : ''

  // Seed data on first mount
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    fetch('/api/seed', { method: 'POST' }).catch(() => {
      // ignore seed errors
    })
  }, [])

  // Redirect to onboarding if not completed, otherwise to home
  useEffect(() => {
    if (currentView === 'onboarding' && hasCompletedOnboarding) {
      setView('home')
    }
  }, [currentView, hasCompletedOnboarding, setView])

  const renderView = () => {
    switch (currentView) {
      case 'onboarding':
        return <OnboardingView />
      case 'home':
        return <HomeView />
      case 'settings':
        return <SettingsView />
      case 'registration':
        return <RegistrationView />
      case 'card-issuance':
        return <CardIssuanceView />
      case 'book-search':
        return <BookSearchView />
      case 'counter-loan':
        return <CounterLoanView />
      case 'counter-return':
        return <CounterReturnView />
      case 'kiosk-loan':
        return <KioskLoanView />
      case 'kiosk-return':
        return <KioskReturnView />
      case 'learning-progress':
        return <LearningProgressView />
      case 'completion':
        return <CompletionView />
      default:
        return <HomeView />
    }
  }

  return (
    <div
      id="app-content"
      className={cn(fontClass, highContrast && 'high-contrast', 'min-h-screen bg-background')}
    >
      {renderView()}
    </div>
  )
}
