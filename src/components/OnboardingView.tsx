'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Hand, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import type { FontSize } from '@/lib/constants'

interface StepData {
  id: number
  title: string
  description: string
  ttsText: string
}

const STEPS: StepData[] = [
  {
    id: 0,
    title: '스마트 도서관 시뮬레이터에 오신 것을 환영합니다!',
    description: '이 앱은 도서관 이용 방법을 쉽고 재미있게 배울 수 있도록 도와드립니다. 함께 하나씩 배워봅시다!',
    ttsText: '스마트 도서관 시뮬레이터에 오신 것을 환영합니다! 이 앱은 도서관 이용 방법을 쉽고 재미있게 배울 수 있도록 도와드립니다.',
  },
  {
    id: 1,
    title: '화면을 터치해보세요',
    description: '아래의 동그란 버튼을 눌러보세요. 버튼을 누르면 색깔이 변합니다.',
    ttsText: '화면을 터치해보세요. 아래의 동그란 버튼을 눌러보세요.',
  },
  {
    id: 2,
    title: '좌우로 밀어보세요',
    description: '화면을 왼쪽이나 오른쪽으로 밀어보세요. 다음 단계로 넘어갈 수 있습니다.',
    ttsText: '좌우로 밀어보세요. 화면을 왼쪽이나 오른쪽으로 밀어보세요.',
  },
  {
    id: 3,
    title: '글자 크기를 선택해주세요',
    description: '읽기 편한 글자 크기를 선택해주세요.',
    ttsText: '글자 크기를 선택해주세요. 읽기 편한 크기를 고르세요.',
  },
  {
    id: 4,
    title: '준비되셨나요?',
    description: '이제 스마트 도서관 시뮬레이터를 시작합니다!',
    ttsText: '준비되셨나요? 이제 스마트 도서관 시뮬레이터를 시작합니다!',
  },
]

const FONT_OPTIONS: { value: FontSize; label: string; preview: string }[] = [
  { value: 'normal', label: '보통', preview: '보통 크기입니다' },
  { value: 'large', label: '크게', preview: '조금 더 큰 글자입니다' },
  { value: 'xlarge', label: '아주 크게', preview: '아주 큰 글자입니다' },
]

export default function OnboardingView() {
  const [currentStep, setCurrentStep] = useState(0)
  const { setHasCompletedOnboarding, setView, setFontSize, ttsEnabled } = useAppStore()

  // Touch practice state
  const [tappedCircles, setTappedCircles] = useState<Set<number>>(new Set())
  // Swipe practice state
  const [swipeCount, setSwipeCount] = useState(0)

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep])

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  // TTS on step change
  useEffect(() => {
    if (ttsEnabled) {
      speak(STEPS[currentStep].ttsText)
    }
  }, [currentStep, ttsEnabled])

  const handleFinish = () => {
    setHasCompletedOnboarding(true)
    setView('home')
  }

  const fadeVariant = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  }

  const renderStep = () => {
    const step = STEPS[currentStep]

    switch (currentStep) {
      case 0:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10"
            >
              <BookOpen className="h-20 w-20 text-primary" />
            </motion.div>
            <h2 className="text-title text-foreground">{step.title}</h2>
            <p className="text-body text-muted-foreground max-w-sm">{step.description}</p>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <h2 className="text-title text-foreground">{step.title}</h2>
            <p className="text-body text-muted-foreground mb-4">{step.description}</p>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <motion.button
                  key={num}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    const next = new Set(tappedCircles)
                    next.add(num)
                    setTappedCircles(next)
                    if (ttsEnabled) speak(`${num}번`)
                  }}
                  className={cn(
                    'flex h-24 w-24 items-center justify-center rounded-full text-heading font-bold transition-all duration-300',
                    tappedCircles.has(num)
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'bg-secondary text-foreground'
                  )}
                >
                  <Hand className="h-8 w-8" />
                </motion.button>
              ))}
            </div>
            {tappedCircles.size >= 6 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-body text-success font-semibold"
              >
                👏 훌륭합니다! 모든 버튼을 눌렀어요!
              </motion.p>
            )}
          </div>
        )

      case 2:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <h2 className="text-title text-foreground">{step.title}</h2>
            <p className="text-body text-muted-foreground mb-4">{step.description}</p>
            <div className="flex items-center gap-8">
              <motion.div
                animate={{ x: [0, -30, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary"
              >
                <ChevronLeft className="h-10 w-10 text-muted-foreground" />
              </motion.div>
              <motion.div
                animate={{ x: [0, 30, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary"
              >
                <ChevronRight className="h-10 w-10 text-muted-foreground" />
              </motion.div>
            </div>
            {swipeCount >= 2 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-body text-success font-semibold"
              >
                👏 밀기 연습 완료!
              </motion.p>
            )}
            <p className="text-caption text-muted-foreground">
              아래 버튼으로도 이동할 수 있어요
            </p>
          </div>
        )

      case 3:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <h2 className="text-title text-foreground">{step.title}</h2>
            <p className="text-body text-muted-foreground mb-4">{step.description}</p>
            <div className="flex w-full max-w-sm flex-col gap-4">
              {FONT_OPTIONS.map((opt) => {
                const fontClass = opt.value === 'large' ? 'font-large' : opt.value === 'xlarge' ? 'font-xlarge' : ''
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setFontSize(opt.value)
                      if (ttsEnabled) speak(`${opt.label}`)
                    }}
                    className={cn(
                      'card-senior w-full text-left',
                      fontClass
                    )}
                  >
                    <p className="text-heading">{opt.label}</p>
                    <p className="text-body text-muted-foreground">{opt.preview}</p>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.8, type: 'spring' }}
              className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10"
            >
              <BookOpen className="h-16 w-16 text-primary" />
            </motion.div>
            <h2 className="text-title text-foreground">{step.title}</h2>
            <p className="text-body text-muted-foreground max-w-sm">{step.description}</p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        {/* Step content */}
        <div className="flex-1">
          <motion.div
            key={currentStep}
            variants={fadeVariant}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.25 }}
            className="flex min-h-full flex-col"
          >
            {renderStep()}
          </motion.div>
        </div>

        {/* Bottom navigation */}
        <div className="flex flex-col gap-4 px-8 pb-8 pt-4">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-3">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const dir = i > currentStep ? 1 : -1
                  if (i === 2) setSwipeCount((c) => c + 1)
                  setCurrentStep(i)
                }}
                className={cn(
                  'h-4 rounded-full transition-all duration-300',
                  i === currentStep
                    ? 'w-10 bg-primary'
                    : i < currentStep
                      ? 'w-4 bg-primary/50'
                      : 'w-4 bg-muted-foreground/30'
                )}
                aria-label={`${i + 1}단계로 이동`}
              />
            ))}
          </div>

          {/* Prev/Next buttons */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className={cn(
                'btn-senior flex-1 bg-secondary text-foreground rounded-xl',
                currentStep === 0 && 'opacity-30'
              )}
              aria-label="이전"
            >
              <ChevronLeft className="h-6 w-6" />
              이전
            </button>

            {currentStep === STEPS.length - 1 ? (
              <button
                onClick={handleFinish}
                className="btn-senior flex-[2] bg-primary text-primary-foreground rounded-xl"
              >
                시작하기
              </button>
            ) : (
              <button
                onClick={() => {
                  if (currentStep === 2) setSwipeCount((c) => c + 1)
                  goNext()
                }}
                className="btn-senior flex-[2] bg-primary text-primary-foreground rounded-xl"
                aria-label="다음"
              >
                다음
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
