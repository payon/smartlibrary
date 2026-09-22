/**
 * 관리자 로그인 폼 컴포넌트
 *
 * [역할]
 * - 이메일 + 비밀번호 입력
 * - 로그인 API 호출
 * - 성공 시 Zustand 스토어 업데이트
 * - 에러 메시지 표시
 *
 * [디자인]
 * - 키오스크 아이들 스크린 스타일 다크 네이비 배경
 * - 도서관 배경 이미지 오버레이
 * - 글래스모피즘 로그인 카드
 * - 스카이블루 글로우 라이브러리 아이콘
 * - SMART LIBRARY 브랜딩
 */

'use client';

import { useState } from 'react';
import { Loader2, LogIn, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminStore } from '@/stores/useAdminStore';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setAdminUser = useAdminStore((s) => s.setAdminUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        return;
      }

      // Zustand 스토어 업데이트
      setAdminUser(data.user);
      toast.success(`환영합니다, ${data.user.name}님!`);
    } catch {
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#0b1120' }}
    >
      {/* 도서관 배경 이미지 오버레이 */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
        style={{ backgroundImage: "url('/images/admin/library-bg.png')" }}
      />

      {/* 다크 그라데이션 오버레이 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(14,165,233,0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(11,17,32,0.4) 0%, rgba(11,17,32,0.8) 100%)',
        }}
      />

      {/* 상단 장식 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* 브랜딩 영역 */}
        <div className="text-center mb-8">
          {/* 라이브러리 아이콘 - 스카이블루 글로우 + 펄스 */}
          <div className="relative mx-auto w-20 h-20 mb-5">
            {/* 글로우 효과 */}
            <div
              className="absolute inset-0 rounded-2xl animate-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%)',
                transform: 'scale(1.5)',
              }}
            />
            <div className="relative w-full h-full rounded-2xl flex items-center justify-center border border-sky-400/20"
              style={{ backgroundColor: 'rgba(14,165,233,0.1)' }}
            >
              <Library className="w-10 h-10 text-sky-400" />
            </div>
          </div>

          {/* SMART LIBRARY 브랜딩 텍스트 */}
          <h1 className="text-2xl font-bold tracking-widest text-white mb-1.5">
            SMART LIBRARY
          </h1>
          <p className="text-sm text-slate-400 tracking-wide">
            스마트 도서관 관리 시스템
          </p>
        </div>

        {/* 글래스모피즘 로그인 카드 */}
        <div
          className="rounded-2xl p-8 border border-white/[0.08]"
          style={{
            background: 'rgba(15,23,41,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-white">관리자 로그인</h2>
            <p className="text-sm text-slate-400 mt-1">관리자 계정으로 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@library.go.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-sky-400/20"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-sky-400/20"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg border p-3"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.2)',
                }}
              >
                <p className="text-sm text-red-400 font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-sky-500 hover:bg-sky-400 text-white border-0 shadow-lg shadow-sky-500/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  로그인 중...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  로그인
                </>
              )}
            </Button>
          </form>

          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-6 p-3 rounded-lg border border-white/[0.06]"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <p className="font-medium mb-1 text-xs text-slate-400">테스트 계정 안내</p>
              <p className="text-xs text-slate-500">이메일: superadmin@library.go.kr</p>
              <p className="text-xs text-slate-500">비밀번호: admin1234</p>
            </div>
          )}
        </div>

        {/* 하단 장식 */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600 tracking-wider">
            © SMART LIBRARY KIOSK SYSTEM
          </p>
        </div>
      </div>

      {/* 하단 장식 라인 */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
    </div>
  );
}
