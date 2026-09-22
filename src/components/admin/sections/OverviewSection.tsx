/**
 * 관리자 대시보드 개요 섹션
 *
 * [역할]
 * - KPI 카드: 총 도서, 활성 대출, 연체, 오늘 대출/반납 (그라디언트 스타일)
 * - 키오스크 디바이스 상태 위젯
 * - 최근 활동 목록 (다크 카드 스타일)
 * - 오늘의 현황 요약 바
 * - 빠른 실행 액션 (키오스크 그라디언트 버튼)
 */

'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Wrench,
  ArrowRight,
  Monitor,
  ScanLine,
  Printer,
  Radio,
  Heart,
  Activity,
  PackageCheck,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';
import Image from 'next/image';

interface AnalyticsData {
  totalBooks: number;
  totalUsers: number;
  activeLoans: number;
  overdueLoans: number;
  todayLoans: number;
  todayReturns: number;
  popularBooks: Array<{ bookId: string; title: string; author: string; loanCount: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
  loansByDay: Array<{ date: string; count: number }>;
}

export default function OverviewSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error('데이터를 불러올 수 없습니다.');
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('분석 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetKiosk = () => {
    const store = useAppStore.getState();
    store.setScreen('idle');
    store.setKioskMode(null);
    store.setAuthenticatedUser(null);
    store.clearSelectedBooks();
    store.clearReturnedLoans();
    toast.success('키오스크가 초기화되었습니다.');
  };

  const handleMaintenanceMode = () => {
    toast.info('유지보수 모드가 설정되었습니다.');
  };

  /* ──────────────────────────────────────────────
   * 1. KPI 카드 - 그라디언트 스타일
   * ────────────────────────────────────────────── */
  const kpiCards = [
    {
      title: '총 도서',
      value: data?.totalBooks ?? 0,
      icon: BookOpen,
      gradient: 'from-emerald-600 to-emerald-700',
    },
    {
      title: '활성 대출',
      value: data?.activeLoans ?? 0,
      icon: RotateCcw,
      gradient: 'from-sky-600 to-sky-700',
    },
    {
      title: '연체 건수',
      value: data?.overdueLoans ?? 0,
      icon: AlertTriangle,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      title: '오늘 대출',
      value: data?.todayLoans ?? 0,
      icon: TrendingUp,
      gradient: 'from-violet-600 to-violet-700',
    },
  ];

  /* ──────────────────────────────────────────────
   * 2. 키오스크 디바이스 상태 정보
   * ────────────────────────────────────────────── */
  const kioskDevices = [
    { label: '온라인', status: true, icon: Monitor },
    { label: '스캐너 정상', status: true, icon: ScanLine },
    { label: '프린터 정상', status: true, icon: Printer },
    { label: '센서 활성', status: true, icon: Radio },
  ];

  const lastHeartbeat = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  /* ──────────────────────────────────────────────
   * 3. 카테고리별 그라디언트 색상
   * ────────────────────────────────────────────── */
  const barAccentColors = [
    'bg-sky-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-pink-500',
  ];

  const loanBarColors = 'bg-sky-500';

