/**
 * 도서관 방문 회원가입 방법 (오프라인 절차 안내)
 *
 * [기능]
 * - 5단계 방문 절차 리스트 (전체 CMS 관리, 하드코딩 없음)
 * - card-apply 화면의 "오프라인 회원가입 방법 보기"에서 진입
 */

'use client';

import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';
import { EcoHeader, EcoTicker } from '@/components/kiosk/eco/EcoChrome';
import KioskA11yBar from '@/components/kiosk/KioskA11yBar';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export default function KioskSignupGuide() {
  const title = useCmsText('signup.title', '도서관 방문 회원가입 방법');
  const theme = useScreenTheme('signup-guide', '#0b1120');
  useKioskSpeak(`${title}. 방문 회원가입 순서를 확인하세요.`);
  const cmsContent = useAppStore((s) => s.cmsContent);
  const { prevScreen } = useAppStore();

  const t = (key: string, fallback: string) => cmsContent[key] || fallback;
  const steps = [1, 2, 3, 4, 5].map((n) => t(`signup.step_${n}`, '')).filter((s) => s);

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="회원가입 안내" />

      <header className="px-6 pt-6 pb-2">
        <h2 className="text-2xl font-bold text-center eco-title-text">{title}</h2>
        <p className="text-center text-sm text-slate-500 mt-1">
          도서관 방문 시 아래 순서대로 진행하세요
        </p>
      </header>

      <main className="flex-1 overflow-y-auto kiosk-scroll px-6 py-3">
        <div className="eco-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-sky-600" />
            <p className="text-sm font-bold text-slate-700">방문 절차 (총 {steps.length}단계)</p>
          </div>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className="shrink-0 w-7 h-7 rounded-full bg-sky-500 text-white text-sm font-bold flex items-center justify-center"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
          {steps.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">안내 내용을 불러오는 중입니다</p>
          )}
        </div>
      </main>

      <footer className="px-6 pb-4 shrink-0">
        <div className="flex justify-center py-2">
          <KioskA11yBar dark={false} />
        </div>
        <button onClick={prevScreen} className="eco-btn-secondary w-full">
          <ArrowLeft className="w-5 h-5" />
          이전으로
        </button>
      </footer>

      <EcoTicker />
    </div>
  );
}
