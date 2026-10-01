/**
 * 비밀번호 입력 화면
 *
 * [기능]
 * - 4자리 숫자 비밀번호 입력 (CMS 관리)
 * - 숫자 키패드 (1-9, 0, 삭제, 확인)
 * - 4자리 완성 + 확인 버튼 → PIN 검증
 * - PIN 일치 → 인증 성공 → 다음 화면
 * - PIN 불일치 → 에러 표시 "PIN 번호가 일치하지 않습니다" + PIN 초기화
 * - 서버 검증: GET /api/users + X-PIN 헤더 (실패 시 절대 자동 로그인하지 않음)
 * - 카드 모드: kioskMode === 'card' → card-apply
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { Delete, CheckCircle2, ArrowLeft, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { speak } from '@/lib/tts';
import type { SimUser } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskAuthPin() {
  const authPinTitle = useCmsText('authpin.title', '비밀번호 입력');
  const theme = useScreenTheme('auth-pin');
  useKioskSpeak(`${authPinTitle}. 4자리 비밀번호를 입력해주세요.`);
  const { setScreen, prevScreen, kioskMode, authenticatedUser, setAuthenticatedUser } = useAppStore();
  const flowTitle = kioskMode === 'return' ? '도서반납' : '도서대출';
  const flowSteps = kioskMode === 'return' ? RETURN_STEPS : LOAN_STEPS;
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);
  const shakeRef = useRef(false);

  /** kioskMode에 따른 다음 화면 결정 (대출은 선택 후 인증→확인) */
  const getNextScreen = useCallback(() => {
    switch (kioskMode) {
      case 'loan': return 'loan-confirm' as const;
      case 'return': return 'return-insert' as const;
      case 'card': return 'card-apply' as const;
      default: return 'loan-confirm' as const;
    }
  }, [kioskMode]);

  /** PIN 검증 성공 → 이전 플로우 잔여 상태는 유지하고 다음 화면 이동 */
  const proceedToNext = useCallback((user: SimUser) => {
    setAuthenticatedUser(user);
    toast.success(`${user.name}님 환영합니다`);
    setTimeout(() => {
      setScreen(getNextScreen());
    }, 500);
  }, [setAuthenticatedUser, setScreen, getNextScreen]);

  /** PIN 에러 처리: 빨간 도트 + 흔들림 + 음성 안내 + 초기화 */
  const handlePinError = useCallback(() => {
    setIsError(true);
    shakeRef.current = true;
    if (useAppStore.getState().ttsEnabled) {
      speak('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
    }
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
          proceedToNext(authenticatedUser);
          return;
        }
        // PIN 불일치
        handlePinError();
        toast.error('PIN 번호가 일치하지 않습니다');
        return;
      }

      // ── 2차: 서버 검증 (X-PIN 헤더로 PIN 조회) ──
      const res = await fetch('/api/users', { headers: { 'X-PIN': pin } });
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (authenticatedUser) {
          // authenticatedUser가 있으면 id 매칭 (서버가 이미 PIN 매칭함)
          if (users.length > 0 && users[0].id === authenticatedUser.id) {
            proceedToNext({ ...users[0], pin });
            return;
          }
        } else if (users.length > 0) {
          // authenticatedUser가 없으면 서버 검증 성공 시 첫 번째 사용자를 인증 사용자로
          proceedToNext({ ...users[0], pin });
          return;
        }
      }
      // 검증 실패 — 절대 자동 로그인하지 않음
      handlePinError();
      toast.error('PIN 번호가 일치하지 않습니다');
      return;
    } catch {
      handlePinError();
      toast.error('인증 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
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

  /** 연습용 비밀번호 자동 입력 (시뮬레이터 데모 계정) */
  const demoPin = useCmsText('authscan.demo_pin', '1234');
  const handleDemoFill = useCallback(() => {
    if (isProcessing || isError) return;
    if (/^\d{4}$/.test(demoPin)) {
      setPin(demoPin);
      toast.success('연습용 비밀번호가 입력되었습니다', {
        description: '확인 버튼을 눌러 계속하세요.',
      });
    }
  }, [isProcessing, isError, demoPin]);

  /** 숫자 키패드 구성 */
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title={flowTitle} />
      {kioskMode !== 'card' && <EcoSteps steps={flowSteps} current={0} />}
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="authpin.title" fallback="비밀번호 입력" />
        </h1>
        <p className="text-slate-600 text-sm mt-1 text-center">
          4자리 비밀번호를 입력해주세요
        </p>
        <button
          onClick={handleDemoFill}
          disabled={isProcessing || isError}
          className="mt-3 w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-700 disabled:opacity-40"
          aria-label={`연습용 비밀번호 ${demoPin} 자동 입력`}
        >
          💡 연습용입니다 — 비밀번호 {demoPin} 자동 입력
        </button>
      </header>

      {/* PIN 도트 표시 영역 (스크린리더 입력 상태 안내) */}
      <div className="px-6 pt-4">
      <div className="eco-card px-6 py-6">
      <div
        className="flex justify-center py-4"
        role="status"
        aria-live="polite"
        aria-label={`비밀번호 ${pin.length}자리 입력됨`}
      >
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
          <p className="text-slate-600 text-sm mt-2">인증 중...</p>
        </div>
      )}

      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
          role="alert"
        >
          <XCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-400 text-sm mt-2 font-medium">PIN 번호가 일치하지 않습니다</p>
        </motion.div>
      )}

      {/* 숫자 키패드 */}
      <div className="flex items-center justify-center px-2 pb-2">
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {keys.map((key) => {
            if (key === '') return <div key="empty" />;

            if (key === 'del') {
              return (
                <button
                  key="del"
                  onClick={handleDelete}
                  disabled={isProcessing || isError}
                  aria-label="마지막 숫자 지우기"
                  className="eco-btn-secondary h-16 rounded-xl text-2xl"
                >
                  <Delete className="w-6 h-6" aria-hidden="true" />
                </button>
              );
            }

            return (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={isProcessing || isError || pin.length >= 4}
                aria-label={`숫자 ${key} 입력`}
                className="eco-btn-secondary h-16 rounded-xl text-2xl font-semibold"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
      </div>
      </div>

      {/* 하단 버튼 */}
      <footer className="pb-10 px-6 flex flex-col gap-3">
        {pin.length === 4 && !isProcessing && !isError && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleConfirm}
            className="eco-btn-primary w-full"
          >
            <CheckCircle2 className="w-5 h-5" />
            확인
          </motion.button>
        )}

        <button
          onClick={prevScreen}
          disabled={isProcessing}
          className="eco-btn-secondary w-full"
        >
          <ArrowLeft className="w-5 h-5" />
          취소
        </button>
      </footer>
      <EcoTicker />
    </div>
  );
}
