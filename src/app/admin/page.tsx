/**
 * 관리자 전용 진입 페이지 (/admin)
 *
 * [역할]
 * - 키오스크 화면의 톱니 버튼 없이 직접 접속 가능한 관리자 경로
 * - 모바일 소형 화면·긴급 유지보수 시 진입 보장
 * - 쿠키 세션 복구 후 인증 상태에 따라 로그인/대시보드 분기
 * - 로그아웃 후에도 /admin 로그인 화면에 머무름
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MonitorSmartphone } from 'lucide-react';
import { useAdminStore } from '@/stores/useAdminStore';
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const setAdminUser = useAdminStore((s) => s.setAdminUser);
  const [checking, setChecking] = useState(true);

  /* 쿠키 세션 복구 (새로고침·직접 접속 대응) */
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.user) {
            setAdminUser(data.user);
          }
        }
      } catch {
        // 세션 확인 실패는 무시 (로그인 화면 표시)
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [setAdminUser]);

  if (checking) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: '#0b1120' }}
        aria-busy="true"
        aria-label="관리자 세션 확인 중"
      >
        <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <AdminDashboard />;
  }

  return (
    <div>
      <AdminLogin />
      {/* 키오스크 복귀 링크 (긴급 상황에서도 키오스크 화면으로 이동) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-sky-300 transition-colors px-3 py-2 rounded-lg"
        >
          <MonitorSmartphone className="w-4 h-4" />
          키오스크 화면으로
        </Link>
      </div>
    </div>
  );
}
