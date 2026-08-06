/**
 * 애플리케이션 전역 상태 관리 스토어 (Zustand)
 *
 * [역할]
 * - SPA 라우팅 상태 관리 (뷰 전환, 이력 추적)
 * - 현재 로그인 사용자 정보
 * - 시니어 접근성 설정 (글꼴, 고대비, TTS)
 * - 온보딩 완료 상태
 * - 키오스크 타임아웃 설정
 * - 학습 미션 모드 상태
 */

import { create } from 'zustand';
import type { FontSize, ViewName } from '@/lib/constants';

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
  pin: string;
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

/** 학습 시나리오 인터페이스 */
export interface ScenarioItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  category: string | null;
  orderIndex: number;
  stepsJson: string;
}

/** 학습 진행도 인터페이스 */
export interface ProgressItem {
  id: string;
  userId: string;
  scenarioId: string;
  stepIndex: number;
  completed: boolean;
  attempts: number;
  bestTimeSec: number | null;
  stars: number;
}

/** 학습 시나리오 단계 인터페이스 */
export interface ScenarioStep {
  step: number;
  title: string;
  description: string;
}

/** 애플리케이션 전역 상태 인터페이스 */
interface AppState {
  // ------------------------------------------------------------------------
  // 네비게이션 (SPA 라우팅)
  // ------------------------------------------------------------------------
  /** 현재 활성 뷰 이름 */
  currentView: ViewName;
  /** 뷰 이동 이력 (뒤로가기 기능용) */
  viewHistory: ViewName[];
  /** 뷰 전환 함수 */
  setView: (view: ViewName) => void;
  /** 이전 뷰로 돌아가기 */
  goBack: () => void;

  // ------------------------------------------------------------------------
  // 사용자 정보
  // ------------------------------------------------------------------------
  /** 현재 로그인된 시뮬레이션 사용자 */
  currentUser: SimUser | null;
  /** 현재 사용자 설정 */
  setCurrentUser: (user: SimUser | null) => void;

  // ------------------------------------------------------------------------
  // 접근성 (시니어 친화)
  // ------------------------------------------------------------------------
  /** 글꼴 크기 설정 */
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  /** 고대비 모드 활성화 여부 */
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  /** TTS (음성 읽기) 활성화 여부 */
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;

  // ------------------------------------------------------------------------
  // 온보딩
  // ------------------------------------------------------------------------
  /** 온보딩 완료 여부 */
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;

  // ------------------------------------------------------------------------
  // 키오스크 설정
  // ------------------------------------------------------------------------
  /** 키오스크 자동 종료 타임아웃 (초) */
  kioskTimeoutSeconds: number;
  setKioskTimeout: (seconds: number) => void;

  // ------------------------------------------------------------------------
  // 학습 미션 모드
  // ------------------------------------------------------------------------
  /** 미션 모드 활성화 여부 */
  isMissionMode: boolean;
  /** 현재 미션 시나리오 ID */
  currentMissionScenarioId: string | null;
  /** 현재 미션 단계 인덱스 */
  currentMissionStep: number;
  /** 미션 시나리오 및 단계 설정 */
  setMission: (scenarioId: string | null, step?: number) => void;
  /** 미션 모드 활성화/비활성화 */
  setIsMissionMode: (enabled: boolean) => void;
  /** 현재 미션 단계 완료 처리 */
  completeMissionStep: () => void;
}

// ============================================================================
// Zustand 스토어 생성
// ============================================================================

/**
 * 애플리케이션 전역 상태 스토어
 * Zustand를 사용한 경량 상태 관리
 */
export const useAppStore = create<AppState>((set, get) => ({
  // ------------------------------------------------------------------------
  // 네비게이션 초기값 및 액션
  // ------------------------------------------------------------------------
  currentView: 'onboarding',
  viewHistory: [],
  /** 새 뷰로 전환하고 이전 뷰를 이력에 저장 */
  setView: (view) =>
    set((state) => ({
      currentView: view,
      viewHistory: [...state.viewHistory, state.currentView],
    })),
  /** 이전 뷰로 돌아가기 (이력에서 마지막 항목 꺼내기) */
  goBack: () => {
    const { viewHistory } = get();
    if (viewHistory.length > 0) {
      const newHistory = [...viewHistory];
      const prevView = newHistory.pop()!;
      set({ currentView: prevView, viewHistory: newHistory });
    }
  },

  // ------------------------------------------------------------------------
  // 사용자 정보 초기값 및 액션
  // ------------------------------------------------------------------------
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // ------------------------------------------------------------------------
  // 접근성 설정 초기값 및 액션
  // ------------------------------------------------------------------------
  fontSize: 'normal',
  setFontSize: (size) => set({ fontSize: size }),
  highContrast: false,
  setHighContrast: (enabled) => set({ highContrast: enabled }),
  ttsEnabled: true,
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),

  // ------------------------------------------------------------------------
  // 온보딩 상태 초기값 및 액션
  // ------------------------------------------------------------------------
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: (completed) => set({ hasCompletedOnboarding: completed }),

  // ------------------------------------------------------------------------
  // 키오스크 설정 초기값 및 액션
  // ------------------------------------------------------------------------
  kioskTimeoutSeconds: 60,
  setKioskTimeout: (seconds) => set({ kioskTimeoutSeconds: seconds }),

  // ------------------------------------------------------------------------
  // 학습 미션 모드 초기값 및 액션
  // ------------------------------------------------------------------------
  isMissionMode: false,
  currentMissionScenarioId: null,
  currentMissionStep: 0,
  setMission: (scenarioId, step = 0) =>
    set({ currentMissionScenarioId: scenarioId, currentMissionStep: step }),
  setIsMissionMode: (enabled) => set({ isMissionMode: enabled }),
  completeMissionStep: () =>
    set((state) => ({ currentMissionStep: state.currentMissionStep + 1 })),
}));
