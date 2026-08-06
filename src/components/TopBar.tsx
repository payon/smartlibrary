'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Home, Settings, Volume2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { speak } from '@/lib/tts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TopBarProps {
  title: string
  showBack?: boolean
  showHome?: boolean
  showSettings?: boolean
  helpText?: string
}

export default function TopBar({
  title,
  showBack = false,
  showHome = true,
  showSettings = true,
  helpText,
}: TopBarProps) {
  const { goBack, setView, ttsEnabled } = useAppStore()
  const prevTitle = useRef(title)
  const [helpOpen, setHelpOpen] = useState(false)

  // TTS on title change
  useEffect(() => {
    if (ttsEnabled && title !== prevTitle.current) {
      speak(title)
    }
    prevTitle.current = title
  }, [title, ttsEnabled])

  const helpContent = helpText || `${title} 화면입니다. 이 화면에서는 ${title}과 관련된 작업을 할 수 있습니다.`

  return (
    <>
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          {/* Left side */}
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={goBack}
                className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95"
                aria-label="뒤로가기"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Center title */}
          <h1 className="text-heading flex-1 text-center truncate px-2">{title}</h1>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {showHome && (
              <button
                onClick={() => setView('home')}
                className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95"
                aria-label="홈으로"
              >
                <Home className="h-6 w-6" />
              </button>
            )}
            {showSettings && (
              <button
                onClick={() => setView('settings')}
                className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-white/20 active:scale-95"
                aria-label="설정"
              >
                <Settings className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Help Button */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild>
          <button
            className={cn(
              'fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 help-pulse'
            )}
            aria-label="도움말"
          >
            <Volume2 className="h-8 w-8" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading">도움말</DialogTitle>
            <DialogDescription className="text-body">
              현재 화면에 대한 설명을 듣습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-body text-foreground">{helpContent}</p>
          </div>
          <button
            onClick={() => speak(helpContent, () => {})}
            className="btn-senior w-full bg-primary text-primary-foreground rounded-xl"
          >
            <Volume2 className="h-6 w-6" />
            다시 듣기
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}
