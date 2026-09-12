/**
 * 비밀번호 입력 화면
 *
 * [기능]
 * - 4자리 숫자 비밀번호 입력 (CMS 관리)
 * - 숫자 키패드 (1-9, 0, 삭제, 확인)
 * - 데모 모드에서는 임의의 4자리 입력 가능
 */

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { Delete, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { SimUser } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';

/**
 * 데모 사용자 조회
 * 데이터베이스에서 PIN '1234' 사용자를 조회합니다.
 * API 호출 실패 시에만 사용됩니다.
 */
async function fetchDemoUser(): Promise<SimUser | null> {
  try {
    const res = await fetch('/api/users', { headers: { 'X-PIN': '1234' } });
    if (res.ok) {
      const users: SimUser[] = await res.json();
      if (users.length > 0) return users[0];
    }
  } catch {
    // 조회 실패 시 null 반환
  }
  return null;
}

export default function KioskAuthPin() {
  const { setScreen, prevScreen, kioskMode, setAuthenticatedUser } = useAppStore();
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  /** 비밀번호 확인 */
  const handleConfirm = useCallback(async (inputPin: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/users', { headers: { 'X-PIN': inputPin } });
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (users.length > 0) {
          setAuthenticatedUser(users[0]);
          toast.success(users[0].name + '님 환영합니다');
          setTimeout(() => {
            setScreen(kioskMode === 'loan' ? 'loan-select' : 'return-insert');
          }, 500);
          setIsProcessing(false);
          return;
        }
      }
    } catch {
      // API 오류 시 데모 모드로 진행
    }

    // API 실패 시 데모 사용자 조회 (데이터베이스에서 PIN 1234 사용자 가져오기)
    const demoUser = await fetchDemoUser();
    setTimeout(() => {
      if (demoUser) {
        setAuthenticatedUser(demoUser);
        toast.success(demoUser.name + '님(데모) 환영합니다');
      } else {
        // DB에도 없으면 하드코딩된 정보로 대체 (DB 외래키 오류 방지용 로컬 처리)
        toast.error('사용자를 찾을 수 없습니다. 다시 시도해주세요.');
        setPin('');
        setIsProcessing(false);
        return;
      }
      setScreen(kioskMode === 'loan' ? 'loan-select' : 'return-insert');
      setIsProcessing(false);
    }, 800);
  }, [isProcessing, setAuthenticatedUser, setScreen, kioskMode]);

  /** 숫자 키 입력 처리 */
  const handleKeyPress = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const newPin = prev + digit;
      // 4자리 입력 완료 시 자동 확인
      if (newPin.length === 4) {
        setTimeout(() => handleConfirm(newPin), 0);
      }
      return newPin;
    });
  }, [handleConfirm]);

  /** 삭제 버튼 */
  const handleDelete = useCallback(() => {
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  /** 숫자 키패드 구성 */
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="kiosk-screen kiosk-dark-bg flex flex-col">
      {/* 상단 타이틀 */}
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-white">
          <CmsText contentKey="authpin.title" fallback="비밀번호 입력" />
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          4자리 비밀번호를 입력해주세요
        </p>
      </header>

      {/* PIN 도트 표시 영역 */}
      <div className="flex justify-center py-8">
        <div className="flex gap-5">
          {[0, 1, 2, 3].map((idx) => (
            <motion.div
              key={idx}
              animate={
                pin.length === idx
                  ? { scale: [1, 1.3, 1] }
                  : {}
              }
              transition={{ duration: 0.2 }}
              className={`w-5 h-5 rounded-full border-2 transition-colors duration-200 ${
                idx < pin.length
                  ? 'bg-sky-400 border-sky-400'
                  : 'bg-transparent border-slate-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 처리 중 표시 */}
      {isProcessing && (
        <div className="text-center mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto"
          />
          <p className="text-slate-400 text-sm mt-2">인증 중...</p>
        </div>
      )}

      {/* 숫자 키패드 */}
      <div className="flex-1 flex items-center justify-center px-6 pb-4">
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {keys.map((key) => {
            if (key === '') return <div key="empty" />;

            if (key === 'del') {
              return (
                <button
                  key="del"
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="kiosk-btn bg-slate-700 hover:bg-slate-600 text-white h-16 rounded-xl"
                >
                  <Delete className="w-6 h-6" />
                </button>
              );
            }

            return (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={isProcessing || pin.length >= 4}
                className="kiosk-btn bg-slate-800 hover:bg-slate-700 text-white text-2xl font-semibold h-16 rounded-xl"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {/* 하단 버튼 */}
      <footer className="pb-10 px-6 flex flex-col gap-3">
        {pin.length === 4 && !isProcessing && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handleConfirm(pin)}
            className="kiosk-btn bg-sky-600 hover:bg-sky-500 text-white"
          >
            <CheckCircle2 className="w-5 h-5" />
            확인
          </motion.button>
        )}

        <button
          onClick={prevScreen}
          className="kiosk-btn bg-transparent hover:bg-slate-800 text-slate-400"
        >
          <ArrowLeft className="w-5 h-5" />
          취소
        </button>
      </footer>
    </div>
  );
}
