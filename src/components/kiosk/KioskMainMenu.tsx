/**
 * 키오스크 메인 메뉴 화면
 *
 * [기능]
 * - 서비스 선택 (도서 대출 / 도서 반납)
 * - 현재 시간 표시
 * - 처음으로 돌아가기 버튼
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { BookOpen, BookDown, Home, Clock } from 'lucide-react';

export default function KioskMainMenu() {
  const { setScreen, setKioskMode } = useAppStore();
  const [currentTime, setCurrentTime] = useState('');

  /** 현재 시간 업데이트 (1초 간격) */
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
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
    <div className="kiosk-screen kiosk-dark-bg flex flex-col">
      {/* 상단 시간 */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <div className="text-slate-400 text-sm flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          {currentTime}
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white mb-12 text-center"
        >
          서비스를 선택해주세요
        </motion.h2>

        {/* 서비스 선택 버튼 */}
        <div className="flex flex-col gap-5 w-full max-w-xs">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLoan}
            className="kiosk-btn bg-sky-700 hover:bg-sky-600 text-white rounded-2xl shadow-lg shadow-sky-900/30"
            style={{ minHeight: '80px', fontSize: '1.25rem' }}
          >
            <BookOpen className="w-7 h-7" />
            도서 대출
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleReturn}
            className="kiosk-btn bg-teal-700 hover:bg-teal-600 text-white rounded-2xl shadow-lg shadow-teal-900/30"
            style={{ minHeight: '80px', fontSize: '1.25rem' }}
          >
            <BookDown className="w-7 h-7" />
            도서 반납
          </motion.button>
        </div>
      </main>

      {/* 하단 처음으로 버튼 */}
      <footer className="pb-10 flex justify-center">
        <button
          onClick={() => setScreen('idle')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm px-4 py-2"
        >
          <Home className="w-4 h-4" />
          처음으로
        </button>
      </footer>
    </div>
  );
}
