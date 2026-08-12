'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  CheckCircle,
  Clock,
  Trophy,
  RotateCcw,
  Play,
  Square,
  Award,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { SCENARIOS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface ProgressEntry {
  id: string
  userId: string
  scenarioId: string
  stepIndex: number
  completed: boolean
  attempts: number
  bestTimeSec: number | null
  stars: number
}

interface CertificateInfo {
  eligible: boolean
  completionDate: string | null
  completedCount: number
  totalScenarios: number
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  signup: Trophy,
  card: Award,
  loan: CheckCircle,
  return: RotateCcw,
  kiosk: Square,
  search: Star,
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

// Parse scenario steps from JSON
function parseSteps(stepsJson: string): { step: number; title: string; description: string }[] {
  try {
    return JSON.parse(stepsJson)
  } catch {
    return []
  }
}

export default function LearningProgressView() {
  const {
    currentUser,
    setView,
    ttsEnabled,
    isMissionMode,
    currentMissionScenarioId,
    currentMissionStep,
    setIsMissionMode,
    setMission,
  } = useAppStore()

  const [progressMap, setProgressMap] = useState<Record<string, ProgressEntry>>({})
  const [certificateInfo, setCertificateInfo] = useState<CertificateInfo | null>(null)
  const [resetTarget, setResetTarget] = useState<string | null>(null)

  // Fetch progress
  useEffect(() => {
    if (!currentUser) return
    fetch(`/api/progress?userId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data: ProgressEntry[]) => {
        const map: Record<string, ProgressEntry> = {}
        if (Array.isArray(data)) {
          for (const p of data) {
            if (!map[p.scenarioId] || p.stars > map[p.scenarioId].stars) {
              map[p.scenarioId] = p
            }
          }
        }
        setProgressMap(map)
      })
      .catch(() => {})
  }, [currentUser])

  // Fetch certificate info
  useEffect(() => {
    if (!currentUser) return
    fetch(`/api/progress/certificate?userId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data: CertificateInfo) => {
        setCertificateInfo(data)
      })
      .catch(() => {})
  }, [currentUser, progressMap])

  // TTS on mount
  useEffect(() => {
    if (ttsEnabled) {
      speak('학습 진행도 화면입니다. 완료한 시나리오와 획득한 별을 확인할 수 있습니다.')
    }
  }, [ttsEnabled])

  // Stats
  const totalStars = Object.values(progressMap).reduce((sum, p) => sum + p.stars, 0)
  const completedCount = Object.values(progressMap).filter((p) => p.completed).length
  const totalScenarios = SCENARIOS.length
  const avgStars = completedCount > 0 ? (totalStars / totalScenarios).toFixed(1) : '0'

  // Reset scenario progress
  const handleReset = async (scenarioId: string) => {
    if (!currentUser) return
    const progress = progressMap[scenarioId]
    if (!progress) return
    try {
      await fetch('/api/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          scenarioId,
          stepIndex: 0,
          completed: false,
          attempts: 0,
          bestTimeSec: null,
          stars: 0,
        }),
      })
      setProgressMap((prev) => {
        const next = { ...prev }
        delete next[scenarioId]
        return next
      })
      toast.success('시나리오 진행도가 초기화되었습니다')
    } catch {
      toast.error('초기화에 실패했습니다')
    }
    setResetTarget(null)
  }

  // Start mission mode
  const handleStartMission = () => {
    const firstIncomplete = SCENARIOS.find((s) => !progressMap[s.id]?.completed)
    if (!firstIncomplete) {
      toast.info('모든 시나리오를 완료했습니다!')
      return
    }
    const steps = parseSteps(firstIncomplete.stepsJson)
    setIsMissionMode(true)
    setMission(firstIncomplete.id, 0)
    const targetView = SCENARIO_VIEW_MAP[firstIncomplete.id]
    if (targetView) {
      setView(targetView as any)
    }
  }

  // Continue mission
  const handleContinueMission = () => {
    if (!currentMissionScenarioId) return
    const targetView = SCENARIO_VIEW_MAP[currentMissionScenarioId]
    if (targetView) {
      setView(targetView as any)
    }
  }

  // Stop mission
  const handleStopMission = () => {
    setIsMissionMode(false)
    setMission(null, 0)
    toast.info('미션이 종료되었습니다')
  }

  // Current mission info
  const currentScenario = SCENARIOS.find((s) => s.id === currentMissionScenarioId)
  const missionSteps = currentScenario ? parseSteps(currentScenario.stepsJson) : []

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="학습 진행도"
        showBack
        showHome
        showSettings
        helpText="학습 진행도 화면입니다. 완료한 시나리오, 획득한 별, 수료증 여부를 확인할 수 있습니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-24">
        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-title text-foreground mb-4">학습 현황</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="card-senior flex flex-col items-center text-center py-4">
              <Star className="h-8 w-8 text-amber-500 mb-1" />
              <p className="text-title text-foreground">{totalStars}</p>
              <p className="text-caption text-muted-foreground">획득 별</p>
            </div>
            <div className="card-senior flex flex-col items-center text-center py-4">
              <CheckCircle className="h-8 w-8 text-emerald-500 mb-1" />
              <p className="text-title text-foreground">{completedCount}/{totalScenarios}</p>
              <p className="text-caption text-muted-foreground">완료 시나리오</p>
            </div>
            <div className="card-senior flex flex-col items-center text-center py-4">
              <Trophy className="h-8 w-8 text-purple-500 mb-1" />
              <p className="text-title text-foreground">{avgStars}</p>
              <p className="text-caption text-muted-foreground">평균 별</p>
            </div>
          </div>
        </motion.div>

        <Separator className="mb-6" />

        {/* Star Stamp Collection */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="text-heading text-foreground mb-3">별 도장 컬렉션</h3>
          <div className="card-senior">
            <div className="grid grid-cols-7 gap-2 justify-items-center">
              {SCENARIOS.map((scenario, index) => {
                const progress = progressMap[scenario.id]
                const isCompleted = progress?.completed
                const Icon = CATEGORY_ICONS[scenario.category] || Star
                return (
                  <div key={scenario.id} className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                        isCompleted
                          ? 'bg-amber-100 border-2 border-amber-400 star-stamp'
                          : 'bg-muted border-2 border-muted-foreground/20'
                      )}
                    >
                      {isCompleted ? (
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      ) : (
                        <span className="text-muted-foreground/40 text-caption font-bold">{index + 1}</span>
                      )}
                    </div>
                    <p className={cn(
                      'text-[10px] leading-tight text-center',
                      isCompleted ? 'text-amber-600' : 'text-muted-foreground/50'
                    )}>
                      {scenario.title.replace(' 하기', '')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>

        <Separator className="mb-6" />

        {/* Mission Mode Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <h3 className="text-heading text-foreground mb-3">미션 모드</h3>
          {isMissionMode && currentScenario ? (
            <div className="card-senior border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 mb-3">
                <Play className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-body font-bold text-foreground">미션 진행 중</p>
                  <p className="text-caption text-muted-foreground">{currentScenario.title}</p>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-caption text-muted-foreground mb-1">
                  진행 단계: {currentMissionStep}/{missionSteps.length}
                </p>
                <Progress value={(currentMissionStep / missionSteps.length) * 100} className="h-3" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleContinueMission}
                  className="btn-senior flex-1 bg-primary text-primary-foreground rounded-xl"
                >
                  <Play className="h-5 w-5" />
                  이어하기
                </button>
                <button
                  onClick={handleStopMission}
                  className="btn-senior flex-1 bg-destructive/10 text-destructive rounded-xl border border-destructive/20"
                >
                  <Square className="h-5 w-5" />
                  그만두기
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartMission}
              disabled={completedCount >= totalScenarios}
              className={cn(
                'card-senior w-full text-left flex items-center gap-4 transition-colors',
                completedCount >= totalScenarios
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-md cursor-pointer'
              )}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Play className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-heading text-foreground">미션 시작하기</p>
                <p className="text-caption text-muted-foreground">
                  {completedCount >= totalScenarios
                    ? '모든 시나리오를 완료했습니다!'
                    : '완료되지 않은 첫 시나리오부터 도전합니다'
                  }
                </p>
              </div>
            </button>
          )}
        </motion.div>

        <Separator className="mb-6" />

        {/* Scenario Progress List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="text-heading text-foreground mb-3">시나리오별 진행도</h3>
          <div className="flex flex-col gap-3">
            {SCENARIOS.map((scenario, index) => {
              const Icon = CATEGORY_ICONS[scenario.category] || Star
              const progress = progressMap[scenario.id]
              const steps = parseSteps(scenario.stepsJson)
              const totalSteps = steps.length
              const completedSteps = progress ? Math.min(progress.stepIndex, totalSteps) : 0
              const isCompleted = progress?.completed
              const stars = progress?.stars || 0
              const attempts = progress?.attempts || 0
              const bestTime = progress?.bestTimeSec

              const statusLabel = isCompleted
                ? '완료'
                : completedSteps > 0
                  ? '진행중'
                  : '미시작'
              const statusColor = isCompleted
                ? 'text-emerald-600 bg-emerald-100'
                : completedSteps > 0
                  ? 'text-amber-600 bg-amber-100'
                  : 'text-gray-500 bg-gray-100'

              return (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                  className="card-senior"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                        isCompleted ? 'bg-emerald-100' : 'bg-primary/10'
                      )}
                    >
                      <Icon className={cn(
                        'h-6 w-6',
                        isCompleted ? 'text-emerald-600' : 'text-primary'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-body font-bold text-foreground truncate">{scenario.title}</h4>
                        <Badge
                          className={cn('text-xs shrink-0', DIFFICULTY_COLORS[scenario.difficulty])}
                          variant="secondary"
                        >
                          {DIFFICULTY_LABELS[scenario.difficulty]}
                        </Badge>
                        <Badge className={cn('text-xs shrink-0', statusColor)} variant="secondary">
                          {statusLabel}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-caption text-muted-foreground">
                            진행도: {completedSteps}/{totalSteps}단계
                          </span>
                          <span className="text-caption text-muted-foreground">
                            시도: {attempts}회
                          </span>
                        </div>
                        <Progress value={(completedSteps / totalSteps) * 100} className="h-2" />
                      </div>

                      {/* Stars and best time */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-5 w-5',
                                s <= stars
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground/30'
                              )}
                            />
                          ))}
                        </div>
                        {bestTime !== null && bestTime > 0 && (
                          <span className="text-caption text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {Math.floor(bestTime / 60)}분 {bestTime % 60}초
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Retry button */}
                  {(isCompleted || completedSteps > 0) && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => setResetTarget(scenario.id)}
                        className="text-caption text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        다시 하기
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        <Separator className="mb-6" />

        {/* Certificate Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <h3 className="text-heading text-foreground mb-3">수료증</h3>
          {certificateInfo?.eligible ? (
            <div className="card-senior border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50">
              <div className="text-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <Award className="h-16 w-16 text-amber-500 mx-auto" />
                </motion.div>
                <p className="text-heading text-amber-700 mt-2 font-bold">수료증 획득!</p>
                <p className="text-caption text-amber-600">
                  {certificateInfo.completionDate
                    ? formatDate(certificateInfo.completionDate)
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setView('completion')}
                className="btn-senior w-full bg-amber-500 text-white rounded-xl"
              >
                <Award className="h-6 w-6" />
                수료증 보기
              </button>
            </div>
          ) : (
            <div className="card-senior">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Lock className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-body font-bold text-foreground">수료증 미발급</p>
                  <p className="text-caption text-muted-foreground">
                    {completedCount}/{totalScenarios} 시나리오 완료
                  </p>
                  <Progress
                    value={(completedCount / totalScenarios) * 100}
                    className="h-2 mt-2"
                  />
                  <p className="text-caption text-muted-foreground mt-1">
                    모든 시나리오를 완료하면 수료증을 받을 수 있습니다
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Reset confirmation dialog */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">진행도 초기화</AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              이 시나리오의 학습 진행도를 초기화하시겠습니까?
              획득한 별과 기록이 모두 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
            <AlertDialogAction
              onClick={() => resetTarget && handleReset(resetTarget)}
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
