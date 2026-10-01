/**
 * 키오스크 전역 상태 관리 스토어 (Zustand)
 *
 * [역할]
 * - 키오스크 화면 전환 (SPA 라우팅)
 * - 인증된 사용자 정보
 * - 대출/반납 도서 선택 상태
 * - 키오스크 모드 (대출/반납)
 * - 센서 시뮬레이션 상태
 * - 자동 타임아웃 관리
 */

import { create } from 'zustand';
import type { KioskViewName, KioskMode } from '@/lib/constants';
import { setTtsEnabled as setTtsModuleEnabled, setDefaultVolume } from '@/lib/tts';

// ============================================================================
// 배리어프리 설정 영속화 (localStorage)
// ============================================================================

function readStored<T extends string | boolean>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    if (typeof fallback === 'boolean') return (raw === '1') as T;
    return raw as T;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string | boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  } catch {
    // 저장 실패 무시 (시크릿 모드 등)
  }
}
import { MAX_LOAN_COUNT } from '@/lib/constants';

// ============================================================================
// 인터페이스 정의
// ============================================================================

/** 시뮬레이션 사용자 정보 인터페이스 */
export interface SimUser {
  id: string;
  name: string;
  birthDate: string;
  phone: string;
  address: string;
  cardType: string;
  cardNumber: string;
  cardIssued: string;
  isActive: boolean;
  createdAt: string;
  pin?: string;
}

/** 도서 정보 인터페이스 */
export interface BookItem {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishYear: number;
  category: string;
  shelfLocation: string;
  totalCopies: number;
  availableCopies: number;
  coverUrl: string | null;
}

/** 카드 발급 신청 인터페이스 */
export interface CardApplication {
  applicantName: string;
  birthDate: string;
  phone: string;
  address: string;
  cardType: 'mobile' | 'physical';
}

/** 카드 발급 API 응답 인터페이스 */
export interface CardApplicationResult {
  cardId: string | null;
  cardNumber: string | null;
  pin: string | null;
  userId: string | null;
}

/** 대출 기록 인터페이스 */
export interface LoanItem {
  id: string;
  userId: string;
  bookId: string;
  loanDate: string;
  dueDate: string;
  returnDate: string | null;
  status: string;
  method: string;
  extended: boolean;
  book?: BookItem;
}

/** 반납 결과 요약 인터페이스 (영수증 표시용) */
export interface ReturnSummaryItem {
  title: string;
  author: string;
  loanDate: string;
  dueDate: string;
  returnDate: string;
  overdueDays: number;
  blockDays: number;
  blockUntil: string | null;
}

/** 반납 결과 요약 */
export interface ReturnSummary {
  returnedAt: string;
  userName: string;
  cardNumber: string;
  phoneMasked: string;
  items: ReturnSummaryItem[];
}

/** 키오스크 전역 상태 인터페이스 */
interface KioskState {
  // ------------------------------------------------------------------------
  // 화면 상태
  // ------------------------------------------------------------------------
  /** 현재 키오스크 화면 */
  screen: KioskViewName;
  /** 화면 전환 */
  setScreen: (screen: KioskViewName) => void;
  /** 이전 화면으로 이동 */
  prevScreen: () => void;

  // ------------------------------------------------------------------------
  // 키오스크 모드
  // ------------------------------------------------------------------------
  /** 현재 키오스크 모드 (대출/반납/카드) */
  kioskMode: KioskMode;
  /** 키오스크 모드 설정 */
  setKioskMode: (mode: KioskMode) => void;

  // ------------------------------------------------------------------------
  // 인증된 사용자
  // ------------------------------------------------------------------------
  /** 인증된 사용자 정보 */
  authenticatedUser: SimUser | null;
  /** 인증된 사용자 설정 */
  setAuthenticatedUser: (user: SimUser | null) => void;

  // ------------------------------------------------------------------------
  // 카드 발급 신청
  // ------------------------------------------------------------------------
  /** 카드 발급 신청 데이터 */
  cardApplication: CardApplication | null;
  /** 카드 발급 신청 설정 */
  setCardApplication: (app: CardApplication | null) => void;
  /** 카드 발급 API 결과 (PIN, 카드번호 등) */
  cardResult: CardApplicationResult | null;
  /** 카드 발급 API 결과 설정 */
  setCardResult: (result: CardApplicationResult | null) => void;

