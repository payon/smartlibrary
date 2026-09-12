/**
 * 키오스크 대기 화면 (ECO 키오스크 어트랙트 스크린)
 *
 * [기능]
 * - SMART LIBRARY 브랜딩 표시 (CMS 관리)
 * - 터치 시 메인 메뉴로 이동
 * - 관리자 모드 진입 버튼 (우측 하단)
 *
 * [디자인]
 * - 다크 네이비 전체 화면 배경 (CMS 관리)
 * - 중앙 브랜딩 + 하단 터치 안내
 * - 미묘한 펄스 글로우 효과
 */

'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { Library, Settings } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskIdleScreen() {
  const { setScreen, setAdminMode } = useAppStore();
  const cmsContent = useAppStore((s) => s.cmsContent);

  /** CMS 배경색 또는 기본값 (hex 색상만 허용하여 CSS 인젝션 방지) */
  const rawBgColor = cmsContent['idle.background_color'] || '#0b1120';
  const bgColor = /^#[0-9a-fA-F]{3,8}$/.test(rawBgColor) ? rawBgColor : '#0b1120';

  /** 화면 터치 시 메인 메뉴로 이동 */
  const handleTouch = useCallback(() => {
    setScreen('main-menu');
  }, [setScreen]);

  /** 관리자 모드 진입 */
  const handleAdminClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      setAdminMode(true);
    },
    [setAdminMode]
  );

  return (
    <div
      className="flex flex-col items-center justify-center h-screen relative select-none cursor-pointer"
      style={{ background: bgColor }}
      onClick={handleTouch}
      onTouchStart={handleTouch}
      role="button"
      tabIndex={0}
      aria-label="화면을 터치하여 시작하세요"
    >
      {/* 배경 글로우 효과 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 400px 400px at 50% 45%, rgba(56,189,248,0.06) 0%, transparent 70%)',
        }}
      />

      {/* 중앙 브랜딩 영역 */}
      <div className="relative z-10 flex flex-col items-center">
        {/* 아이콘 + 텍스트 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <Library
            className="w-16 h-16 text-sky-400 mb-5"
            strokeWidth={1.2}
            style={{
              filter: 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.3))',
            }}
          />
          <CmsText
            contentKey="idle.title"
            fallback="SMART LIBRARY"
            as="h1"
            className="text-4xl font-bold tracking-[0.2em] text-white"
          />
          <CmsText
            contentKey="idle.subtitle"
            fallback="무인 도서대출반납기"
            as="p"
            className="text-slate-500 text-sm tracking-[0.3em] mt-3"
          />
        </motion.div>

        {/* 하단 터치 안내 */}
        <motion.p
          className="text-sky-300/80 text-base tracking-wider mt-16"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <CmsText contentKey="idle.pulse_text" fallback="화면을 터치하여 시작하세요" />
        </motion.p>
      </div>

      {/* 하단 펄스 링 효과 */}
      <motion.div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none"
        animate={{
          scale: [1, 1.8, 2.5],
          opacity: [0.25, 0.08, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeOut',
        }}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: '1.5px solid rgba(56, 189, 248, 0.3)',
        }}
      />

      {/* 관리자 모드 진입 버튼 (작고 반투명) */}
      <button
        onClick={handleAdminClick}
        onTouchStart={handleAdminClick}
        className="absolute bottom-4 right-4 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-400 transition-colors opacity-30 hover:opacity-60 z-20"
        aria-label="관리자 모드"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}
