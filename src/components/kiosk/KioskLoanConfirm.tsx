/**
 * 대출 확인 화면
 *
 * [기능]
 * - 사용자 정보 카드 표시
 * - 선택 도서 목록 및 반납 예정일 표시
 * - 대출 실행
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { LOAN_PERIOD_DAYS } from '@/lib/constants';
import { ArrowLeft, CheckCircle2, User } from 'lucide-react';
import { toast } from 'sonner';

export default function KioskLoanConfirm() {
  const { selectedBooks, authenticatedUser, setScreen, prevScreen } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);

  /** 반납 예정일 계산 */
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
  const dueDateStr = `${dueDate.getFullYear()}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${String(dueDate.getDate()).padStart(2, '0')}`;

  /** 대출 실행 */
  const handleLoan = async () => {
    if (!authenticatedUser || selectedBooks.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    // 각 도서별 대출 API 호출
    for (const book of selectedBooks) {
      try {
        const res = await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authenticatedUser.id,
            bookId: book.id,
            method: 'kiosk',
            pin: authenticatedUser.pin || '1234',
          }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(`${successCount}권 대출이 완료되었습니다`);
      setScreen('loan-complete');
    } else {
      toast.error('대출 처리에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="kiosk-screen kiosk-light-bg flex flex-col">
      {/* 상단 타이틀 */}
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-800">대출 정보를 확인해주세요</h1>
      </header>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        {/* 사용자 정보 카드 */}
        <div className="bg-slate-50 rounded-xl p-4 mb-4 flex items-center gap-3">
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
          className="kiosk-btn bg-slate-200 hover:bg-slate-300 text-slate-700 flex-1"
          disabled={isProcessing}
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={handleLoan}
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
              대출하기
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
