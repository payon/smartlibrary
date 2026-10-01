/**
 * ECO 공용 크롬 (실기기 참조, 세로형)
 *
 * [구성]
 * - EcoHeader: 상단 타이틀바 (도서대출/도서반납)
 * - EcoSteps: 단계 브레드크럼 (현재 단계 pill 강조)
 * - EcoUserPill: 이용자 + 대출가능 권수
 * - EcoTicker: 하단 날씨 + 공지 바
 */

'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useCmsText } from '@/hooks/useCmsContent';
import { MAX_LOAN_COUNT } from '@/lib/constants';
import type { LoanItem } from '@/stores/useAppStore';

// ============================================================================
// 상단 타이틀바
// ============================================================================

export function EcoHeader({ title }: { title: string }) {
  return (
    <header className="eco-header-bar px-6 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-center tracking-wider text-white">{title}</h1>
    </header>
  );
}

// ============================================================================
// 단계 브레드크럼
// ============================================================================

export const LOAN_STEPS = ['회원인증', '도서선택', '도서확인', '대출처리', '영수증발급', '처리완료'];
export const RETURN_STEPS = ['도서인식', '도서투입', '반납처리', '영수증발급', '처리완료'];

export function EcoSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav
      className="flex items-center justify-center gap-1 px-4 py-2 bg-white/70 border-b border-slate-200 overflow-x-auto"
      aria-label="진행 단계"
      aria-current={false}
    >
      {steps.map((step, idx) => (
        <span key={step} className="flex items-center gap-1 shrink-0">
          <span className={`eco-step-pill ${idx === current ? 'eco-step-pill-active' : ''}`}>
            {step}
          </span>
          {idx < steps.length - 1 && (
            <span className="text-slate-300 text-xs" aria-hidden="true">
              ▸
            </span>
          )}
        </span>
      ))}
      <span className="sr-only">현재 단계: {steps[current]}</span>
    </nav>
  );
}

// ============================================================================
// 이용자 pill (대출가능 권수 표시)
// ============================================================================

export function EcoUserPill() {
  const authenticatedUser = useAppStore((s) => s.authenticatedUser);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!authenticatedUser) {
      setRemaining(null);
      return;
    }
    fetch(`/api/loans?userId=${authenticatedUser.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((loans: LoanItem[]) => {
        const active = loans.filter((l) => l.status === 'active').length;
        setRemaining(Math.max(0, MAX_LOAN_COUNT - active));
      })
      .catch(() => {});
  }, [authenticatedUser]);

  if (!authenticatedUser) return null;

  return (
    <div className="px-6 pt-3">
      <div className="eco-user-pill flex items-center gap-2 px-4 py-2">
        <span className="w-7 h-7 rounded-full bg-violet-400 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-white" />
        </span>
        <p className="text-sm text-slate-700 truncate">
          <span className="font-semibold">{authenticatedUser.name}님</span>
          {remaining !== null && (
            <span className="text-slate-500">, 대출 가능 권수: {remaining}권</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 하단 티커 (날씨 + 공지)
// ============================================================================

export function EcoTicker() {
  const weather = useCmsText('ticker.weather', '맑음/13.0℃');
  const notice = useCmsText('ticker.notice', '24시간 도서 대출/반납이 가능한 스마트도서관입니다.');
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="eco-ticker-bar flex items-center gap-3 px-4 py-2.5">
      <span className="text-sm text-slate-600 shrink-0" aria-label={`날씨 ${weather}`}>
        🌙 {weather}
      </span>
      <span className="text-xs font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 shrink-0">
        공지
      </span>
      <p className="text-sm text-slate-700 truncate flex-1">{notice}</p>
      {time && (
        <span className="text-xs text-slate-500 font-mono shrink-0">{time}</span>
      )}
    </div>
  );
}
