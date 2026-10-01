/**
 * 키오스크 따라하기 도움말 패널
 *
 * [기능]
 * - 현재 화면의 단계별 안내 (박스 오버레이)
 * - 이전/다음 단계 이동 + 현재 단계 음성 안내
 * - 안내 문구는 관리자 `guide.{screen}` JSON으로 변경 가능
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { speak, stopSpeaking } from '@/lib/tts';
import { resolveGuide } from '@/lib/kiosk-guide';

export default function KioskGuide({ onClose }: { onClose: () => void }) {
  const screen = useAppStore((s) => s.screen);
  const cmsContent = useAppStore((s) => s.cmsContent);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);

  const guide = useMemo(
    () => resolveGuide(screen, cmsContent),
    [screen, cmsContent]
  );
  const [step, setStep] = useState(0);
  const total = guide.steps.length;
  const currentStepText = guide.steps[step] || '';

  /** beneath 화면이 바뀌면 1단계로 복귀 */
  useEffect(() => {
    setStep(0);
  }, [screen]);

  /** 패널이 열리거나 단계가 바뀌면 해당 단계 음성 안내 */
  useEffect(() => {
    if (!ttsEnabled || total === 0) return;
    const text = `${guide.title}. ${step + 1}단계. ${currentStepText}`;
    speak(text);
    return () => {
      stopSpeaking();
    };
  }, [ttsEnabled, step, total, guide.title, currentStepText]);

  /** 닫힐 때 음성 중단 */
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const goStep = (next: number) => {
    if (total === 0) return;
    setStep(Math.min(total - 1, Math.max(0, next)));
  };

  const replay = () => {
    if (!total) return;
    speak(`${guide.title}. ${step + 1}단계. ${currentStepText}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${guide.title} 도움말`}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-bold text-white">
              💡 {guide.title} 따라하기
            </p>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center"
              aria-label="도움말 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 단계 표시 */}
          {total > 0 ? (
            <>
              <div
                className="rounded-xl bg-slate-800 p-4 mb-3 min-h-24"
                role="status"
                aria-live="polite"
                aria-label={`${step + 1}단계 / 총 ${total}단계`}
              >
                <p className="text-sky-400 text-sm font-semibold mb-1">
                  {step + 1} / {total} 단계
                </p>
                <p className="text-white text-base leading-relaxed">{guide.steps[step]}</p>
              </div>

              {/* 진행 점 */}
              <div className="flex items-center justify-center gap-1.5 mb-4" aria-hidden="true">
                {guide.steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-sky-400' : 'w-2 bg-slate-600'}`}
                  />
                ))}
              </div>

              {/* 컨트롤 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goStep(step - 1)}
                  disabled={step === 0}
                  className="h-12 px-4 rounded-xl bg-slate-700 text-white flex items-center gap-1 disabled:opacity-40"
                  aria-label="이전 단계"
                >
                  <ChevronLeft className="w-5 h-5" />
                  이전
                </button>
                <button
                  onClick={replay}
                  className="h-12 px-4 rounded-xl bg-slate-700 text-white flex items-center gap-1.5"
                  aria-label="현재 단계 다시 듣기"
                >
                  <Volume2 className="w-5 h-5" />
                  다시 듣기
                </button>
                <button
                  onClick={() => (step === total - 1 ? onClose() : goStep(step + 1))}
                  className="h-12 flex-1 rounded-xl bg-sky-600 text-white font-semibold flex items-center justify-center gap-1"
                >
                  {step === total - 1 ? '따라하기 시작' : (
                    <>
                      다음
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">이 화면의 안내가 준비되지 않았습니다.</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
