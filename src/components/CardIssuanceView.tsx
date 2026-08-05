'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Phone,
  CreditCard,
  Wallet,
  Star,
  CheckCircle,
  Library,
  Lock,
  ArrowLeft,
} from 'lucide-react'
import { useAppStore, type SimUser } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

type CardPhase = 'select' | 'set-pin' | 'issuing' | 'display'

type CardType = 'mobile' | 'physical'

// QR code grid pattern (7x7 simplified)
function QRCodePlaceholder() {
  const pattern = [
    [1,1,1,0,1,1,1],
    [1,0,1,1,1,0,1],
    [1,1,1,0,1,1,1],
    [0,0,0,1,0,0,0],
    [1,1,1,0,1,1,1],
    [1,0,1,1,1,0,1],
    [1,1,1,0,1,1,1],
  ]
  return (
    <div className="mx-auto grid w-28 grid-cols-7 gap-[2px] p-2 qr-glow">
      {pattern.flat().map((cell, i) => (
        <div
          key={i}
          className={cn(
            'aspect-square rounded-[1px]',
            cell ? 'bg-foreground' : 'bg-card',
          )}
        />
      ))}
    </div>
  )
}

// Larger QR for mobile card display
function QRCodeLarge() {
  const pattern = [
    [1,1,1,0,1,0,1,0,1,1,1],
    [1,0,1,0,0,1,0,1,1,0,1],
    [1,1,1,0,1,0,1,0,1,1,1],
    [0,0,0,1,1,1,0,0,0,0,0],
    [1,0,1,1,0,0,1,1,0,1,0],
    [0,1,0,0,1,1,0,0,1,0,1],
    [1,1,1,0,1,0,1,0,1,1,1],
    [0,1,0,1,0,1,0,1,0,1,0],
    [1,0,1,0,1,0,1,0,1,0,1],
    [0,1,0,1,0,1,0,1,0,1,0],
    [1,1,1,0,1,1,1,0,1,1,1],
  ]
  return (
    <div className="mx-auto grid w-36 grid-cols-11 gap-[2px] rounded-lg border-2 border-foreground/20 bg-card p-3">
      {pattern.flat().map((cell, i) => (
        <div
          key={i}
          className={cn(
            'aspect-square rounded-[1px]',
            cell ? 'bg-foreground' : 'bg-transparent',
          )}
        />
      ))}
    </div>
  )
}

