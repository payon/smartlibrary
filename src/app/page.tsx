/**
 * 키오스크 시뮬레이션 메인 페이지
 *
 * [역할]
 * - 키오스크 화면 컨테이너 (세로 모드, max-width 480px)
 * - 화면 라우팅 (store.screen 기준)
 * - 시드 데이터 초기화
 * - PWA 상태 표시
 *
 * [하이드레이션 안전]
 * - dynamic import + ssr: false 로 서버 사이드 렌더링 완전 차단
 * - 클라이언트에서만 렌더링하여 하이드레이션 불일치 원천 제거
 */

'use client';

import dynamic from 'next/dynamic';

/** SSR 없이 클라이언트에서만 마운트 (하이드레이션 오류 완전 방지) */
const KioskApp = dynamic(() => import('@/components/kiosk/KioskApp'), {
  ssr: false,
  loading: () => (
    <div className="kiosk-frame kiosk-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sky-300 text-sm">키오스크를 시작하는 중...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <KioskApp />;
}
