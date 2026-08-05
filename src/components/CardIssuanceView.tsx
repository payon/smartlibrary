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

type CardPhase = 'select' | 'issuing' | 'display'

type CardType = 'mobile' | 'physical'

// QR code grid pattern (7x7 simplified)
function QRCodePlaceholder() {
  // Pre-defined pattern to look like a QR code
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
    [1,1,1,0,1,1,1,0,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,0],
    [1,1,1,0,1,1,1,0,1,0,1],
    [0,0,0,1,0,0,0,1,1,1,0],
    [1,1,1,0,1,1,1,0,0,0,1],
    [1,0,1,1,1,0,1,1,0,1,1],
    [1,1,1,0,1,1,1,0,1,0,1],
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

export default function CardIssuanceView() {
  const { currentUser, setCurrentUser, setView, ttsEnabled, isMissionMode, completeMissionStep } = useAppStore()
  const [phase, setPhase] = useState<CardPhase>(currentUser?.cardIssued ? 'display' : 'select')
  const [selectedType, setSelectedType] = useState<CardType | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [showStarAnim, setShowStarAnim] = useState(false)
  const [reissueDialogOpen, setReissueDialogOpen] = useState(false)

  // Display card data (from store or after issuance)
  const [displayUser, setDisplayUser] = useState<SimUser | null>(currentUser)

  // TTS on mount
  useEffect(() => {
    if (!ttsEnabled) return
    if (phase === 'select' && !currentUser?.cardIssued) {
      speak('도서증 종류를 선택해주세요. 모바일 도서증 또는 실물 도서증 중 선택할 수 있습니다.')
    } else if (phase === 'display' && displayUser) {
      const type = displayUser.cardType === 'mobile' ? '모바일' : '실물'
      speak(`${type} 도서증이 발급되었습니다.`)
    }
  }, [phase, displayUser, ttsEnabled, currentUser])

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
        body: JSON.stringify({ cardType: type }),
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

      // Short delay for animation
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
        {/* Phase: Card Type Selection */}
          {phase === 'select' && !issuing && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <h2 className="text-title text-foreground text-center">
                도서증 종류를 선택해주세요
              </h2>

              {/* Mobile Card Option */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectType('mobile')}
                className="card-senior w-full text-left transition-all hover:border-primary"
              >
                <div className="flex items-start gap-4">
                  {/* Phone mockup preview */}
                  <div className="flex h-24 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-foreground/20 bg-slate-100">
                    <Phone className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading text-foreground mb-1">모바일 도서증</h3>
                    <p className="text-caption text-muted-foreground">
                      휴대전화에서 바로 사용할 수 있습니다
                    </p>
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
                  {/* Physical card preview */}
                  <div className="flex h-24 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/20 bg-gradient-to-br from-amber-100 to-amber-200">
                    <CreditCard className="h-10 w-10 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading text-foreground mb-1">실물 도서증</h3>
                    <p className="text-caption text-muted-foreground">
                      도서관에서 직접 받을 수 있습니다
                    </p>
                  </div>
                  <CreditCard className="h-14 w-20 text-amber-600" />
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* Phase: Issuing (loading) */}
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
                  {selectedType === 'mobile' ? (
                    <Phone className="h-10 w-10 text-primary" />
                  ) : (
                    <CreditCard className="h-10 w-10 text-primary" />
                  )}
                </div>
              </div>
              <p className="text-heading text-foreground">
                도서증을 발급하고 있습니다...
              </p>
              <p className="text-body text-muted-foreground">
                잠시만 기다려주세요
              </p>
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
              {/* Star stamp animation */}
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
                /* Mobile Card: Phone Frame */
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  className="relative w-72 rounded-[2rem] border-4 border-foreground/80 bg-foreground p-2 shadow-2xl"
                >
                  {/* Notch */}
                  <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground" />
                  {/* Screen */}
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
                    <p className="mt-3 text-caption text-muted-foreground">
                      발급일: {user.cardIssued}
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* Physical Card: Credit Card Proportions */
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 shadow-2xl"
                  style={{ aspectRatio: '1.586 / 1' }}
                >
                  {/* Library name */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-body text-white/80">스마트 도서관</p>
                      <p className="text-heading text-white font-bold">SMART LIBRARY</p>
                    </div>
                    <Library className="h-10 w-10 text-white/60" />
                  </div>

                  {/* Photo placeholder + name */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                      <span className="text-heading text-white font-bold">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-heading text-white font-bold">{user.name}</p>
                      <p className="text-caption text-white/70">회원</p>
                    </div>
                  </div>

                  {/* Card number */}
                  <div className="mt-auto">
                    <p className="text-caption text-white/60">도서증 번호</p>
                    <p className="text-body text-white font-bold tracking-wider">{user.cardNumber}</p>
                  </div>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex w-full flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-senior bg-primary text-primary-foreground rounded-xl w-full"
                >
                  {isMobile ? (
                    <>
                      <Phone className="h-6 w-6" />
                      저장하기
                    </>
                  ) : (
                    <>
                      <Wallet className="h-6 w-6" />
                      지갑에 저장하기
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setView('home')}
                  className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
                >
                  홈으로
                </button>
              </div>

              {/* Reissue section */}
              <div className="mt-4 w-full rounded-xl border-2 border-dashed border-border p-4 text-center">
                <p className="text-body text-muted-foreground mb-3">
                  도서증을 분실했나요?
                </p>
                <AlertDialog open={reissueDialogOpen} onOpenChange={setReissueDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="btn-senior bg-destructive text-white rounded-xl"
                    >
                      <CreditCard className="h-6 w-6" />
                      재발급받기
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-heading">도서증을 재발급하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription className="text-body">
                        기존 도서증이 새로운 번호로 재발급됩니다.
                        기존 도서증은 사용할 수 없게 됩니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
                      <AlertDialogAction
                        onClick={handleReissue}
                        className="btn-senior bg-primary text-primary-foreground rounded-xl w-full"
                      >
                        재발급하기
                      </AlertDialogAction>
                      <AlertDialogCancel
                        className="btn-senior bg-secondary text-secondary-foreground rounded-xl w-full"
                      >
                        취소
                      </AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          )}

      </main>
    </div>
  )
}
