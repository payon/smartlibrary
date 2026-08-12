/**
 * 회원증 스캔 화면
 *
 * [기능]
 * - 회원증 RFID 스캔 안내
 * - 2초 후 자동 인식 시뮬레이션
 * - 인식 성공 메시지 표시 후 PIN 입력으로 이동
 * - 회원증 없이 이용하기 옵션 (데모용)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { CreditCard, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SimUser } from '@/stores/useAppStore';

export default function KioskAuthScan() {
  const { setScreen, prevScreen, kioskMode, setAuthenticatedUser } = useAppStore();
  const [status, setStatus] = useState<'scanning' | 'recognized' | 'skipped'>('scanning');
  const movedRef = useRef(false);

  /** 2초 후 자동 인식 시뮬레이션 */
  useEffect(() => {
    if (movedRef.current) return;
    movedRef.current = true;
    const timer = setTimeout(() => {
      setStatus('recognized');
    }, 2000);
    const moveTimer = setTimeout(() => {
      setScreen('auth-pin');
    }, 3500);
    return () => {
      clearTimeout(timer);
      clearTimeout(moveTimer);
    };
  }, []);

  /** 회원증 없이 이용하기 (데모 모드) - DB에서 실제 데모 사용자 조회 */
  const handleSkip = async () => {
    setStatus('skipped');
    try {
      const res = await fetch('/api/users?pin=1234');
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (users.length > 0) {
          setAuthenticatedUser(users[0]);
          toast.success(users[0].name + '님(데모) 환영합니다');
          setTimeout(() => {
            setScreen(kioskMode === 'loan' ? 'loan-select' : 'return-insert');
          }, 500);
          return;
        }
      }
    } catch {
      // 조회 실패
    }
    toast.error('데모 사용자를 찾을 수 없습니다');
    setStatus('scanning');
  };

  return (
    <div className="kiosk-screen kiosk-dark-bg flex flex-col">
      {/* 상단 타이틀 */}
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-white">회원인증</h1>
      </header>

      {/* 메인 스캔 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          {/* 카드 아이콘 및 스캔 애니메이션 */}
          <div className="relative mb-8">
            <div className="w-32 h-32 mx-auto rounded-2xl bg-white/5 border-2 border-sky-400/30 flex items-center justify-center">
              {status === 'scanning' ? (
                <CreditCard className="w-14 h-14 text-sky-400" />
              ) : (
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
              )}
            </div>

            {/* 스캔 링 애니메이션 */}
            {status === 'scanning' && (
              <div className="absolute inset-0 w-32 h-32 mx-auto rounded-2xl card-scan-ring" />
            )}
          </div>

          {/* 안내 메시지 */}
          {status === 'scanning' && (
            <motion.p
              className="text-slate-300 text-lg mb-2"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              회원증을 가져다 대세요
            </motion.p>
          )}

          {status === 'recognized' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-emerald-400 text-lg font-semibold"
            >
              인식되었습니다
            </motion.p>
          )}

          {status === 'skipped' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sky-300 text-base"
            >
              데모 모드로 진행합니다
            </motion.p>
          )}

          <p className="text-slate-500 text-sm mt-3">
            RFID 카드 리더기에 회원증을 대주세요
          </p>
        </motion.div>
      </main>

      {/* 하단 버튼 영역 */}
      <footer className="pb-10 px-6 flex flex-col gap-3">
        {/* 취소 버튼 */}
        <button
          onClick={prevScreen}
          className="kiosk-btn bg-slate-700 hover:bg-slate-600 text-white"
        >
          <X className="w-5 h-5" />
          취소
        </button>

        {/* 데모 모드 스킵 버튼 */}
        {status === 'scanning' && (
          <button
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
          >
            회원증 없이 이용하기
          </button>
        )}
      </footer>
    </div>
  );
}
