/**
 * 대출 이력 화면 (나의 대출 현황)
 *
 * [기능]
 * - 현재 이용자의 대출 중 도서 + 반납예정일 목록
 * - 메인 메뉴 대출이력 버튼 진입
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { LoanItem } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { formatReceiptDate } from '@/components/kiosk/KioskReceipt';

export default function KioskLoanHistory() {
  const title = useCmsText('loanhistory.title', '대출 이력');
  const theme = useScreenTheme('loan-history');
  useKioskSpeak(`${title}. 현재 빌린 책 목록입니다.`);
  const { authenticatedUser, setScreen, prevScreen, setKioskMode } = useAppStore();
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticatedUser) {
      setLoading(false);
      return;
    }
    fetch(`/api/loans?userId=${authenticatedUser.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LoanItem[]) => setLoans(data.filter((l) => l.status === 'active')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authenticatedUser]);

  const handleGoReturn = () => {
    setKioskMode('return');
    setScreen('return-insert');
  };

  const handleGoAuth = () => {
    setKioskMode('loan');
    setScreen('auth-scan');
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서대출" />
      <EcoSteps steps={LOAN_STEPS} current={1} />
      <EcoUserPill />

      <header className="px-6 pt-6 pb-2">
        <h2 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="loanhistory.title" fallback="대출 이력" />
        </h2>
      </header>

      <main className="flex-1 overflow-y-auto kiosk-scroll px-6 pb-4">
        {loading ? (
          <p className="text-center text-slate-500 py-10">불러오는 중...</p>
        ) : !authenticatedUser ? (
          <div className="eco-card p-6 text-center">
            <p className="text-slate-600 mb-4">대출 이력을 보려면 회원인증이 필요합니다</p>
            <button onClick={handleGoAuth} className="eco-btn-primary w-full">
              회원인증 하러 가기
            </button>
          </div>
        ) : loans.length === 0 ? (
          <div className="eco-card p-6 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600">빌린 책이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {loans.map((loan, idx) => (
              <motion.div
                key={loan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="eco-card p-3 flex gap-3"
              >
                <div className="w-10 h-14 rounded-lg bg-slate-100 shrink-0 overflow-hidden">
                  {loan.book?.coverUrl ? (
                    <img src={loan.book.coverUrl} alt={loan.book.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{loan.book?.title || '도서'}</p>
                  <p className="text-xs text-slate-500">{loan.book?.author || ''}</p>
                  <p className="text-xs text-sky-700 mt-0.5">반납예정: {formatReceiptDate(loan.dueDate)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-6 pb-4 flex gap-3">
        <button onClick={prevScreen} className="eco-btn-secondary flex-1">
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        {loans.length > 0 && (
          <button onClick={handleGoReturn} className="eco-btn-primary flex-[2]">
            반납하러 가기
          </button>
        )}
      </footer>

      <EcoTicker />
    </div>
  );
}
