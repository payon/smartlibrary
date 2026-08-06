'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Search,
  CreditCard,
  ArrowRight,
  Library,
  Star,
  CheckCircle,
  UserPlus,
  Monitor,
  HandCoins,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { SCENARIOS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Badge } from '@/components/ui/badge'

interface ProgressMap {
  [scenarioId: string]: { completed: boolean; stars: number }
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  signup: UserPlus,
  card: CreditCard,
  loan: BookOpen,
  return: HandCoins,
  kiosk: Monitor,
  search: Search,
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-800',
  intermediate: 'bg-amber-100 text-amber-800',
  advanced: 'bg-rose-100 text-rose-800',
}

const SCENARIO_VIEW_MAP: Record<string, string> = {
  'scenario-signup': 'registration',
  'scenario-card': 'card-issuance',
  'scenario-search': 'book-search',
  'scenario-counter-loan': 'counter-loan',
  'scenario-counter-return': 'counter-return',
  'scenario-kiosk-loan': 'kiosk-loan',
  'scenario-kiosk-return': 'kiosk-return',
}

export default function HomeView() {
  const { currentUser, setView, ttsEnabled } = useAppStore()
  const [progressMap, setProgressMap] = useState<ProgressMap>({})

  // Fetch progress for the user
  useEffect(() => {
    async function fetchProgress() {
      if (!currentUser) return
      try {
        const res = await fetch(`/api/progress?userId=${currentUser.id}`)
        if (res.ok) {
          const data = await res.json()
          const map: ProgressMap = {}
          if (Array.isArray(data)) {
            for (const p of data) {
              if (!map[p.scenarioId] || map[p.scenarioId].stars < p.stars) {
                map[p.scenarioId] = {
                  completed: p.completed,
                  stars: p.stars,
                }
              }
            }
          }
          setProgressMap(map)
        }
      } catch {
        // ignore fetch errors
      }
    }
    fetchProgress()
  }, [currentUser])

  // TTS greeting
  useEffect(() => {
    if (ttsEnabled) {
      const greeting = currentUser
        ? `반갑습니다, ${currentUser.name}님!`
        : '환영합니다!'
      speak(greeting)
    }
  }, [])

  const totalStars = Object.values(progressMap).reduce((sum, p) => sum + p.stars, 0)
  const completedCount = Object.values(progressMap).filter((p) => p.completed).length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="스마트 도서관"
        showBack={false}
        showHome={false}
        helpText="홈 화면입니다. 여기서 도서관 이용 시나리오를 선택하여 연습할 수 있습니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-title text-foreground">
            {currentUser ? `반갑습니다, ${currentUser.name}님!` : '환영합니다!'}
          </h2>
          <p className="text-body text-muted-foreground mt-2">
            원하는 시나리오를 선택하여 연습해보세요
          </p>
        </motion.div>

        {/* Registration CTA if no user */}
        {!currentUser && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setView('registration')}
            className="card-senior mb-6 w-full border-primary/30 bg-primary/5 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-heading text-foreground">도서관 회원가입하기</h3>
                <p className="text-caption text-muted-foreground">
                  먼저 회원가입을 하여 도서증을 만들어보세요
                </p>
              </div>
              <ArrowRight className="h-6 w-6 text-primary" />
            </div>
          </motion.button>
        )}

        {/* User profile card */}
        {currentUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-senior mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Library className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-heading text-foreground">{currentUser.name}</h3>
                <p className="text-caption text-muted-foreground">{currentUser.cardNumber}</p>
                <Badge className="mt-1" variant="secondary">
                  {currentUser.cardType === 'mobile' ? '모바일' : '실물'} 도서증
                </Badge>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6 flex items-center gap-4"
        >
          <div className="card-senior flex flex-1 items-center gap-3">
            <Star className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-caption text-muted-foreground">획득한 별</p>
              <p className="text-heading text-foreground">{totalStars}</p>
            </div>
          </div>
          <div className="card-senior flex flex-1 items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-caption text-muted-foreground">완료 시나리오</p>
              <p className="text-heading text-foreground">{completedCount} / {SCENARIOS.length}</p>
            </div>
          </div>
        </motion.div>

        {/* Scenario cards */}
        <h3 className="text-heading text-foreground mb-4">학습 시나리오</h3>
        <div className="flex flex-col gap-4 pb-24">
          {SCENARIOS.map((scenario, index) => {
            const Icon = CATEGORY_ICONS[scenario.category] || BookOpen
            const progress = progressMap[scenario.id]
            const isCompleted = progress?.completed
            const stars = progress?.stars || 0

            return (
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const targetView = SCENARIO_VIEW_MAP[scenario.id]
                  if (targetView) setView(targetView as any)
                }}
                className="card-senior w-full text-left"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                      isCompleted ? 'bg-emerald-100' : 'bg-primary/10'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-7 w-7 text-emerald-600" />
                    ) : (
                      <Icon className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-heading text-foreground truncate">{scenario.title}</h4>
                      <Badge
                        className={cn('text-xs shrink-0', DIFFICULTY_COLORS[scenario.difficulty])}
                        variant="secondary"
                      >
                        {DIFFICULTY_LABELS[scenario.difficulty]}
                      </Badge>
                    </div>
                    <p className="text-caption text-muted-foreground line-clamp-2">
                      {scenario.description}
                    </p>
                    {/* Star rating */}
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'h-5 w-5',
                            s <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </motion.button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
