/**
 * 도서증 발급 종류 선택 화면
 *
 * [기능]
 * - 모바일 도서증 / 실물 도서증 / 자동 발급 신청 선택 (CMS 관리)
 * - 선택 시 카드 모드 설정 후 입력 폼으로 이동
 *
 * [디자인]
 * - 다크 네이비 배경 (#0b1120)
 * - 대형 수직 버튼 카드
 * - Framer Motion 진입 애니메이션
 */

'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { Smartphone, CreditCard, Zap, ArrowLeft } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

/** 버튼 진입 애니메이션 variants */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.1 + i * 0.12 },
  }),
};

export default function KioskCardApply() {
  const { setScreen, setKioskMode, setCardApplication } = useAppStore();

  /** 뒤로가기 */
  const handleBack = () => {
    setScreen('main-menu');
  };

  /** 모바일 도서증 발급 선택 */
  const handleMobile = () => {
    setKioskMode('card');
    setCardApplication({
      applicantName: '',
      birthDate: '',
      phone: '',
      address: '',
      cardType: 'mobile',
    });
    setScreen('card-form');
  };

  /** 실물 도서증 발급 선택 */
  const handlePhysical = () => {
    setKioskMode('card');
    setCardApplication({
      applicantName: '',
      birthDate: '',
      phone: '',
      address: '',
      cardType: 'physical',
    });
    setScreen('card-form');
  };

  /** 자동 발급 신청 선택 */
  const handleAutoApply = () => {
    setKioskMode('card');
    setCardApplication({
      applicantName: '',
      birthDate: '',
      phone: '',
      address: '',
      cardType: 'mobile',
    });
    setScreen('card-form');
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: '#0b1120' }}
    >
      {/* 상단 헤더 */}
      <header className="flex items-center px-6 pt-8 pb-4">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors min-h-[48px] min-w-[48px]"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-sm">이전</span>
        </motion.button>
      </header>

      {/* 타이틀 */}
      <div className="text-center pb-6 px-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold text-white tracking-wider"
        >
          <CmsText contentKey="cardapply.title" fallback="도서증 발급" />
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-slate-500 text-sm mt-2 tracking-wider"
        >
          <CmsText contentKey="cardapply.subtitle" fallback="발급 종류를 선택해주세요" />
        </motion.p>
      </div>

      {/* 선택 버튼 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
        {/* 모바일 도서증 발급 */}
        <motion.button
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={handleMobile}
          className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '130px',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
          }}
        >
          <Smartphone className="w-11 h-11 text-sky-400" strokeWidth={1.5} />
          <div className="text-left">
            <span className="text-xl font-bold text-white tracking-wider block">
              <CmsText contentKey="cardapply.mobile_title" fallback="모바일 도서증 발급" />
            </span>
            <span className="text-xs text-sky-300/70 tracking-wide block mt-1">
              <CmsText contentKey="cardapply.mobile_desc" fallback="즉시 발급, 자동 승인" />
            </span>
          </div>
        </motion.button>

        {/* 실물 도서증 발급 */}
        <motion.button
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={handlePhysical}
          className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '130px',
            background: 'linear-gradient(135deg, #4a3620 0%, #3a2a15 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
          }}
        >
          <CreditCard className="w-11 h-11 text-amber-400" strokeWidth={1.5} />
          <div className="text-left">
            <span className="text-xl font-bold text-white tracking-wider block">
              <CmsText contentKey="cardapply.physical_title" fallback="실물 도서증 발급" />
            </span>
            <span className="text-xs text-amber-300/70 tracking-wide block mt-1">
              <CmsText contentKey="cardapply.physical_desc" fallback="담당자 승인 후 발급" />
            </span>
          </div>
        </motion.button>

        {/* 자동 발급 신청 */}
        <motion.button
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={handleAutoApply}
          className="w-full max-w-md rounded-2xl flex items-center justify-center gap-5 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '130px',
            background: 'linear-gradient(135deg, #1a3a2a 0%, #0f2a1e 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(52, 211, 153, 0.15)',
          }}
        >
          <Zap className="w-11 h-11 text-emerald-400" strokeWidth={1.5} />
          <div className="text-left">
            <span className="text-xl font-bold text-white tracking-wider block">
              <CmsText contentKey="cardapply.auto_title" fallback="자동 발급 신청" />
            </span>
            <span className="text-xs text-emerald-300/70 tracking-wide block mt-1">
              <CmsText contentKey="cardapply.auto_desc" fallback="개인정보 입력 후 자동 승인" />
            </span>
          </div>
        </motion.button>
      </main>
    </div>
  );
}
