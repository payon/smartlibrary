/**
 * 스마트 도서관 시뮬레이터 - 서비스 워커 (PWA 오프라인 지원)
 * 
 * [캐싱 전략]
 * - 정적 에셋 (아이콘, 폰트, _next/static): Cache First
 * - API 요청 (/api/*): Network First (오프라인 시 캐시)
 * - HTML 페이지: Stale While Revalidate
 * 
 * [버전 관리]
 * CACHE_NAME 버전을 변경하면 이전 캐시가 자동으로 정리됩니다.
 */

// 캐시 버전 - 빌드 시마다 업데이트하여 이전 캐시 무효화
const CACHE_NAME = 'smartlib-sim-v2';

// 사전 캐싱할 정적 에셋 목록 (서비스 워커 설치 시 캐시)
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-1024.png',
  '/icons/icon-180.png',
  '/icons/favicon-32.png',
  '/icons/maskable-icon-192.png',
  '/icons/maskable-icon-512.png',
];

// 정적 에셋 매칭 패턴 (Cache First 전략 적용)
const STATIC_PATTERNS = [
  /\/icons\//,
  /\/screenshots\//,
  /\/_next\/static\//,
  /\/\.well-known\//,
  /\/offline\.html$/,
];

// API 요청 매칭 패턴 (Network First 전략 적용)
const API_PATTERN = /\/api\//;

/**
 * 설치 이벤트 핸들러
 * 서비스 워커가 처음 설치될 때 실행됩니다.
 * 중요한 정적 에셋을 사전 캐싱합니다.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 사전 캐싱 시작');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] 사전 캐싱 중 일부 실패 (무시 가능):', err);
      })
  );
});

/**
 * 활성화 이벤트 핸들러
 * 서비스 워커가 새 버전으로 교체될 때 실행됩니다.
 * 이전 버전의 캐시를 정리합니다.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] 이전 캐시 삭제:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * 요청이 정적 에셋 패턴에 매칭되는지 확인합니다.
 * @param {string} url - 요청 URL
 * @returns {boolean} 정적 에셋 여부
 */
function isStaticAsset(url) {
  return STATIC_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Cache First 전략
 * 캐시에 있으면 캐시에서 반환, 없으면 네트워크에서 가져와 캐시에 저장.
 * 정적 에셋(아이콘, 폰트, 번들 파일 등)에 적합합니다.
 * @param {FetchEvent} event - fetch 이벤트
 */
async function cacheFirstStrategy(event) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(event.request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(event.request);
    // 성공적인 응답만 캐시에 저장 (HTTP 상태 코드 200)
    if (networkResponse.ok) {
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // 네트워크 실패 시 오프라인 폴백 반환
    return new Response('오프라인 상태입니다. 네트워크 연결을 확인해주세요.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * Network First 전략
 * 네트워크에서 먼저 시도하고, 실패 시 캐시에서 반환.
 * API 요청 등 최신 데이터가 필요한 경우에 적합합니다.
 * @param {FetchEvent} event - fetch 이벤트
 */
async function networkFirstStrategy(event) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(event.request);
    // 성공적인 응답을 캐시에 업데이트
    if (networkResponse.ok) {
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // 네트워크 실패 시 캐시에서 반환
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // 캐시에도 없으면 오프라인 응답 반환
    return new Response(
      JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결 후 다시 시도해주세요.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

/**
 * Stale While Revalidate 전략
 * 캐시에서 즉시 반환하면서 백그라운드에서 네트워크에서 업데이트.
 * HTML 페이지 등 사용자 경험을 빠르게 하면서 최신 데이터 유지에 적합합니다.
 * 캐시도 없고 네트워크도 실패하면 /offline.html 폴백을 반환합니다.
 * @param {FetchEvent} event - fetch 이벤트
 */
async function staleWhileRevalidateStrategy(event) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(event.request);

  // 네비게이션 요청은 네트워크 우선으로 시도 (최신 HTML 보장)
  if (event.request.mode === 'navigate') {
    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // 네트워크 실패 시 캐시 → 오프라인 페이지 순으로 폴백
      if (cachedResponse) return cachedResponse;
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) return offlinePage;
      return new Response('오프라인 상태입니다. 네트워크 연결을 확인해주세요.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  // 정적/기타 GET 요청: 캐시 즉시 반환 + 백그라운드 업데이트
  // 백그라운드에서 네트워크 업데이트 (실패해도 무시)
  const fetchPromise = fetch(event.request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // 네트워크 실패는 무시 (캐시된 버전 사용)
      return undefined;
    });

  // 캐시에 있으면 즉시 반환, 없으면 네트워크 응답 대기
  if (cachedResponse) {
    // 백그라운드 업데이트는 fire-and-forget (await 하지 않음)
    if (fetchPromise && typeof fetchPromise.catch === 'function') {
      fetchPromise.catch(() => {});
    }
    return cachedResponse;
  }
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;
  // 둘 다 실패하면 오프라인 텍스트 폴백 (절대 undefined 반환 금지)
  return new Response('오프라인 상태입니다. 네트워크 연결을 확인해주세요.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * fetch 이벤트 핸들러
 * 모든 네트워크 요청을 가로채서 적절한 캐싱 전략을 적용합니다.
 * - GET 요청만 캐싱 (POST, PUT, DELETE 등은 캐시하지 않음)
 * - 내부 요청(non-http)은 패스
 */
self.addEventListener('fetch', (event) => {
  // GET 요청이 아닌 경우 캐싱하지 않고 통과
  if (event.request.method !== 'GET') {
    return;
  }

  // 내부 요청 (non-HTTP) 패스
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const url = event.request.url;

  // 전략 분기
  if (isStaticAsset(url)) {
    // 정적 에셋: Cache First
    event.respondWith(cacheFirstStrategy(event));
  } else if (API_PATTERN.test(url)) {
    // API 요청: Network First
    event.respondWith(networkFirstStrategy(event));
  } else {
    // HTML 페이지 등: Stale While Revalidate
    event.respondWith(staleWhileRevalidateStrategy(event));
  }
});

/**
 * 메시지 이벤트 핸들러
 * 클라이언트와 서비스 워커 간 통신을 처리합니다.
 * - 'SKIP_WAITING': 새 서비스 워커 즉시 활성화
 * - 'GET_CACHE_SIZE': 현재 캐시 크기 반환
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME).then((cache) => {
      return cache.keys().then((keys) => {
        // 클라이언트에 캐시 크기 전송
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'CACHE_SIZE',
              size: keys.length,
            });
          });
        });
      });
    });
  }
});
