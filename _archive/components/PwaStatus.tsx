/**
 * PWA 상태 표시 컴포넌트
 *
 * [역할]
 * - PWA 설치 버튼 표시
 * - 서비스 워커 업데이트 알림
 * - 오프라인 상태 표시
 *
 * [하이드레이션 안전]
 * - useSyncExternalStore로 클라이언트 마운트 여부 감지
 * - 서버에서는 false, 클라이언트에서 true를 반환하여 불일치 방지
 */

'use client';

import { useSyncExternalStore } from 'react';
import { usePwa } from '@/hooks/use-pwa';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** 구독 함수 (빈 함수 - 상태 변경 없음) */
const emptySubscribe = () => () => {};

/** 클라이언트 스냅샷 (항상 true) */
const getSnapshot = () => true;

/** 서버 스냅샷 (항상 false) */
const getServerSnapshot = () => false;

/**
 * PWA 관련 상태 표시 컴포넌트
 * 마운트 전에는 빈 프래그먼트를 반환하여 하이드레이션 불일치를 방지합니다.
 */
export default function PwaStatus() {
  const { canInstall, promptInstall, isOffline, updateAvailable, applyUpdate } = usePwa();

  /** 클라이언트에서만 true, 서버에서는 false (하이드레이션 안전) */
  const isClient = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  // 서버에서는 아무것도 렌더링하지 않음
  if (!isClient) {
    return null;
  }

  /** 업데이트 적용 버튼 클릭 핸들러 */
  const handleUpdate = () => {
    toast.info('새 버전으로 업데이트 중...');
    applyUpdate();
  };

  /** PWA 설치 버튼 클릭 핸들러 */
  const handleInstall = async () => {
    try {
      await promptInstall();
      toast.success('스마트 도서관 앱이 설치되었습니다!');
    } catch {
      // 사용자가 설치를 취소한 경우
      toast.info('앱 설치가 취소되었습니다.');
    }
  };

  return (
    <>
      {/* 오프라인 상태 배너 */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <WifiOff className="h-5 w-5 shrink-0" />
          <span>오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.</span>
        </div>
      )}

      {/* 업데이트 알림 배너 */}
      {updateAvailable && !isOffline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <RefreshCw className="h-5 w-5 shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
          <span className="text-sm font-medium whitespace-nowrap">새 버전이 있습니다</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpdate}
            className="shrink-0"
          >
            업데이트
          </Button>
        </div>
      )}

      {/* PWA 설치 버튼 (설치 가능하고 온라인일 때만 표시) */}
      {canInstall && !isOffline && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleInstall}
            className="rounded-full shadow-xl h-14 w-14 p-0 flex items-center justify-center"
            title="앱 설치하기"
          >
            <Download className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  );
}
