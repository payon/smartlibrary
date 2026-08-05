'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  CheckCircle,
  Clock,
  Home,
  HelpCircle,
  X,
  Printer,
  Library,
  QrCode,
  Barcode,
  AlertTriangle,
  Lock,
  PackageOpen,
  ScanBarcode,
  CircleDot,
} from 'lucide-react'
import { useAppStore, type BookItem } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { LOAN_PERIOD_DAYS, MAX_LOAN_COUNT } from '@/lib/constants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type KioskLoanStep = 'start' | 'place-books' | 'scan-card' | 'enter-pin' | 'confirm' | 'complete'

interface ScannedBook {
  book: BookItem
  dueDate: string
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function KioskLoanView() {
  const {
    currentUser,
    setView,
    ttsEnabled,
    kioskTimeoutSeconds,
    isMissionMode,
    currentMissionScenarioId,
    completeMissionStep,
  } = useAppStore()

  const [step, setStep] = useState<KioskLoanStep>('start')
  const [scanning, setScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [books, setBooks] = useState<BookItem[]>([])
  const [scannedBooks, setScannedBooks] = useState<ScannedBook[]>([])
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [autoScanDone, setAutoScanDone] = useState(false)
  const [loanProcessing, setLoanProcessing] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pin, setPin] = useState('')

  // Timeout timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [timerKey, setTimerKey] = useState(0)
  const timeoutWarningSpokenRef = useRef(false)

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
      if (ttsEnabled) speak('시간이 초과되었습니다. 처음부터 다시 시작합니다.')
      setTimeout(() => goStart(), 2000)
    }, kioskTimeoutSeconds * 1000)
  }, [kioskTimeoutSeconds, ttsEnabled])

  useEffect(() => {
    const id = setTimeout(resetTimer, 0)
    return () => {
      clearTimeout(id)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [step, resetTimer])

  // Fetch available books on mount
  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data: BookItem[]) => setBooks(data.filter((b) => b.availableCopies > 0)))
      .catch(() => {})
  }, [])

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    switch (step) {
      case 'start': speak('원하시는 서비스를 선택해주세요'); break
      case 'place-books': speak('빌릴 책을 최대 10권까지 선택해주세요. 선택 후 자동으로 스캔됩니다.'); break
      case 'scan-card': speak('도서증 바코드를 스캔해주세요. 모바일 도서증이나 실물 도서증 모두 가능합니다.'); break
      case 'enter-pin': speak('비밀번호 4자리를 입력해주세요.'); break
      case 'confirm': speak('대여할 책을 확인하고 대여 완료를 눌러주세요'); break
      case 'complete': speak('대여가 완료되었습니다!'); break
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
          <p className="text-white/60 text-body">도서관 회원가입 후 이용하실 수 있습니다.</p>
          <button onClick={() => setView('registration')} className="btn-senior bg-emerald-600 text-white rounded-xl w-full max-w-xs">회원가입 하러 가기</button>
        </div>
      </div>
    )
  }

  // Handle book auto-scan (user places books on scanner)
  const handleAutoScanBooks = () => {
    if (selectedBookIds.size === 0) {
      toast.error('빌릴 책을 먼저 선택해주세요')
      return
    }
    setScanning(true)
    if (ttsEnabled) speak('책을 스캔하고 있습니다')
    setTimeout(() => {
      const selected = books.filter((b) => selectedBookIds.has(b.id))
      const scanned: ScannedBook[] = selected.map((book) => ({
        book,
        dueDate: addDays(new Date(), LOAN_PERIOD_DAYS).toISOString(),
      }))
      setScannedBooks(scanned)
      setScanning(false)
      setAutoScanDone(true)
      if (ttsEnabled) speak(`삑! ${scanned.length}권 스캔 완료`)
      // Auto-advance to scan card
      setTimeout(() => setStep('scan-card'), 1500)
    }, 2000)
  }

  // Toggle book selection
  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev)
      if (next.has(bookId)) {
        next.delete(bookId)
      } else if (next.size < MAX_LOAN_COUNT) {
        next.add(bookId)
      } else {
        toast.error(`최대 ${MAX_LOAN_COUNT}권까지 선택 가능합니다`)
      }
      return next
    })
  }

  // Remove scanned book
  const removeScannedBook = (bookId: string) => {
    setScannedBooks((prev) => prev.filter((s) => s.book.id !== bookId))
    setSelectedBookIds((prev) => {
      const next = new Set(prev)
      next.delete(bookId)
      return next
    })
  }

  // Scan card handler
  const handleScanCard = () => {
    if (scanning) return
    setScanning(true)
    setScanComplete(false)
    if (ttsEnabled) speak('스캔 중입니다')
    setTimeout(() => {
      setScanning(false)
      setScanComplete(true)
      if (ttsEnabled) speak(`삑! 스캔 완료. ${currentUser.name}님 환영합니다.`)
      if (isMissionMode && currentMissionScenarioId === 'scenario-kiosk-loan') {
        completeMissionStep()
      }
      setTimeout(() => setStep('enter-pin'), 1500)
    }, 2000)
  }

  // Handle PIN input
  const handlePinInput = (digit: number | 'delete') => {
    setPinError('')
    if (digit === 'delete') {
      setPin((p) => p.slice(0, -1))
    } else if (pin.length < 4) {
      setPin((p) => p + String(digit))
      if (pin.length === 3) {
        // Will be 4 after this set, check match after render
        setTimeout(() => {
          // auto-advance to confirm
        }, 200)
      }
    }
  }

  const handlePinConfirm = () => {
    if (pin.length !== 4) {
      setPinError('비밀번호 4자리를 입력해주세요')
      if (ttsEnabled) speak('비밀번호 4자리를 입력해주세요')
      return
    }
    setStep('confirm')
  }

  // Confirm loan with PIN
  const handleConfirmLoan = async () => {
    setConfirmOpen(false)
    setLoanProcessing(true)
    try {
      // Verify PIN first
      const pinRes = await fetch(`/api/users/${currentUser.id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!pinRes.ok) {
        const data = await pinRes.json()
        toast.error(data.error || '비밀번호 확인에 실패했습니다.')
        setLoanProcessing(false)
        setStep('enter-pin')
        setPin('')
        setPinError('비밀번호가 일치하지 않습니다')
        if (ttsEnabled) speak('비밀번호가 일치하지 않습니다')
        return
      }

      // Create all loans
      let allSuccess = true
      for (const sb of scannedBooks) {
        const res = await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            bookId: sb.book.id,
            method: 'kiosk',
            pin,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || '대여 처리 중 오류')
          allSuccess = false
          break
        }
      }

      if (allSuccess) {
        if (isMissionMode && currentMissionScenarioId === 'scenario-kiosk-loan') {
          completeMissionStep()
        }
        setStep('complete')
      }
    } catch {
      toast.error('대여 처리 중 오류가 발생했습니다')
    } finally {
      setLoanProcessing(false)
    }
  }

  const handlePrintReceipt = () => toast.success('영수증이 출력되었습니다')

  const goStart = () => {
    setStep('start')
    setScannedBooks([])
    setScanning(false)
    setScanComplete(false)
    setAutoScanDone(false)
    setSelectedBookIds(new Set())
    setPin('')
    setPinError('')
    setLoanProcessing(false)
  }

  const helpTexts: Record<KioskLoanStep, string> = {
    start: '키오스크 시작 화면입니다. 도서 대여 또는 도서 반납을 선택할 수 있습니다.',
    'place-books': '빌릴 책을 최대 10권까지 선택하세요. 선택한 책은 자동으로 스캔됩니다.',
    'scan-card': '모바일 도서증의 바코드 또는 실물 도서증의 바코드를 스캔하는 화면입니다.',
    'enter-pin': '가입 시 설정한 비밀번호 4자리를 입력해주세요.',
    confirm: '대여할 책 목록을 확인하는 화면입니다. 내용이 맞으면 대여 완료 버튼을 눌러주세요.',
    complete: '대여가 완료되었습니다. 영수증을 출력하시거나 처음으로 돌아갈 수 있습니다.',
  }

  const stepLabels: Record<KioskLoanStep, string> = {
    start: '서비스 선택',
    'place-books': '책 선택',
    'scan-card': '도서증 스캔',
    'enter-pin': '비밀번호 입력',
    confirm: '대여 확인',
    complete: '대여 완료',
  }

  const stepOrder: KioskLoanStep[] = ['start', 'place-books', 'scan-card', 'enter-pin', 'confirm', 'complete']
  const currentStepIndex = stepOrder.indexOf(step)

  return (
    <div
      className="kiosk-frame flex flex-col"
      onClick={resetTimer}
      onTouchStart={resetTimer}
      role="application"
      aria-label="키오스크 대여"
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
        <button onClick={goStart} className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95" aria-label="처음으로">
          <Home className="h-6 w-6 text-white" />
        </button>
        <span className="text-white text-heading font-bold flex items-center gap-2">
          <Library className="h-6 w-6 text-white/80" />
          스마트 도서관 키오스크
        </span>
        <button onClick={() => setHelpOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95" aria-label="도움말">
          <HelpCircle className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Step indicator bar */}
      <div className="relative z-40 flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-900/80 to-purple-900/80">
        {stepOrder.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className={cn(
              'flex-1 h-2 rounded-full transition-all duration-300',
              i < currentStepIndex ? 'bg-emerald-400' : i === currentStepIndex ? 'bg-white' : 'bg-white/20'
            )} />
          </div>
        ))}
      </div>
      <div className="relative z-40 px-4 py-1 bg-gradient-to-r from-blue-900/60 to-purple-900/60">
        <p className="text-white/80 text-caption text-center">{stepLabels[step]}</p>
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
          <button onClick={() => { speak(helpTexts[step]); setHelpOpen(false) }} className="btn-senior w-full bg-blue-900 text-white rounded-xl">
            다시 듣기
          </button>
        </DialogContent>
      </Dialog>

      {/* Timeout overlay */}
      {timedOut && (
        <motion.div key="timeout-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="absolute inset-0 z-30 bg-gray-900/90 flex items-center justify-center">
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
          <motion.div key="start" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-center justify-center px-6 py-12 gap-8">
            <div className="text-center mb-4">
              <p className="text-white/60 text-body">원하시는 서비스를 선택해주세요</p>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep('place-books')} className="w-full max-w-sm h-28 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg">
              <BookOpen className="h-10 w-10" />
              도서 대여
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView('kiosk-return')} className="w-full max-w-sm h-28 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg">
              <BookOpen className="h-10 w-10" />
              도서 반납
            </motion.button>
          </motion.div>
        )}

        {/* Step 2: Place Books - Select up to 5 books for auto-scan */}
        {step === 'place-books' && (
          <motion.div key="place-books" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col px-6 py-6 gap-5">
            <div className="text-center">
              <p className="text-white text-heading">빌릴 책을 선택하세요</p>
              <p className="text-white/60 text-caption mt-1">최대 {MAX_LOAN_COUNT}권까지 선택 가능 ({selectedBookIds.size}/{MAX_LOAN_COUNT})</p>
              <p className="text-white/40 text-caption mt-1">선택한 책은 자동으로 스캔됩니다</p>
            </div>

            {/* Scan area visualization */}
            <div className="relative w-full h-24 border-4 border-dashed border-white/20 rounded-xl flex items-center justify-center bg-white/5 overflow-hidden">
              {scanning ? (
                <>
                  <div className="absolute left-0 right-0 h-1 bg-emerald-400 scan-line z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <p className="text-white/80 text-body">책을 자동 스캔하고 있습니다...</p>
                </>
              ) : autoScanDone ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <p className="text-emerald-400 text-heading">{scannedBooks.length}권 스캔 완료!</p>
                </motion.div>
              ) : (
                <div className="text-center">
                  <PackageOpen className="h-10 w-10 text-white/40 mx-auto mb-1" />
                  <p className="text-white/40 text-caption">책을 선택하면 자동으로 스캔됩니다</p>
                </div>
              )}
            </div>

            {/* Book selection list */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
              {books.map((book) => {
                const isSelected = selectedBookIds.has(book.id)
                return (
                  <motion.button
                    key={book.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleBookSelection(book.id)}
                    disabled={scanning || autoScanDone}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                      isSelected
                        ? 'bg-emerald-600/30 border-2 border-emerald-400'
                        : 'bg-white/10 border-2 border-transparent hover:bg-white/15'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all',
                      isSelected ? 'bg-emerald-500 border-emerald-400' : 'border-white/30'
                    )}>
                      {isSelected && <CheckCircle className="h-5 w-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-body truncate font-bold">{book.title}</p>
                      <p className="text-white/60 text-caption truncate">{book.author}</p>
                    </div>
                    <Barcode className="h-5 w-5 text-white/40 shrink-0" />
                  </motion.button>
                )
              })}
            </div>

            {/* Action buttons */}
            {!autoScanDone ? (
              <button
                onClick={handleAutoScanBooks}
                disabled={selectedBookIds.size === 0 || scanning}
                className={cn(
                  'btn-senior rounded-xl w-full',
                  selectedBookIds.size > 0 ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/40'
                )}
              >
                <ScanBarcode className="h-6 w-6" />
                {scanning ? '스캔 중...' : `${selectedBookIds.size}권 자동 스캔하기`}
              </button>
            ) : (
              <button onClick={() => setStep('scan-card')} className="btn-senior bg-emerald-600 text-white rounded-xl w-full">
                도서증 스캔하러 가기
              </button>
            )}
          </motion.div>
        )}

        {/* Step 3: Scan card barcode */}
        {step === 'scan-card' && (
          <motion.div key="scan-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-center px-6 py-8 gap-6">
            <p className="text-white text-heading text-center">도서증 바코드를 스캔해주세요</p>
            <p className="text-white/60 text-caption text-center">모바일 도서증 또는 실물 도서증 모두 가능합니다</p>

            {/* Scanned books summary */}
            <div className="w-full max-w-xs bg-white/10 rounded-xl p-3">
              <p className="text-white/60 text-caption mb-2">스캔된 책 ({scannedBooks.length}권)</p>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                {scannedBooks.map((sb) => (
                  <p key={sb.book.id} className="text-white text-body truncate">• {sb.book.title}</p>
                ))}
              </div>
            </div>

            {/* Scan area */}
            <div className="relative w-full max-w-xs aspect-square border-4 border-dashed border-white/30 rounded-2xl flex items-center justify-center bg-white/5 overflow-hidden">
              {scanning && (
                <div className="absolute left-0 right-0 h-1 bg-emerald-400 scan-line z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              )}
              {scanComplete ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                  <CheckCircle className="h-20 w-20 text-emerald-400 mx-auto" />
                  <p className="text-emerald-400 text-heading mt-2">삑! 스캔 완료</p>
                  <p className="text-white text-body mt-1">{currentUser.name}님</p>
                </motion.div>
              ) : (
                <div className="text-center">
                  <Barcode className="h-16 w-16 text-white/40 mb-2" />
                  <p className="text-white/40 text-caption">바코드를 여기에 대주세요</p>
                </div>
              )}
            </div>

            {/* Card info */}
            <div className="w-full max-w-xs bg-white/10 rounded-2xl p-4 text-center">
              <p className="text-white/60 text-caption mb-2">내 도서증 정보</p>
              <p className="text-white text-body font-bold">{currentUser.cardNumber}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Lock className="h-4 w-4 text-white/40" />
                <p className="text-white/40 text-caption">PIN 설정 완료</p>
              </div>
            </div>

            {!scanComplete && (
              <button onClick={handleScanCard} disabled={scanning} className="btn-senior bg-emerald-600 text-white rounded-xl w-full max-w-xs">
                {scanning ? '스캔 중...' : '스캔하기'}
              </button>
            )}
          </motion.div>
        )}

        {/* Step 4: Enter PIN */}
        {step === 'enter-pin' && (
          <motion.div key="enter-pin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-center px-6 py-8 gap-6">
            <div className="text-center">
              <p className="text-white text-heading">비밀번호를 입력해주세요</p>
              <p className="text-white/60 text-caption mt-1">4자리 비밀번호를 눌러주세요</p>
            </div>

            {/* PIN display boxes */}
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl border-3 transition-all duration-200 sm:h-20 sm:w-20',
                  pin.length === i
                    ? 'border-white bg-white/20 scale-105'
                    : pin[i]
                      ? 'border-emerald-400 bg-emerald-400/20'
                      : 'border-white/20 bg-white/5'
                )}>
                  {pin[i] ? (
                    <div className="h-4 w-4 rounded-full bg-white" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-white/30" />
                  )}
                </div>
              ))}
            </div>

            {pinError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-amber-400 text-body text-center font-bold">
                {pinError}
              </motion.p>
            )}

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'delete'].map((num) => {
                if (num === null) return <div key="empty" />
                const isDelete = num === 'delete'
                return (
                  <motion.button
                    key={num}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handlePinInput(isDelete ? 'delete' : num as number)}
                    className={cn(
                      'flex h-16 items-center justify-center rounded-2xl text-heading font-bold transition-colors',
                      isDelete
                        ? 'bg-white/10 text-white/70 active:bg-white/20'
                        : 'bg-white/15 text-white active:bg-white/25'
                    )}
                  >
                    {isDelete ? <span className="text-body">삭제</span> : num}
                  </motion.button>
                )
              })}
            </div>

            {pin.length === 4 && !pinError && (
              <button onClick={handlePinConfirm} className="btn-senior bg-emerald-600 text-white rounded-xl w-full max-w-xs">
                확인
              </button>
            )}
          </motion.div>
        )}

        {/* Step 5: Confirm */}
        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col px-6 py-6 gap-5">
            <p className="text-white text-heading text-center">대여 내역 확인</p>

            <div className="bg-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-white/60 text-body">대출자</span>
                <span className="text-white text-body font-bold">{currentUser.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-white/60 text-body">도서증 번호</span>
                <span className="text-white text-body">{currentUser.cardNumber}</span>
              </div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-white/60 text-body">대여 권수</span>
                <span className="text-white text-body font-bold">{scannedBooks.length}권</span>
              </div>
            </div>

            <div className="space-y-2">
              {scannedBooks.map((sb, i) => (
                <div key={sb.book.id} className="bg-white/10 rounded-xl p-3">
                  <p className="text-white text-body font-bold">{i + 1}. {sb.book.title}</p>
                  <p className="text-white/60 text-caption">{sb.book.author}</p>
                  <p className="text-emerald-400 text-caption mt-1">반납일: {formatDate(sb.dueDate)}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={loanProcessing}
              className="btn-senior bg-emerald-600 text-white rounded-xl w-full"
            >
              {loanProcessing ? '처리 중...' : '대여 완료'}
            </button>
          </motion.div>
        )}

        {/* Step 6: Complete */}
        {step === 'complete' && (
          <motion.div key="complete" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-center px-6 py-8 gap-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <CheckCircle className="h-24 w-24 text-emerald-400" />
            </motion.div>
            <p className="text-white text-title text-center">대여가 완료되었습니다!</p>

            {/* Receipt */}
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-gray-900 border-2 border-dashed border-gray-300">
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                <p className="text-heading font-bold">대여 영수증</p>
                <p className="text-caption text-gray-500">스마트 도서관 (무인 키오스크)</p>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between"><span className="text-body text-gray-500">대출자</span><span className="text-body font-bold">{currentUser.name}</span></div>
                <div className="flex justify-between"><span className="text-body text-gray-500">도서증</span><span className="text-body">{currentUser.cardNumber}</span></div>
                <div className="flex justify-between"><span className="text-body text-gray-500">대여일</span><span className="text-body">{formatDate(new Date().toISOString())}</span></div>
              </div>
              <div className="border-t border-gray-200 pt-2 space-y-2">
                {scannedBooks.map((sb, i) => (
                  <div key={sb.book.id}>
                    <p className="text-body font-bold">{i + 1}. {sb.book.title}</p>
                    <p className="text-caption text-emerald-600">반납일: {formatDate(sb.dueDate)}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handlePrintReceipt} className="btn-senior bg-blue-600 text-white rounded-xl w-full max-w-sm">
              <Printer className="h-6 w-6" />
              영수증 출력
            </button>
          </motion.div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="relative z-40 flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-blue-900 to-purple-900 border-t border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={goStart} className="btn-senior flex-1 bg-white/10 text-white rounded-xl border border-white/20">
            <Home className="h-5 w-5" />
            처음으로
          </button>
          <button onClick={() => setHelpOpen(true)} className="btn-senior flex-1 bg-white/10 text-white rounded-xl border border-white/20">
            <HelpCircle className="h-5 w-5" />
            도움말
          </button>
        </div>
        <button onClick={() => setView('home')} className="text-white/40 text-caption hover:text-white/70 transition-colors text-center py-1">
          시뮬레이션 종료하기
        </button>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">대여 확인</AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              선택하신 {scannedBooks.length}권의 책을 대여하시겠습니까?
              <br />대여 기간은 {LOAN_PERIOD_DAYS}일입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
            <AlertDialogAction onClick={handleConfirmLoan} className="btn-senior bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full">확인</AlertDialogAction>
            <AlertDialogCancel className="btn-senior bg-white/10 text-white rounded-xl w-full border border-white/20">취소</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
