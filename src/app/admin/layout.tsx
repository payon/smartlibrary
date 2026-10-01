import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 | SMART LIBRARY",
  description: "스마트 도서관 키오스크 관리자 대시보드",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
