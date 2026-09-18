/**
 * 도서증 발급 승인 대기 화면 (실물 도서증)
 *
 * [기능]
 * - 신청 완료 안내 및 담당자 승인 대기 표시 (CMS 관리)
 * - 신청 내역 요약 표시
 * - 애니메이션 대기 인디케이터 (펄스 도트)
 * - 시뮬레이션: 5초 후 자동 승인 후 완료 화면 이동
 *   - 승인 시 관리자 API 호출하여 카드 상태를 approved→issued로 변경
 * - 취소 버튼으로 메인 메뉴 복귀
 *
 * [디자인]
 * - 다크 네이비 배경 (#0b1120)
 * - 펄스 애니메이션 도트
 * - Framer Motion 진입 애니메이션
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { Clock, User, CalendarDays, Phone, XCircle, CreditCard, CheckCircle2 } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskCardPending() {
  const { cardApplication, cardResult, setCardResult, setScreen, setCardApplication } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);

  /** 5초 후 자동 승인 (시뮬레이션) */
  useEffect(() => {
    timerRef.current = setTimeout(async () => {
      // 시뮬레이션: 관리자 승인 API 호출
      if (cardResult?.cardId) {
        try {
          // 1. 승인
          await fetch(`/api/admin/cards/${cardResult.cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          });
          // 2. 발급
          const issueRes = await fetch(`/api/admin/cards/${cardResult.cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'issue' }),
          });
          if (issueRes.ok) {
            const data = await issueRes.json();
            // 카드 번호 업데이트
            if (data.card?.cardNumber && cardResult) {
              setCardResult({
                ...cardResult,
                cardNumber: data.card.cardNumber,
              });
            }
          }
        } catch (err) {
          console.error('자동 승인 시뮬레이션 오류:', err);
        }
      }

      setAutoApproved(true);
      // 1초 후 완료 화면으로 이동
      setTimeout(() => {
        setScreen('card-complete');
      }, 1000);
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cardResult, setCardResult, setScreen]);

  /** 취소 - 메인 메뉴로 복귀 */
  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCardApplication(null);
    setScreen('main-menu');
  };

  /** 생년월일 포맷팅 */
  const formatBirthDate = (date: string) => {
    if (date.length === 8) {
      return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
    }
    return date;
  };

  /** 전화번호 포맷팅 */
  const formatPhone = (p: string) => {
    if (p.length === 11) {
      return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7, 11)}`;
    }
    if (p.length === 10) {
      return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6, 10)}`;
    }
    return p;
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: '#0b1120' }}
    >
      {/* 상단 안내 영역 */}
      <header className="text-center pt-16 pb-6 px-6">
        {/* 대기 → 승인 애니메이션 */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: autoApproved
              ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
              : 'linear-gradient(135deg, #4a3620 0%, #3a2a15 100%)',
            boxShadow: autoApproved
              ? '0 0 24px rgba(16, 185, 129, 0.25)'
              : '0 0 24px rgba(251, 191, 36, 0.15)',
          }}
        >
          {autoApproved ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : (
            <Clock className="w-8 h-8 text-amber-400" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-2xl font-bold text-white tracking-wider"
        >
          {autoApproved ? (
            <CmsText contentKey="cardpending.approved_title" fallback="승인이 완료되었습니다!" />
          ) : (
            <CmsText contentKey="cardpending.title" fallback="발급 신청이 완료되었습니다" />
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`text-base mt-3 tracking-wider ${autoApproved ? 'text-emerald-300/70' : 'text-amber-300/70'}`}
        >
          {autoApproved ? (
            <CmsText contentKey="cardpending.approved_message" fallback="발급 처리 중..." />
          ) : (
            <CmsText contentKey="cardpending.wait_message" fallback="담당자 승인을 기다려주세요" />
          )}
        </motion.p>
      </header>

      {/* 펄스 대기 인디케이터 */}
      {!autoApproved && (
        <div className="flex items-center justify-center gap-3 py-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-amber-400"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.25,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* 신청 내역 요약 */}
      <main className="flex-1 px-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
          }}
        >
          <h2 className="text-sm font-semibold text-slate-400 tracking-wider mb-3">
            <CmsText contentKey="cardpending.summary_title" fallback="신청 내역" />
          </h2>

          {cardApplication && (
            <>
              {/* 이름 */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500 text-sm shrink-0">이름</span>
                <span className="text-white text-sm ml-auto">{cardApplication.applicantName}</span>
              </div>

              {/* 생년월일 */}
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500 text-sm shrink-0">생년월일</span>
                <span className="text-white text-sm ml-auto">{formatBirthDate(cardApplication.birthDate)}</span>
              </div>

              {/* 전화번호 */}
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500 text-sm shrink-0">전화번호</span>
                <span className="text-white text-sm ml-auto">{formatPhone(cardApplication.phone)}</span>
              </div>

              {/* 카드 종류 */}
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500 text-sm shrink-0">카드 종류</span>
                <span className="text-amber-400 text-sm ml-auto">
                  {cardApplication.cardType === 'mobile' ? '모바일 도서증' : '실물 도서증'}
                </span>
              </div>
            </>
          )}
        </motion.div>

        {/* 시뮬레이션 안내 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-4 rounded-xl p-3 text-center"
          style={{
            background: 'rgba(56, 189, 248, 0.06)',
            border: '1px solid rgba(56, 189, 248, 0.1)',
          }}
        >
          <p className="text-sky-300/70 text-xs">
            💡 시뮬레이션: 5초 후 자동 승인 처리됩니다
          </p>
        </motion.div>
      </main>

      {/* 취소 버튼 */}
      {!autoApproved && (
        <footer className="pb-8 px-8 pt-4">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCancel}
            className="w-full max-w-md mx-auto rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-shadow duration-200"
            style={{
              minHeight: '56px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}
          >
            <XCircle className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
            <span className="text-base font-semibold text-slate-400 tracking-wider">
              <CmsText contentKey="cardpending.cancel_button_text" fallback="취소" />
            </span>
          </motion.button>
        </footer>
      )}
    </div>
  );
}
