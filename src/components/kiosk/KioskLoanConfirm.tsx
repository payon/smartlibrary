/**
 * 대출 확인 화면
 *
 * [기능]
 * - 사용자 정보 카드 표시 (CMS 관리)
 * - 선택 도서 목록 및 반납 예정일 표시
 * - 대출 실행
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { LOAN_PERIOD_DAYS } from '@/lib/constants';
import { ArrowLeft, CheckCircle2, User } from 'lucide-react';
import { toast } from 'sonner';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskLoanConfirm() {
  const loanConfirmTitle = useCmsText('loanconfirm.title', '대출 정보를 확인해주세요');
  const theme = useScreenTheme('loan-confirm');
  useKioskSpeak(`${loanConfirmTitle}. 대출 정보를 확인한 뒤 대출하기를 눌러주세요.`);
  const { selectedBooks, authenticatedUser, setScreen, prevScreen } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [loanError, setLoanError] = useState<{
    message: string;
    overdueDays?: number;
    blockDays?: number;
  } | null>(null);

  /** 반납 예정일 계산 */
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
  const dueDateStr = `${dueDate.getFullYear()}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${String(dueDate.getDate()).padStart(2, '0')}`;

  /** 대출 실행 (한 번에 모든 도서 처리) */
  const handleLoan = async () => {
    if (selectedBooks.length === 0) {
      toast.error('선택된 도서가 없습니다. 도서를 먼저 선택해주세요.');
      setScreen('loan-select');
      return;
    }
    if (!authenticatedUser) {
      toast.error('회원인증이 필요합니다');
      setScreen('auth-scan');
      return;
    }
    if (!authenticatedUser.pin) {
      toast.error('PIN 인증이 필요합니다');
      setScreen('auth-pin');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authenticatedUser.id,
          bookIds: selectedBooks.map((b) => b.id),
          method: 'kiosk',
          pin: authenticatedUser.pin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.loanedCount}권 대출이 완료되었습니다`);
        setLoanError(null);
        useAppStore.getState().setDispenseQueue(
          selectedBooks.map((b) => ({ title: b.title, author: b.author }))
        );
        useAppStore.getState().clearSelectedBooks();
        setScreen('loan-dispense');
      } else {
        const data = await res.json().catch(() => ({}));
        const message = data.error || '대출 처리에 실패했습니다. 다시 시도해주세요.';
        if (data.code === 'OVERDUE_BLOCKED') {
          setLoanError({
            message,
            overdueDays: data.overdueDays,
            blockDays: data.blockDays ?? data.penaltyRemainingDays,
          });
        } else {
          setLoanError({ message });
        }
        toast.error(message);
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서대출" />
      <EcoSteps steps={LOAN_STEPS} current={2} />
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="loanconfirm.title" fallback="대출 정보를 확인해주세요" />
        </h1>
      </header>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        {/* 사용자 정보 카드 */}
        <div className="eco-card p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
            <User className="w-6 h-6 text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{authenticatedUser?.name || '데모 사용자'}</p>
            <p className="text-xs text-slate-400">{authenticatedUser?.cardNumber || 'LIB-00000001'}</p>
          </div>
        </div>

        {/* 선택 도서 목록 */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-600 mb-3">
            대출 도서 ({selectedBooks.length}권)
          </p>
          <div className="space-y-2">
            {selectedBooks.map((book, idx) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex gap-3 bg-white rounded-xl p-3 border border-slate-100"
              >
                {/* 소형 표지 */}
                <div className="w-12 h-16 rounded-lg bg-slate-100 shrink-0 overflow-hidden">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{book.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{book.author}</p>
                  <p className="text-xs text-slate-400">반납예정: {dueDateStr}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 연체 차단 안내 (서버가 대출을 거부한 경우) */}
        {loanError && (
          <div
            className={`rounded-xl p-4 mb-3 ${loanError.overdueDays ? 'bg-red-50 border border-red-200' : 'bg-slate-100 border border-slate-200'}`}
            role="alert"
          >
            <p className={`text-sm font-semibold ${loanError.overdueDays ? 'text-red-700' : 'text-slate-700'}`}>
              ⚠ 대출할 수 없습니다
            </p>
            <p className={`text-sm mt-1 ${loanError.overdueDays ? 'text-red-600' : 'text-slate-600'}`}>
              {loanError.message}
            </p>
            {loanError.overdueDays ? (
              <p className="text-xs text-red-500 mt-1">
                연체 {loanError.overdueDays}일 → 연체일수만큼 대여가 제한됩니다. 연체 도서를 먼저 반납해주세요.
              </p>
            ) : null}
          </div>
        )}

        {/* 요약 */}
        <div className="bg-sky-50 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">총 대출 권수</span>
            <span className="text-lg font-bold text-sky-700">{selectedBooks.length}권</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-600">반납 예정일</span>
            <span className="text-sm font-semibold text-slate-800">{dueDateStr}</span>
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <footer className="pb-8 px-5 flex gap-3">
        <button
          onClick={prevScreen}
          className="eco-btn-secondary flex-1"
          disabled={isProcessing}
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={handleLoan}
          disabled={isProcessing}
          className="eco-btn-primary flex-[2] disabled:opacity-60"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <CmsText contentKey="loanconfirm.confirm_button_text" fallback="대출하기" />
            </>
          )}
        </button>
      </footer>
      <EcoTicker />
    </div>
  );
}
