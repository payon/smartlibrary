/**
 * 키오스크 대기 화면
 *
 * [기능]
 * - SMART LIBRARY 브랜딩 표시
 * - 환영 메시지 및 이용 안내 자동 슬라이드
 * - 터치 감지 시 메인 메뉴로 이동
 * - 센서 접근 감지 시뮬레이션
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { BookOpen, ArrowRightCircle, Info, CreditCard, Library } from 'lucide-react';

/** 슬라이드 정보 타입 */
interface SlideInfo {
  icon: React.ReactNode;
  title: string;
  description: string;
}

/** 이용 안내 슬라이드 데이터 */
const INFO_SLIDES: SlideInfo[] = [
  {
    icon: <Info className="w-10 h-10" />,
    title: '이용 안내',
    description: '화면을 터치하고 원하는 서비스를 선택하세요.\n회원증을 스캔하고 비밀번호를 입력하면\n도서 대출과 반납을 할 수 있습니다.',
  },
  {
    icon: <BookOpen className="w-10 h-10" />,
    title: '도서 대출',
    description: '최대 10권까지 대출 가능합니다.\n대출 기간은 15일이며,\n연장은 불가합니다.',
  },
  {
    icon: <CreditCard className="w-10 h-10" />,
    title: '도서 반납',
    description: '반납할 도서를 투입구에 넣으면\n자동으로 RFID 태그를 인식하여\n반납 처리가 완료됩니다.',
  },
];

export default function KioskIdleScreen() {
  const { setScreen, sensorActive, setSensorActive } = useAppStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  /** 화면 터치 시 메인 메뉴로 이동 */
  const handleTouch = useCallback(() => {
    setScreen('main-menu');
  }, [setScreen]);

  /** 슬라이드 자동 전환 (5초 간격) */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % INFO_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /** 센서 시뮬레이션 (10초 후 접근 감지 메시지 표시) */
  useEffect(() => {
    const sensorTimer = setTimeout(() => {
      setSensorActive(true);
    }, 10000);
    return () => {
      clearTimeout(sensorTimer);
      setSensorActive(false);
    };
  }, [setSensorActive]);

  return (
    <div
      className="kiosk-screen kiosk-dark-bg relative flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleTouch}
      onTouchStart={handleTouch}
      role="button"
      tabIndex={0}
      aria-label="화면을 터치하여 시작하세요"
    >
      {/* 상단 브랜딩 영역 */}
      <div className="text-center pt-20 pb-8 px-6">
        {/* SMART LIBRARY 타이틀 */}
        <div className="mb-2">
          <Library className="w-12 h-12 mx-auto mb-4 text-sky-400" />
          <h1 className="text-3xl font-bold tracking-wider text-white"
              style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.3)' }}
          >
            SMART LIBRARY
          </h1>
        </div>

        {/* 환영 메시지 */}
        <p className="text-sky-200 text-sm mt-4 leading-relaxed">
          도서관을 방문하지 않아도
          <br />
          도서 대출과 반납을 한번에!!
        </p>
      </div>

      {/* 자동 슬라이드 영역 */}
      <div className="flex-1 flex items-center justify-center w-full px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 max-w-sm w-full border border-white/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-sky-400">
                {INFO_SLIDES[currentSlide].icon}
              </div>
              <h2 className="text-lg font-semibold text-white">
                {INFO_SLIDES[currentSlide].title}
              </h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {INFO_SLIDES[currentSlide].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 슬라이드 인디케이터 */}
      <div className="flex gap-2 mb-6">
        {INFO_SLIDES.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all duration-300 ${
              idx === currentSlide
                ? 'w-6 h-2 bg-sky-400'
                : 'w-2 h-2 bg-slate-500'
            }`}
          />
        ))}
      </div>

      {/* 하단 터치 안내 */}
      <div className="pb-16 text-center">
        <AnimatePresence>
          {!sensorActive ? (
            <motion.p
              className="text-sky-300 text-sm touch-pulse flex items-center justify-center gap-2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ArrowRightCircle className="w-5 h-5" />
              화면을 터치하여 시작하세요
            </motion.p>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-sky-500/20 border border-sky-400/30 rounded-xl px-6 py-3"
            >
              <p className="text-sky-300 text-sm sensor-pulse">
                접근이 감지되었습니다
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
