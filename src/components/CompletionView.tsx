'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Home, RotateCcw, Award, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
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

// Generate confetti pieces
const CONFETTI_PIECES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F0E68C'][i % 7],
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 3 + Math.random() * 2,
  size: 8 + Math.random() * 12,
}))

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function CompletionView() {
  const { currentUser, setView, ttsEnabled } = useAppStore()
  const [showConfetti, setShowConfetti] = useState(true)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [completionDate, setCompletionDate] = useState<string | null>(null)

  // Fetch certificate info for date
  useEffect(() => {
    if (!currentUser) return
    fetch(`/api/progress/certificate?userId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.completionDate) {
          setCompletionDate(data.completionDate)
        } else {
          setCompletionDate(new Date().toISOString())
        }
      })
      .catch(() => {
        setCompletionDate(new Date().toISOString())
      })
  }, [currentUser])

  // TTS on mount
  useEffect(() => {
    if (ttsEnabled) {
      const name = currentUser?.name || ''
      setTimeout(() => {
        speak(`축하합니다! ${name ? `${name}님, ` : ''}스마트 도서관 시뮬레이션 수료증이 발급되었습니다.`)
      }, 500)
    }
  }, [ttsEnabled, currentUser])

  // Stop confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  // Handle reset all progress
  const handleResetAll = async () => {
    if (!currentUser) return
    try {
      await fetch('/api/seed', { method: 'POST' })
      toast.success('모든 학습 진행도가 초기화되었습니다')
      setView('home')
    } catch {
      toast.error('초기화에 실패했습니다')
    }
    setResetDialogOpen(false)
  }

  const today = completionDate ? formatDate(completionDate) : formatDate(new Date().toISOString())
  const userName = currentUser?.name || '학습자'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="수료증"
        showBack
        showHome
        showSettings={false}
        helpText="수료증 화면입니다. 모든 시나리오를 완료하면 수료증이 발급됩니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-24 relative">
        {showConfetti && (
          <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
            {CONFETTI_PIECES.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ y: -20, x: `${piece.left}vw`, opacity: 1, rotate: 0 }}
                animate={{ y: '110vh', opacity: 0.3, rotate: 720 }}
                transition={{ duration: piece.duration, delay: piece.delay, ease: 'linear' }}
                className="absolute top-0 rounded-sm"
                style={{ backgroundColor: piece.color, width: piece.size, height: piece.size * 0.6 }}
              />
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.3 }}
          className="my-8"
        >
          <div className="relative rounded-2xl p-8 text-center border-4 border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-xl shadow-amber-200/50">
            <span className="absolute top-3 left-3 h-6 w-6 border-t-2 border-l-2 border-amber-500 rounded-tl" />
            <span className="absolute top-3 right-3 h-6 w-6 border-t-2 border-r-2 border-amber-500 rounded-tr" />
            <span className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-amber-500 rounded-bl" />
            <span className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-amber-500 rounded-br" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="mx-auto mb-4"
            >
              <Sparkles className="h-12 w-12 text-amber-500" />
            </motion.div>

            <h2 className="text-title text-amber-800 mb-1">스마트 도서관 이용 수료증</h2>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-px flex-1 max-w-20 bg-amber-400" />
              <Award className="h-5 w-5 text-amber-500" />
              <div className="h-px flex-1 max-w-20 bg-amber-400" />
            </div>

            <p className="text-muted-foreground text-body mb-2">성 명</p>
            <p className="text-title text-amber-900 mb-6">{userName}</p>

            <div className="bg-white/60 rounded-xl p-4 mb-6 border border-amber-200">
              <p className="text-body text-amber-900 leading-relaxed">
                {'위 사람은 스마트 도서관 시뮬레이션의'}
              </p>
              <p className="text-body text-amber-900 leading-relaxed">
                {'모든 과정을 성공적으로 이수하였음을'}
              </p>
              <p className="text-body text-amber-900 leading-relaxed">
                {'증명합니다.'}
              </p>
            </div>

            <p className="text-body text-amber-700 mb-6">{today}</p>

            <div className="flex items-center justify-center gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 1 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-500 bg-amber-100"
              >
                <Award className="h-10 w-10 text-amber-600" />
              </motion.div>
            </div>
            <p className="text-heading text-amber-800 mt-3 font-bold">스마트 도서관 시뮬레이터</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col gap-4"
        >
          <button
            onClick={() => setView('home')}
            className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
          >
            <Home className="h-6 w-6" />
            홈으로 돌아가기
          </button>
          <button
            onClick={() => setResetDialogOpen(true)}
            className="btn-senior w-full bg-white text-foreground rounded-xl border-2 border-border hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-6 w-6" />
            다시 학습하기
          </button>
        </motion.div>
      </main>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">다시 학습하기</AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              모든 학습 진행도가 초기화됩니다.
              수료증 기록도 삭제되며 되돌릴 수 없습니다.
              정말 초기화하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
            <AlertDialogAction
              onClick={handleResetAll}
              className="btn-senior bg-destructive text-white rounded-xl w-full"
            >
              초기화
            </AlertDialogAction>
            <AlertDialogCancel className="btn-senior bg-white/10 text-foreground rounded-xl w-full border border-border">
              취소
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
