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
  /** 반납 대출 초기화 */
  clearReturnedLoans: () => void;

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
  'main-menu': 'idle',
  'card-apply': 'main-menu',
  'card-form': 'card-apply',
  'card-pending': 'card-form',
  'card-complete': 'idle',
  'auth-scan': 'main-menu',
  'auth-pin': 'auth-scan',
  'loan-select': 'auth-pin',
  'loan-confirm': 'loan-select',
  'loan-complete': 'idle',
  'return-insert': 'main-menu',
  'return-scanning': 'return-insert',
  'return-confirm': 'return-scanning',
  'return-complete': 'idle',
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
  screen: 'idle',
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

}));

/**
 * 사전 정의된 이전 화면 매핑 (컴포넌트에서 직접 사용)
 */
export { PREV_SCREEN_MAP };
