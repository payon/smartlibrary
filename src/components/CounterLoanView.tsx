'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Clock,
  UserCheck,
  Star,
  ChevronRight,
  Library,
  Search,
  X,
  ArrowRight,
} from 'lucide-react'
import { useAppStore, type BookItem, type LoanItem } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
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
import { toast } from 'sonner'
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS, EXTEND_DAYS } from '@/lib/constants'

type LoanStep = 1 | 2 | 3 | 4 | 5 | 6

// Format date to Korean
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// Add days to date
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
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

// Category-based colors
const CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  소설: { bg: 'bg-rose-100', icon: 'text-rose-600' },
  인문: { bg: 'bg-amber-100', icon: 'text-amber-700' },
  과학: { bg: 'bg-teal-100', icon: 'text-teal-700' },
  시: { bg: 'bg-violet-100', icon: 'text-violet-700' },
  역사: { bg: 'bg-sky-100', icon: 'text-sky-700' },
}

export default function CounterLoanView() {
  const {
    currentUser,
    setView,
    ttsEnabled,
    isMissionMode,
    completeMissionStep,
    currentMissionStep,
  } = useAppStore()

  const [step, setStep] = useState<LoanStep>(1)
  const [cardPresented, setCardPresented] = useState(false)
  const [books, setBooks] = useState<BookItem[]>([])
  const [activeLoans, setActiveLoans] = useState<LoanItem[]>([])
  const [selectedBooks, setSelectedBooks] = useState<BookItem[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loansCreated, setLoansCreated] = useState(false)
  const [loanResults, setLoanResults] = useState<{ book: BookItem; dueDate: string }[]>([])
  const [librarianMessage, setLibrarianMessage] = useState('')
  const [cardAnimation, setCardAnimation] = useState(false)

  // Fetch available books and active loans
  const refreshData = async () => {
    if (!currentUser) return
    try {
      const [booksRes, loansRes] = await Promise.all([
        fetch('/api/books'),
        fetch(`/api/loans?userId=${currentUser.id}`),
      ])
      if (booksRes.ok) {
        const booksData = await booksRes.json()
        setBooks(booksData.filter((b: BookItem) => b.availableCopies > 0))
      }
      if (loansRes.ok) {
        const loansData = await loansRes.json()
        const active = loansData.filter((l: LoanItem) => l.status === 'active')
        setActiveLoans(active)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      if (!currentUser) return
      try {
        const [booksRes, loansRes] = await Promise.all([
          fetch('/api/books'),
          fetch(`/api/loans?userId=${currentUser.id}`),
        ])
        if (cancelled) return
        if (booksRes.ok) {
          const booksData = await booksRes.json()
          setBooks(booksData.filter((b: BookItem) => b.availableCopies > 0))
        }
        if (loansRes.ok) {
          const loansData = await loansRes.json()
          const active = loansData.filter((l: LoanItem) => l.status === 'active')
          setActiveLoans(active)
        }
      } catch {
        // ignore
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [currentUser])

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    const messages: Record<LoanStep, string> = {
      1: '사서님께 도서증을 제시해주세요.',
      2: '빌리고 싶은 책을 선택해주세요. 최대 5권까지 빌릴 수 있습니다.',
      3: '대여 권수를 확인해주세요.',
      4: '연체된 도서가 있는지 확인해주세요.',
      5: '대여할 책과 반납일을 확인해주세요.',
      6: '대여가 완료되었습니다.',
    }
    speak(messages[step])
  }, [step, ttsEnabled])

  // Pre-requisite check
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="창구 대여" />
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

  // Toggle book selection
  const toggleBook = (book: BookItem) => {
    setSelectedBooks((prev) => {
      const exists = prev.find((b) => b.id === book.id)
      if (exists) {
        return prev.filter((b) => b.id !== book.id)
      }
      if (prev.length >= MAX_LOAN_COUNT) {
        toast.warning(`최대 ${MAX_LOAN_COUNT}권까지 선택할 수 있습니다.`)
        return prev
      }
      return [...prev, book]
    })
  }

  // Step 1: Present card
  const handlePresentCard = () => {
    setCardAnimation(true)
    setLibrarianMessage('네, 확인했습니다')
    setTimeout(() => {
      setCardPresented(true)
      if (ttsEnabled) speak('네, 확인했습니다. 도서증을 확인했습니다.')
      if (isMissionMode) completeMissionStep()
    }, 1500)
  }

  // Go to next step after selection
  const handleNextFromSelection = () => {
    if (selectedBooks.length === 0) {
      toast.warning('최소 1권 이상 선택해주세요.')
      return
    }

    // Check if already at max loans
    const totalLoans = activeLoans.length + selectedBooks.length
    if (totalLoans > MAX_LOAN_COUNT) {
      setStep(3)
      return
    }

    // Check for overdue loans
    const today = new Date()
    const hasOverdue = activeLoans.some((loan) => new Date(loan.dueDate) < today)
    if (hasOverdue) {
      setStep(4)
      return
    }

    setStep(5)
    if (isMissionMode) completeMissionStep()
  }

  // Step 5: Confirm loan
  const handleConfirmLoan = async () => {
    setConfirmOpen(false)
    setLoading(true)

    const today = new Date()
    const results: { book: BookItem; dueDate: string }[] = []

    for (const book of selectedBooks) {
      try {
        const res = await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            bookId: book.id,
            method: 'counter',
          }),
        })
        if (res.ok) {
          const dueDate = addDays(today, LOAN_PERIOD_DAYS)
          results.push({
            book,
            dueDate: dueDate.toISOString().split('T')[0],
          })
        } else {
          const data = await res.json()
          toast.error(data.error || `${book.title} 대출에 실패했습니다.`)
        }
      } catch {
        toast.error('네트워크 오류가 발생했습니다.')
      }
    }

    setLoanResults(results)
    setLoansCreated(true)
    setStep(6)
    setLoading(false)

    if (results.length > 0) {
      if (ttsEnabled) {
        speak(`대여가 완료되었습니다. ${results.length}권을 빌렸습니다.`)
      }
      if (isMissionMode) completeMissionStep()
    }

    // Refresh active loans
    refreshData()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="창구 대여"
        helpText="창구 대여 화면입니다. 사서님께 도서증을 보여주고 책을 빌리는 연습을 합니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <StepProgress current={step} total={6} />

        {/* Step 1: Present Card */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                도서증 제시
              </h2>

              {/* Counter desk scene */}
              <div className="card-senior flex flex-col items-center gap-4">
                {/* Desk illustration */}
                <div className="w-full rounded-xl bg-amber-100/60 p-6">
                  <div className="flex items-center gap-4">
                    {/* Librarian avatar */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                      <span className="text-heading text-white font-bold">사</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-body font-bold text-foreground">사서님</p>
                      <p className="text-caption text-muted-foreground">
                        도서증을 보여주세요
                      </p>
                    </div>
                    <Library className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>

                {/* User's card */}
                <motion.div
                  animate={cardAnimation ? { y: [0, -20, -60], opacity: [1, 1, 0] } : {}}
                  transition={{ duration: 1.2 }}
                  className={cn(
                    'w-full rounded-xl border-2 bg-gradient-to-br from-emerald-600 to-teal-500 p-4 text-white shadow-lg',
                    cardAnimation && 'opacity-0'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-caption text-white/70">스마트 도서관</p>
                      <p className="text-heading font-bold">{currentUser.name}</p>
                      <p className="text-body mt-1 font-mono">{currentUser.cardNumber}</p>
                    </div>
                    <CreditCard className="h-10 w-10 text-white/60" />
                  </div>
                </motion.div>

                {/* Librarian message */}
                {librarianMessage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full rounded-xl bg-emerald-50 border-2 border-emerald-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600" />
                      <p className="text-body font-bold text-emerald-800">
                        {librarianMessage}
                      </p>
                    </div>
                  </motion.div>
                )}

                {!cardPresented && (
                  <button
                    onClick={handlePresentCard}
                    className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
                  >
                    <CreditCard className="h-6 w-6" />
                    도서증을 제시합니다
                  </button>
                )}

                {cardPresented && (
                  <button
                    onClick={() => {
                      setStep(2)
                      if (isMissionMode) completeMissionStep()
                    }}
                    className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
                  >
                    <ChevronRight className="h-6 w-6" />
                    다음 단계로
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select books */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                빌릴 책 선택
              </h2>

              {/* Current active loans count */}
              <div className="flex items-center gap-4">
                <div className="card-senior flex flex-1 items-center gap-3">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-caption text-muted-foreground">현재 대출</p>
                    <p className="text-body font-bold text-foreground">{activeLoans.length}권</p>
                  </div>
                </div>
                <div className="card-senior flex flex-1 items-center gap-3">
                  <BookOpen className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="text-caption text-muted-foreground">대출 가능</p>
                    <p className="text-body font-bold text-foreground">
                      {Math.max(0, MAX_LOAN_COUNT - activeLoans.length)}권
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected books summary */}
              {selectedBooks.length > 0 && (
                <div className="rounded-xl bg-primary/5 border-2 border-primary/20 p-4">
                  <p className="text-body font-bold text-primary mb-2">
                    선택한 책: {selectedBooks.length}권
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooks.map((b) => (
                      <Badge key={b.id} variant="secondary" className="text-caption py-1.5 px-3">
                        {b.title}
                        <button
                          onClick={() => toggleBook(b)}
                          className="ml-2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Book list */}
              <div className="max-h-80 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {books.map((book, index) => {
                  const isSelected = selectedBooks.some((b) => b.id === book.id)
                  const colors = CATEGORY_COLORS[book.category] || { bg: 'bg-slate-100', icon: 'text-slate-600' }

                  return (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => toggleBook(book)}
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
                        <div className={cn('flex h-14 w-10 shrink-0 items-center justify-center rounded-lg', colors.bg)}>
                          <BookOpen className={cn('h-6 w-6', colors.icon)} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-body font-bold text-foreground truncate">{book.title}</h4>
                          <p className="text-caption text-muted-foreground truncate">{book.author}</p>
                        </div>

                        {/* Available copies */}
                        <Badge className="bg-emerald-100 text-emerald-800" variant="secondary">
                          {book.availableCopies}권
                        </Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Next button */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="btn-senior bg-secondary text-secondary-foreground rounded-xl"
                >
                  이전
                </button>
                <button
                  onClick={handleNextFromSelection}
                  className="btn-senior flex-1 bg-primary text-primary-foreground rounded-xl"
                >
                  <ArrowRight className="h-5 w-5" />
                  다음 ({selectedBooks.length}권)
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Loan limit exceeded */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <AlertTriangle className="h-20 w-20 text-amber-500" />
              </motion.div>

              <div className="text-center">
                <h2 className="text-title text-foreground">
                  대여 권수를 초과했습니다!
                </h2>
                <p className="text-body text-muted-foreground mt-2">
                  최대 {MAX_LOAN_COUNT}권까지 대출할 수 있습니다.
                </p>
              </div>

              {/* Current loans list */}
              <div className="card-senior w-full">
                <h3 className="text-heading text-foreground mb-3">현재 대출 목록</h3>
                <div className="flex flex-col gap-2">
                  {activeLoans.map((loan) => (
                    <div key={loan.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                      <BookOpen className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-body text-foreground truncate flex-1">
                        {loan.book?.title || '제목 없음'}
                      </span>
                      <span className="text-caption text-muted-foreground shrink-0">
                        ~{formatDate(loan.dueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 text-center w-full">
                <p className="text-body font-bold text-amber-800">
                  반납 후 다시 오세요
                </p>
              </div>

              <div className="flex w-full gap-3">
                <button
                  onClick={() => setView('counter-return')}
                  className="btn-senior flex-1 bg-primary text-primary-foreground rounded-xl"
                >
                  반납하러 가기
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="btn-senior bg-secondary text-secondary-foreground rounded-xl"
                >
                  다시 선택
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Overdue books warning */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <AlertTriangle className="h-20 w-20 text-rose-500" />
              </motion.div>

              <div className="text-center">
                <h2 className="text-title text-foreground">
                  연체된 도서가 있습니다
                </h2>
                <p className="text-body text-muted-foreground mt-2">
                  먼저 반납해주세요.
                </p>
              </div>

              {/* Overdue loans */}
              <div className="card-senior w-full">
                <h3 className="text-heading text-foreground mb-3">연체 도서 목록</h3>
                <div className="flex flex-col gap-2">
                  {activeLoans
                    .filter((loan) => new Date(loan.dueDate) < new Date())
                    .map((loan) => {
                      const today = new Date()
                      const due = new Date(loan.dueDate)
                      const overdueDays = Math.ceil(
                        (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
                      )
                      return (
                        <div key={loan.id} className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3">
                          <BookOpen className="h-5 w-5 text-rose-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-body text-foreground truncate block">
                              {loan.book?.title || '제목 없음'}
                            </span>
                            <span className="text-caption text-rose-600">
                              반납일: {formatDate(loan.dueDate)} ({overdueDays}일 연체)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              <button
                onClick={() => setView('counter-return')}
                className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
              >
                <ArrowRight className="h-5 w-5" />
                반납하러 가기
              </button>
              <button
                onClick={() => setStep(2)}
                className="btn-senior w-full bg-secondary text-secondary-foreground rounded-xl"
              >
                다시 선택
              </button>
            </motion.div>
          )}

          {/* Step 5: Loan confirmation */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                대여 확인
              </h2>

              <p className="text-body text-muted-foreground text-center">
                아래 책을 대출합니다. 반납일을 확인해주세요.
              </p>

              {/* Loan summary */}
              <div className="card-senior">
                <div className="flex flex-col gap-4">
                  {selectedBooks.map((book, index) => {
                    const dueDate = addDays(new Date(), LOAN_PERIOD_DAYS)
                    const colors = CATEGORY_COLORS[book.category] || { bg: 'bg-slate-100', icon: 'text-slate-600' }
                    return (
                      <motion.div
                        key={book.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 rounded-xl bg-muted/50 p-4"
                      >
                        <div className={cn('flex h-12 w-10 shrink-0 items-center justify-center rounded-lg', colors.bg)}>
                          <BookOpen className={cn('h-6 w-6', colors.icon)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-body font-bold text-foreground truncate">
                            {book.title}
                          </h4>
                          <p className="text-caption text-muted-foreground">{book.author}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-caption text-muted-foreground">반납일</p>
                          <p className="text-body font-bold text-primary">
                            {formatDate(dueDate.toISOString())}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <span className="text-body font-bold text-foreground">총 {selectedBooks.length}권</span>
                  <span className="text-caption text-muted-foreground">
                    대출기간: {LOAN_PERIOD_DAYS}일
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="btn-senior bg-secondary text-secondary-foreground rounded-xl"
                >
                  이전
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="btn-senior flex-1 bg-primary text-primary-foreground rounded-xl"
                >
                  <CheckCircle className="h-5 w-5" />
                  대여합니다
                </button>
              </div>

              {/* AlertDialog */}
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-heading">
                      정말 대여하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-body">
                      {selectedBooks.length}권의 책을 대출합니다.
                      반납일은 대출일로부터 {LOAN_PERIOD_DAYS}일 후입니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
                    <AlertDialogAction
                      onClick={handleConfirmLoan}
                      disabled={loading}
                      className="btn-senior bg-primary text-primary-foreground rounded-xl w-full"
                    >
                      {loading ? '처리 중...' : '네, 대여합니다'}
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
                    >
                      아니요
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}

          {/* Step 6: Receipt / Success */}
          {step === 6 && (
            <motion.div
              key="step6"
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
                대여 완료!
              </h2>

              {/* Receipt card */}
              <div className="w-full rounded-xl border-2 border-dashed border-border bg-card p-6">
                <div className="mb-4 text-center">
                  <p className="text-heading font-bold text-foreground">스마트 도서관 영수증</p>
                  <Separator className="mt-2" />
                </div>

                <div className="flex flex-col gap-4">
                  {/* User info */}
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">회원명</span>
                    <span className="text-body font-bold text-foreground">{currentUser.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-muted-foreground">도서증 번호</span>
                    <span className="text-body font-bold text-foreground">{currentUser.cardNumber}</span>
                  </div>

                  <Separator />

                  {/* Loan items */}
                  {loanResults.map((item) => (
                    <div key={item.book.id} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-body font-bold text-foreground">{item.book.title}</p>
                      <p className="text-caption text-muted-foreground">{item.book.author}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-caption font-bold text-primary">
                          반납일: {formatDate(item.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="text-center">
                    <p className="text-heading font-bold text-foreground">
                      총 {loanResults.length}권 대여
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                    <p className="text-caption text-amber-800">
                      💡 연장은 1회 가능합니다 ({EXTEND_DAYS}일)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3">
                <button
                  onClick={() => setView('home')}
                  className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
                >
                  홈으로
                </button>
              </div>
            </motion.div>
          )}
      </main>
    </div>
  )
}
