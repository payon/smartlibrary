/**
 * 메인 페이지 컴포넌트
 *
 * [역할]
 * - 전체 애플리케이션의 뷰 라우팅 (SPA 방식)
 * - 시니어 접근성 설정 (글꼴 크기, 고대비 모드)
 * - 시드 데이터 초기화
 * - PWA 상태 표시 (오프라인, 업데이트, 설치)
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import OnboardingView from '@/components/OnboardingView';
import HomeView from '@/components/HomeView';
import SettingsView from '@/components/SettingsView';
import RegistrationView from '@/components/RegistrationView';
import CardIssuanceView from '@/components/CardIssuanceView';
import BookSearchView from '@/components/BookSearchView';
import CounterLoanView from '@/components/CounterLoanView';
import CounterReturnView from '@/components/CounterReturnView';
import KioskLoanView from '@/components/KioskLoanView';
import KioskReturnView from '@/components/KioskReturnView';
import LearningProgressView from '@/components/LearningProgressView';
import CompletionView from '@/components/CompletionView';
import PwaStatus from '@/components/PwaStatus';

/**
 * 홈 페이지 컴포넌트
 * 애플리케이션의 진입점으로, 현재 뷰 상태에 따라 컴포넌트를 렌더링합니다.
 */
export default function Home() {
  // Zustand 스토어에서 상태 가져오기
  const { currentView, fontSize, highContrast, hasCompletedOnboarding, setView } = useAppStore();

  // 시드 데이터 초기화 중복 실행 방지용 ref
  const seededRef = useRef(false);

  // 글꼴 크기에 따른 CSS 클래스 매핑
  const fontClass = fontSize === 'large' ? 'font-large' : fontSize === 'xlarge' ? 'font-xlarge' : '';

  // ========================================================================
  // 초기화: 시드 데이터 로드
  // ========================================================================
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    fetch('/api/seed', { method: 'POST' }).catch(() => {
      // 시드 오류는 무시 (이미 데이터가 있을 수 있음)
    });
  }, []);

  // ========================================================================
  // 온보딩 완료 상태 확인
  // ========================================================================
  useEffect(() => {
    if (currentView === 'onboarding' && hasCompletedOnboarding) {
      setView('home');
    }
  }, [currentView, hasCompletedOnboarding, setView]);

  /**
   * 현재 뷰 상태에 따라 렌더링할 컴포넌트를 반환합니다.
   * SPA 라우팅 패턴으로, URL 변경 없이 화면을 전환합니다.
   */
  const renderView = () => {
    switch (currentView) {
      case 'onboarding':
        return <OnboardingView />;
      case 'home':
        return <HomeView />;
      case 'settings':
        return <SettingsView />;
      case 'registration':
        return <RegistrationView />;
      case 'card-issuance':
        return <CardIssuanceView />;
      case 'book-search':
        return <BookSearchView />;
      case 'counter-loan':
        return <CounterLoanView />;
      case 'counter-return':
        return <CounterReturnView />;
      case 'kiosk-loan':
        return <KioskLoanView />;
      case 'kiosk-return':
        return <KioskReturnView />;
      case 'learning-progress':
        return <LearningProgressView />;
      case 'completion':
        return <CompletionView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div
      id="app-content"
      className={cn(fontClass, highContrast && 'high-contrast', 'min-h-screen bg-background')}
    >
      {/* 현재 뷰 렌더링 */}
      {renderView()}

      {/* PWA 상태 표시 (오프라인, 업데이트, 설치) */}
      <PwaStatus />
    </div>
  );
}
