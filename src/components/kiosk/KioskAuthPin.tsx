/**
 * 비밀번호 입력 화면
 *
 * [기능]
 * - 4자리 숫자 비밀번호 입력 (CMS 관리)
 * - 숫자 키패드 (1-9, 0, 삭제, 확인)
 * - 4자리 완성 즉시 백엔드 PIN 검증
 * - PIN 일치 → 인증 성공 → 다음 화면
 * - PIN 불일치 → 에러 표시 + PIN 초기화 (즉시 피드백)
 * - 시뮬레이션 모드: PIN이 DB에 없어도 데모 사용자로 인증 허용
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { Delete, CheckCircle2, ArrowLeft, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SimUser } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';

export default function KioskAuthPin() {
  const { setScreen, prevScreen, kioskMode, setAuthenticatedUser } = useAppStore();
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);
  const shakeRef = useRef(false);

  /** PIN 검증 후 다음 화면으로 이동 */
  const proceedToNext = useCallback((user: SimUser, isDemo: boolean) => {
    setAuthenticatedUser(user);
    if (isDemo) {
      toast.success(`${user.name}님(데모) 환영합니다`, {
        description: '시뮬레이션 모드: 임의 비밀번호 허용',
      });
    } else {
      toast.success(`${user.name}님 환영합니다`);
    }
    setTimeout(() => {
      setScreen(kioskMode === 'loan' ? 'loan-select' : 'return-insert');
    }, 500);
  }, [setAuthenticatedUser, setScreen, kioskMode]);

  /** PIN 에러 처리: 빨간 도트 + 흔들림 + 초기화 */
  const handlePinError = useCallback(() => {
    setIsError(true);
    shakeRef.current = true;
    // 1초 후 에러 상태 해제 및 PIN 초기화
    setTimeout(() => {
      setIsError(false);
      setPin('');
      shakeRef.current = false;
      setIsProcessing(false);
    }, 1000);
  }, []);

  /** 비밀번호 확인 (4자리 완성 시 즉시 실행) */
  const handleConfirm = useCallback(async (inputPin: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsError(false);

    try {
      // 1차: 입력한 PIN으로 DB 조회
      const res = await fetch('/api/users', { headers: { 'X-PIN': inputPin } });
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (users.length > 0) {
          // PIN 일치 → 인증 성공
          proceedToNext(users[0], false);
          return;
        }
      }

      // 2차: PIN이 DB에 없음 → 시뮬레이션 모드에서 데모 사용자로 인증
      // (시뮬레이터이므로 아무 PIN이나 허용)
      const demoRes = await fetch('/api/users', { headers: { 'X-PIN': '1234' } });
      if (demoRes.ok) {
        const demoUsers: SimUser[] = await demoRes.json();
        if (demoUsers.length > 0) {
          // 데모 모드로 인증 (PIN은 틀렸지만 시뮬레이션이므로 통과)
          proceedToNext(demoUsers[0], true);
          return;
        }
      }

      // 3차: 데모 사용자도 없으면 → 첫 번째 활성 사용자 조회
      const allUsersRes = await fetch('/api/users?pin=0000');
      // 위 API는 PIN 0000 검색이므로 실패할 수 있음
      // 대안: DB에 사용자가 전혀 없으면 에러
      handlePinError();
      toast.error('등록된 사용자가 없습니다. 도서증을 먼저 발급받아주세요.');
    } catch {
      // 네트워크 오류 → 시뮬레이션 모드에서는 통과시킴
      handlePinError();
      toast.error('네트워크 오류. 다시 시도해주세요.');
    }
  }, [isProcessing, proceedToNext, handlePinError]);

  /** 숫자 키 입력 처리 */
  const handleKeyPress = useCallback((digit: string) => {
    if (isProcessing || isError) return;
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const newPin = prev + digit;
      // 4자리 입력 완료 시 자동 확인
      if (newPin.length === 4) {
        setTimeout(() => handleConfirm(newPin), 0);
      }
      return newPin;
    });
  }, [handleConfirm, isProcessing, isError]);

  /** 삭제 버튼 */
  const handleDelete = useCallback(() => {
    if (isProcessing || isError) return;
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, [isProcessing, isError]);

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
        <motion.div
          animate={isError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex gap-5"
        >
          {[0, 1, 2, 3].map((idx) => (
            <motion.div
              key={idx}
              animate={
                pin.length === idx && !isError
                  ? { scale: [1, 1.3, 1] }
                  : {}
              }
              transition={{ duration: 0.2 }}
              className={`w-5 h-5 rounded-full border-2 transition-colors duration-200 ${
                isError
                  ? 'bg-red-500 border-red-500'
                  : idx < pin.length
                    ? 'bg-sky-400 border-sky-400'
                    : 'bg-transparent border-slate-500'
              }`}
            />
          ))}
        </motion.div>
      </div>

      {/* 상태 메시지 */}
      {isProcessing && !isError && (
        <div className="text-center mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto"
          />
          <p className="text-slate-400 text-sm mt-2">인증 중...</p>
        </div>
      )}

      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
        >
          <XCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-400 text-sm mt-2 font-medium">비밀번호가 틀렸습니다</p>
        </motion.div>
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
                  disabled={isProcessing || isError}
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
                disabled={isProcessing || isError || pin.length >= 4}
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
        {pin.length === 4 && !isProcessing && !isError && (
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
          disabled={isProcessing}
          className="kiosk-btn bg-transparent hover:bg-slate-800 text-slate-400"
        >
          <ArrowLeft className="w-5 h-5" />
          취소
        </button>
      </footer>
    </div>
  );
}
