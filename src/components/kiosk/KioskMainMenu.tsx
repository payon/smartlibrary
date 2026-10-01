/**
 * 키오스크 메인 메뉴 화면
 *
 * [기능]
 * - 서비스 선택 (도서 대출 / 도서 반납) (CMS 관리)
 * - 현재 시간 표시
 *
 * [디자인]
 * - ECO 키오스크 실제 제품 디자인 반영
 * - 다크 네이비 배경, 대형 수직 버튼
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { BookOpen, ArrowDownToLine, Clock, Library, CreditCard } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';
import KioskA11yBar from '@/components/kiosk/KioskA11yBar';

export default function KioskMainMenu() {
  const { setScreen, setKioskMode } = useAppStore();
  const mainMenuTitle = useCmsText('mainmenu.title', 'SMART LIBRARY');
  const theme = useScreenTheme('main-menu', '#0b1120');
  useKioskSpeak(`${mainMenuTitle}. 원하시는 서비스를 선택하세요. 도서카드 발급, 도서 대출, 도서 반납이 있습니다.`);
  const [currentTime, setCurrentTime] = useState('');

  /** 현재 시간 업데이트 (1초 간격) */
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  /** 도서카드 발급 선택 */
  const handleCardApply = () => {
    setKioskMode('card');
    setScreen('card-apply');
  };

  /** 도서 대출 선택 */
  const handleLoan = () => {
    setKioskMode('loan');
    setScreen('auth-scan');
  };

  /** 도서 반납 선택 */
  const handleReturn = () => {
    setKioskMode('return');
    setScreen('auth-scan');
  };

  /** 메인 버튼 정의 (표시 순서는 CMS mainmenu.button_order 따름) */
  const BUTTON_DEFS = [
    {
      id: 'card',
      label: '도서카드 발급',
      textKey: 'mainmenu.card_button_text',
      Icon: CreditCard,
      iconColor: 'text-amber-400',
      gradient: 'linear-gradient(135deg, #4a3620 0%, #3a2a15 100%)',
      border: '1px solid rgba(251, 191, 36, 0.15)',
      onClick: handleCardApply,
    },
    {
      id: 'loan',
      label: '도서 대출',
      textKey: 'mainmenu.loan_button_text',
      Icon: BookOpen,
      iconColor: 'text-sky-400',
      gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
      border: '1px solid rgba(56, 189, 248, 0.15)',
      onClick: handleLoan,
    },
    {
      id: 'return',
      label: '도서 반납',
      textKey: 'mainmenu.return_button_text',
      Icon: ArrowDownToLine,
      iconColor: 'text-teal-400',
      gradient: 'linear-gradient(135deg, #134e4a 0%, #0a3d3a 100%)',
      border: '1px solid rgba(45, 212, 191, 0.15)',
      onClick: handleReturn,
    },
  ] as const;

  const cmsOrderRaw = useAppStore((s) => s.cmsContent['mainmenu.button_order']);
  const orderedButtons = (() => {
    try {
      const parsed: unknown = JSON.parse(cmsOrderRaw || '["card","loan","return"]');
      if (!Array.isArray(parsed)) return [...BUTTON_DEFS];
      const ids = parsed.filter(
        (v): v is 'card' | 'loan' | 'return' =>
          v === 'card' || v === 'loan' || v === 'return'
      );
      const seen = new Set<string>();
      const ordered = ids
        .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
        .map((id) => BUTTON_DEFS.find((b) => b.id === id)!);
      // 누락된 버튼은 뒤에 추가 (삭제 방지)
      for (const def of BUTTON_DEFS) {
        if (!seen.has(def.id)) ordered.push({ ...def });
      }
      return ordered;
    } catch {
      return [...BUTTON_DEFS];
    }
  })();

  return (
    <div
      className="flex flex-col h-screen"
      style={theme.style}
    >
      {/* 상단 브랜딩 영역 */}
      <header className="flex flex-col items-center pt-10 pb-6 px-6">
        <div className="flex items-center gap-3 mb-1">
          <Library className="w-7 h-7 text-sky-400" strokeWidth={1.8} />
          <CmsText
            contentKey="mainmenu.title"
            fallback="SMART LIBRARY"
            as="h1"
            className="text-2xl font-bold tracking-[0.15em] text-white"
          />
        </div>
        <p className="text-slate-500 text-xs tracking-widest mt-1">
          무인 도서대출반납기
        </p>
      </header>

      {/* 메인 버튼 영역 (순서는 CMS mainmenu.button_order 따름) */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {orderedButtons.map((btn, idx) => (
          <motion.button
            key={btn.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 + idx * 0.1 }}
            whileTap={{ scale: 0.97 }}
            onClick={btn.onClick}
            className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
            style={{
              minHeight: '140px',
              background: btn.gradient,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
              border: btn.border,
            }}
            aria-label={btn.label}
          >
            <btn.Icon className={`w-12 h-12 ${btn.iconColor}`} strokeWidth={1.5} />
            <span className="text-2xl font-bold text-white tracking-wider">
              <CmsText contentKey={btn.textKey} fallback={btn.label} />
            </span>
          </motion.button>
        ))}
      </main>

      {/* 하단 시간 표시 + 접근성 툴바 */}
      <footer className="pb-8 px-6 flex flex-col items-center gap-3">
        <KioskA11yBar dark />
        <div className="flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-slate-600" />
          <span className="text-slate-600 text-sm tracking-wider font-mono">
            {currentTime}
          </span>
        </div>
      </footer>
    </div>
  );
}
