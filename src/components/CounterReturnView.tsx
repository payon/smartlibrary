'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle,
  CreditCard,
  HandCoins,
  Star,
  ChevronRight,
  Library,
  Home,
  AlertTriangle,
  Clock,
  X,
  UserCheck,
} from 'lucide-react'
import { useAppStore, type LoanItem } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants'
import { toast } from 'sonner'

type ReturnStep = 1 | 2 | 3 | 4

// Format date to Korean
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// Get days remaining (negative = overdue)
function getDaysRemaining(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Get color class based on days remaining
function getDaysColor(days: number): string {
  if (days < 0) return 'bg-rose-100 text-rose-800'
  if (days <= 7) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

function getDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}일 연체`
  if (days === 0) return '오늘 반납'
  return `${days}일 남음`
}

// Step progress bar
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              i + 1 <= current ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-caption text-muted-foreground">
        {current} / {total}단계
      </p>
    </div>
  )
}

// Barcode placeholder
function BarcodePlaceholder() {
  return (
    <div className="flex h-12 items-center justify-center gap-[2px] rounded bg-white px-2">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="h-full rounded-sm bg-foreground/80"
          style={{
            width: i % 3 === 0 ? '2px' : '1px',
          }}
        />
      ))}
    </div>
  )
}

// Scan simulation card
function ScanCard({ book, index, total, scanning, scanned }: {
  book: LoanItem
  index: number
  total: number
  scanning: boolean
  scanned: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-senior"
    >
      <div className="flex items-start gap-4">
        {/* Book cover */}
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <BookOpen className="h-7 w-7 text-amber-700" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-body font-bold text-foreground truncate">
            {book.book?.title || '제목 없음'}
          </h4>
          <p className="text-caption text-muted-foreground">{book.book?.author || ''}</p>

          {/* Barcode area */}
          <div className="relative mt-2 overflow-hidden rounded-lg border border-border bg-muted/30 p-2">
            <BarcodePlaceholder />
            {/* Scan line animation */}
            {scanning && (
              <motion.div
                className="absolute left-0 right-0 h-1 bg-primary"
                initial={{ top: 0 }}
                animate={{ top: ['0%', '95%', '0%'] }}
                transition={{ duration: 1.5, repeat: 1, ease: 'easeInOut' }}
              />
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {scanning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary" />
            </motion.div>
          )}
          {scanned && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="flex items-center justify-center"
            >
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </motion.div>
          )}
          {!scanning && !scanned && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <span className="text-caption text-muted-foreground">{index + 1}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scan status text */}
      {scanning && (
        <p className="mt-3 text-center text-body text-primary font-bold">
          스캔 중...
        </p>
      )}
      {scanned && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-2"
        >
          <span className="text-body text-emerald-700 font-bold">삑!</span>
          <span className="text-caption text-emerald-600">스캔 완료</span>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function CounterReturnView() {
  const {
    currentUser,
    setView,
    ttsEnabled,
    isMissionMode,
    completeMissionStep,
  } = useAppStore()

  const [step, setStep] = useState<ReturnStep>(1)
  const [activeLoans, setActiveLoans] = useState<LoanItem[]>([])
  const [selectedLoans, setSelectedLoans] = useState<LoanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scanningIndex, setScanningIndex] = useState(-1)
  const [scannedIndices, setScannedIndices] = useState<Set<number>>(new Set())
  const [totalPenaltyDays, setTotalPenaltyDays] = useState(0)
  const [overdueItems, setOverdueItems] = useState<{ book: LoanItem; days: number; penaltyDays: number }[]>([])
  const [returnCompleted, setReturnCompleted] = useState(false)
  const [hasOverdue, setHasOverdue] = useState(false)

  // Fetch active loans
  const fetchLoans = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/loans?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        const active = data.filter((l: LoanItem) => l.status === 'active')
        setActiveLoans(active)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    const messages: Record<ReturnStep, string> = {
      1: '반납할 책을 선택해주세요.',
      2: '책 바코드를 스캔하고 있습니다.',
      3: '연체 상태를 확인해주세요.',
      4: '반납이 완료되었습니다.',
    }
    speak(messages[step])
  }, [step, ttsEnabled])

  // Toggle loan selection
  const toggleLoan = (loan: LoanItem) => {
    setSelectedLoans((prev) => {
      const exists = prev.find((l) => l.id === loan.id)
      if (exists) {
        return prev.filter((l) => l.id !== loan.id)
      }
      return [...prev, loan]
    })
  }

  // Run scan simulation
  const runScanSimulation = () => {
    if (selectedLoans.length === 0) return
    setStep(2)
    setScanningIndex(0)
    setScannedIndices(new Set())

    let currentIndex = 0
    const interval = setInterval(() => {
      // Mark current as scanned
      setScannedIndices((prev) => {
        const next = new Set(prev)
        next.add(currentIndex)
        return next
      })

      if (ttsEnabled && currentIndex === selectedLoans.length - 1) {
        speak('삑! 모든 책 스캔이 완료되었습니다.')
      }

      currentIndex++
      if (currentIndex >= selectedLoans.length) {
        setScanningIndex(-1)
        clearInterval(interval)

        // Calculate overdue penalty days after a brief delay
        setTimeout(() => {
          let totalPenalty = 0
          const items: { book: LoanItem; days: number; penaltyDays: number }[] = []
          for (const loan of selectedLoans) {
            const days = getDaysRemaining(loan.dueDate)
            if (days < 0) {
              const penaltyDays = Math.abs(days) * OVERDUE_BLOCK_MULTIPLIER
              items.push({ book: loan, days: Math.abs(days), penaltyDays })
              if (penaltyDays > totalPenalty) totalPenalty = penaltyDays
            }
          }
          setOverdueItems(items)
          setTotalPenaltyDays(totalPenalty)
          setHasOverdue(items.length > 0)

          setStep(3)

          if (isMissionMode) completeMissionStep()
        }, 1000)
      } else {
        setScanningIndex(currentIndex)
      }
    }, 1500)
  }

  // Process return
  const processReturn = async () => {
    setLoading(true)

    let anyOverdue = false
    let maxPenaltyDays = 0
    const items: { book: LoanItem; days: number; penaltyDays: number }[] = []

    for (const loan of selectedLoans) {
      try {
        const res = await fetch(`/api/loans/${loan.id}/return`, {
          method: 'POST',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.penaltyDays > 0) {
            anyOverdue = true
            if (data.penaltyDays > maxPenaltyDays) maxPenaltyDays = data.penaltyDays
            items.push({ book: loan, days: data.overdueDays, penaltyDays: data.penaltyDays })
          }
        }
      } catch {
        toast.error(`${loan.book?.title} 반납에 실패했습니다.`)
      }
    }

    setOverdueItems(items)
    setTotalPenaltyDays(maxPenaltyDays)
    setHasOverdue(anyOverdue)
    setReturnCompleted(true)
    setStep(4)
    setLoading(false)

    if (ttsEnabled) {
      if (anyOverdue) {
        speak(`반납이 완료되었습니다. 연체로 인해 ${maxPenaltyDays}일 동안 대여가 제한됩니다.`)
      } else {
        speak('반납이 완료되었습니다. 감사합니다!')
      }
    }

    if (isMissionMode) completeMissionStep()

    // Refresh loans
    fetchLoans()
  }

  // Pre-requisite check
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="창구 반납" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4">
          <CreditCard className="h-16 w-16 text-muted-foreground/50" />
          <h2 className="text-title text-foreground">회원가입이 필요합니다</h2>
          <p className="text-body text-muted-foreground text-center">
            먼저 회원가입을 해주세요
          </p>
          <button
            onClick={() => setView('registration')}
            className="btn-senior bg-primary text-primary-foreground rounded-xl"
          >
            <UserCheck className="h-6 w-6" />
            회원가입하기
          </button>
        </main>
      </div>
    )
  }

  // Loading state
  if (loading && step === 1) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="창구 반납" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-body text-muted-foreground">불러오는 중...</p>
        </main>
      </div>
    )
  }

  // No active loans
  if (!loading && step === 1 && activeLoans.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="창구 반납" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <BookOpen className="h-16 w-16 text-muted-foreground/50" />
          </motion.div>
          <h2 className="text-title text-foreground">반납할 도서가 없습니다</h2>
          <p className="text-body text-muted-foreground text-center">
            현재 대출 중인 책이 없습니다.
          </p>
          <button
            onClick={() => setView('home')}
            className="btn-senior bg-primary text-primary-foreground rounded-xl"
          >
            <Home className="h-6 w-6" />
            홈으로
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="창구 반납"
        helpText="창구 반납 화면입니다. 반납할 책을 선택하고 바코드 스캔을 통해 반납하는 연습을 합니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <StepProgress current={step} total={4} />

        {/* Step 1: Select books to return */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                반납할 책 선택
              </h2>

              {/* Selection counter */}
              {selectedLoans.length > 0 && (
                <div className="rounded-xl bg-primary/5 border-2 border-primary/20 p-4 text-center">
                  <p className="text-heading font-bold text-primary">
                    선택한 책: {selectedLoans.length}권
                  </p>
                </div>
              )}

              {/* Loans list */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {activeLoans.map((loan, index) => {
                  const isSelected = selectedLoans.some((l) => l.id === loan.id)
                  const days = getDaysRemaining(loan.dueDate)

                  return (
                    <motion.div
                      key={loan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => toggleLoan(loan)}
                      className={cn(
                        'card-senior cursor-pointer transition-all',
                        isSelected && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 transition-colors"
                          style={{
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                            background: isSelected ? 'var(--primary)' : 'var(--card)',
                          }}
                        >
                          {isSelected && (
                            <CheckCircle className="h-8 w-8 text-primary-foreground" />
                          )}
                        </div>

                        {/* Book cover */}
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                          <BookOpen className="h-6 w-6 text-amber-700" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-body font-bold text-foreground truncate">
                            {loan.book?.title || '제목 없음'}
                          </h4>
                          <p className="text-caption text-muted-foreground truncate">
                            {loan.book?.author || ''}
                          </p>
                        </div>

                        {/* Days badge */}
                        <Badge className={cn('shrink-0', getDaysColor(days))} variant="secondary">
                          {getDaysLabel(days)}
                        </Badge>
                      </div>

                      {/* Loan details */}
                      <div className="mt-2 flex items-center gap-4 text-caption text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          대출: {formatDate(loan.loanDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          반납: {formatDate(loan.dueDate)}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Action button */}
              <button
                onClick={runScanSimulation}
                disabled={selectedLoans.length === 0}
                className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
              >
                <HandCoins className="h-6 w-6" />
                {selectedLoans.length === 0
                  ? '반납할 책을 선택해주세요'
                  : `반납하기 (${selectedLoans.length}권)`
                }
              </button>
            </motion.div>
          )}

          {/* Step 2: Scan simulation */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                책 스캔 중
              </h2>

              {/* Progress */}
              <div className="rounded-xl bg-primary/5 border-2 border-primary/20 p-4 text-center">
                <p className="text-heading font-bold text-primary">
                  {scannedIndices.size} / {selectedLoans.length}권 스캔 완료
                </p>
              </div>

              {/* Scan cards */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {selectedLoans.map((loan, index) => (
                  <ScanCard
                    key={loan.id}
                    book={loan}
                    index={index}
                    total={selectedLoans.length}
                    scanning={index === scanningIndex}
                    scanned={scannedIndices.has(index)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Overdue fee calculation */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                {hasOverdue ? '연체 확인' : '반납 확인'}
              </h2>

              {hasOverdue ? (
                <>
                  {/* Overdue items */}
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="card-senior w-full"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                      <h3 className="text-heading text-foreground">연체 도서</h3>
                    </div>

                    <div className="flex flex-col gap-3">
                      {overdueItems.map((item) => (
                        <div key={item.book.id} className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                          <div className="flex items-start gap-3">
                            <BookOpen className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-body font-bold text-foreground truncate">
                                {item.book.book?.title || '제목 없음'}
                              </p>
                              <div className="mt-2 flex items-center gap-4">
                                <span className="text-caption text-rose-600">
                                  {item.days}일 연체
                                </span>
                                <span className="text-body font-bold text-rose-700">
                                  대여 정지 {item.penaltyDays}일
                                </span>
                              </div>
                              <p className="text-caption text-muted-foreground mt-1">
                                (연체 {item.days}일 × {OVERDUE_BLOCK_MULTIPLIER}배 = {item.penaltyDays}일 정지)
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center justify-between">
                      <span className="text-heading font-bold text-foreground">대여 정지 기간</span>
                      <span className="text-title font-bold text-rose-600">
                        {totalPenaltyDays}일
                      </span>
                    </div>
                  </motion.div>

                  {/* Simulation notice */}
                  <div className="w-full rounded-xl bg-sky-50 border border-sky-200 p-4 text-center">
                    <p className="text-caption text-sky-700">
                      📋 이것은 시뮬레이션입니다. 실제 비용이 청구되지 않습니다.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    <CheckCircle className="h-16 w-16 text-emerald-500" />
                  </motion.div>
                  <p className="text-body text-muted-foreground text-center">
                    연체된 도서가 없습니다. 정상 반납됩니다.
                  </p>
                </>
              )}

              <button
                onClick={processReturn}
                disabled={loading}
                className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
              >
                {loading ? '처리 중...' : '반납 완료하기'}
              </button>
            </motion.div>
          )}

          {/* Step 4: Return complete */}
          {step === 4 && returnCompleted && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Star stamp animation */}
              {isMissionMode && (
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="star-stamp"
                >
                  <Star className="h-16 w-16 fill-amber-400 text-amber-400" />
                </motion.div>
              )}

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 150, damping: 15 }}
              >
                <CheckCircle className="h-20 w-20 text-emerald-500" />
              </motion.div>

              <h2 className="text-title text-foreground text-center">
                반납 완료!
              </h2>

              {/* Return confirmation card */}
              <div className="w-full rounded-xl border-2 border-dashed border-border bg-card p-6">
                <div className="mb-4 text-center">
                  <p className="text-heading font-bold text-foreground">반납 확인증</p>
                  <Separator className="mt-2" />
                </div>

                <div className="flex flex-col gap-4">
                  {/* User info */}
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">회원명</span>
                    <span className="text-body font-bold text-foreground">{currentUser.name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">반납일</span>
                    <span className="text-body font-bold text-foreground">
                      {formatDate(new Date().toISOString())}
                    </span>
                  </div>

                  <Separator />

                  {/* Returned books */}
                  <h3 className="text-body font-bold text-foreground">반납 도서</h3>
                  <div className="flex flex-col gap-2">
                    {selectedLoans.map((loan) => (
                      <div key={loan.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <BookOpen className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-body text-foreground truncate flex-1">
                          {loan.book?.title || '제목 없음'}
                        </span>
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Return status */}
                  {hasOverdue ? (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-center">
                      <p className="text-heading font-bold text-rose-700">연체 반납</p>
                      <p className="text-body text-rose-600 mt-1">
                        대여 정지: {totalPenaltyDays}일
                      </p>
                      <p className="text-caption text-rose-500 mt-1">
                        (시뮬레이션 — 실제 제한이 적용되지 않습니다)
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                      <p className="text-heading font-bold text-emerald-700">정상 반납</p>
                      <p className="text-body text-emerald-600 mt-1">
                        감사합니다!
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-body font-bold text-foreground">
                      총 {selectedLoans.length}권 반납
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setView('home')}
                className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
              >
                <Home className="h-6 w-6" />
                홈으로
              </button>
            </motion.div>
          )}
      </main>
    </div>
  )
}
