/**
 * 영수증 발급 여부 화면 — 실기기 참조 (대출/반납 공용)
 *
 * [기능]
 * - "N권 완료되었습니다. 영수증을 출력하시겠습니까?"
 * - 출력 → 완료 화면에서 영수증 표시
 * - 출력 안 함 → 완료 화면에서 영수증 생략
 */

'use client';

import { motion } from 'framer-motion';
import { Printer, XCircle } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';

export default function KioskReceiptPrompt() {
  const theme = useScreenTheme('receipt');
  const { kioskMode, dispenseQueue, returnedLoans, lastReturnSummary, setReceiptPrint, setScreen } =
    useAppStore();

  const isReturn = kioskMode === 'return';
  const count = isReturn
    ? (lastReturnSummary?.items.length ?? returnedLoans.length)
    : dispenseQueue.length;

  const title = useCmsText(
    isReturn ? 'returnreceipt.title' : 'loanreceipt.title',
    isReturn ? '반납완료' : '대출완료'
  );

  useKioskSpeak(
    isReturn
      ? `반납이 ${count}권 완료되었습니다. 영수증을 출력하시겠습니까?`
      : '대출이 완료되었습니다. 영수증을 출력하시겠습니까?'
  );

  const handlePrint = (print: boolean) => {
    setReceiptPrint(print);
    setScreen(isReturn ? 'return-complete' : 'loan-complete');
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title={isReturn ? '도서반납' : '도서대출'} />
      <EcoSteps steps={isReturn ? RETURN_STEPS : LOAN_STEPS} current={isReturn ? 3 : 4} />
      <EcoUserPill />

      <header className="px-6 pt-6 pb-2">
        <h2 className="text-3xl font-bold text-center eco-title-text">{title}</h2>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="eco-card w-full max-w-sm px-6 py-8 text-center">
          <p className="text-lg font-semibold text-slate-700 leading-relaxed">
            {isReturn ? (
              <>
                반납이 {count}권 완료되었습니다.<br />
                영수증을 출력하시겠습니까?
              </>
            ) : (
              <>
                대출이 완료되었습니다.<br />
                영수증을 출력하시겠습니까?
              </>
            )}
          </p>
          <p className="text-sm text-slate-500 mt-2">반납 예정일을 꼭 확인하세요.</p>

          <div className="flex gap-3 mt-6">
            <button onClick={() => handlePrint(true)} className="eco-btn-primary flex-1">
              <Printer className="w-5 h-5" />
              <CmsText contentKey="receipt.print_button" fallback="출력" />
            </button>
            <button onClick={() => handlePrint(false)} className="eco-btn-secondary flex-1">
              <XCircle className="w-5 h-5" />
              <CmsText contentKey="receipt.skip_button" fallback="출력 안 함" />
            </button>
          </div>
        </div>
      </main>

      <EcoTicker />
    </div>
  );
}
