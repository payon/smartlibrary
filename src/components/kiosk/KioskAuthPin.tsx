/**
 * 비밀번호 입력 화면
 *
 * [기능]
 * - 4자리 숫자 비밀번호 입력 (CMS 관리)
 * - 숫자 키패드 (1-9, 0, 삭제, 확인)
 * - 4자리 완성 + 확인 버튼 → PIN 검증
 * - PIN 일치 → 인증 성공 → 다음 화면
 * - PIN 불일치 → 에러 표시 "PIN 번호가 일치하지 않습니다" + PIN 초기화
 * - 시뮬레이션 모드: authenticatedUser가 없으면 아무 4자리 PIN 허용
 * - 카드 모드: kioskMode === 'card' → card-apply
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
  const { setScreen, prevScreen, kioskMode, authenticatedUser, setAuthenticatedUser } = useAppStore();
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);
  const shakeRef = useRef(false);

  /** kioskMode에 따른 다음 화면 결정 */
  const getNextScreen = useCallback(() => {
    switch (kioskMode) {
      case 'loan': return 'loan-select' as const;
      case 'return': return 'return-insert' as const;
      case 'card': return 'card-apply' as const;
      default: return 'loan-select' as const;
    }
  }, [kioskMode]);

  /** PIN 검증 성공 → 다음 화면 이동 */
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
      setScreen(getNextScreen());
    }, 500);
  }, [setAuthenticatedUser, setScreen, getNextScreen]);

  /** PIN 에러 처리: 빨간 도트 + 흔들림 + 초기화 */
  const handlePinError = useCallback(() => {
    setIsError(true);
    shakeRef.current = true;
    setTimeout(() => {
      setIsError(false);
      setPin('');
      shakeRef.current = false;
      setIsProcessing(false);
    }, 1000);
  }, []);

  /** 비밀번호 확인 버튼 클릭 */
  const handleConfirm = useCallback(async () => {
    if (pin.length !== 4 || isProcessing) return;
    setIsProcessing(true);
    setIsError(false);

    try {
      // ── 1차: authenticatedUser가 있고 pin이 있으면 직접 비교 ──
      if (authenticatedUser && authenticatedUser.pin) {
        if (pin === authenticatedUser.pin) {
          proceedToNext(authenticatedUser, false);
          return;
        }
        // PIN 불일치
        handlePinError();
        toast.error('PIN 번호가 일치하지 않습니다');
        return;
      }

      // ── 2차: authenticatedUser가 있지만 pin이 없으면 API로 조회 ──
      if (authenticatedUser) {
        const res = await fetch('/api/users', { headers: { 'X-PIN': pin } });
        if (res.ok) {
          const users: SimUser[] = await res.json();
          // 응답에서 PIN이 제거되므로 id로 매칭
          if (users.length > 0 && users[0].id === authenticatedUser.id) {
            proceedToNext({ ...users[0], pin: pin }, false);
            return;
          }
        }
        // PIN 불일치
        handlePinError();
        toast.error('PIN 번호가 일치하지 않습니다');
        return;
      }

      // ── 3차: authenticatedUser가 없음 → 데모/시뮬레이션 모드 ──
      // 임의의 4자리 PIN을 허용 (시뮬레이터)
      // DB에서 첫 번째 활성 사용자를 데모 사용자로 사용
      const demoRes = await fetch('/api/users', { headers: { 'X-PIN': pin } });
      if (demoRes.ok) {
        const users: SimUser[] = await demoRes.json();
        if (users.length > 0) {
          proceedToNext({ ...users[0], pin }, false);
          return;
        }
      }

      // PIN으로 사용자를 찾을 수 없어도 데모 모드에서는 통과
      // 가상의 데모 사용자 생성
      const demoUser: SimUser = {
        id: 'demo-user',
        name: '데모 이용자',
        birthDate: '20000101',
        phone: '01000000000',
        address: '',
        cardType: 'mobile',
        cardNumber: 'LIB-DEMO-0000',
        cardIssued: new Date().toISOString().split('T')[0],
        isActive: true,
        createdAt: new Date().toISOString(),
        pin,
      };
      proceedToNext(demoUser, true);
    } catch {
      // 네트워크 오류 → 데모 모드에서는 통과시킴
      const demoUser: SimUser = {
        id: 'demo-user',
        name: '데모 이용자',
        birthDate: '20000101',
        phone: '01000000000',
        address: '',
        cardType: 'mobile',
        cardNumber: 'LIB-DEMO-0000',
        cardIssued: new Date().toISOString().split('T')[0],
        isActive: true,
        createdAt: new Date().toISOString(),
        pin,
      };
      proceedToNext(demoUser, true);
    }
  }, [pin, isProcessing, authenticatedUser, proceedToNext, handlePinError]);

  /** 숫자 키 입력 처리 */
  const handleKeyPress = useCallback((digit: string) => {
    if (isProcessing || isError) return;
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + digit;
    });
  }, [isProcessing, isError]);

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
          <p className="text-red-400 text-sm mt-2 font-medium">PIN 번호가 일치하지 않습니다</p>
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
            onClick={handleConfirm}
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
