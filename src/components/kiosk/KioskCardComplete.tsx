/**
 * 도서증 발급 완료 화면
 *
 * [기능]
 * - 발급 완료 안내 및 카드 정보 표시 (CMS 관리)
 * - 카드 번호: LIB-YYYYMMDD-XXXX 형식
 * - 모바일: QR 코드 플레이스홀더
 * - 실물: 3영업일 내 발급 안내
 * - 확인 버튼: 대기 화면 복귀
 * - 도서 대출 버튼: 대출 인증 화면 이동
 *
 * [디자인]
 * - 다크 네이비 배경 (#0b1120)
 * - 성공 체크마크 애니메이션
 * - Framer Motion 진입 애니메이션
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { CheckCircle2, CreditCard, BookOpen, QrCode, CalendarDays } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskCardComplete() {
  const { cardApplication, setScreen, setKioskMode } = useAppStore();

  const isMobile = cardApplication?.cardType === 'mobile';

  /** 카드 번호 생성: LIB-YYYYMMDD-XXXX */
  const cardNumber = useMemo(() => {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = String(Math.floor(1000 + Math.random() * 9000));
    return `LIB-${datePart}-${random}`;
  }, []);

  /** 발급일 포맷팅 */
  const issueDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  /** 확인 버튼 - 대기 화면으로 */
  const handleConfirm = () => {
    setScreen('idle');
  };

  /** 도서 대출하러 가기 */
  const handleGoLoan = () => {
    setKioskMode('loan');
    setScreen('auth-scan');
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: '#0b1120' }}
    >
      {/* 성공 타이틀 영역 */}
      <header className="text-center pt-12 pb-6 px-6">
        {/* 성공 체크마크 */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            boxShadow: '0 0 32px rgba(16, 185, 129, 0.25)',
          }}
        >
          <CheckCircle2 className="w-9 h-9 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-2xl font-bold text-emerald-400 tracking-wider"
        >
          <CmsText contentKey="cardcomplete.title" fallback="도서증 발급이 완료되었습니다!" />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-slate-400 text-sm mt-2 tracking-wider"
        >
          {isMobile
            ? <CmsText contentKey="cardcomplete.mobile_message" fallback="모바일 도서증이 발급되었습니다" />
            : <CmsText contentKey="cardcomplete.physical_message" fallback="실물 도서증은 3영업일 내 발급됩니다" />
          }
        </motion.p>
      </header>

      {/* 카드 정보 영역 */}
      <main className="flex-1 px-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.4) 0%, rgba(15, 39, 68, 0.4) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.1)',
          }}
        >
          {/* 카드 번호 */}
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">카드 번호</p>
              <p className="text-white text-base font-mono font-semibold tracking-wider">{cardNumber}</p>
            </div>
          </div>

          {/* 이름 */}
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">이름</p>
              <p className="text-white text-base">{cardApplication?.applicantName ?? '-'}</p>
            </div>
          </div>

          {/* 카드 종류 */}
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">카드 종류</p>
              <p className={`text-base ${isMobile ? 'text-sky-400' : 'text-amber-400'}`}>
                {isMobile ? '모바일 도서증' : '실물 도서증'}
              </p>
            </div>
          </div>

          {/* 발급일 */}
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">발급일</p>
              <p className="text-white text-base">{issueDate}</p>
            </div>
          </div>

          {/* 모바일 QR 코드 플레이스홀더 */}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="flex flex-col items-center pt-4 pb-2"
            >
              <div
                className="w-28 h-28 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px dashed rgba(148, 163, 184, 0.2)',
                }}
              >
                <QrCode className="w-12 h-12 text-slate-600" />
              </div>
              <p className="text-slate-600 text-xs mt-2">QR 코드</p>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* 하단 버튼 */}
      <footer className="pb-8 px-8 pt-4 space-y-3">
        {/* 도서 대출하러 가기 */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleGoLoan}
          className="w-full max-w-md mx-auto rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-shadow duration-200 hover:shadow-xl active:shadow-md"
          style={{
            minHeight: '60px',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <BookOpen className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
          <span className="text-base font-bold text-white tracking-wider">
            <CmsText contentKey="cardcomplete.go_loan_button_text" fallback="도서 대출하러 가기" />
          </span>
        </motion.button>

        {/* 확인 */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.65 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleConfirm}
          className="w-full max-w-md mx-auto rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-shadow duration-200"
          style={{
            minHeight: '52px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          }}
        >
          <span className="text-base font-semibold text-slate-400 tracking-wider">
            <CmsText contentKey="cardcomplete.confirm_button_text" fallback="확인" />
          </span>
        </motion.button>
      </footer>
    </div>
  );
}