function PinDigitBox({ value, active }: { value: string; active: boolean }) {
  return (
    <div
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-2xl border-3 text-heading font-bold transition-all duration-200 sm:h-16 sm:w-16',
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
}

export default function CardIssuanceView() {
  const { currentUser, setCurrentUser, setView, ttsEnabled, isMissionMode, completeMissionStep } = useAppStore()
  const needsPin = !currentUser?.pin
  const [phase, setPhase] = useState<CardPhase>(
    currentUser?.cardIssued ? 'display' : needsPin ? 'set-pin' : 'select'
  )
  const [selectedType, setSelectedType] = useState<CardType | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [showStarAnim, setShowStarAnim] = useState(false)
  const [reissueDialogOpen, setReissueDialogOpen] = useState(false)

  // PIN state
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinStep, setPinStep] = useState<'input' | 'confirm'>('input')

  const [displayUser, setDisplayUser] = useState<SimUser | null>(currentUser)

  // TTS on mount
  useEffect(() => {
    if (!ttsEnabled) return
    if (phase === 'set-pin') {
      speak('비밀번호 4자리를 설정해주세요. 이 비밀번호는 무인 키오스크에서 도서를 대여할 때 필요합니다.')
    } else if (phase === 'select' && !currentUser?.cardIssued) {
      speak('도서증 종류를 선택해주세요. 모바일 도서증 또는 실물 도서증 중 선택할 수 있습니다.')
    } else if (phase === 'display' && displayUser) {
      const type = displayUser.cardType === 'mobile' ? '모바일' : '실물'
      speak(`${type} 도서증이 발급되었습니다.`)
    }
  }, [phase, displayUser, ttsEnabled, currentUser])

  const validatePin = (value: string): string | null => {
    if (!/^\d{4}$/.test(value)) return '비밀번호 4자리를 모두 입력해주세요.'
    if (/^(\d)\1{3}$/.test(value)) return '같은 숫자 4자리는 사용할 수 없습니다.'
    if (value === '1234' || value === '4321' || value === '0123') return '너무 단순한 비밀번호입니다.'
    return null
  }

  const handlePinComplete = () => {
    const err = validatePin(pin)
    if (err) { setPinError(err); if (ttsEnabled) speak(err); return }
    if (pin !== pinConfirm) {
      setPinError('비밀번호가 일치하지 않습니다.')
      if (ttsEnabled) speak('비밀번호가 일치하지 않습니다')
      return
    }
    setPinError('')
    setPhase('select')
  }

  const handlePinInput = (digit: number | 'delete') => {
    if (pinStep === 'input') {
      if (digit === 'delete') {
        setPin(p => p.slice(0, -1))
        setPinError('')
      } else if (pin.length < 4) {
        const newPin = pin + String(digit)
        setPin(newPin)
        setPinError('')
        if (newPin.length === 4) {
          const err = validatePin(newPin)
          if (err) { setPinError(err) }
          else { setTimeout(() => setPinStep('confirm'), 300) }
        }
      }
    } else {
      if (digit === 'delete') {
        if (pinConfirm.length === 0) {
          setPinStep('input')
        } else {
          setPinConfirm(p => p.slice(0, -1))
        }
        setPinError('')
      } else if (pinConfirm.length < 4) {
        const newConfirm = pinConfirm + String(digit)
        setPinConfirm(newConfirm)
        setPinError('')
        if (newConfirm.length === 4) {
          // Auto check match
          if (newConfirm !== pin) {
            setPinError('비밀번호가 일치하지 않습니다.')
            if (ttsEnabled) speak('비밀번호가 일치하지 않습니다')
          } else {
            setPinError('')
          }
        }
      }
    }
  }

  const handleSelectType = async (type: CardType) => {
    setSelectedType(type)
    setIssuing(true)
    setPhase('issuing')

    try {
      if (!currentUser) {
        toast.error('사용자 정보가 없습니다.')
        setPhase('select')
        setIssuing(false)
        return
      }

      const res = await fetch(`/api/users/${currentUser.id}/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: type, pin: !currentUser.pin ? pin : undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '도서증 발급에 실패했습니다.')
        setPhase('select')
        setIssuing(false)
        return
      }

      const updatedUser = await res.json()
      setCurrentUser(updatedUser)
      setDisplayUser(updatedUser)

      setTimeout(() => {
        setPhase('display')
        setIssuing(false)
        setShowStarAnim(true)
        if (isMissionMode) completeMissionStep()
        const t = type === 'mobile' ? '모바일 도서증이 발급되었습니다' : '실물 도서증이 발급되었습니다'
        if (ttsEnabled) speak(t)
      }, 1500)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      setPhase('select')
      setIssuing(false)
    }
  }

  const handleReissue = async () => {
    setReissueDialogOpen(false)
    if (!currentUser) return

    const newType = currentUser.cardType === 'mobile' ? 'physical' : 'mobile'
    setIssuing(true)
    setPhase('issuing')

    try {
      const res = await fetch(`/api/users/${currentUser.id}/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: newType }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '재발급에 실패했습니다.')
        setPhase('display')
        setIssuing(false)
        return
      }

      const updatedUser = await res.json()
      setCurrentUser(updatedUser)
      setDisplayUser(updatedUser)

      setTimeout(() => {
        setPhase('display')
        setIssuing(false)
        setShowStarAnim(true)
        toast.success('새 도서증이 발급되었습니다!')
        if (ttsEnabled) speak('새 도서증이 재발급되었습니다.')
      }, 1500)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      setPhase('display')
      setIssuing(false)
    }
  }

  const handleSave = () => {
    toast.success('저장되었습니다!')
    if (ttsEnabled) speak('저장되었습니다')
  }

  const user = displayUser || currentUser
  const isMobile = user?.cardType === 'mobile'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar
        title="도서증 발급"
        helpText="도서증 발급 화면입니다. 모바일 도서증 또는 실물 도서증을 선택하여 발급받을 수 있습니다."
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {/* Phase: PIN Setup (required before card issuance if not set) */}
        {phase === 'set-pin' && !issuing && (
          <motion.div
            key="set-pin"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="text-center">
              <h2 className="text-title text-foreground mb-2">비밀번호를 설정해주세요</h2>
              <p className="text-body text-muted-foreground">무인 키오스크에서 도서 대여 시 필요합니다</p>
            </div>

            {/* PIN display */}
            <div className="flex flex-col items-center gap-6">
              <div>
                <p className="text-body text-muted-foreground text-center mb-3">
                  {pinStep === 'input' ? '비밀번호 입력' : '비밀번호 확인'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => {
                    const currentVal = pinStep === 'input' ? pin : pinConfirm
                    const isActive = currentVal.length === i
                    let borderColor = ''
                    if (pinStep === 'confirm' && pinConfirm[i] && pin[i]) {
                      borderColor = pinConfirm[i] === pin[i] ? 'border-emerald-500 bg-emerald-500/10' : 'border-destructive bg-destructive/10'
                    }
                    return (
                      <PinDigitBox
                        key={i}
                        value={currentVal[i] || ''}
                        active={isActive}
                      />
                    )
                  })}
                </div>
              </div>

              {pinError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-caption text-destructive text-center">
                  {pinError}
                </motion.p>
              )}
              {pinStep === 'confirm' && pinConfirm.length === 4 && pin === pinConfirm && !pinError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-body text-emerald-600 font-semibold text-center">
                  ✓ 비밀번호가 일치합니다
                </motion.p>
              )}
            </div>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'delete'].map((num) => {
                if (num === null) return <div key="empty" />
                const isDelete = num === 'delete'
                return (
                  <motion.button
                    key={num}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handlePinInput(isDelete ? 'delete' : num as number)}
                    className={cn(
                      'flex h-14 w-full items-center justify-center rounded-2xl text-heading font-bold transition-colors',
                      isDelete ? 'bg-destructive/10 text-destructive active:bg-destructive/20' : 'bg-secondary text-foreground active:bg-secondary/80'
                    )}
                  >
                    {isDelete ? <span className="text-body">삭제</span> : num}
                  </motion.button>
                )
              })}
            </div>

            {pinStep === 'confirm' && pinConfirm.length === 4 && pin === pinConfirm && (
              <button
                onClick={handlePinComplete}
                className="btn-senior bg-primary text-primary-foreground rounded-xl w-full max-w-xs"
              >
                <Lock className="h-5 w-5" />
                비밀번호 설정 완료
              </button>
            )}

            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              <p className="text-caption text-center">비밀번호는 타인에게 알려주지 마세요</p>
            </div>
          </motion.div>
        )}

        {/* Phase: Card Type Selection */}
        {phase === 'select' && !issuing && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <h2 className="text-title text-foreground text-center">도서증 종류를 선택해주세요</h2>

            {/* Mobile Card Option */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectType('mobile')}
              className="card-senior w-full text-left transition-all hover:border-primary"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-foreground/20 bg-slate-100">
                  <Phone className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-heading text-foreground mb-1">모바일 도서증</h3>
                  <p className="text-caption text-muted-foreground">휴대전화에서 바로 사용할 수 있습니다</p>
                </div>
                <QRCodePlaceholder />
              </div>
            </motion.button>

            {/* Physical Card Option */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectType('physical')}
              className="card-senior w-full text-left transition-all hover:border-primary"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/20 bg-gradient-to-br from-amber-100 to-amber-200">
                  <CreditCard className="h-10 w-10 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-heading text-foreground mb-1">실물 도서증</h3>
                  <p className="text-caption text-muted-foreground">도서관에서 직접 받을 수 있습니다</p>
                </div>
                <CreditCard className="h-14 w-20 text-amber-600" />
              </div>
            </motion.button>
          </motion.div>
        )}

        {/* Phase: Issuing */}
        {phase === 'issuing' && issuing && (
          <motion.div
            key="issuing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center gap-6 py-16"
          >
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {selectedType === 'mobile' ? <Phone className="h-10 w-10 text-primary" /> : <CreditCard className="h-10 w-10 text-primary" />}
              </div>
            </div>
            <p className="text-heading text-foreground">도서증을 발급하고 있습니다...</p>
            <p className="text-body text-muted-foreground">잠시만 기다려주세요</p>
          </motion.div>
        )}

        {/* Phase: Card Display */}
        {phase === 'display' && user && !issuing && (
          <motion.div
            key={isMobile ? 'mobile-display' : 'physical-display'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-6"
          >
            {showStarAnim && (
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="star-stamp"
              >
                <Star className="h-16 w-16 fill-amber-400 text-amber-400" />
              </motion.div>
            )}

            <h2 className="text-title text-foreground text-center">
              {isMobile ? '모바일 도서증' : '실물 도서증'}
            </h2>

            {isMobile ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                className="relative w-72 rounded-[2rem] border-4 border-foreground/80 bg-foreground p-2 shadow-2xl"
              >
                <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground" />
                <div className="mt-4 flex min-h-[400px] flex-col items-center rounded-2xl bg-white p-6">
                  <Library className="mb-2 h-8 w-8 text-primary" />
                  <p className="text-heading text-foreground font-bold">스마트 도서관</p>
                  <div className="my-3 h-px w-3/4 bg-border" />
                  <p className="text-caption text-muted-foreground">회원명</p>
                  <p className="text-heading text-foreground font-bold">{user.name}</p>
                  <p className="text-caption text-muted-foreground mt-2">도서증 번호</p>
                  <p className="text-body text-primary font-bold">{user.cardNumber}</p>
                  <div className="mt-4">
                    <QRCodeLarge />
                  </div>
                  <p className="mt-3 text-caption text-muted-foreground">발급일: {user.cardIssued}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 shadow-2xl"
                style={{ aspectRatio: '1.586 / 1' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-body text-white/80">스마트 도서관</p>
                    <p className="text-heading text-white font-bold">SMART LIBRARY</p>
                  </div>
                  <Library className="h-10 w-10 text-white/60" />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <span className="text-heading text-white font-bold">{user.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-heading text-white font-bold">{user.name}</p>
                    <p className="text-caption text-white/70">회원</p>
                  </div>
                </div>
                <div className="mt-auto">
                  <p className="text-caption text-white/60">도서증 번호</p>
                  <p className="text-body text-white font-bold tracking-wider">{user.cardNumber}</p>
                </div>
              </motion.div>
            )}

            <div className="flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="btn-senior bg-primary text-primary-foreground rounded-xl w-full"
              >
                {isMobile ? (<><Phone className="h-6 w-6" />저장하기</>) : (<><Wallet className="h-6 w-6" />지갑에 저장하기</>)}
              </button>
              <button
                type="button"
                onClick={() => setView('home')}
                className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
              >
                홈으로
              </button>
            </div>

            <div className="mt-4 w-full rounded-xl border-2 border-dashed border-border p-4 text-center">
              <p className="text-body text-muted-foreground mb-3">도서증을 분실했나요?</p>
              <AlertDialog open={reissueDialogOpen} onOpenChange={setReissueDialogOpen}>
                <AlertDialogTrigger asChild>
                  <button type="button" className="btn-senior bg-destructive text-white rounded-xl">
                    <CreditCard className="h-6 w-6" />
                    재발급받기
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-heading">도서증을 재발급하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription className="text-body">기존 도서증이 새로운 번호로 재발급됩니다. 기존 도서증은 사용할 수 없게 됩니다.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
                    <AlertDialogAction onClick={handleReissue} className="btn-senior bg-primary text-primary-foreground rounded-xl w-full">재발급하기</AlertDialogAction>
                    <AlertDialogCancel className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full">취소</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>
        )}
      </main>

      {/* Back button (only for set-pin and select phases) */}
      {(phase === 'set-pin' || phase === 'select') && !issuing && (
        <div className="mx-auto w-full max-w-lg flex items-center gap-3 px-4 py-4 pb-8">
          <button
            type="button"
            onClick={() => setView('home')}
            className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
          >
            <ArrowLeft className="h-6 w-6" />
            홈으로
          </button>
        </div>
      )}
    </div>
  )
}