  // ------------------------------------------------------------------------
  // 대출 선택 도서
  // ------------------------------------------------------------------------
  /** 대출 선택된 도서 목록 */
  selectedBooks: BookItem[];
  /** 도서 추가 */
  addBook: (book: BookItem) => void;
  /** 도서 제거 */
  removeBook: (bookId: string) => void;
  /** 선택 도서 초기화 */
  clearSelectedBooks: () => void;

  // ------------------------------------------------------------------------
  // 반납 인식 대출
  // ------------------------------------------------------------------------
  /** 반납할 대출 기록 목록 */
  returnedLoans: LoanItem[];
  /** 반납 대출 추가 */
  addReturnedLoan: (loan: LoanItem) => void;
  /** 반납 대출 제거 */
  removeReturnedLoan: (loanId: string) => void;
  /** 반납 대출 초기화 */
  clearReturnedLoans: () => void;

  // ------------------------------------------------------------------------
  // 반납 결과 요약 (영수증 표시용)
  // ------------------------------------------------------------------------
  /** 최근 반납 결과 요약 (없으면 null) */
  lastReturnSummary: ReturnSummary | null;
  /** 반납 결과 요약 설정 */
  setLastReturnSummary: (summary: ReturnSummary | null) => void;

  // ------------------------------------------------------------------------
  // 대출 수령 큐 + 영수증 출력 여부 (ECO 흐름)
  // ------------------------------------------------------------------------
  /** 수령 대기 도서 (제목/저자) */
  dispenseQueue: Array<{ title: string; author: string }>;
  /** 수령 큐 설정 */
  setDispenseQueue: (queue: Array<{ title: string; author: string }>) => void;
  /** 영수증 출력 여부 (기본 true) */
  receiptPrint: boolean;
  /** 영수증 출력 여부 설정 */
  setReceiptPrint: (print: boolean) => void;

  // ------------------------------------------------------------------------
  // 센서 상태 (시뮬레이션)
  // ------------------------------------------------------------------------
  /** 센서 활성화 여부 */
  sensorActive: boolean;
  /** 센서 상태 설정 */
  setSensorActive: (active: boolean) => void;

  // ------------------------------------------------------------------------
  // 관리자 모드
  // ------------------------------------------------------------------------
  /** 관리자 모드 활성화 여부 */
  adminMode: boolean;
  /** 관리자 모드 설정 */
  setAdminMode: (mode: boolean) => void;

  // ------------------------------------------------------------------------
  // CMS 콘텐츠
  // ------------------------------------------------------------------------
  /** CMS 콘텐츠 key→value 맵 */
  cmsContent: Record<string, string>;
  /** CMS 콘텐츠 버전 번호 */
  cmsVersion: number;
  /** CMS 콘텐츠 설정 */
  setCmsContent: (content: Record<string, string>, version: number) => void;

  // ------------------------------------------------------------------------
  // 배리어프리 설정 (TTS / 글자 크기 / 고대비)
  // ------------------------------------------------------------------------
  /** 음성 안내 활성화 여부 (기본 ON, PRD F-012) */
  ttsEnabled: boolean;
  /** 음성 안내 설정 */
  setTtsEnabled: (enabled: boolean) => void;
  /** 글자 크기 (normal | large | xlarge) */
  fontSize: 'normal' | 'large' | 'xlarge';
  /** 글자 크기 설정 */
  setFontSize: (size: 'normal' | 'large' | 'xlarge') => void;
  /** 고대비 모드 여부 */
  highContrast: boolean;
  /** 고대비 모드 설정 */
  setHighContrast: (enabled: boolean) => void;

  // ------------------------------------------------------------------------
  // 키오스크 하드웨어 설정 (관리자 KioskConfig → 공개 API로 동기화)
  // ------------------------------------------------------------------------
  /** 음성 안내 음량 (0~100, 기본 80) */
  volume: number;
  /** 음량 설정 */
  setVolume: (volume: number) => void;
  /** 화면 밝기 (%, 기본 100) */
  brightness: number;
  /** 화면 밝기 설정 */
  setBrightness: (brightness: number) => void;
  /** 유휴 자동복귀 시간 (초, 기본 120) */
  idleTimeoutSec: number;
  /** 유휴 시간 설정 */
  setIdleTimeoutSec: (sec: number) => void;

