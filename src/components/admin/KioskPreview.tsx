/**
 * 키오스크 라이브 프리뷰 컴포넌트
 *
 * [기능]
 * - Zustand 스토어의 screen/kioskMode 상태를 읽어 미니어처 키오스크 화면 렌더링
 * - 15개 화면 상태별 모크업 렌더링
 * - PIP(Picture-in-Picture) 스타일 플로팅 패널
 * - 드래그 가능, 닫기 버튼
 *
 * [디자인]
 * - 240x380px 포트레이트 키오스크 비율
 * - 다크 라운드 컨테이너 + 그림자 + 보더 글로우
 * - 상단 타이틀 바: "키오스크 프리뷰" + 닫기 버튼
 */

'use client';

import { useAppStore } from '@/stores/useAppStore';
import type { KioskViewName } from '@/lib/constants';
import {
  Library,
  CreditCard,
  BookOpen,
  RotateCcw,
  ScanLine,
  Lock,
  CheckCircle2,
  Clock,
  Smartphone,
  X,
} from 'lucide-react';

// ============================================================================
// Props
// ============================================================================

interface KioskPreviewProps {
  onClose: () => void;
}

// ============================================================================
// 화면 라벨 매핑
// ============================================================================

const SCREEN_LABELS: Record<KioskViewName, string> = {
  'idle': '대기 화면',
  'main-menu': '메인 메뉴',
  'card-apply': '도서증 종류 선택',
  'card-form': '개인정보 입력',
  'card-pending': '승인 대기',
  'card-complete': '발급 완료',
  'auth-scan': '카드 스캔',
  'auth-pin': 'PIN 입력',
  'loan-select': '도서 선택',
  'loan-confirm': '대출 확인',
  'loan-complete': '대출 완료',
  'return-insert': '도서 투입',
  'return-scanning': '인식 중',
  'return-confirm': '반납 확인',
  'return-complete': '반납 완료',
};

// ============================================================================
// 미니어처 화면 렌더러
// ============================================================================

function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="relative">
        <div className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', transform: 'scale(2.5)' }} />
        <Library className="w-8 h-8 text-sky-400 relative z-10" />
      </div>
      <span className="text-[10px] font-bold tracking-widest text-sky-400 animate-pulse">SMART LIBRARY</span>
      <span className="text-[8px] text-slate-500">터치하여 시작</span>
    </div>
  );
}

function MainMenuScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6" style={{ background: '#0b1120' }}>
      <span className="text-[10px] font-bold text-white tracking-wider mb-2">원하시는 서비스를 선택하세요</span>
      {/* 도서카드 발급 */}
      <div className="w-full rounded-lg flex items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2744)', border: '1px solid rgba(56,189,248,0.15)' }}>
        <CreditCard className="w-4 h-4 text-sky-400" />
        <span className="text-[9px] font-bold text-white tracking-wider">도서카드 발급</span>
      </div>
      {/* 도서 대출 */}
      <div className="w-full rounded-lg flex items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #1a3a2a, #0f2a1e)', border: '1px solid rgba(52,211,153,0.15)' }}>
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <span className="text-[9px] font-bold text-white tracking-wider">도서 대출</span>
      </div>
      {/* 도서 반납 */}
      <div className="w-full rounded-lg flex items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #4a3620, #3a2a15)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <RotateCcw className="w-4 h-4 text-amber-400" />
        <span className="text-[9px] font-bold text-white tracking-wider">도서 반납</span>
      </div>
    </div>
  );
}

function AuthScanScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="relative">
        <div className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', transform: 'scale(2.5)' }} />
        <ScanLine className="w-8 h-8 text-sky-400 relative z-10" />
      </div>
      <span className="text-[10px] font-bold text-white tracking-wider">카드를 스캔하세요</span>
      <span className="text-[8px] text-slate-500">도서카드를 스캐너에 가져대세요</span>
    </div>
  );
}

