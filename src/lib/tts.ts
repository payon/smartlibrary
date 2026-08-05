'use client'

let ttsEnabled = true

export function setTtsEnabled(enabled: boolean) {
  ttsEnabled = enabled
}

export function isTtsEnabled() {
  return ttsEnabled
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined') return
  if (!ttsEnabled) {
    onEnd?.()
    return
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  utterance.rate = 0.85
  utterance.pitch = 1.0
  utterance.volume = 1.0

  // Try to find Korean voice
  const voices = window.speechSynthesis.getVoices()
  const koreanVoice = voices.find(v => v.lang.startsWith('ko'))
  if (koreanVoice) {
    utterance.voice = koreanVoice
  }

  if (onEnd) {
    utterance.onend = onEnd
  }

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return
  window.speechSynthesis.cancel()
}

// Preload voices
if (typeof window !== 'undefined') {
  window.speechSynthesis?.getVoices()
  window.speechSynthesis?.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices()
  })
}