  // ------------------------------------------------------------------------
  // 스토어 리셋
  // ------------------------------------------------------------------------
  /** 전체 스토어 초기화 (유휴 로그아웃용) */
  resetStore: () => void;

  // ------------------------------------------------------------------------
  // 관리자 모드
  // ------------------------------------------------------------------------
}

// ============================================================================
// 화면 이력 관리 (이전 화면으로 돌아가기용)
// ============================================================================

/** 화면 이력 스택 */
const screenHistory: KioskViewName[] = [];

/** 이전 화면 매핑 */
const PREV_SCREEN_MAP: Partial<Record<KioskViewName, KioskViewName>> = {
  'main-menu': 'miryang-main',
  'signup-guide': 'card-apply',
  'card-apply': 'main-menu',
  'card-form': 'card-apply',
  'card-pending': 'card-form',
  'card-complete': 'miryang-main',
  'auth-scan': 'main-menu',
  'auth-pin': 'auth-scan',
  'loan-select': 'auth-pin',
  'loan-confirm': 'loan-select',
  'loan-dispense': 'loan-confirm',
  'loan-complete': 'miryang-main',
  'loan-history': 'main-menu',
  'receipt': 'loan-confirm',
  'return-insert': 'main-menu',
  'return-scanning': 'return-insert',
  'return-confirm': 'return-scanning',
  'return-complete': 'miryang-main',
};

// ============================================================================
// Zustand 스토어 생성
// ============================================================================

/**
 * 키오스크 전역 상태 스토어
 * Zustand를 사용한 경량 상태 관리
 */
