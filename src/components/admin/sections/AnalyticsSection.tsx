/**
 * 분석 대시보드 섹션
 *
 * [역할]
 * - 날짜 범위 선택 (7일/30일/90일)
 * - 대출 추이 차트 (Recharts LineChart)
 * - 카테고리 분포 (Recharts PieChart)
 * - 인기 도서 순위 (BarChart)
 * - 통계 카드
 *
 * [Enhanced]
 * - 키오스크 다크 테마 (bg-slate-900 카드, bg-slate-800 테이블)
 * - Stats 카드: 그라디언트 스타일 (emerald/sky/violet/amber)
 * - Chart 카드: 다크 bg + white text + sky-blue underline accent
 * - Kiosk accent colors for chart: sky-500, emerald-500, amber-500, violet-500, rose-500, teal-500
 * - 날짜 범위 탭: kiosk-style with sky-blue active
 * - Analytics hero 이미지 배너 (full width, 100px, gradient overlay)
 * - Summary 카드: 다크 bg with accent color numbers
 * - 섹션 헤더: sky-blue gradient underline accent
 */

'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { BookOpen, Users, RotateCcw, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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

/* Kiosk accent colors for charts */
const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316'];
const CHART_LINE_COLOR = '#0ea5e9';
const CHART_BAR_COLOR = '#0ea5e9';

/* Custom dark tooltip style */
const darkTooltipStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

export default function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('분석 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /* Stats cards with gradient style (like OverviewSection) */
  const statsCards = [
    { title: '총 도서', value: data?.totalBooks ?? 0, icon: BookOpen, gradient: 'from-emerald-600 to-emerald-700' },
    { title: '등록 이용자', value: data?.totalUsers ?? 0, icon: Users, gradient: 'from-sky-600 to-sky-700' },
    { title: '활성 대출', value: data?.activeLoans ?? 0, icon: RotateCcw, gradient: 'from-violet-600 to-violet-700' },
    { title: '연체 건수', value: data?.overdueLoans ?? 0, icon: TrendingUp, gradient: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* ──────── Section Header with sky-blue gradient underline ──────── */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          분석 대시보드
          <span className="block w-16 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent rounded-full" />
        </h2>
      </div>

      {/* ──────── Analytics Hero Banner ──────── */}
      <div className="relative w-full h-[100px] rounded-xl overflow-hidden border border-slate-700">
        <Image
          src="/images/admin/analytics-hero.png"
          alt="분석 대시보드 배너"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-lg font-bold text-white">데이터 인사이트</p>
            <p className="text-sm text-slate-300">키오스크 이용 현황을 실시간으로 분석합니다</p>
          </div>
        </div>
      </div>

      {/* ──────── 날짜 범위 탭 + 새로고침 (Kiosk-style) ──────── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg">
          {['7days', '30days', '90days'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                dateRange === range
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {range === '7days' ? '최근 7일' : range === '30days' ? '최근 30일' : '최근 90일'}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAnalytics}
          className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          새로고침
        </Button>
      </div>

      {/* ──────── Stats Cards (Gradient Style) ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div
            key={stat.title}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${stat.gradient} border border-white/10 p-5 hover:scale-[1.02] transition-transform cursor-default shadow-lg`}
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 bg-white/20" />
                <Skeleton className="h-8 w-16 bg-white/20" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/15">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white/80">{stat.title}</p>
                  <p className="text-3xl font-bold text-white">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {/* decorative glow */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
          </div>
        ))}
      </div>

      {/* ──────── Chart Cards (Dark Style) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 대출 추이 라인 차트 */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              일별 대출 추이
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full bg-slate-800" />
            ) : data?.loansByDay && data.loansByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.loansByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#475569' }}
                  />
                  <Tooltip
                    contentStyle={darkTooltipStyle}
                    labelFormatter={(v) => v}
                    formatter={(value: number) => [`${value}건`, '대출']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_LINE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CHART_LINE_COLOR }}
                    activeDot={{ r: 6, fill: CHART_LINE_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 카테고리 분포 파이 차트 */}
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-700/50">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              카테고리별 도서 분포
              <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full bg-slate-800" />
            ) : data?.categoryDistribution && data.categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.categoryDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={darkTooltipStyle}
                    formatter={(value: number, name: string) => [`${value}권`, name]}
                  />
                  <Legend
                    wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 인기 도서 바 차트 */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
        <CardHeader className="pb-2 border-b border-slate-700/50">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            인기 도서 대출 순위
            <span className="block w-8 h-0.5 bg-sky-500 rounded-full" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-[250px] w-full bg-slate-800" />
          ) : data?.popularBooks && data.popularBooks.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={data.popularBooks}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} axisLine={{ stroke: '#475569' }} />
                <YAxis
                  type="category"
                  dataKey="title"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={120}
                  axisLine={{ stroke: '#475569' }}
                />
                <Tooltip
                  contentStyle={darkTooltipStyle}
                  formatter={(value: number) => [`${value}회`, '대출']}
                />
                <Bar dataKey="loanCount" fill={CHART_BAR_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-12">데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* ──────── Summary Cards (Dark bg + accent numbers) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardContent className="p-4 text-center">
            {loading ? (
              <Skeleton className="h-12 w-full bg-slate-800" />
            ) : (
              <>
                <p className="text-sm text-slate-400">오늘 대출</p>
                <p className="text-3xl font-bold text-emerald-400">{data?.todayLoans ?? 0}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardContent className="p-4 text-center">
            {loading ? (
              <Skeleton className="h-12 w-full bg-slate-800" />
            ) : (
              <>
                <p className="text-sm text-slate-400">오늘 반납</p>
                <p className="text-3xl font-bold text-sky-400">{data?.todayReturns ?? 0}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardContent className="p-4 text-center">
            {loading ? (
              <Skeleton className="h-12 w-full bg-slate-800" />
            ) : (
              <>
                <p className="text-sm text-slate-400">연체 건수</p>
                <p className="text-3xl font-bold text-amber-400">{data?.overdueLoans ?? 0}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
