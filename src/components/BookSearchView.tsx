'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  BookOpen,
  BookX,
  Mic,
  MicOff,
  MapPin,
  Star,
  TrendingUp,
  CheckCircle,
  X,
} from 'lucide-react'
import { useAppStore, type BookItem } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

// Category-based colors for book covers
const CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  소설: { bg: 'bg-rose-100', icon: 'text-rose-600' },
  인문: { bg: 'bg-amber-100', icon: 'text-amber-700' },
  과학: { bg: 'bg-teal-100', icon: 'text-teal-700' },
  시: { bg: 'bg-violet-100', icon: 'text-violet-700' },
  역사: { bg: 'bg-sky-100', icon: 'text-sky-700' },
}

// Parse shelf location for map highlighting
function parseShelfLocation(location: string): { floor: string; row: string; col: string } {
  const parts = location.split(' ')
  const floorParts = parts[0]?.match(/(\d+)/)
  const shelfParts = parts[1]?.split('-')
  return {
    floor: floorParts ? `${floorParts[1]}층` : '2층',
    row: shelfParts?.[0] || 'A',
    col: shelfParts?.[1] || '01',
  }
}

// Shelf map component
function ShelfMap({ book }: { book: BookItem }) {
  const { floor, row, col } = parseShelfLocation(book.shelfLocation)
  const floors = ['2층', '3층', '4층']
  const rows = ['A', 'B', 'C', 'D', 'E']

  const floorIndex = floors.indexOf(floor)
  const rowIndex = rows.indexOf(row)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-senior mt-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h3 className="text-heading text-foreground">책 위치 안내</h3>
      </div>

      {/* Floor selector */}
      <div className="mb-4 flex items-center gap-2">
        {floors.map((f) => (
          <div
            key={f}
            className={cn(
              'flex h-12 min-w-[4rem] items-center justify-center rounded-lg px-3 text-caption font-bold',
              f === floor
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {f}
          </div>
        ))}
      </div>

      {/* Shelf grid */}
      <div className="relative rounded-xl border-2 border-border bg-muted/30 p-4">
        {rows.map((r, ri) => (
          <div key={r} className="mb-2 last:mb-0">
            <div className="flex items-center gap-3">
              <span className="w-8 text-caption font-bold text-muted-foreground">{r}열</span>
              <div className="relative h-10 flex-1 rounded-lg bg-amber-100/60 border border-amber-200/50">
                {/* Shelf rows look like bookshelves */}
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg bg-amber-300/60" />
                {/* Books on shelf */}
                {Array.from({ length: 8 }).map((_, ci) => (
                  <div
                    key={ci}
                    className={cn(
                      'absolute bottom-1 rounded-t-sm',
                      ri === rowIndex && ci === parseInt(col) - 1
                        ? 'bg-primary h-8 w-2 left-[12.5%] z-10 pulsing-book'
                        : `h-${4 + (ci % 3)} w-1.5 bg-amber-400/40`,
                      ri !== rowIndex && ci !== parseInt(col) - 1 && 'top-0'
                    )}
                    style={
                      ri === rowIndex && ci === parseInt(col) - 1
                        ? { left: `${(ci + 0.5) * 12.5}%`, height: '2rem', width: '0.5rem' }
                        : ri !== rowIndex
                          ? { left: `${(ci + 0.5) * 12.5}%`, height: `${1 + (ci % 3) * 0.25}rem`, width: '0.375rem', top: 0, bottom: '0.25rem' }
                          : { left: `${(ci + 0.5) * 12.5}%`, height: `${1 + (ci % 3) * 0.25}rem`, width: '0.375rem', top: 0, bottom: '0.25rem' }
                    }
                  />
                ))}
                {/* Highlight indicator */}
                {ri === rowIndex && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 z-20 flex items-center justify-center"
                    style={{ left: `${(parseInt(col) - 0.5) * 12.5}%` }}
                  >
                    <div className="h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50" />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Location info */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/5 p-3">
        <span className="text-body font-bold text-primary">{book.shelfLocation}</span>
        <span className="text-caption text-muted-foreground">{book.title}</span>
      </div>
    </motion.div>
  )
}

// Book card component
function BookCard({ book, onSelect, onBorrow, compact = false }: {
  book: BookItem
  onSelect?: () => void
  onBorrow?: () => void
  compact?: boolean
}) {
  const colors = CATEGORY_COLORS[book.category] || { bg: 'bg-slate-100', icon: 'text-slate-600' }
  const isAvailable = book.availableCopies > 0

  if (compact) {
    return (
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="card-senior min-w-[200px] max-w-[220px] cursor-pointer shrink-0"
        onClick={onSelect}
      >
        <div className={cn('flex h-24 items-center justify-center rounded-lg mb-2', colors.bg)}>
          <BookOpen className={cn('h-10 w-10', colors.icon)} />
        </div>
        <h4 className="text-body font-bold text-foreground truncate">{book.title}</h4>
        <p className="text-caption text-muted-foreground">{book.author}</p>
        <Badge className={cn('mt-1', isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')} variant="secondary">
          {isAvailable ? '대출 가능' : '대출 중'}
        </Badge>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="card-senior cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        {/* Book cover placeholder */}
        <div className={cn('flex h-24 w-20 shrink-0 items-center justify-center rounded-xl', colors.bg)}>
          <BookOpen className={cn('h-10 w-10', colors.icon)} />
        </div>

        {/* Book info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-heading text-foreground truncate">{book.title}</h4>
          <p className="text-body text-muted-foreground">{book.author}</p>
          <p className="text-caption text-muted-foreground">
            {book.publisher} · {book.publishYear}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge className={cn(
              isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            )} variant="secondary">
              {isAvailable ? '대출 가능' : '대출 중'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <MapPin className="mr-1 h-3 w-3" />
              {book.shelfLocation}
            </Badge>
          </div>
        </div>
      </div>

      {/* Borrow button */}
      {isAvailable && onBorrow && (
        <button
          onClick={(e) => { e.stopPropagation(); onBorrow() }}
          className="btn-senior mt-4 w-full bg-primary text-primary-foreground rounded-xl"
        >
          <BookOpen className="h-5 w-5" />
          빌리기
        </button>
      )}
    </motion.div>
  )
}

export default function BookSearchView() {
  const { setView, ttsEnabled, isMissionMode, completeMissionStep } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookItem[]>([])
  const [popularBooks, setPopularBooks] = useState<BookItem[]>([])
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const missionSearchDone = useRef(false)

  // Load popular books on mount
  useEffect(() => {
    async function loadPopular() {
      try {
        const res = await fetch('/api/books')
        if (res.ok) {
          const data = await res.json()
          setPopularBooks(data.slice(0, 4))
        }
      } catch {
        // ignore
      }
    }
    loadPopular()
  }, [])

  // TTS on mount
  useEffect(() => {
    if (ttsEnabled) {
      speak('도서 검색 화면입니다. 찾고 싶은 책의 제목이나 저자를 검색해보세요.')
    }
  }, [ttsEnabled])

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setSelectedBook(null)
    try {
      const res = await fetch(`/api/books?query=${encodeURIComponent(query.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        if (ttsEnabled) {
          speak(`${data.length}권의 책을 찾았습니다.`)
        }
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, ttsEnabled])

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Voice search
  const toggleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (ttsEnabled) speak('이 브라우저에서는 음성 검색을 지원하지 않습니다.')
      return
    }
    if (isListening) {
      setIsListening(false)
      return
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setQuery(transcript)
      if (ttsEnabled) speak(`"${transcript}"을 검색합니다.`)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.start()
  }

  // Select a book
  const handleSelectBook = (book: BookItem) => {
    setSelectedBook(book)
    if (ttsEnabled) {
      speak(`${book.title}, ${book.author}. ${book.shelfLocation}에 있습니다.`)
    }
    if (isMissionMode && !missionSearchDone.current) {
      missionSearchDone.current = true
      completeMissionStep()
    }
  }

  // Handle borrow
  const handleBorrow = (book: BookItem) => {
    setView('counter-loan')
  }

  // Mission steps
  const missionSteps = [
    { step: 1, title: '검색창 열기', description: '검색창을 눌러 검색을 시작합니다.' },
    { step: 2, title: '책 제목 검색', description: '찾고 싶은 책의 제목이나 저자를 입력합니다.' },
    { step: 3, title: '검색 결과 확인', description: '검색 결과에서 원하는 책을 찾습니다.' },
    { step: 4, title: '대출 가능 확인', description: '책이 대출 가능한지 확인합니다.' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="도서 검색"
        helpText="도서 검색 화면입니다. 찾고 싶은 책의 제목이나 저자를 입력하여 검색할 수 있습니다. 마이크 버튼으로 음성 검색도 가능합니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {/* Search area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-title text-foreground mb-4">도서 검색</h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="책 제목이나 저자를 검색해보세요"
                className="input-senior pl-12"
              />
            </div>
            <button
              onClick={toggleVoiceSearch}
              className={cn(
                'flex h-[var(--btn-height)] min-h-[var(--btn-height)] w-[var(--btn-height)] min-w-[var(--btn-height)] items-center justify-center rounded-xl border-2 transition-all',
                isListening
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-card text-muted-foreground hover:border-primary/50'
              )}
              aria-label={isListening ? '음성 검색 중지' : '음성 검색'}
            >
              {isListening ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </button>
          </div>
          {isListening && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-caption text-primary text-center"
            >
              🎤 듣고 있습니다...
            </motion.p>
          )}
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-senior mt-3 w-full bg-primary text-primary-foreground rounded-xl"
          >
            <Search className="h-6 w-6" />
            {loading ? '검색 중...' : '검색하기'}
          </button>
        </motion.div>

        {/* Popular books (shown before search) */}
        {!searched && popularBooks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h3 className="text-heading text-foreground">인기 도서</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {popularBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  compact
                  onSelect={() => handleSelectBook(book)}
                  onBorrow={() => handleBorrow(book)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Search results */}
        {searched && (
          <div className="mb-6">
            <h3 className="text-heading text-foreground mb-3">
              검색 결과 ({results.length}권)
            </h3>

            {results.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center gap-4 py-12"
              >
                <BookX className="h-16 w-16 text-muted-foreground/50" />
                <p className="text-body text-muted-foreground text-center">
                  검색 결과가 없습니다
                </p>
                <p className="text-caption text-muted-foreground">
                  다른 키워드로 검색해보세요
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-4">
                {results.map((book, index) => (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                    >
                      <BookCard
                        book={book}
                        onSelect={() => handleSelectBook(book)}
                        onBorrow={() => handleBorrow(book)}
                      />
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Shelf map when book selected */}
        {selectedBook && (
            <motion.div
              key="shelf-map"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ShelfMap book={selectedBook} />

              {/* Action buttons */}
              <div className="mt-4 flex gap-3">
                {selectedBook.availableCopies > 0 && (
                  <button
                    onClick={() => handleBorrow(selectedBook)}
                    className="btn-senior flex-1 bg-primary text-primary-foreground rounded-xl"
                  >
                    <BookOpen className="h-5 w-5" />
                    빌리러 가기
                  </button>
                )}
                <button
                  onClick={() => setSelectedBook(null)}
                  className="btn-senior bg-secondary text-secondary-foreground rounded-xl"
                >
                  <X className="h-5 w-5" />
                  닫기
                </button>
              </div>
            </motion.div>
          )}

        {/* Mission mode steps */}
        {isMissionMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 mb-24"
          >
            <Separator className="mb-4" />
            <h3 className="text-heading text-foreground mb-3">📝 학습 진행</h3>
            <div className="flex flex-col gap-3">
              {missionSteps.map((step, i) => {
                const isCompleted = i < (missionSearchDone.current ? 2 : 0)
                return (
                  <div
                    key={step.step}
                    className={cn(
                      'flex items-center gap-3 rounded-xl p-3 border-2',
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-border bg-card'
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
                      isCompleted ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <span className="text-caption font-bold">{step.step}</span>
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        'text-body font-bold',
                        isCompleted ? 'text-emerald-700' : 'text-foreground'
                      )}>
                        {step.title}
                      </p>
                      <p className="text-caption text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Bottom padding */}
        {!isMissionMode && <div className="pb-24" />}
      </main>
    </div>
  )
}
