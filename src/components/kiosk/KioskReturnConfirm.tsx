/**
 * 도서 반납 확인 화면
 *
 * [기능]
 * - 반납할 대출 기록 목록 표시 (CMS 관리)
 * - 반납 API 호출
 * - 반납 완료 화면으로 이동
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { CmsText } from '@/components/kiosk/CmsText';
import { maskPhone } from '@/components/kiosk/KioskReceipt';
import type { ReturnSummaryItem } from '@/stores/useAppStore';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskReturnConfirm() {
  const returnConfirmTitle = useCmsText('returnconfirm.title', '반납 정보를 확인해주세요');
  const theme = useScreenTheme('return-confirm');
  useKioskSpeak(`${returnConfirmTitle}. 반납 정보를 확인한 뒤 반납하기를 눌러주세요.`);
  const { returnedLoans, setScreen, prevScreen, authenticatedUser, setLastReturnSummary } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);

  /** 반납 실행 (도서별 연체 정보 수집 → 영수증 요약 저장) */
  const handleReturn = async () => {
    if (returnedLoans.length === 0) return;
    setIsProcessing(true);

    let successCount = 0;
    const summaryItems: ReturnSummaryItem[] = [];
    for (const loan of returnedLoans) {
      try {
        const res = await fetch(`/api/loans/${loan.id}/return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          successCount++;
          const data = await res.json().catch(() => ({}));
          const loanData = data.loan || {};
          const overdueDays = data.overdueDays ?? data.penalty?.overdueDays ?? 0;
          const blockDays = data.penaltyDays ?? data.penalty?.blockDays ?? 0;
          summaryItems.push({
            title: loan.book?.title || loanData.book?.title || '도서',
            author: loan.book?.author || loanData.book?.author || '',
            loanDate: loan.loanDate,
            dueDate: loan.dueDate,
            returnDate: loanData.returnDate || new Date().toISOString().split('T')[0],
            overdueDays,
            blockDays,
            blockUntil: data.penalty?.blockUntil || null,
          });
        }
      } catch {
        // API 오류 무시
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      setLastReturnSummary({
        returnedAt: new Date().toISOString(),
        userName: authenticatedUser?.name || '',
        cardNumber: authenticatedUser?.cardNumber || '',
        phoneMasked: maskPhone(authenticatedUser?.phone),
        items: summaryItems,
      });
      toast.success(`${successCount}권 반납이 완료되었습니다`);
      setScreen('return-complete');
    } else {
      toast.error('반납 처리에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="kiosk-screen kiosk-light-bg flex flex-col" style={theme.style}>
      {/* 상단 타이틀 */}
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-800">
          <CmsText contentKey="returnconfirm.title" fallback="반납 정보를 확인해주세요" />
        </h1>
      </header>

      {/* 반납 도서 목록 */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        <p className="text-sm font-semibold text-slate-600 mb-3">
          반납 도서 ({returnedLoans.length}권)
        </p>
        <div className="space-y-2">
          {returnedLoans.map((loan, idx) => (
            <motion.div
              key={loan.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex gap-3 bg-white rounded-xl p-3 border border-slate-100"
            >
              {/* 소형 표지 */}
              <div className="w-12 h-16 rounded-lg bg-slate-100 shrink-0 overflow-hidden">
                {loan.book?.coverUrl ? (
                  <img
                    src={loan.book.coverUrl}
                    alt={loan.book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {loan.book?.title || '도서'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{loan.book?.author || ''}</p>
                <p className="text-xs text-amber-600">
                  대출일: {loan.loanDate} → 반납예정: {loan.dueDate}
                </p>
                {new Date(loan.dueDate) < new Date(new Date().toISOString().split('T')[0]) && (
                  <p className="text-xs text-red-600 font-semibold mt-0.5">
                    ⚠ 반납예정일 경과 — 연체로 처리될 수 있습니다
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      <footer className="pb-8 px-5 flex gap-3">
        <button
          onClick={prevScreen}
          className="kiosk-btn bg-slate-200 hover:bg-slate-300 text-slate-700 flex-1"
          disabled={isProcessing}
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={handleReturn}
          disabled={isProcessing}
          className="kiosk-btn bg-slate-800 hover:bg-slate-700 text-white flex-[2] disabled:opacity-60"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <CmsText contentKey="returnconfirm.confirm_button_text" fallback="반납하기" />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
