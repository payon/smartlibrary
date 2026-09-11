/**
 * 분석 대시보드 섹션
 *
 * [역할]
 * - 날짜 범위 선택 (7일/30일/90일)
 * - 대출 추이 차트 (Recharts LineChart)
 * - 카테고리 분포 (Recharts PieChart)
 * - 인기 도서 순위 (BarChart)
 * - 통계 카드
 */

'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { BookOpen, Users, RotateCcw, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const statsCards = [
    { title: '총 도서', value: data?.totalBooks ?? 0, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: '등록 이용자', value: data?.totalUsers ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: '활성 대출', value: data?.activeLoans ?? 0, icon: RotateCcw, color: 'text-violet-600', bg: 'bg-violet-50' },
    { title: '연체 건수', value: data?.overdueLoans ?? 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      {/* 날짜 범위 탭 + 새로고침 */}
      <div className="flex items-center justify-between">
        <Tabs defaultValue="7days">
          <TabsList>
            <TabsTrigger value="7days">최근 7일</TabsTrigger>
            <TabsTrigger value="30days">최근 30일</TabsTrigger>
            <TabsTrigger value="90days">최근 90일</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={fetchAnalytics}>
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="shadow-sm">
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 대출 추이 라인 차트 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">일별 대출 추이</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : data?.loansByDay && data.loansByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.loansByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v) => v}
                    formatter={(value: number) => [`${value}건`, '대출']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 카테고리 분포 파이 차트 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">카테고리별 도서 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
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
                    formatter={(value: number, name: string) => [`${value}권`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 인기 도서 바 차트 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">인기 도서 대출 순위</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : data?.popularBooks && data.popularBooks.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={data.popularBooks}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="title"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}회`, '대출']}
                />
                <Bar dataKey="loanCount" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 오늘/이번주/이번달 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">오늘 대출</p>
            <p className="text-3xl font-bold text-emerald-600">{data?.todayLoans ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">오늘 반납</p>
            <p className="text-3xl font-bold text-blue-600">{data?.todayReturns ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">연체 건수</p>
            <p className="text-3xl font-bold text-amber-600">{data?.overdueLoans ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