function AuthPinScreen() {
  const keys = ['1','2','3','4','5','6','7','8','9','←','0'];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-4" style={{ background: '#0b1120' }}>
      <Lock className="w-5 h-5 text-sky-400 mb-1" />
      <span className="text-[9px] font-bold text-white tracking-wider">PIN 번호 입력</span>
      {/* PIN dots */}
      <div className="flex gap-2 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="w-3 h-3 rounded-full border border-sky-400/30" style={{ background: i < 2 ? 'rgba(56,189,248,0.4)' : 'transparent' }} />
        ))}
      </div>
      {/* Number pad */}
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-[140px]">
        {keys.map((k, i) => (
          <div
            key={i}
            className="rounded-md flex items-center justify-center text-[9px] font-bold"
            style={{
              background: k === '←' ? 'rgba(30,41,59,0.6)' : 'rgba(30,41,59,0.4)',
              border: '1px solid rgba(148,163,184,0.1)',
              color: k === '←' ? '#94a3b8' : '#e2e8f0',
              minHeight: '22px',
            }}
          >
            {k}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoanSelectScreen() {
  return (
    <div className="flex flex-col h-full" style={{ background: '#0b1120' }}>
      <div className="text-center py-3">
        <BookOpen className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
        <span className="text-[9px] font-bold text-white tracking-wider">도서를 선택하세요</span>
      </div>
      <div className="flex-1 px-3 space-y-1.5 overflow-hidden">
        {['연금술사', '어린왕자', '사피엔스'].map((title, i) => (
          <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(148,163,184,0.08)' }}>
            <div className="w-4 h-5 rounded-sm bg-slate-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-medium text-white truncate">{title}</p>
              <p className="text-[7px] text-slate-500">가능</p>
            </div>
            <div className="w-3 h-3 rounded border border-emerald-400/30 bg-emerald-400/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoanConfirmScreen() {
  return (
    <div className="flex flex-col h-full" style={{ background: '#0b1120' }}>
      <div className="text-center py-3">
        <span className="text-[9px] font-bold text-white tracking-wider">대출 확인</span>
      </div>
      <div className="flex-1 px-3 space-y-1.5">
        {['연금술사', '어린왕자'].map((title, i) => (
          <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(52,211,153,0.1)' }}>
            <div className="w-4 h-5 rounded-sm bg-slate-700 shrink-0" />
            <span className="text-[8px] text-white">{title}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <div className="w-full rounded-lg py-2 text-center" style={{ background: 'linear-gradient(135deg, #1a3a2a, #0f2a1e)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <span className="text-[9px] font-bold text-white">확인</span>
        </div>
      </div>
    </div>
  );
}

function LoanCompleteScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #065f46, #047857)', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}>
        <CheckCircle2 className="w-5 h-5 text-white" />
      </div>
      <span className="text-[10px] font-bold text-emerald-400 tracking-wider">대출 완료</span>
      <span className="text-[8px] text-slate-500">2권 대출 처리됨</span>
    </div>
  );
}

function ReturnInsertScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <RotateCcw className="w-7 h-7 text-amber-400" />
      <span className="text-[10px] font-bold text-white tracking-wider">도서를 투입하세요</span>
      {/* Slot illustration */}
      <div className="w-32 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #1e293b, #0f172a)', border: '1px solid rgba(251,191,36,0.15)' }} />
      <span className="text-[8px] text-slate-500">반납구에 도서를 넣어주세요</span>
    </div>
  );
}

function ReturnScanningScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="relative">
        <ScanLine className="w-7 h-7 text-amber-400" />
        <div className="absolute inset-0 animate-ping opacity-20">
          <ScanLine className="w-7 h-7 text-amber-400" />
        </div>
      </div>
      <span className="text-[10px] font-bold text-white tracking-wider">도서 인식 중...</span>
      {/* Progress bar */}
      <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

function ReturnConfirmScreen() {
  return (
    <div className="flex flex-col h-full" style={{ background: '#0b1120' }}>
      <div className="text-center py-3">
        <span className="text-[9px] font-bold text-white tracking-wider">반납 확인</span>
      </div>
      <div className="flex-1 px-3 space-y-1.5">
        {['백년의 고독', '채식주의자'].map((title, i) => (
          <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(251,191,36,0.1)' }}>
            <div className="w-4 h-5 rounded-sm bg-slate-700 shrink-0" />
            <span className="text-[8px] text-white">{title}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <div className="w-full rounded-lg py-2 text-center" style={{ background: 'linear-gradient(135deg, #4a3620, #3a2a15)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <span className="text-[9px] font-bold text-white">반납 완료</span>
        </div>
      </div>
    </div>
  );
}

function ReturnCompleteScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #065f46, #047857)', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}>
        <CheckCircle2 className="w-5 h-5 text-white" />
      </div>
      <span className="text-[10px] font-bold text-emerald-400 tracking-wider">반납 완료</span>
      <span className="text-[8px] text-slate-500">2권 반납 처리됨</span>
    </div>
  );
}

function CardApplyScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-5" style={{ background: '#0b1120' }}>
      <span className="text-[10px] font-bold text-white tracking-wider">도서증 발급</span>
      {/* Mobile card */}
      <div className="w-full rounded-lg flex items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2744)', border: '1px solid rgba(56,189,248,0.15)' }}>
        <Smartphone className="w-4 h-4 text-sky-400" />
        <span className="text-[8px] font-bold text-white">모바일 도서증</span>
      </div>
      {/* Physical card */}
      <div className="w-full rounded-lg flex items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(135deg, #4a3620, #3a2a15)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <CreditCard className="w-4 h-4 text-amber-400" />
        <span className="text-[8px] font-bold text-white">실물 도서증</span>
      </div>
    </div>
  );
}

function CardFormScreen() {
  const fields = ['이름', '생년월일', '전화번호', '주소'];
  return (
    <div className="flex flex-col h-full" style={{ background: '#0b1120' }}>
      <div className="text-center py-2">
        <span className="text-[9px] font-bold text-white tracking-wider">개인정보 입력</span>
      </div>
      <div className="flex-1 px-4 space-y-2">
        {fields.map((field, i) => (
          <div key={i}>
            <span className="text-[7px] text-slate-500">{field}</span>
            <div className="w-full rounded-md h-5 mt-0.5" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.1)' }} />
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <div className="w-full rounded-lg py-2 text-center" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2744)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <span className="text-[9px] font-bold text-white">신청하기</span>
        </div>
      </div>
    </div>
  );
}

function CardPendingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4a3620, #3a2a15)', boxShadow: '0 0 16px rgba(251,191,36,0.15)' }}>
        <Clock className="w-5 h-5 text-amber-400" />
      </div>
      <span className="text-[9px] font-bold text-white tracking-wider">승인 대기 중</span>
      <span className="text-[8px] text-amber-300/70">담당자 승인을 기다려주세요</span>
      {/* Pulse dots */}
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function CardCompleteScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0b1120' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #065f46, #047857)', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}>
        <CheckCircle2 className="w-5 h-5 text-white" />
      </div>
      <span className="text-[10px] font-bold text-emerald-400 tracking-wider">발급 완료</span>
      {/* Card info mockup */}
      <div className="rounded-lg px-3 py-2 w-36" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(56,189,248,0.1)' }}>
        <p className="text-[7px] text-slate-500">카드 번호</p>
        <p className="text-[8px] text-white font-mono">LIB-20250XXX-XXXX</p>
      </div>
    </div>
  );
}

// ============================================================================
// 화면 라우터
// ============================================================================

function ScreenRenderer({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle':
      return <IdleScreen />;
    case 'main-menu':
      return <MainMenuScreen />;
    case 'auth-scan':
      return <AuthScanScreen />;
    case 'auth-pin':
      return <AuthPinScreen />;
    case 'loan-select':
      return <LoanSelectScreen />;
    case 'loan-confirm':
      return <LoanConfirmScreen />;
    case 'loan-complete':
      return <LoanCompleteScreen />;
    case 'return-insert':
      return <ReturnInsertScreen />;
    case 'return-scanning':
      return <ReturnScanningScreen />;
    case 'return-confirm':
      return <ReturnConfirmScreen />;
    case 'return-complete':
      return <ReturnCompleteScreen />;
    case 'card-apply':
      return <CardApplyScreen />;
    case 'card-form':
      return <CardFormScreen />;
    case 'card-pending':
      return <CardPendingScreen />;
    case 'card-complete':
      return <CardCompleteScreen />;
    default:
      return <IdleScreen />;
  }
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function KioskPreview({ onClose }: KioskPreviewProps) {
  const { screen, kioskMode } = useAppStore();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col rounded-2xl overflow-hidden select-none"
      style={{
        width: '240px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.1), 0 0 20px rgba(56,189,248,0.05)',
        background: '#0f1729',
        border: '1px solid rgba(56,189,248,0.12)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{
          background: 'linear-gradient(90deg, rgba(15,23,41,0.95), rgba(15,23,41,0.85))',
          borderBottom: '1px solid rgba(56,189,248,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <div className="size-1.5 rounded-full bg-sky-400" />
            <div className="absolute size-1.5 rounded-full bg-sky-400 animate-ping opacity-40" />
          </div>
          <span className="text-[10px] font-bold text-white tracking-wider">키오스크 프리뷰</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors rounded-sm hover:bg-white/[0.06] p-0.5"
          aria-label="프리뷰 닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status info bar */}
      <div
        className="flex items-center justify-between px-3 py-1 shrink-0"
        style={{ background: 'rgba(15,23,41,0.6)', borderBottom: '1px solid rgba(148,163,184,0.06)' }}
      >
        <span className="text-[8px] text-slate-500">{SCREEN_LABELS[screen]}</span>
        {kioskMode && (
          <span
            className="text-[7px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: kioskMode === 'loan' ? 'rgba(52,211,153,0.1)' : kioskMode === 'return' ? 'rgba(251,191,36,0.1)' : 'rgba(56,189,248,0.1)',
              color: kioskMode === 'loan' ? '#34d399' : kioskMode === 'return' ? '#fbbf24' : '#38bdf8',
              border: `1px solid ${kioskMode === 'loan' ? 'rgba(52,211,153,0.2)' : kioskMode === 'return' ? 'rgba(251,191,36,0.2)' : 'rgba(56,189,248,0.2)'}`,
            }}
          >
            {kioskMode === 'loan' ? '대출' : kioskMode === 'return' ? '반납' : '카드'}
          </span>
        )}
      </div>

      {/* Miniature kiosk screen */}
      <div
        className="relative shrink-0"
        style={{ height: '340px', background: '#0b1120' }}
      >
        <ScreenRenderer screen={screen} />
      </div>
    </div>
  );
}
