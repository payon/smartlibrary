/**
 * 관리자 대시보드 개요 섹션
 *
 * [역할]
 * - KPI 카드: 총 도서, 활성 대출, 연체, 오늘 대출/반납
 * - 최근 활동 목록
 * - 빠른 실행 액션
 */

'use client';

import { useEffect, useState } from 'react';
import { BookOpen, RotateCcw, AlertTriangle, TrendingUp, RefreshCw, Wrench, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/useAppStore';
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

  const kpiCards = [
    {
      title: '총 도서',
      value: data?.totalBooks ?? 0,
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: '활성 대출',
      value: data?.activeLoans ?? 0,
      icon: RotateCcw,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: '연체 건수',
      value: data?.overdueLoans ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: '오늘 대출',
      value: data?.todayLoans ?? 0,
      icon: TrendingUp,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="shadow-sm">
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-bold">{kpi.value.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 대출 추이 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">최근 7일 대출 추이</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : data?.loansByDay && data.loansByDay.length > 0 ? (
              <div className="space-y-2">
                {data.loansByDay.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {day.date.slice(5)}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all"
                        style={{
                          width: `${Math.max((day.count / Math.max(...data.loansByDay.map((d) => d.count), 1)) * 100, 2)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right">{day.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 인기 도서 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">인기 도서 TOP 5</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : data?.popularBooks && data.popularBooks.length > 0 ? (
              <div className="space-y-2">
                {data.popularBooks.map((book, idx) => (
                  <div key={book.bookId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Badge variant={idx < 3 ? 'default' : 'secondary'} className="w-7 h-7 p-0 justify-center text-xs shrink-0">
                      {idx + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {book.loanCount}회
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리 분포 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">카테고리별 도서 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : data?.categoryDistribution && data.categoryDistribution.length > 0 ? (
              <div className="space-y-2">
                {data.categoryDistribution.map((cat) => {
                  const total = data.categoryDistribution.reduce((sum, c) => sum + c.count, 0);
                  const pct = total > 0 ? (cat.count / total) * 100 : 0;
                  return (
                    <div key={cat.category} className="flex items-center gap-3">
                      <span className="text-sm w-16 shrink-0">{cat.category}</span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {cat.count}권 ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 빠른 실행 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">빠른 실행</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 justify-start text-base"
              onClick={handleResetKiosk}
            >
              <RefreshCw className="w-5 h-5 mr-3" />
              키오스크 초기화
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 justify-start text-base"
              onClick={handleMaintenanceMode}
            >
              <Wrench className="w-5 h-5 mr-3" />
              유지보수 모드
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 justify-start text-base"
              onClick={fetchAnalytics}
            >
              <RotateCcw className="w-5 h-5 mr-3" />
              데이터 새로고침
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