export const useAppStore = create<KioskState>((set, get) => ({
  // ------------------------------------------------------------------------
  // 화면 상태 초기값 및 액션
  // ------------------------------------------------------------------------
  screen: 'miryang-main',
  /** 화면 전환 (이력에 현재 화면을 저장) — 타임아웃은 각 화면에서 useEffect로 관리 */
  setScreen: (newScreen) => {
    const current = get().screen;
    screenHistory.push(current);
    // 이력이 너무 길어지면 앞부분 제거
    if (screenHistory.length > 20) screenHistory.shift();
    set({ screen: newScreen });
  },
  /** 이전 화면으로 이동 */
  prevScreen: () => {
    if (screenHistory.length > 0) {
      const prev = screenHistory.pop()!;
      set({ screen: prev });
    }
  },

  // ------------------------------------------------------------------------
  // 키오스크 모드 초기값 및 액션
  // ------------------------------------------------------------------------
  kioskMode: null,
  setKioskMode: (mode) => set({ kioskMode: mode }),

  // ------------------------------------------------------------------------
  // 인증된 사용자 초기값 및 액션
  // ------------------------------------------------------------------------
  authenticatedUser: null,
  setAuthenticatedUser: (user) => set({ authenticatedUser: user }),

  // ------------------------------------------------------------------------
  // 카드 발급 신청 초기값 및 액션
  // ------------------------------------------------------------------------
  cardApplication: null,
  setCardApplication: (app) => set({ cardApplication: app }),
  cardResult: null,
  setCardResult: (result) => set({ cardResult: result }),

  // ------------------------------------------------------------------------
  // 대출 선택 도서 초기값 및 액션
  // ------------------------------------------------------------------------
  selectedBooks: [],
  addBook: (book) =>
    set((state) => {
      // 이미 선택된 도서인지 확인
      if (state.selectedBooks.some((b) => b.id === book.id)) return state;
      // 최대 대출 권수 초과 방지
      if (state.selectedBooks.length >= MAX_LOAN_COUNT) return state;
      return { selectedBooks: [...state.selectedBooks, book] };
    }),
  removeBook: (bookId) =>
    set((state) => ({
      selectedBooks: state.selectedBooks.filter((b) => b.id !== bookId),
    })),
  clearSelectedBooks: () => set({ selectedBooks: [] }),

  // ------------------------------------------------------------------------
  // 반납 대출 기록 초기값 및 액션
  // ------------------------------------------------------------------------
  returnedLoans: [],
  addReturnedLoan: (loan) =>
    set((state) => {
      if (state.returnedLoans.some((l) => l.id === loan.id)) return state;
      return { returnedLoans: [...state.returnedLoans, loan] };
    }),
  clearReturnedLoans: () => set({ returnedLoans: [] }),
  removeReturnedLoan: (loanId) =>
    set((state) => ({
      returnedLoans: state.returnedLoans.filter((l) => l.id !== loanId),
    })),
  lastReturnSummary: null,
  setLastReturnSummary: (summary) => set({ lastReturnSummary: summary }),
  dispenseQueue: [],
  setDispenseQueue: (queue) => set({ dispenseQueue: queue }),
  receiptPrint: true,
  setReceiptPrint: (print) => set({ receiptPrint: print }),

  // ------------------------------------------------------------------------
  // 센서 상태 초기값 및 액션
  // ------------------------------------------------------------------------
  sensorActive: false,
  setSensorActive: (active) => set({ sensorActive: active }),

  // ------------------------------------------------------------------------
  // 관리자 모드 초기값 및 액션
  // ------------------------------------------------------------------------
  adminMode: false,
  setAdminMode: (mode) => set({ adminMode: mode }),

  // ------------------------------------------------------------------------
  // CMS 콘텐츠 초기값 및 액션
  // ------------------------------------------------------------------------
  cmsContent: {},
  cmsVersion: 0,
  setCmsContent: (content, version) => set({ cmsContent: content, cmsVersion: version }),

  // ------------------------------------------------------------------------
  // 배리어프리 설정 초기값 및 액션 (localStorage 영속화)
  // ------------------------------------------------------------------------
  ttsEnabled: true,
  setTtsEnabled: (enabled) => {
    setTtsModuleEnabled(enabled);
    writeStored('a11y.tts', enabled);
    set({ ttsEnabled: enabled });
  },
  fontSize: 'normal',
  setFontSize: (size) => {
    writeStored('a11y.fontSize', size);
    set({ fontSize: size });
  },
  highContrast: false,
  setHighContrast: (enabled) => {
    writeStored('a11y.highContrast', enabled);
    set({ highContrast: enabled });
  },

  // ------------------------------------------------------------------------
  // 키오스크 하드웨어 설정 초기값 및 액션 (서버값 우선, 로컬 저장 안 함)
  // ------------------------------------------------------------------------
  volume: 80,
  setVolume: (volume) => {
    const v = Math.min(100, Math.max(0, Math.round(volume)));
    setDefaultVolume(v / 100);
    set({ volume: v });
  },
  brightness: 100,
  setBrightness: (brightness) => {
    const b = Math.min(100, Math.max(10, Math.round(brightness)));
    set({ brightness: b });
  },
  idleTimeoutSec: 120,
  setIdleTimeoutSec: (sec) => {
    const s = Math.min(600, Math.max(30, Math.round(sec)));
    set({ idleTimeoutSec: s });
  },

  // ------------------------------------------------------------------------
  // 스토어 리셋
  // ------------------------------------------------------------------------
    resetStore: () => {
    screenHistory.length = 0;
    set({
      screen: 'miryang-main',
      kioskMode: null,
      authenticatedUser: null,
      cardApplication: null,
      cardResult: null,
      selectedBooks: [],
      returnedLoans: [],
      lastReturnSummary: null,
      dispenseQueue: [],
      receiptPrint: true,
      sensorActive: false,
    });
  },

}));

/**
 * 스토어 생성 후 저장된 배리어프리 설정을 복원합니다.
 * (클라이언트에서 최초 1회 호출)
 */
let a11yHydrated = false;
export function hydrateA11ySettings(): void {
  if (a11yHydrated || typeof window === 'undefined') return;
  a11yHydrated = true;
  const tts = readStored('a11y.tts', true);
  const fontSize = readStored<'normal' | 'large' | 'xlarge'>('a11y.fontSize', 'normal');
  const highContrast = readStored('a11y.highContrast', false);
  setTtsModuleEnabled(tts);
  useAppStore.setState({
    ttsEnabled: tts,
    fontSize: fontSize === 'large' || fontSize === 'xlarge' ? fontSize : 'normal',
    highContrast,
  });
}

/**
 * 사전 정의된 이전 화면 매핑 (컴포넌트에서 직접 사용)
 */
export { PREV_SCREEN_MAP };
