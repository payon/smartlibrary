/**
 * 키오스크 화면 음성 안내 훅
 *
 * [역할]
 * - 화면 진입 시 안내 멘트를 TTS로 1회 재생 (PRD F-012)
 * - 스토어 ttsEnabled OFF면 재생하지 않음
 * - 화면 이탈 시 재생 중단 (멘트 겹침 방지)
 */

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { speak, stopSpeaking } from '@/lib/tts';

/**
 * 화면 진입 시 안내 멘트를 음성으로 재생합니다.
 * @param text - 안내 멘트 (TTS OFF면 재생 생략)
 */
export function useKioskSpeak(text: string): void {
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);

  useEffect(() => {
    if (!ttsEnabled || !text) return;
    speak(text);
    return () => {
      stopSpeaking();
    };
  }, [ttsEnabled, text]);
}
