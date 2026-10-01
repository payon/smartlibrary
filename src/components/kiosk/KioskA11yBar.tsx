/**
 * 키오스크 배리어프리 툴바
 *
 * [기능]
 * - 음성 안내 ON/OFF (스피커 버튼)
 * - 글자 크기 3단계 순환 (보통 → 크게 → 아주 크게)
 * - 고대비 모드 ON/OFF
 * - 따라하기 도움말 (?) — 현재 화면 단계별 안내 + 음성
 * - 설정은 localStorage에 영속화 (스토어에서 처리)
 */

'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { speak } from '@/lib/tts';
import { Volume2, VolumeX, Type, Contrast, CircleHelp } from 'lucide-react';
import KioskGuide from '@/components/kiosk/KioskGuide';

const FONT_LABELS = { normal: '보통', large: '크게', xlarge: '아주 크게' } as const;
const FONT_ORDER = ['normal', 'large', 'xlarge'] as const;

export default function KioskA11yBar({ dark = true }: { dark?: boolean }) {
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const setTtsEnabled = useAppStore((s) => s.setTtsEnabled);
  const fontSize = useAppStore((s) => s.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);
  const highContrast = useAppStore((s) => s.highContrast);
  const setHighContrast = useAppStore((s) => s.setHighContrast);
  const [guideOpen, setGuideOpen] = useState(false);

  const btnBase = dark
    ? 'bg-white/10 hover:bg-white/20 text-white'
    : 'bg-slate-800/10 hover:bg-slate-800/20 text-slate-700';

  const handleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (next) speak('음성 안내가 켜졌습니다');
  };

  const handleFont = () => {
    const next = FONT_ORDER[(FONT_ORDER.indexOf(fontSize) + 1) % FONT_ORDER.length];
    setFontSize(next);
    speak(`글자 크기를 ${FONT_LABELS[next]}로 설정했습니다`);
  };

  const handleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    speak(next ? '고대비 모드가 켜졌습니다' : '고대비 모드가 꺼졌습니다');
  };

  return (
    <div
      className="flex items-center gap-2"
      role="toolbar"
      aria-label="접근성 설정"
    >
      <button
        onClick={handleTts}
        className={`min-w-11 min-h-11 h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 font-semibold ${btnBase}`}
        aria-label={ttsEnabled ? '음성 안내 끄기' : '음성 안내 켜기'}
        aria-pressed={ttsEnabled}
        title="음성 안내"
      >
        {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
      <button
        onClick={handleFont}
        className={`min-w-11 min-h-11 h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 font-semibold ${btnBase}`}
        aria-label={`글자 크기: ${FONT_LABELS[fontSize]}. 누르면 다음 크기로 변경됩니다.`}
        title="글자 크기"
      >
        <Type className="w-5 h-5" />
        <span className="text-sm">{FONT_LABELS[fontSize]}</span>
      </button>
      <button
        onClick={handleContrast}
        className={`min-w-11 min-h-11 h-11 px-3 rounded-xl flex items-center justify-center ${btnBase} ${highContrast ? 'ring-2 ring-yellow-400' : ''}`}
        aria-label={highContrast ? '고대비 모드 끄기' : '고대비 모드 켜기'}
        aria-pressed={highContrast}
        title="고대비"
      >
        <Contrast className="w-5 h-5" />
      </button>
      <button
        onClick={() => setGuideOpen(true)}
        className={`min-w-11 min-h-11 h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 font-semibold ${btnBase}`}
        aria-label="따라하기 도움말 열기"
        title="따라하기 도움말"
      >
        <CircleHelp className="w-5 h-5" />
        <span className="text-sm">도움말</span>
      </button>
      {guideOpen && <KioskGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
