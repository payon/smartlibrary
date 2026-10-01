'use client'

import { motion } from 'framer-motion'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import { setTtsEnabled } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { FontSize } from '@/lib/constants'

const FONT_OPTIONS: { value: FontSize; label: string; preview: string; fontClass: string }[] = [
  { value: 'normal', label: '보통', preview: '이것은 보통 크기입니다', fontClass: '' },
  { value: 'large', label: '크게', preview: '이것은 큰 글자입니다', fontClass: 'font-large' },
  { value: 'xlarge', label: '아주 크게', preview: '이것은 아주 큰 글자입니다', fontClass: 'font-xlarge' },
]

const TIMEOUT_OPTIONS = [
  { value: 30, label: '30초' },
  { value: 60, label: '60초' },
  { value: 90, label: '90초' },
]

export default function SettingsView() {
  const {
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    ttsEnabled,
    setTtsEnabled: storeSetTtsEnabled,
    kioskTimeoutSeconds,
    setKioskTimeout,
    setView,
    setCurrentUser,
    setHasCompletedOnboarding,
  } = useAppStore()

  const handleTtsToggle = (enabled: boolean) => {
    storeSetTtsEnabled(enabled)
    setTtsEnabled(enabled)
    if (enabled) {
      speak('음성 안내가 켜졌습니다')
    }
  }

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size)
    const labels: Record<FontSize, string> = { normal: '보통', large: '크게', xlarge: '아주 크게' }
    speak(`글자 크기를 ${labels[size]}로 설정했습니다`)
  }

  const handleHighContrastToggle = (enabled: boolean) => {
    setHighContrast(enabled)
    speak(enabled ? '고대비 모드가 켜졌습니다' : '고대비 모드가 꺼졌습니다')
  }

  const handleResetProgress = async () => {
    try {
      await fetch('/api/seed', { method: 'POST' })
      speak('학습 진도가 초기화되었습니다')
      setView('home')
    } catch {
      speak('초화 중 오류가 발생했습니다')
    }
  }

  const handleResetAll = () => {
    setCurrentUser(null)
    setHasCompletedOnboarding(false)
    setView('onboarding')
    speak('모든 설정이 초기화되었습니다')
  }

  const handleTimeoutChange = (value: string) => {
    const seconds = parseInt(value)
    setKioskTimeout(seconds)
    speak(`키오스크 시간을 ${seconds}초로 설정했습니다`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="설정"
        showBack={true}
        showHome={true}
        showSettings={false}
        helpText="설정 화면입니다. 글자 크기, 고대비 모드, 음성 안내 등을 설정할 수 있습니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-24">
        <div className="flex flex-col gap-6">
          {/* Font Size */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-senior"
          >
            <h3 className="text-heading text-foreground mb-4">글자 크기</h3>
            <div className="flex flex-col gap-3">
              {FONT_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleFontSizeChange(opt.value)}
                  className={cn(
                    'flex items-center gap-4 rounded-xl p-4 border-2 transition-colors',
                    fontSize === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-secondary hover:bg-secondary/80'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                      fontSize === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    <span className="text-button font-bold">
                      {opt.value === 'normal' ? 'A' : opt.value === 'large' ? '가' : '나'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-body font-semibold">{opt.label}</p>
                    <p className={cn('text-caption text-muted-foreground', opt.fontClass)}>
                      {opt.preview}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* High Contrast */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card-senior"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-heading text-foreground">고대비 모드</h3>
                <p className="text-caption text-muted-foreground mt-1">
                  화면의 색상 대비를 높입니다
                </p>
              </div>
              <Switch
                checked={highContrast}
                onCheckedChange={handleHighContrastToggle}
                aria-label="고대비 모드"
                className="scale-125"
              />
            </div>
          </motion.section>

          {/* TTS */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-senior"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-heading text-foreground">음성 안내</h3>
                <p className="text-caption text-muted-foreground mt-1">
                  화면 내용을 음성으로 들려줍니다
                </p>
              </div>
              <Switch
                checked={ttsEnabled}
                onCheckedChange={handleTtsToggle}
                aria-label="음성 안내"
                className="scale-125"
              />
            </div>
          </motion.section>

          {/* Kiosk Timeout */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card-senior"
          >
            <h3 className="text-heading text-foreground mb-4">키오스크 대기 시간</h3>
            <RadioGroup
              value={String(kioskTimeoutSeconds)}
              onValueChange={handleTimeoutChange}
              className="flex flex-col gap-3"
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`timeout-${opt.value}`}
                  className={cn(
                    'flex items-center gap-4 rounded-xl p-4 border-2 cursor-pointer transition-colors',
                    kioskTimeoutSeconds === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-secondary hover:bg-secondary/80'
                  )}
                >
                  <RadioGroupItem
                    value={String(opt.value)}
                    id={`timeout-${opt.value}`}
                    className="scale-125"
                  />
                  <span className="text-body font-semibold">{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </motion.section>

          {/* Reset Progress */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-senior border-destructive/20"
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="btn-senior w-full bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors">
                  <RotateCcw className="h-6 w-6" />
                  학습 초기화
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-heading">학습 진도를 초기화하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription className="text-body">
                    모든 학습 진도와 획득한 별이 삭제됩니다. 사용자 정보는 유지됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="btn-senior bg-secondary text-foreground rounded-xl">
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetProgress}
                    className="btn-senior bg-destructive text-white rounded-xl"
                  >
                    초기화
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.section>

          {/* Reset Everything */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card-senior border-destructive/20"
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="btn-senior w-full bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors">
                  <Trash2 className="h-6 w-6" />
                  처음부터 다시
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-heading">모든 데이터를 초기화하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription className="text-body">
                    사용자 정보, 학습 진도, 모든 설정이 삭제되고 처음부터 다시 시작합니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="btn-senior bg-secondary text-foreground rounded-xl">
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetAll}
                    className="btn-senior bg-destructive text-white rounded-xl"
                  >
                    모두 초기화
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
