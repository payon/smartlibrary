/**
 * 회원증 스캔 화면
 *
 * [기능]
 * - 회원증 RFID 스캔 안내 (CMS 관리)
 * - 2초 후 자동 인식 시뮬레이션 → DB에서 사용자 조회 → authenticatedUser 설정
 * - 인식 성공 메시지 표시 후 PIN 입력으로 이동
 * - 회원증 없이 이용하기 옵션 (데모용) → PIN 입력으로 이동
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { CreditCard, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SimUser } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskAuthScan() {
  const { setScreen, prevScreen, setAuthenticatedUser } = useAppStore();
  const [status, setStatus] = useState<'scanning' | 'recognized' | 'skipped'>('scanning');

  /** DB에서 데모 사용자를 조회하여 authenticatedUser에 설정 */
  const fetchAndSetDemoUser = async (): Promise<boolean> => {
    try {
      // PIN 1234로 사용자 조회
      const res = await fetch('/api/users', { headers: { 'X-PIN': '1234' } });
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (users.length > 0) {
          setAuthenticatedUser({ ...users[0], pin: '1234' });
          return true;
        }
      }

      // 다른 PIN으로 재시도 (0001~0010)
      for (let i = 1; i <= 10; i++) {
        const tryPin = String(i).padStart(4, '0');
        const retryRes = await fetch('/api/users', { headers: { 'X-PIN': tryPin } });
        if (retryRes.ok) {
          const retryUsers: SimUser[] = await retryRes.json();
          if (retryUsers.length > 0) {
            setAuthenticatedUser({ ...retryUsers[0], pin: tryPin });
            return true;
          }
        }
      }
    } catch {
      // 네트워크 오류 - 데모 모드로 계속 진행
    }
    return false;
  };

  /** 2초 후 자동 인식 시뮬레이션 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('recognized');
    }, 2000);
    const moveTimer = setTimeout(async () => {
      // 스캔 인식 후 DB에서 사용자 조회
      await fetchAndSetDemoUser();
      // PIN 화면으로 이동 (사용자가 있든 없든 PIN 화면에서 처리)
      setScreen('auth-pin');
    }, 3500);
    return () => {
      clearTimeout(timer);
      clearTimeout(moveTimer);
    };
  }, [setScreen, setAuthenticatedUser]);

  /** 회원증 없이 이용하기 (데모 모드) → PIN 입력으로 이동 */
  const handleSkip = async () => {
    setStatus('skipped');
    // 데모 사용자를 찾아서 설정 (있으면 좋고, 없어도 PIN 화면에서 처리)
    await fetchAndSetDemoUser();
    setTimeout(() => {
      setScreen('auth-pin');
    }, 500);
  };

  return (
    <div className="kiosk-screen kiosk-dark-bg flex flex-col">
      {/* 상단 타이틀 */}
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-white">
          <CmsText contentKey="authscan.title" fallback="회원인증" />
        </h1>
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
              <CmsText contentKey="authscan.instruction" fallback="회원증을 가져다 대세요" />
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
            <CmsText contentKey="authscan.demo_button_text" fallback="회원증 없이 이용하기" />
          </button>
        )}
      </footer>
    </div>
  );
}
