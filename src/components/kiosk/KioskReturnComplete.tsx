/**
 * 도서 반납 완료 화면 (CMS 관리)
 */

'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CheckCircle2 } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';
import KioskReceipt, { formatReceiptDate } from '@/components/kiosk/KioskReceipt';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskReturnComplete() {
  const returnCompleteTitle = useCmsText('returncomplete.title', '반납완료');
  const theme = useScreenTheme('return-complete');
  useKioskSpeak(`${returnCompleteTitle}. 반납이 완료되었습니다.`);
  const { authenticatedUser, returnedLoans, setScreen, clearReturnedLoans, setAuthenticatedUser, lastReturnSummary, setLastReturnSummary } = useAppStore();

  const handleConfirm = () => {
    clearReturnedLoans();
    setLastReturnSummary(null);
    setAuthenticatedUser(null);
    setScreen('idle');
  };

  const penaltyNote = lastReturnSummary
    ? (() => {
        const overdueItems = lastReturnSummary.items.filter((i) => i.overdueDays > 0);
        if (overdueItems.length === 0) return null;
        const maxBlock = Math.max(...overdueItems.map((i) => i.blockDays));
        const latestUntil = overdueItems
          .map((i) => i.blockUntil)
          .filter(Boolean)
          .sort()
          .pop();
        return `${overdueItems.length}권 연체로 ${maxBlock}일간 대출이 제한됩니다${latestUntil ? ` (${formatReceiptDate(latestUntil as string)}까지)` : ''}. 연체일수만큼 대여가 불가합니다.`;
      })()
    : null;

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <div className="w-full">
        <EcoHeader title="도서반납" />
        <EcoSteps steps={RETURN_STEPS} current={4} />
        <EcoUserPill />
      </div>
      <main className="flex-1 flex flex-col items-center justify-center px-6 w-full">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="mb-6 mt-6"
      >
        <CheckCircle2 className="w-20 h-20 text-emerald-500" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-3xl font-bold text-center eco-title-text mb-2"
      >
        <CmsText contentKey="returncomplete.title" fallback="반납완료" />
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-slate-500 text-base mb-8"
      >
        <CmsText contentKey="returncomplete.message" fallback="도서가 정상적으로 반납되었습니다." />
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-xs mb-8"
      >
        {lastReturnSummary ? (
          <KioskReceipt
            kind="return"
            userName={lastReturnSummary.userName}
            cardNumber={lastReturnSummary.cardNumber}
            phone={authenticatedUser?.phone}
            books={lastReturnSummary.items}
            penaltyNote={penaltyNote}
          />
        ) : (
          <div className="bg-white rounded-xl p-4 border border-slate-100">
            <p className="text-sm font-semibold text-slate-600 mb-3">
              반납 도서 ({returnedLoans.length}권)
            </p>
            {returnedLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-slate-700 truncate">
                  {loan.book?.title || '도서'}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        onClick={handleConfirm}
        className="eco-btn-primary w-full max-w-xs"
      >
        <CheckCircle2 className="w-5 h-5" />
        <CmsText contentKey="returncomplete.confirm_button_text" fallback="확인하기" />
      </motion.button>
      </main>
      <EcoTicker />
    </div>
  );
}
