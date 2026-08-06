/**
 * PWA (Progressive Web App) 관련 훅
 *
 * [기능]
 * - 서비스 워커 등록 및 업데이트 관리
 * - PWA 설치 가능 여부 감지
 * - PWA 설치 프롬프트 표시/해제
 * - 오프라인/온라인 상태 감지
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/** PWA 설치 이벤트 인터페이스 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** PWA 훅 반환 타입 */
interface PwaState {
  /** PWA 설치 가능 여부 */
  canInstall: boolean;
  /** PWA 설치 프롬프트 표시 함수 */
  promptInstall: () => Promise<void>;
  /** 현재 오프라인 상태 여부 (서버와 항상 false로 일치) */
  isOffline: boolean;
  /** 서비스 워커 업데이트 필요 여부 */
  updateAvailable: boolean;
  /** 서비스 워커 업데이트 적용 함수 */
  applyUpdate: () => void;
}

/**
 * PWA 관련 기능을 제공하는 커스텀 훅
 * 서비스 워커 등록, 설치 프롬프트, 오프라인 감지를 관리합니다.
 *
 * [하이드레이션 안전]
 * - 모든 상태 초기값은 서버와 동일하게 false
 * - 오프라인 상태는 PwaStatus 컴포넌트에서 마운트 후 별도 감지
 */
export function usePwa(): PwaState {
  const [canInstall, setCanInstall] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const workerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    // ========================================================================
    // 서비스 워커 등록
    // ========================================================================
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] 서비스 워커 등록 성공:', registration.scope);
          workerRef.current = registration.active;

          // 서비스 워커 업데이트 감지
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] 새 버전의 서비스 워커가 설치되었습니다.');
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[PWA] 서비스 워커 등록 실패:', error);
        });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] 서비스 워커 컨트롤러 변경됨');
      });
    }

    // ========================================================================
    // PWA 설치 가능 이벤트 감지
    // ========================================================================
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      console.log('[PWA] 앱 설치 가능');
    };

    const handleAppInstalled = () => {
      setCanInstall(false);
      deferredPromptRef.current = null;
      console.log('[PWA] 앱 설치 완료');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // ========================================================================
    // 온라인/오프라인 상태 감지
    // ========================================================================
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 이벤트 리스너 정리
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * PWA 설치 프롬프트 표시
   */
  const promptInstall = useCallback(async () => {
    if (!deferredPromptRef.current) return;
    await deferredPromptRef.current.prompt();
    const result = await deferredPromptRef.current.userChoice;
    console.log('[PWA] 설치 선택:', result.outcome);
    deferredPromptRef.current = null;
    setCanInstall(false);
  }, []);

  /**
   * 서비스 워커 업데이트 적용
   */
  const applyUpdate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  return {
    canInstall,
    promptInstall,
    isOffline,
    updateAvailable,
    applyUpdate,
  };
}