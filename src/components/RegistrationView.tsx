'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  User,
  Lock,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import TopBar from '@/components/TopBar'
import { toast } from 'sonner'

const TERMS_TEXT = `제1조 (목적)
이 약관은 스마트 도서관(이하 "도서관")의 이용에 관한 사항을 규정함을 목적으로 합니다.

제2조 (이용자의 의무)
① 이용자는 도서관의 설비와 자료를 소중히 다루어야 합니다.
② 이용자는 다른 이용자의 도서 이용에 방해가 되는 행동을 해서는 안 됩니다.
③ 도서관 자료를 훼손하거나 분실한 경우에는 원상복구 또는 변상하여야 합니다.

제3조 (대출 규정)
① 거주 주소지를 기반으로 해당 지역의 모든 도서관에서 이용할 수 있습니다.
② 1인당 최대 10권까지 대출할 수 있습니다.
③ 대출 기간은 대출일로부터 15일입니다.
④ 연장은 불가합니다.
⑤ 연체 반납 시, 연체된 기간(일수)만큼 도서 대여가 제한됩니다.

제4조 (개인정보 보호)
① 도서관은 이용자의 개인정보를 법령에서 정한 경우를 제외하고는 타인에게 제공하지 않습니다.
② 이용자의 개인정보는 도서관 이용 목적 외에는 사용하지 않습니다.
③ 개인정보처리방침은 도서관 홈페이지에 공지되어 있습니다.

제5조 (도서관 이용 제한)
① 도서관 자료를 고의로 훼손한 경우 이용이 제한될 수 있습니다.
② 타인의 명의를 도용하여 도서를 대출한 경우 이용이 제한됩니다.
③ 소음 등으로 다른 이용자에게 피해를 주는 경우 퇴실 조치될 수 있습니다.

제6조 (멤버십)
① 회원은 도서증을 발급받아 관할 지역 내 모든 도서관의 서비스를 이용할 수 있습니다.
② 회원은 언제든 탈퇴할 수 있으며, 미반납 도서가 있는 경우 반납 후 탈퇴 처리됩니다.
③ 도서증은 타인에게 대여할 수 없습니다.

제7조 (기타 규정)
① 이 약관에 명시되지 않은 사항은 관련 법령 및 도서관의 내부 규정에 따릅니다.
② 이 약관은 시행일로부터 효력이 발생합니다.
③ 약관의 개정이 필요한 경우 7일 전에 공지합니다.

시행일: 2024년 1월 1일`

const CONFETTI_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#E11D48',
]

interface FormData {
  name: string
  birthDate: string
  phone: string
  address: string
  pin: string
  pinConfirm: string
}

const TOTAL_STEPS = 8

