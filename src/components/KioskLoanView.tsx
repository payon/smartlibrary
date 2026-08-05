'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
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

type KioskLoanStep = 'start' | 'scan-card' | 'scan-books' | 'confirm' | 'complete'

interface ScannedBook {
  book: BookItem
  dueDate: string
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Format date to Korean
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// QR code placeholder grid (visual only)
function QrCodePlaceholder({ size = 11 }: { size?: number }) {
  // Predefined pattern for visual effect
  const pattern = [
    [1,1,1,0,1,0,1,0,1,1,1],
    [1,0,1,0,0,1,0,1,1,0,1],
    [1,1,1,0,1,0,1,0,1,1,1],
    [0,0,0,0,1,1,0,0,0,0,0],
    [1,0,1,1,0,0,1,1,0,1,0],
    [0,1,0,0,1,1,0,0,1,0,1],
    [1,1,1,0,1,0,1,0,1,1,1],
    [0,0,0,1,0,1,0,1,0,0,0],
    [1,0,1,1,0,0,1,1,0,1,0],
    [1,1,1,0,1,0,1,0,1,1,1],
    [1,0,1,0,0,1,0,1,1,0,1],
  ]
  const cellSize = Math.max(4, Math.floor(120 / size))
  return (
    <div
      className="mx-auto bg-white rounded-lg p-2 inline-block qr-glow"
      style={{ width: size * cellSize + 16, height: size * cellSize + 16 }}
    >
      <div className="grid" style={{
        gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
      }}>
        {Array.from({ length: size * size }).map((_, i) => {
          const row = Math.floor(i / size)
          const col = i % size
          const filled = pattern[row]?.[col] === 1
          return (
            <div
              key={i}
              className={cn('rounded-sm', filled ? 'bg-gray-900' : 'bg-white')}
              style={{ width: cellSize, height: cellSize }}
            />
          )
        })}
      </div>
    </div>
  )
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
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [bookScanComplete, setBookScanComplete] = useState(false)

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

    // Warning at 10 seconds before timeout
    const warnTime = Math.max(0, kioskTimeoutSeconds - 10) * 1000
    warningRef.current = setTimeout(() => {
      if (ttsEnabled && !timeoutWarningSpokenRef.current) {
        speak('곧 초기화됩니다. 계속하시려면 화면을 터치해주세요')
        timeoutWarningSpokenRef.current = true
      }
    }, warnTime)

    // Full timeout
    timerRef.current = setTimeout(() => {
      setTimedOut(true)
      if (ttsEnabled) {
        speak('시간이 초과되었습니다. 처음부터 다시 시작합니다.')
      }
      setTimeout(() => {
        setStep('start')
        setScannedBooks([])
        setScanning(false)
        setScanComplete(false)
        setBookScanComplete(false)
        setSelectedBookId(null)
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

  // Fetch available books on mount
  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data: BookItem[]) => {
        setBooks(data.filter((b) => b.availableCopies > 0))
      })
      .catch(() => {})
  }, [])

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    switch (step) {
      case 'start':
        speak('원하시는 서비스를 선택해주세요')
        break
      case 'scan-card':
        speak('도서증 QR코드를 스캔해주세요')
        break
      case 'scan-books':
        speak('빌리고 싶은 책을 선택한 후 바코드를 스캔해주세요')
        break
      case 'confirm':
        speak('대여할 책을 확인하고 대여 완료를 눌러주세요')
        break
      case 'complete':
        speak('대여가 완료되었습니다!')
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
          <p className="text-white/60 text-body">도서관 회원가입 후 이용하실 수 있습니다.</p>
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
      // Auto-advance after a moment
      setTimeout(() => setStep('scan-books'), 1500)
    }, 2000)
  }

  // Scan book handler
  const handleScanBook = () => {
    if (scanning || !selectedBookId) return
    const book = books.find((b) => b.id === selectedBookId)
    if (!book) return
    if (scannedBooks.length >= MAX_LOAN_COUNT) {
      toast.error(`최대 ${MAX_LOAN_COUNT}권까지 대여 가능합니다`)
      return
    }
    setScanning(true)
    setBookScanComplete(false)
    if (ttsEnabled) speak('바코드를 스캔하고 있습니다')
    setTimeout(() => {
      setScanning(false)
      setBookScanComplete(true)
      if (ttsEnabled) speak('삑!')
      const dueDate = addDays(new Date(), LOAN_PERIOD_DAYS).toISOString()
      setScannedBooks((prev) => [...prev, { book, dueDate }])
      setSelectedBookId(null)
      setTimeout(() => setBookScanComplete(false), 1000)
    }, 1500)
  }

  // Remove scanned book
  const removeScannedBook = (bookId: string) => {
    setScannedBooks((prev) => prev.filter((s) => s.book.id !== bookId))
  }

  // Confirm loan
  const handleConfirmLoan = async () => {
    setConfirmOpen(false)
    try {
      for (const sb of scannedBooks) {
        await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            bookId: sb.book.id,
            method: 'kiosk',
          }),
        })
      }
      if (isMissionMode && currentMissionScenarioId === 'scenario-kiosk-loan') {
        completeMissionStep()
      }
      setStep('complete')
    } catch {
      toast.error('대여 처리 중 오류가 발생했습니다')
    }
  }

  // Print receipt simulation
  const handlePrintReceipt = () => {
    toast.success('영수증이 출력되었습니다')
  }

  // Go to first step
  const goStart = () => {
    setStep('start')
    setScannedBooks([])
    setScanning(false)
    setScanComplete(false)
    setBookScanComplete(false)
    setSelectedBookId(null)
  }

  // Help text per step
  const helpTexts: Record<KioskLoanStep, string> = {
    start: '키오스크 시작 화면입니다. 도서 대여 또는 도서 반납을 선택할 수 있습니다.',
    'scan-card': '모바일 도서증의 QR코드를 스캔하는 화면입니다. 도서증 화면을 키오스크 카메라에 가까이 대주세요.',
    'scan-books': '빌리고 싶은 책의 바코드를 스캔하는 화면입니다. 책을 선택한 후 스캔하기 버튼을 눌러주세요.',
    confirm: '대여할 책 목록을 확인하는 화면입니다. 내용이 맞으면 대여 완료 버튼을 눌러주세요.',
    complete: '대여가 완료되었습니다. 영수증을 출력하시거나 처음으로 돌아갈 수 있습니다.',
  }

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
                onClick={() => setStep('scan-card')}
                className="w-full max-w-sm h-28 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg"
              >
                <BookOpen className="h-10 w-10" />
                도서 대여
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setView('kiosk-return')}
                className="w-full max-w-sm h-28 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-button flex items-center justify-center gap-4 transition-colors shadow-lg"
              >
                <BookOpen className="h-10 w-10" />
                도서 반납
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Scan card */}
          {step === 'scan-card' && (
            <motion.div
              key="scan-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center px-6 py-8 gap-6"
            >
              <p className="text-white text-heading text-center">도서증을 스캔해주세요</p>

              {/* QR scan area */}
              <div className="relative w-full max-w-xs aspect-square border-4 border-dashed border-white/30 rounded-2xl flex items-center justify-center bg-white/5 overflow-hidden">
                {/* Scan line animation */}
                {scanning && (
                  <div className="absolute left-0 right-0 h-1 bg-emerald-400 scan-line z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )}
                {scanComplete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <CheckCircle className="h-20 w-20 text-emerald-400 mx-auto" />
                    <p className="text-emerald-400 text-heading mt-2">삑! 스캔 완료</p>
                    <p className="text-white text-body mt-1">{currentUser.name}님</p>
                  </motion.div>
                ) : (
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-white/40 mb-2" />
                    <p className="text-white/40 text-caption">QR 코드를 여기에 대주세요</p>
                  </div>
                )}
              </div>

              {/* User QR code card */}
              <div className="w-full max-w-xs bg-white/10 rounded-2xl p-4 text-center">
                <p className="text-white/60 text-caption mb-2">내 도서증</p>
                <QrCodePlaceholder size={11} />
                <p className="text-white text-body mt-2 font-bold">{currentUser.cardNumber}</p>
              </div>

              {!scanComplete && (
                <button
                  onClick={handleScanCard}
                  disabled={scanning}
                  className="btn-senior bg-emerald-600 text-white rounded-xl w-full max-w-xs"
                >
                  {scanning ? '스캔 중...' : '스캔하기'}
                </button>
              )}
            </motion.div>
          )}

          {/* Step 3: Scan books */}
          {step === 'scan-books' && (
            <motion.div
              key="scan-books"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col px-6 py-6 gap-5"
            >
              <div className="text-center">
                <p className="text-white text-heading">빌릴 책을 선택하세요</p>
                <p className="text-white/60 text-caption mt-1">최대 {MAX_LOAN_COUNT}권 ({scannedBooks.length}/{MAX_LOAN_COUNT})</p>
              </div>

              {/* Scan area for book barcode */}
              <div className="relative w-full h-32 border-4 border-dashed border-white/20 rounded-xl flex items-center justify-center bg-white/5 overflow-hidden">
                {scanning && (
                  <div className="absolute left-0 right-0 h-1 bg-emerald-400 scan-line z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )}
                {bookScanComplete && (
                    <motion.div
                      key="book-scan-ok"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0 flex items-center justify-center bg-emerald-600/20"
                    >
                      <span className="text-emerald-400 text-title font-bold">삑!</span>
                    </motion.div>
                  )}
                {!scanning && !bookScanComplete && (
                  <div className="text-center">
                    <Barcode className="h-10 w-10 text-white/40" />
                    <p className="text-white/40 text-caption">책 바코드 스캔 영역</p>
                  </div>
                )}
                {scanning && (
                  <p className="text-white/60 text-body">스캔 중...</p>
                )}
              </div>

              {/* Selected book + scan button */}
              {selectedBookId && (
                <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-body font-bold truncate">
                      {books.find((b) => b.id === selectedBookId)?.title}
                    </p>
                    <p className="text-white/60 text-caption truncate">
                      {books.find((b) => b.id === selectedBookId)?.author}
                    </p>
                  </div>
                  <button
                    onClick={handleScanBook}
                    disabled={scanning}
                    className="btn-senior bg-emerald-600 text-white rounded-xl"
                  >
                    스캔하기
                  </button>
                </div>
              )}

              {/* Book list */}
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                {books
                  .filter((b) => !scannedBooks.some((s) => s.book.id === b.id))
                  .map((book) => (
                    <motion.button
                      key={book.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedBookId(book.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                        selectedBookId === book.id
                          ? 'bg-emerald-600/30 border-2 border-emerald-400'
                          : 'bg-white/10 border-2 border-transparent hover:bg-white/15'
                      )}
                    >
                      <Barcode className="h-6 w-6 text-white/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-body truncate">{book.title}</p>
                        <p className="text-white/60 text-caption truncate">{book.author}</p>
                      </div>
                      <CircleDot className={cn(
                        'h-5 w-5 shrink-0',
                        selectedBookId === book.id ? 'text-emerald-400' : 'text-white/30'
                      )} />
                    </motion.button>
                  ))}
              </div>

              {/* Scanned books list */}
              {scannedBooks.length > 0 && (
                <div>
                  <p className="text-white/80 text-body font-bold mb-2">스캔된 책 ({scannedBooks.length}권)</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {scannedBooks.map((sb) => (
                      <div
                        key={sb.book.id}
                        className="flex items-center gap-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-3"
                      >
                        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-body truncate">{sb.book.title}</p>
                        </div>
                        <button
                          onClick={() => removeScannedBook(sb.book.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          aria-label="제거"
                        >
                          <X className="h-5 w-5 text-white/60" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {scannedBooks.length > 0 && (
                    <button
                      onClick={() => setStep('confirm')}
                      className="btn-senior bg-emerald-600 text-white rounded-xl w-full mt-4"
                    >
                      다음 단계
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col px-6 py-6 gap-5"
            >
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
                  <div
                    key={sb.book.id}
                    className="bg-white/10 rounded-xl p-3"
                  >
                    <p className="text-white text-body font-bold">{i + 1}. {sb.book.title}</p>
                    <p className="text-white/60 text-caption">{sb.book.author}</p>
                    <p className="text-emerald-400 text-caption mt-1">
                      반납일: {formatDate(sb.dueDate)}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setConfirmOpen(true)}
                className="btn-senior bg-emerald-600 text-white rounded-xl w-full"
              >
                대여 완료
              </button>
            </motion.div>
          )}

          {/* Step 5: Complete */}
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
              <p className="text-white text-title text-center">대여가 완료되었습니다!</p>

              {/* Receipt */}
              <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-gray-900 border-2 border-dashed border-gray-300">
                <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                  <p className="text-heading font-bold">대여 영수증</p>
                  <p className="text-caption text-gray-500">스마트 도서관</p>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">대출자</span>
                    <span className="text-body font-bold">{currentUser.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">도서증</span>
                    <span className="text-body">{currentUser.cardNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-body text-gray-500">대여일</span>
                    <span className="text-body">{formatDate(new Date().toISOString())}</span>
                  </div>
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

              <button
                onClick={handlePrintReceipt}
                className="btn-senior bg-blue-600 text-white rounded-xl w-full max-w-sm"
              >
                <Printer className="h-6 w-6" />
                영수증 출력
              </button>
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
            <AlertDialogAction
              onClick={handleConfirmLoan}
              className="btn-senior bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full"
            >
              확인
            </AlertDialogAction>
            <AlertDialogCancel className="btn-senior bg-white/10 text-white rounded-xl w-full border border-white/20">
              취소
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
