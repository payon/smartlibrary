/**
 * PWA 상태 표시 컴포넌트
 *
 * [역할]
 * - PWA 설치 버튼 표시
 * - 서비스 워커 업데이트 알림
 * - 오프라인 상태 표시
 * - TWA (Trusted Web Activity) 모드 감지
 */

'use client';

import { usePwa } from '@/hooks/use-pwa';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * PWA 관련 상태 표시 컴포넌트
 * 오프라인 배너, 업데이트 알림, 설치 버튼을 표시합니다.
 */
export default function PwaStatus() {
  const { canInstall, promptInstall, isOffline, updateAvailable, applyUpdate } = usePwa();

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
