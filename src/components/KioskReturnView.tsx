'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle,
  Home,
  HelpCircle,
  X,
  Printer,
  Library,
  AlertTriangle,
  Inbox,
  Clock,
  ArrowDown,
} from 'lucide-react'
import { useAppStore, type LoanItem } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { OVERDUE_FEE_PER_DAY } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ReturnedBook extends LoanItem {
 overdueDays: number
 overdueFee: number
}

type KioskReturnStep = 'start' | 'returning' | 'review' | 'complete'

// Format date to Korean
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// Calculate overdue days
function getOverdueDays(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = now.getTime() - due.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

export default function KioskReturnView() {
  const {
    currentUser,
    setView,
    ttsEnabled,
    kioskTimeoutSeconds,
    isMissionMode,
    currentMissionScenarioId,
    completeMissionStep,
  } = useAppStore()

  const [step, setStep] = useState<KioskReturnStep>('start')
  const [loans, setLoans] = useState<LoanItem[]>([])
  const [returnedBooks, setReturnedBooks] = useState<ReturnedBook[]>([])
  const [insertingBookId, setInsertingBookId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(false)
  const [insertSuccess, setInsertSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!currentUser)

  // Timeout timer - use refs for state the timer needs to check
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [timerKey, setTimerKey] = useState(0)
  const timeoutWarningSpokenRef = useRef(false)

  // Reset timeout on any interaction
  const resetTimer = useCallback(() => {
    setTimedOut(false)
    setTimerKey((k) => k + 1)
    timeoutWarningSpokenRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    const warnTime = Math.max(0, kioskTimeoutSeconds - 10) * 1000
    warningRef.current = setTimeout(() => {
      if (ttsEnabled && !timeoutWarningSpokenRef.current) {
        speak('곧 초기화됩니다. 계속하시려면 화면을 터치해주세요')
        timeoutWarningSpokenRef.current = true
      }
    }, warnTime)

    timerRef.current = setTimeout(() => {
      setTimedOut(true)
      if (ttsEnabled) {
        speak('시간이 초과되었습니다. 처음부터 다시 시작합니다.')
      }
      setTimeout(() => {
        setStep('start')
        setReturnedBooks([])
        setInsertingBookId(null)
        setInsertSuccess(null)
      }, 2000)
    }, kioskTimeoutSeconds * 1000)
  }, [kioskTimeoutSeconds, ttsEnabled])

  // Start timer on mount and step change
  useEffect(() => {
    const id = setTimeout(resetTimer, 0)
    return () => {
      clearTimeout(id)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [step, resetTimer])

  // Fetch active loans
  useEffect(() => {
    if (!currentUser) return
    const controller = new AbortController()
    fetch(`/api/loans?userId=${currentUser.id}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: LoanItem[]) => {
        const active = (Array.isArray(data) ? data : []).filter(
          (l) => l.status === 'active' && !returnedBooks.some((r) => r.id === l.id)
        )
        setLoans(active)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
    return () => controller.abort()
  }, [currentUser, returnedBooks.length])

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    switch (step) {
      case 'start':
        speak('원하시는 서비스를 선택해주세요')
        break
      case 'returning':
        speak('반납할 책을 투입구에 넣어주세요')
        break
      case 'review':
        speak('반납된 책 목록을 확인해주세요')
        break
      case 'complete':
        speak('반납이 완료되었습니다')
        break
    }
  }, [step, ttsEnabled])

  // Pre-requisite check
  if (!currentUser) {
    return (
      <div className="kiosk-frame flex flex-col">
        <div className="h-1 bg-gray-700" />
        <div className="flex items-center justify-center px-4 py-4 bg-gradient-to-r from-blue-900 to-purple-900">
          <Library className="h-6 w-6 text-white/80 mr-2" />
          <span className="text-white text-heading font-bold">스마트 도서관 키오스크</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
          <AlertTriangle className="h-16 w-16 text-amber-400" />
          <p className="text-white text-heading">먼저 회원가입을 해주세요</p>
          <button
            onClick={() => setView('registration')}
            className="btn-senior bg-emerald-600 text-white rounded-xl w-full max-w-xs"
          >
            회원가입 하러 가기
          </button>
        </div>
      </div>
    )
  }

  // Insert book handler
  const handleInsertBook = (loan: LoanItem) => {
    if (insertingBookId) return
    setInsertingBookId(loan.id)
    setInsertSuccess(null)
    if (ttsEnabled) speak('스캔 중입니다')

    setTimeout(() => {
      setInsertSuccess(loan.id)
      if (ttsEnabled) speak('삑!')
      const overdueDays = getOverdueDays(loan.dueDate)
      const overdueFee = overdueDays * OVERDUE_FEE_PER_DAY
      setReturnedBooks((prev) => [
        ...prev,
        { ...loan, overdueDays, overdueFee },
      ])

      if (isMissionMode && currentMissionScenarioId === 'scenario-kiosk-return') {
        completeMissionStep()
      }

      setTimeout(() => {
        setInsertingBookId(null)
        setInsertSuccess(null)
      }, 1200)
    }, 1500)
  }

  // POST return for each book
  const processReturns = async () => {
    try {
      for (const rb of returnedBooks) {
        await fetch(`/api/loans/${rb.id}/return`, { method: 'POST' })
      }
      if (isMissionMode && currentMissionScenarioId === 'scenario-kiosk-return') {
        completeMissionStep()
      }
      if (printReceipt) {
        toast.success('영수증이 출력되었습니다')
      }
      setStep('complete')
    } catch {
      toast.error('반납 처리 중 오류가 발생했습니다')
    }
  }

  // Go to start
  const goStart = () => {
    setStep('start')
    setReturnedBooks([])
    setInsertingBookId(null)
    setInsertSuccess(null)
    setPrintReceipt(false)
  }

  const remainingLoans = loans.filter(
    (l) => !returnedBooks.some((r) => r.id === l.id)
  )

  const totalFee = returnedBooks.reduce((sum, rb) => sum + rb.overdueFee, 0)
  const hasAnyOverdue = returnedBooks.some((rb) => rb.overdueDays > 0)

  // Help text per step
  const helpTexts: Record<KioskReturnStep, string> = {
    start: '키오스크 시작 화면입니다. 도서 대여 또는 도서 반납을 선택할 수 있습니다.',
    returning: '반납할 책을 투입구에 넣는 화면입니다. 반납할 책을 누르면 자동으로 투입됩니다.',
    review: '반납된 책 목록을 확인하는 화면입니다. 연체된 책이 있으면 연체료가 표시됩니다.',
    complete: '반납이 완료되었습니다. 영수증을 출력하거나 처음으로 돌아갈 수 있습니다.',
  }

  return (
    <div
      className="kiosk-frame flex flex-col"
      onClick={resetTimer}
      onTouchStart={resetTimer}
      role="application"
      aria-label="키오스크 반납"
    >
      {/* Timeout bar */}
      <div className="absolute top-0 left-0 z-50 h-1.5 bg-gray-700 w-full">
        <motion.div
          key={timerKey}
          className="h-full bg-red-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: kioskTimeoutSeconds, ease: 'linear' }}
        />
      </div>

      {/* Kiosk header */}
      <div className="relative z-40 flex items-center justify-between px-4 py-4 bg-gradient-to-r from-blue-900 to-purple-900">
        <button
          onClick={goStart}
          className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95"
          aria-label="처음으로"
        >
          <Home className="h-6 w-6 text-white" />
        </button>
        <span className="text-white text-heading font-bold flex items-center gap-2">
          <Library className="h-6 w-6 text-white/80" />
          스마트 도서관 키오스크
        </span>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95"
          aria-label="도움말"
        >
          <HelpCircle className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading">키오스크 도움말</DialogTitle>
            <DialogDescription className="text-body">현재 단계에 대한 설명입니다.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-body text-foreground">{helpTexts[step]}</p>
          </div>
          <button
            onClick={() => { speak(helpTexts[step]); setHelpOpen(false) }}
            className="btn-senior w-full bg-blue-900 text-white rounded-xl"
          >
            다시 듣기
          </button>
        </DialogContent>
      </Dialog>

      {/* Timeout overlay */}
      {timedOut && (
        <motion.div
          key="timeout-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-30 bg-gray-900/90 flex items-center justify-center"
        >
          <div className="text-center">
            <Clock className="h-16 w-16 text-amber-400 mx-auto mb-4" />
            <p className="text-white text-heading">시간이 초과되었습니다.</p>
            <p className="text-white/60 text-body mt-2">처음부터 다시 시작합니다.</p>
          </div>
        </motion.div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        {/* Step 1: Start screen */}
          {step === 'start' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center px-6 py-12 gap-8"
            >
              <div className="text-center mb-4">
                <p className="text-white/60 text-body">원하시는 서비스를 선택해주세요</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setView('kiosk-loan')}
                className="w-full max-w-sm h-28 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg"
              >
                <BookOpen className="h-10 w-10" />
                도서 대여
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (loans.length === 0) {
                    toast.error('반납할 도서가 없습니다')
                    return
                  }
                  setStep('returning')
                }}
                className="w-full max-w-sm h-28 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg"
              >
                <BookOpen className="h-10 w-10" />
                도서 반납
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Return mode - book drop slot */}
          {step === 'returning' && (
            <motion.div
              key="returning"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col px-6 py-6 gap-5"
            >
              <div className="text-center">
                <p className="text-white text-heading">반납할 책을 투입구에 넣어주세요</p>
                <p className="text-white/60 text-caption mt-1">
                  {returnedBooks.length}/{loans.length + returnedBooks.length}권 반납 완료
                </p>
              </div>

              {/* Book drop slot animation area */}
              <div className="relative w-full max-w-xs mx-auto">
                {/* Slot opening */}
                <div className="relative h-24 bg-gray-900/80 rounded-t-2xl border-2 border-white/20 border-b-0 overflow-hidden">
                  <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-b from-gray-700 to-gray-800" />
                  <p className="absolute inset-0 flex items-center justify-center text-white/30 text-caption">
                    책 투입구
                  </p>
                </div>
                <div className="h-4 bg-gray-800 border-x-2 border-white/20" />
                <div className="bg-gray-800/50 rounded-b-2xl h-8 border-2 border-t-0 border-white/10" />

                {/* Inserting book animation */}
                {insertingBookId && (
                    <motion.div
                      key={insertingBookId}
                      initial={{ y: -80, opacity: 1 }}
                      animate={{ y: 0, opacity: 0 }}
                      transition={{ duration: 1.5, ease: 'easeIn' }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 bg-amber-700 rounded-lg shadow-lg flex items-center justify-center z-10"
                    >
                      <BookOpen className="h-6 w-6 text-amber-100" />
                    </motion.div>
                  )}

                {/* Success flash */}
                {insertSuccess && (
                    <motion.div
                      key={`success-${insertSuccess}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center z-20"
                    >
                      <div className="bg-emerald-500/20 rounded-2xl px-8 py-4">
                        <span className="text-emerald-400 text-title font-bold">삑!</span>
                      </div>
                    </motion.div>
                  )}
              </div>

              {/* Remaining loans list */}
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-white/60 text-body">로딩 중...</p>
                </div>
              ) : remainingLoans.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-white text-body">모든 책을 반납했습니다!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-white/80 text-body font-bold">반납할 책 목록</p>
                  <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2">
                    {remainingLoans.map((loan) => (
                      <motion.button
                        key={loan.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleInsertBook(loan)}
                        disabled={!!insertingBookId}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 border-2 border-transparent hover:bg-white/15 transition-colors text-left disabled:opacity-50"
                      >
                        <Inbox className="h-6 w-6 text-white/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-body truncate">
                            {loan.book?.title || '알 수 없는 책'}
                          </p>
                          <p className="text-white/60 text-caption truncate">
                            반납기한: {formatDate(loan.dueDate)}
                          </p>
                        </div>
                        <ArrowDown className="h-5 w-5 text-white/40 shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Returned books summary */}
              {returnedBooks.length > 0 && (
                <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4">
                  <p className="text-emerald-400 text-body font-bold mb-2">
                    반납 완료 ({returnedBooks.length}권)
                  </p>
                  <div className="space-y-1">
                    {returnedBooks.map((rb) => (
                      <div key={rb.id} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-white text-caption truncate">
                          {rb.book?.title || '알 수 없는 책'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next step button */}
              {returnedBooks.length > 0 && (
                <button
                  onClick={() => setStep('review')}
                  className="btn-senior bg-blue-600 text-white rounded-xl w-full"
                >
                  반납 목록 확인
                </button>
              )}
            </motion.div>
          )}

          {/* Step 3: Review returned books */}
          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col px-6 py-6 gap-5"
            >
              <p className="text-white text-heading text-center">반납 목록 확인</p>

              <div className="space-y-3">
                {returnedBooks.map((rb, i) => (
                  <div
                    key={rb.id}
                    className={cn(
                      'rounded-xl p-4',
                      rb.overdueDays > 0
                        ? 'bg-rose-600/20 border border-rose-500/30'
                        : 'bg-white/10 border border-white/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle
                        className={cn(
                          'h-6 w-6 shrink-0 mt-1',
                          rb.overdueDays > 0 ? 'text-rose-400' : 'text-emerald-400'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-body font-bold">
                          {i + 1}. {rb.book?.title || '알 수 없는 책'}
                        </p>
                        <p className="text-white/60 text-caption">
                          {rb.book?.author}
                        </p>
                        <p className="text-white/60 text-caption">
                          대여일: {formatDate(rb.loanDate)} ~ 반납기한: {formatDate(rb.dueDate)}
                        </p>
                        {rb.overdueDays > 0 ? (
                          <div className="mt-2 bg-rose-600/20 rounded-lg p-2">
                            <p className="text-rose-400 text-caption">
                              연체 {rb.overdueDays}일 | 연체료: {rb.overdueFee.toLocaleString()}원
                            </p>
                          </div>
                        ) : (
                          <p className="text-emerald-400 text-caption mt-1">정상 반납</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasAnyOverdue && (
                <>
                  <div className="bg-amber-600/20 border border-amber-500/30 rounded-xl p-4 text-center">
                    <p className="text-amber-400 text-body font-bold">
                      총 연체료: {totalFee.toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-white/50 text-caption">
                      시뮬레이션입니다. 실제 비용이 없습니다.
                    </p>
                  </div>
                </>
              )}

              <button
                onClick={processReturns}
                className="btn-senior bg-emerald-600 text-white rounded-xl w-full"
              >
                반납 완료
              </button>
            </motion.div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center px-6 py-8 gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <CheckCircle className="h-24 w-24 text-emerald-400" />
              </motion.div>
              <p className="text-white text-title text-center">반납이 완료되었습니다!</p>

              {/* Return summary card */}
              <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-gray-900 border-2 border-dashed border-gray-300">
                <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                  <p className="text-heading font-bold">반납 확인증</p>
                  <p className="text-caption text-gray-500">스마트 도서관</p>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">반납자</span>
                    <span className="text-body font-bold">{currentUser.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">반납일</span>
                    <span className="text-body">{formatDate(new Date().toISOString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">반납 권수</span>
                    <span className="text-body font-bold">{returnedBooks.length}권</span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-2 space-y-2">
                  {returnedBooks.map((rb, i) => (
                    <div key={rb.id}>
                      <p className="text-body font-bold">
                        {i + 1}. {rb.book?.title || '알 수 없는 책'}
                      </p>
                      {rb.overdueDays > 0 ? (
                        <p className="text-caption text-rose-600">
                          연체 반납 (연체료: {rb.overdueFee.toLocaleString()}원)
                        </p>
                      ) : (
                        <p className="text-caption text-emerald-600">정상 반납</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Print receipt toggle */}
              <div className="w-full max-w-sm bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white text-body">영수증 출력</span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setPrintReceipt(true)}
                      className={cn(
                        'btn-senior rounded-xl px-4 py-2 text-body',
                        printReceipt
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 text-white/60 border border-white/20'
                      )}
                    >
                      예
                    </button>
                    <button
                      onClick={() => setPrintReceipt(false)}
                      className={cn(
                        'btn-senior rounded-xl px-4 py-2 text-body',
                        !printReceipt
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-white/60 border border-white/20'
                      )}
                    >
                      아니오
                    </button>
                  </div>
                </div>
              </div>

              {printReceipt && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => toast.success('영수증이 출력되었습니다')}
                  className="btn-senior bg-blue-600 text-white rounded-xl w-full max-w-sm"
                >
                  <Printer className="h-6 w-6" />
                  영수증 출력
                </motion.button>
              )}
            </motion.div>
          )}
      </div>

      {/* Bottom navigation - always visible */}
      <div className="relative z-40 flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-blue-900 to-purple-900 border-t border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={goStart}
            className="btn-senior flex-1 bg-white/10 text-white rounded-xl border border-white/20"
          >
            <Home className="h-5 w-5" />
            처음으로
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="btn-senior flex-1 bg-white/10 text-white rounded-xl border border-white/20"
          >
            <HelpCircle className="h-5 w-5" />
            도움말
          </button>
        </div>
        <button
          onClick={() => setView('home')}
          className="text-white/40 text-caption hover:text-white/70 transition-colors text-center py-1"
        >
          시뮬레이션 종료하기
        </button>
      </div>
    </div>
  )
}
