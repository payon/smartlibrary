/**
 * 루트 레이아웃 컴포넌트
 *
 * [역할]
 * - 전체 애플리케이션의 공통 레이아웃 구조 정의
 * - PWA 메타데이터 및 아이콘 설정
 * - 전역 토스트 알림 설정
 * - 한국어 기본 언어 설정
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import PwaStatus from "@/components/PwaStatus";

/** PWA 테마 컬러 */
const THEME_COLOR = "#0f172a";

/** 뷰포트 설정 (키오스크 세로 모드, 노치/홈인디케이터 대응) */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
  colorScheme: "dark",
};

/** SEO 및 PWA 메타데이터 */
export const metadata: Metadata = {
  title: "SMART LIBRARY | 무인 도서 대출 반납기",
  description: "무인 도서 대출 반납기 시뮬레이터. 회원증 스캔과 비밀번호 입력으로 도서를 대출하고 반납할 수 있습니다.",
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
    statusBarStyle: "black-translucent",
    title: "SMART LIBRARY",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "SMART LIBRARY",
    "application-name": "SMART LIBRARY",
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
      <body className="antialiased bg-[#0f172a] text-foreground font-sans overflow-hidden">
        <div id="app-root" className="h-screen w-screen overflow-hidden">
          {children}
        </div>
        <PwaStatus />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
