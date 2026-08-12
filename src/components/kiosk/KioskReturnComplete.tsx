/**
 * 도서 반납 완료 화면
 */

'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { CheckCircle2 } from 'lucide-react';

export default function KioskReturnComplete() {
  const { returnedLoans, setScreen, clearReturnedLoans } = useAppStore();

  const handleConfirm = () => {
    clearReturnedLoans();
    setScreen('idle');
  };

  return (
    <div className="kiosk-screen kiosk-light-bg flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="mb-6"
      >
        <CheckCircle2 className="w-20 h-20 text-emerald-500" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-bold text-slate-800 mb-2"
      >
        반납완료
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-slate-500 text-base mb-8"
      >
        도서가 정상적으로 반납되었습니다.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-xs bg-white rounded-xl p-4 border border-slate-100 mb-8"
      >
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
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        onClick={handleConfirm}
        className="kiosk-btn bg-slate-800 hover:bg-slate-700 text-white w-full max-w-xs"
      >
        <CheckCircle2 className="w-5 h-5" />
        확인하기
      </motion.button>
    </div>
  );
}
