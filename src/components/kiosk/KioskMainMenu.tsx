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
import { BookOpen, ArrowDownToLine, Clock, Library } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskMainMenu() {
  const { setScreen, setKioskMode } = useAppStore();
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

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: '#0b1120' }}
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

      {/* 메인 버튼 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* 도서 대출 버튼 */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLoan}
          className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '140px',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
          }}
        >
          <BookOpen className="w-12 h-12 text-sky-400" strokeWidth={1.5} />
          <span className="text-2xl font-bold text-white tracking-wider">
            <CmsText contentKey="mainmenu.loan_button_text" fallback="도서 대출" />
          </span>
        </motion.button>

        {/* 도서 반납 버튼 */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleReturn}
          className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '140px',
            background: 'linear-gradient(135deg, #134e4a 0%, #0a3d3a 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(45, 212, 191, 0.15)',
          }}
        >
          <ArrowDownToLine className="w-12 h-12 text-teal-400" strokeWidth={1.5} />
          <span className="text-2xl font-bold text-white tracking-wider">
            <CmsText contentKey="mainmenu.return_button_text" fallback="도서 반납" />
          </span>
        </motion.button>
      </main>

      {/* 하단 시간 표시 */}
      <footer className="pb-8 flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-slate-600" />
        <span className="text-slate-600 text-sm tracking-wider font-mono">
          {currentTime}
        </span>
      </footer>
    </div>
  );
}
