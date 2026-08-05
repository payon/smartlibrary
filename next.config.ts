/**
 * Next.js 설정 파일
 *
 * [PWA 지원]
 * - 서비스 워커 캐시 방지 설정
 *
 * [보안 설정]
 * - poweredByHeader: 서버 정보 노출 방지
 * - 모든 응답에 보안 HTTP 헤더 자동 적용
 * - OWASP/KISA 권장 보안 헤더 포함
 *
 * [빌드 설정]
 * - output: standalone (Docker/배포 최적화)
 * - reactStrictMode: false (모션 애니메이션 중복 실행 방지)
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 독립형 출력 (Docker 배포 최적화) */
  output: "standalone",

  /** 서버 정보 노출 방지 (X-Powered-By 헤더 제거) */
  poweredByHeader: false,

  /** 타입스크립트 빌드 오류 무시 (개발 편의) */
  typescript: {
    ignoreBuildErrors: true,
  },

  /** 리액트 Strict Mode 비활성화 (모션 라이브러리와 호환성) */
  reactStrictMode: false,

  /** 보안 및 PWA 관련 HTTP 헤더 설정 */
  async headers() {
    return [
      // ====================================================================
      // 서비스 워커 파일 (캐시하지 않음 - 항상 최신 버전 로드)
      // ====================================================================
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      // ====================================================================
      // PWA 매니페스트 파일 (1시간 캐시)
      // ====================================================================
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
      // ====================================================================
      // 아이콘 파일 (1년 장기 캐시, 파일명 변경 시 무효화)
      // ====================================================================
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // ====================================================================
      // TWA Digital Asset Links (캐시 금지, CORS 허용)
      // ====================================================================
      {
        source: "/.well-known/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      // ====================================================================
      // 모든 응답에 보안 헤더 적용 (OWASP/KISA 권장)
      // ====================================================================
      {
        source: "/:path*",
        headers: [
          /** 콘텐츠 보안 정책 (XSS, 데이터 삽입, 클릭재킹 방지) */
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          /** 클릭재킹 방지 */
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          /** MIME 스니핑 방지 */
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          /** 리퍼러 정보 유출 방지 */
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          /** 브라우저 기능 접근 제한 */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          /** 레거시 XSS 필터 */
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          /** HTTPS 강제 사용 */
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          /** 크로스 도메인 정책 제한 */
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          /** 크로스 도메인 윈도우 열기 보호 */
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          /** 크로스 도메인 리소스 로딩 제한 */
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
