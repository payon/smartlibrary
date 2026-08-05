/**
 * 루트 레이아웃 컴포넌트
 *
 * [역할]
 * - 전체 애플리케이션의 공통 레이아웃 구조 정의
 * - PWA 메타데이터 및 아이콘 설정
 * - 전역 토스트 알림 설정
 * - 한국어 기본 언어 설정
 *
 * [PWA 지원]
 * - Web App Manifest 링크
 * - Apple Touch Icon 설정
 * - 테마 컬러 설정
 * - 뷰포트 설정 (모바일 최적화)
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

/** PWA 테마 컬러 */
const THEME_COLOR = "#16a34a";

/** 뷰포트 설정 (모바일 최적화, PWA 호환) */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

/** SEO 및 PWA 메타데이터 */
export const metadata: Metadata = {
  title: "스마트 도서관 시뮬레이터 | SmartLib Sim",
  description: "시니어 친화적인 스마트 도서관 이용 연습 시뮬레이터. 회원가입, 도서 검색, 대출/반납 연습을 할 수 있습니다.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SmartLib",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "SmartLib",
    "application-name": "SmartLib",
    "msapplication-TileColor": THEME_COLOR,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* PWA 파비콘 및 Apple Touch Icon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        <div id="app-root" className="min-h-screen flex flex-col">
          {children}
        </div>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}