export default function RegistrationView() {
  const { setView, ttsEnabled, setCurrentUser, isMissionMode, completeMissionStep } = useAppStore()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    birthDate: '',
    phone: '',
    address: '',
    pin: '',
    pinConfirm: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [agreed, setAgreed] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [pinMode, setPinMode] = useState<'pin' | 'confirm'>('pin')
  const [creating, setCreating] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [createdUser, setCreatedUser] = useState<any>(null)
  const termsRef = useRef<HTMLDivElement>(null)

  // TTS on step change
  useEffect(() => {
    if (!ttsEnabled) return
    const texts: Record<number, string> = {
      1: '이름을 입력해주세요',
      2: '생년월일을 입력해주세요. 예를 들어 1952년 1월 15일이면 19520115라고 입력합니다.',
      3: '휴대전화 번호를 입력해주세요.',
      4: '주소를 입력해주세요. 시 군 구 까지만 입력하셔도 됩니다.',
      5: '비밀번호 4자리를 설정해주세요. 이 비밀번호는 무인 키오스크에서 도서를 대여할 때 필요합니다.',
      6: '약관을 끝까지 읽어보시고 동의해주세요.',
      7: '신분증을 촬영합니다.',
      8: '축하합니다! 가입이 완료되었습니다!',
    }
    const t = texts[step]
    if (t) speak(t)
  }, [step, ttsEnabled])

  // Mission mode: complete step after agreement
  useEffect(() => {
    if (isMissionMode && step === 7 && agreed) {
      completeMissionStep()
    }
  }, [step, agreed, isMissionMode, completeMissionStep])

  const goNext = useCallback(() => {
    if (step >= TOTAL_STEPS) return
    setStep((s) => s + 1)
  }, [step])

  const goBack = useCallback(() => {
    if (step <= 1) {
      setView('home')
      return
    }
    if (step === 6) setPinMode('pin')
    setStep((s) => s - 1)
  }, [step, setView])

  // Validation helpers
  const validateName = (value: string): string | null => {
    if (value.length < 2) return '이름은 2글자 이상이어야 합니다.'
    return null
  }

  const validateBirthDate = (value: string): string | null => {
    if (!/^\d{8}$/.test(value)) return '생년월일 8자리를 입력해주세요.'
    const year = parseInt(value.substring(0, 4))
    const month = parseInt(value.substring(4, 6))
    const day = parseInt(value.substring(6, 8))
    if (year < 1900 || year > 2020) return '올바른 연도를 입력해주세요. (1900~2020)'
    if (month < 1 || month > 12) return '올바른 월을 입력해주세요.'
    const maxDay = new Date(year, month, 0).getDate()
    if (day < 1 || day > maxDay) return '올바른 일을 입력해주세요.'
    return null
  }

  const validatePhone = (value: string): string | null => {
    const digits = value.replace(/[^0-9]/g, '')
    if (!digits.startsWith('010')) return '010으로 시작하는 번호를 입력해주세요.'
    if (digits.length !== 11) return '11자리 번호를 입력해주세요.'
    return null
  }

  const validatePin = (value: string): string | null => {
    if (!/^\d{4}$/.test(value)) return '비밀번호 4자리를 모두 입력해주세요.'
    // Avoid repetitive or sequential pins
    if (/^(\d)\1{3}$/.test(value)) return '같은 숫자 4자리는 사용할 수 없습니다.'
    if (value === '1234' || value === '4321' || value === '0123') return '너무 단순한 비밀번호입니다.'
    return null
  }

  const formatPhone = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return formData.name.length >= 2
      case 2: return !validateBirthDate(formData.birthDate)
      case 3: return !validatePhone(formData.phone)
      case 4: return formData.address.trim().length > 0
      case 5: return !validatePin(formData.pin) && formData.pin === formData.pinConfirm && formData.pinConfirm.length === 4
      case 6: return agreed
      case 7: return scanComplete
      default: return true
    }
  }, [step, formData, agreed, scanComplete])

  const handleNext = () => {
    if (!canProceed()) return

    if (step === 1) {
      const err = validateName(formData.name)
      if (err) { setErrors({ name: err }); if (ttsEnabled) speak(err); return }
    }
    if (step === 2) {
      const err = validateBirthDate(formData.birthDate)
      if (err) { setErrors({ birthDate: err }); if (ttsEnabled) speak(err); return }
    }
    if (step === 3) {
      const err = validatePhone(formData.phone)
      if (err) { setErrors({ phone: err }); if (ttsEnabled) speak(err); return }
    }
    if (step === 5) {
      const err = validatePin(formData.pin)
      if (err) { setErrors({ pin: err }); if (ttsEnabled) speak(err); return }
      if (formData.pin !== formData.pinConfirm) {
        setErrors({ pinConfirm: '비밀번호가 일치하지 않습니다.' })
        if (ttsEnabled) speak('비밀번호가 일치하지 않습니다')
        return
      }
    }

    if (step === TOTAL_STEPS) return
    goNext()
  }

  const handleCapture = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setScanComplete(true)
    }, 2000)
  }

  const handleCompleteRegistration = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          birthDate: formData.birthDate,
          phone: formData.phone,
          address: formData.address,
          pin: formData.pin,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '가입에 실패했습니다.')
        setCreating(false)
        return
      }
      const user = await res.json()
      setCreatedUser(user)
      setCurrentUser(user)
      setShowConfetti(true)
      if (ttsEnabled) {
        speak(`축하합니다! ${user.name}님, 가입이 완료되었습니다! 도서증 번호는 ${user.cardNumber}입니다.`)
      }
      setTimeout(() => setShowConfetti(false), 4000)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight)
    setScrollProgress(Math.min(progress * 100, 100))
  }

  const fadeVariant = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  }

  const confettiPieces = CONFETTI_COLORS.map((color, i) => ({
    id: i, color,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${8 + Math.random() * 12}px`,
  }))

  const formatBirthDate = (bd: string) => {
    if (bd.length !== 8) return bd
    return `${bd.slice(0, 4)}.${bd.slice(4, 6)}.${bd.slice(6, 8)}`
  }

  // PIN digit box component
  const PinDigitBox = ({ value, active, index }: { value: string; active: boolean; index: number }) => (
    <div
      className={cn(
        'flex h-16 w-16 items-center justify-center rounded-2xl border-3 text-heading font-bold transition-all duration-200 sm:h-20 sm:w-20',
        active
          ? 'border-primary bg-primary/10 text-primary scale-105'
          : value
            ? 'border-primary/50 bg-primary/5 text-foreground'
            : 'border-border bg-card text-muted-foreground'
      )}
    >
      {value || <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
    </div>
  )

  // Number pad for PIN
  const NumberPad = ({ onInput, onDeleteBack, maxLength, value }: { onInput: (val: string) => void; onDeleteBack?: () => void; maxLength: number; value: string }) => (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'delete'].map((num) => {
        if (num === null) return <div key="empty" />
        const isDelete = num === 'delete'
        return (
          <motion.button
            key={num}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              if (isDelete) {
                if (value.length === 0 && onDeleteBack) {
                  onDeleteBack()
                } else {
                  onInput(value.slice(0, -1))
                }
              } else if (value.length < maxLength) {
                onInput(value + String(num))
              }
            }}
            className={cn(
              'flex h-14 w-full items-center justify-center rounded-2xl text-heading font-bold transition-colors',
              isDelete
                ? 'bg-destructive/10 text-destructive active:bg-destructive/20'
                : 'bg-secondary text-foreground active:bg-secondary/80'
            )}
          >
            {isDelete ? <span className="text-body">삭제</span> : num}
          </motion.button>
        )
      })}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="회원가입"
        showBack={false}
        showSettings={false}
        helpText="도서관 회원가입 화면입니다. 안내에 따라 순서대로 정보를 입력해주세요."
      />

      {/* Step Progress Indicator */}
      <div className="mx-auto w-full max-w-lg px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const stepNum = i + 1
            const isActive = step === stepNum
            const isDone = step > stepNum
            return (
              <div key={stepNum} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-3 w-full rounded-full transition-all duration-300',
                    isActive ? 'bg-primary' : isDone ? 'bg-emerald-500' : 'bg-muted',
                  )}
                />
              </div>
            )
          })}
        </div>
        <p className="text-caption text-muted-foreground mt-2 text-center">
          {step} / {TOTAL_STEPS}
        </p>
      </div>

      {/* Step Content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <motion.div
          key={step}
          initial="initial"
          animate="animate"
          variants={fadeVariant}
          transition={{ duration: 0.25 }}
        >
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-title text-foreground block mb-4">이름을 입력해주세요</label>
                <input
                  type="text"
                  className="input-senior"
                  placeholder="홍길동"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: undefined })
                  }}
                  autoFocus
                />
                {errors.name && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-destructive mt-2">{errors.name}</motion.p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Birth Date */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-title text-foreground block mb-4">생년월일을 입력해주세요</label>
                <p className="text-body text-muted-foreground mb-4">(예: 19520115)</p>
                <input
                  type="text"
                  className="input-senior"
                  placeholder="19520115"
                  maxLength={8}
                  value={formData.birthDate}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
                    setFormData({ ...formData, birthDate: val })
                    if (errors.birthDate) setErrors({ ...errors, birthDate: undefined })
                  }}
                  autoFocus
                />
                {errors.birthDate && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-destructive mt-2">{errors.birthDate}</motion.p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Phone */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-title text-foreground block mb-4">휴대전화 번호를 입력해주세요</label>
                <input
                  type="tel"
                  className="input-senior"
                  placeholder="010-1234-5678"
                  value={formData.phone}
                  onChange={(e) => {
                    const val = formatPhone(e.target.value)
                    setFormData({ ...formData, phone: val })
                    if (errors.phone) setErrors({ ...errors, phone: undefined })
                  }}
                  autoFocus
                />
                {errors.phone && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-destructive mt-2">{errors.phone}</motion.p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Address */}
          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-title text-foreground block mb-4">주소를 입력해주세요</label>
                <textarea
                  className="input-senior min-h-[120px] resize-none"
                  placeholder="서울시 강남구 테헤란로 123"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  autoFocus
                />
                <p className="text-caption text-muted-foreground mt-2">💡 시/군/구 까지만 입력하셔도 됩니다</p>
              </div>
            </div>
          )}

          {/* Step 5: PIN Setup */}
          {step === 5 && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <label className="text-title text-foreground block mb-2">비밀번호를 설정해주세요</label>
                <p className="text-body text-muted-foreground">무인 키오스크에서 도서 대여 시 필요합니다</p>
              </div>

              {/* PIN input display */}
              <div className="flex flex-col items-center gap-8">
                <div>
                  <p className="text-body text-muted-foreground text-center mb-3">비밀번호 입력</p>
                  <div className="flex items-center justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <PinDigitBox
                        key={i}
                        value={formData.pin[i] || ''}
                        active={pinMode === 'pin' && formData.pin.length === i}
                        index={i}
                      />
                    ))}
                  </div>
                </div>

                {pinMode === 'confirm' && (
                  <div>
                    <p className="text-body text-muted-foreground text-center mb-3">비밀번호 확인</p>
                    <div className="flex items-center justify-center gap-3">
                      {[0, 1, 2, 3].map((i) => {
                        const isMatch = formData.pinConfirm.length > i
                          && formData.pin[i] === formData.pinConfirm[i]
                        const isMismatch = formData.pinConfirm.length > i
                          && formData.pin[i] !== formData.pinConfirm[i]
                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex h-16 w-16 items-center justify-center rounded-2xl border-3 text-heading font-bold transition-all duration-200 sm:h-20 sm:w-20',
                              formData.pinConfirm.length === i && 'border-primary bg-primary/10 scale-105',
                              isMatch && formData.pinConfirm.length > i && 'border-emerald-500 bg-emerald-500/10 text-emerald-600',
                              isMismatch && 'border-destructive bg-destructive/10 text-destructive',
                              !isMatch && !isMismatch && formData.pinConfirm.length !== i && 'border-border bg-card'
                            )}
                          >
                            {formData.pinConfirm[i] || <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {errors.pin && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-destructive text-center">{errors.pin}</motion.p>
              )}
              {errors.pinConfirm && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-destructive text-center">{errors.pinConfirm}</motion.p>
              )}
              {pinMode === 'confirm' && formData.pinConfirm.length === 4 && formData.pin === formData.pinConfirm && !errors.pin && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-body text-emerald-600 font-semibold text-center">
                  ✓ 비밀번호가 일치합니다
                </motion.p>
              )}

              {/* Number pad */}
              <NumberPad
                onInput={(val) => {
                  if (pinMode === 'pin') {
                    setFormData({ ...formData, pin: val, pinConfirm: '' })
                    if (errors.pin) setErrors({ ...errors, pin: undefined })
                    if (val.length === 4) {
                      const err = validatePin(val)
                      if (err) {
                        setErrors({ ...errors, pin: err })
                        if (ttsEnabled) speak(err)
                      } else {
                        setPinMode('confirm')
                      }
                    }
                  } else {
                    setFormData({ ...formData, pinConfirm: val })
                    if (errors.pinConfirm) setErrors({ ...errors, pinConfirm: undefined })
                  }
                }}
                onDeleteBack={pinMode === 'confirm' ? () => {
                  setPinMode('pin')
                } : undefined}
                maxLength={4}
                value={pinMode === 'pin' ? formData.pin : formData.pinConfirm}
              />

              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-5 w-5" />
                <p className="text-caption text-center">비밀번호는 타인에게 알려주지 마세요</p>
              </div>
            </div>
          )}

          {/* Step 6: Terms Agreement */}
          {step === 6 && (
            <div className="flex flex-col gap-4">
              <label className="text-title text-foreground block">도서관 이용 약관</label>
              <div
                ref={termsRef}
                onScroll={handleTermsScroll}
                className="custom-scrollbar max-h-64 overflow-y-auto rounded-xl border-2 border-border bg-card p-4"
              >
                <p className="text-body text-foreground whitespace-pre-line leading-relaxed">{TERMS_TEXT}</p>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.max(scrollProgress, 2)}%` }}
                />
              </div>
              <p className="text-caption text-muted-foreground text-center">약관을 끝까지 스크롤해주세요 ({Math.round(scrollProgress)}%)</p>

              <button
                type="button"
                onClick={() => setAgreed(!agreed)}
                disabled={scrollProgress < 90}
                className={cn(
                  'card-senior flex w-full items-center gap-4 text-left transition-all',
                  agreed ? 'border-primary bg-primary/5' : 'opacity-50',
                  scrollProgress >= 90 && !agreed && 'hover:border-primary/50',
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                  agreed ? 'border-primary bg-primary' : 'border-muted-foreground',
                )}>
                  {agreed && <CheckCircle className="h-6 w-6 text-primary-foreground" />}
                </div>
                <span className="text-body text-foreground">위 약관에 동의합니다</span>
              </button>
            </div>
          )}

          {/* Step 7: ID Verification Simulation */}
          {step === 7 && (
            <div className="flex flex-col items-center gap-6">
              <label className="text-title text-foreground text-center block">본인확인 시뮬레이션</label>

              <div className="relative w-full max-w-xs overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-slate-100 to-slate-200 shadow-lg">
                <div className="bg-slate-700 px-4 py-2">
                  <p className="text-caption text-white font-bold">주민등록증</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-lg bg-slate-300 flex items-center justify-center">
                      <User className="h-10 w-10 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-heading text-foreground font-bold">{formData.name}</p>
                      <p className="text-caption text-muted-foreground">{formatBirthDate(formData.birthDate)}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-300" />
                  <div className="space-y-1">
                    <p className="text-caption text-muted-foreground">주소</p>
                    <p className="text-body text-foreground">{formData.address || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-caption text-muted-foreground">전화번호</p>
                    <p className="text-body text-foreground">{formData.phone}</p>
                  </div>
                </div>
                {scanning && (
                  <div className="absolute inset-0 bg-white/20">
                    <div className="absolute left-0 right-0 h-1 bg-emerald-500 scan-line" />
                  </div>
                )}
                {scanComplete && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 p-6 shadow-xl">
                      <CheckCircle className="h-16 w-16 text-emerald-600" />
                      <p className="text-heading text-emerald-700 font-bold">본인확인 완료</p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Camera className="h-6 w-6" />
                <p className="text-body">신분증을 촬영합니다</p>
              </div>

              {!scanComplete && (
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={scanning}
                  className="btn-senior bg-primary text-primary-foreground rounded-xl"
                >
                  <Camera className="h-6 w-6" />
                  {scanning ? '촬영 중...' : '촬영하기'}
                </button>
              )}
            </div>
          )}

          {/* Step 8: Completion */}
          {step === 8 && (
            <div className="flex flex-col items-center gap-6 py-4">
              {showConfetti && (
                <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
                  {confettiPieces.map((p) => (
                    <div
                      key={p.id}
                      className="absolute top-0 rounded-sm"
                      style={{
                        left: p.left, width: p.size, height: p.size,
                        backgroundColor: p.color,
                        animation: `confettiFall ${p.duration} ease-in ${p.delay} forwards`,
                      }}
                    />
                  ))}
                </div>
              )}

              {!createdUser ? (
                <button
                  type="button"
                  onClick={handleCompleteRegistration}
                  disabled={creating}
                  className="btn-senior bg-primary text-primary-foreground rounded-xl"
                >
                  {creating ? '가입 처리 중...' : '가입 완료하기'}
                </button>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-lg"
                  >
                    <CheckCircle className="h-14 w-14 text-white" />
                  </motion.div>

                  <h2 className="text-title text-foreground text-center">축하합니다!<br />가입이 완료되었습니다!</h2>

                  <div className="card-senior w-full text-center">
                    <p className="text-body text-muted-foreground mb-1">이름</p>
                    <p className="text-heading text-foreground">{createdUser.name}</p>
                    <div className="my-3 h-px bg-border" />
                    <p className="text-body text-muted-foreground mb-1">도서증 번호</p>
                    <p className="text-heading text-primary font-bold">{createdUser.cardNumber}</p>
                    <div className="my-3 h-px bg-border" />
                    <div className="flex items-center justify-center gap-2">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <p className="text-body text-muted-foreground">비밀번호가 설정되었습니다</p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setView('card-issuance')}
                      className="btn-senior bg-primary text-primary-foreground rounded-xl w-full"
                    >
                      도서증 발급받기
                      <ArrowRight className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('home')}
                      className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
                    >
                      홈으로
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Navigation Buttons */}
      {!(step === TOTAL_STEPS && createdUser) && (
        <div className="mx-auto w-full max-w-lg flex items-center gap-3 px-4 py-4 pb-8">
          <button
            type="button"
            onClick={goBack}
            className="btn-senior bg-secondary text-secondary-foreground rounded-xl flex-1"
          >
            <ArrowLeft className="h-6 w-6" />
            {step === 1 ? '홈으로' : '이전'}
          </button>
          {step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-senior bg-primary text-primary-foreground rounded-xl flex-1"
            >
              다음
              <ArrowRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