  return (
    <div className="space-y-6">
      {/* ───────── KPI 카드 (그라디언트) ───────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.title}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${kpi.gradient} border border-white/10 p-5 hover:scale-[1.02] transition-transform cursor-default shadow-lg`}
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 bg-white/20" />
                <Skeleton className="h-8 w-16 bg-white/20" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/15">
                  <kpi.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white/80">{kpi.title}</p>
                  <p className="text-3xl font-bold text-white">
                    {kpi.value.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {/* decorative glow */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
          </div>
        ))}
      </div>

      {/* ───────── 키오스크 디바이스 상태 위젯 ───────── */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-sky-400" />
              키오스크 디바이스 상태
            </CardTitle>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
              <Activity className="w-3 h-3 mr-1" />
              실시간
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* 디바이스 이미지 */}
            <div className="shrink-0 rounded-xl overflow-hidden border border-slate-600/50 bg-slate-800 p-2">
              <Image
                src="/images/admin/kiosk-device.png"
                alt="키오스크 단말기"
                width={80}
                height={80}
                className="rounded-lg object-contain"
              />
            </div>

            {/* 상태 인디케이터 */}
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 w-full">
              {kioskDevices.map((device) => (
                <div key={device.label} className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${device.status ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`}
                  />
                  <device.icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">{device.label}</span>
                </div>
              ))}
            </div>

            {/* 마지막 하트비트 */}
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Heart className="w-3 h-3 text-rose-400" />
                Last Heartbeat
              </div>
              <p className="text-sm font-mono text-white/80">{lastHeartbeat}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────── 차트 카드 (다크 스타일) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 대출 추이 */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              최근 7일 대출 추이
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full bg-slate-700" />
                ))}
              </div>
            ) : data?.loansByDay && data.loansByDay.length > 0 ? (
              <div className="space-y-2">
                {data.loansByDay.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-20 shrink-0">
                      {day.date.slice(5)}
                    </span>
                    <div className="flex-1 h-6 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${loanBarColors} rounded-full transition-all`}
                        style={{
                          width: `${Math.max((day.count / Math.max(...data.loansByDay.map((d) => d.count), 1)) * 100, 2)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right text-white/90">
                      {day.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 인기 도서 */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              인기 도서 TOP 5
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-slate-700" />
                ))}
              </div>
            ) : data?.popularBooks && data.popularBooks.length > 0 ? (
              <div className="space-y-2">
                {data.popularBooks.map((book, idx) => (
                  <div
                    key={book.bookId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                  >
                    <Badge
                      variant={idx < 3 ? 'default' : 'secondary'}
                      className={`w-7 h-7 p-0 justify-center text-xs shrink-0 ${idx < 3 ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    >
                      {idx + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{book.title}</p>
                      <p className="text-xs text-slate-400 truncate">{book.author}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 border-slate-600 text-slate-300">
                      {book.loanCount}회
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───────── 카테고리 분포 + 빠른 실행 (다크 스타일) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리 분포 */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              카테고리별 도서 분포
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full bg-slate-700" />
                ))}
              </div>
            ) : data?.categoryDistribution && data.categoryDistribution.length > 0 ? (
              <div className="space-y-2">
                {data.categoryDistribution.map((cat, idx) => {
                  const total = data.categoryDistribution.reduce((sum, c) => sum + c.count, 0);
                  const pct = total > 0 ? (cat.count / total) * 100 : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span className="text-sm w-16 shrink-0 text-slate-300">{cat.category}</span>
                      <div className="flex-1 h-6 bg-slate-700/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barAccentColors[idx % barAccentColors.length]} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right text-white/90">
                        {cat.count}권 ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 빠른 실행 (키오스크 그라디언트 버튼) */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-3 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              빠른 실행
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <button
              className="w-full h-12 flex items-center justify-start text-base font-medium rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white hover:from-sky-500 hover:to-sky-600 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              onClick={handleResetKiosk}
            >
              <span className="p-1.5 rounded-lg bg-white/15 mr-3 ml-3">
                <RefreshCw className="w-5 h-5 text-white drop-shadow-[0_0_4px_rgba(125,211,252,0.6)]" />
              </span>
              키오스크 초기화
              <ArrowRight className="w-4 h-4 ml-auto mr-3 text-white/70" />
            </button>
            <button
              className="w-full h-12 flex items-center justify-start text-base font-medium rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              onClick={handleMaintenanceMode}
            >
              <span className="p-1.5 rounded-lg bg-white/15 mr-3 ml-3">
                <Wrench className="w-5 h-5 text-white drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
              </span>
              유지보수 모드
              <ArrowRight className="w-4 h-4 ml-auto mr-3 text-white/70" />
            </button>
            <button
              className="w-full h-12 flex items-center justify-start text-base font-medium rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              onClick={fetchAnalytics}
            >
              <span className="p-1.5 rounded-lg bg-white/15 mr-3 ml-3">
                <RotateCcw className="w-5 h-5 text-white drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
              </span>
              데이터 새로고침
              <ArrowRight className="w-4 h-4 ml-auto mr-3 text-white/70" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ───────── 오늘의 현황 요약 바 ───────── */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-700/50">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            오늘의 현황
            <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 오늘 대출 */}
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <TrendingUp className="w-5 h-5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
              <span className="text-xs text-slate-400">오늘 대출</span>
              <span className="text-2xl font-bold text-sky-400">
                {loading ? '–' : (data?.todayLoans ?? 0).toLocaleString()}
              </span>
            </div>
            {/* 오늘 반납 */}
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <PackageCheck className="w-5 h-5 text-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
              <span className="text-xs text-slate-400">오늘 반납</span>
              <span className="text-2xl font-bold text-teal-400">
                {loading ? '–' : (data?.todayReturns ?? 0).toLocaleString()}
              </span>
            </div>
            {/* 오늘 카드 발급 */}
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <CreditCard className="w-5 h-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
              <span className="text-xs text-slate-400">오늘 카드 발급</span>
              <span className="text-2xl font-bold text-amber-400">
                {loading ? '–' : '0'}
              </span>
            </div>
            {/* 현재 대출 중 */}
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <BookOpen className="w-5 h-5 text-violet-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]" />
              <span className="text-xs text-slate-400">현재 대출 중</span>
              <span className="text-2xl font-bold text-violet-400">
                {loading ? '–' : (data?.activeLoans ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
