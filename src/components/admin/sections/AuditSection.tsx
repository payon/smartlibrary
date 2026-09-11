/**
 * 감사 로그 뷰어 섹션
 *
 * [역할]
 * - 필터: 액션, 엔티티, 날짜 범위
 * - 감사 로그 테이블 (타임스탬프, 사용자, 액션, 엔티티, 상세)
 * - 페이지네이션
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  timestamp: string;
  user?: { name: string; email: string } | null;
}

const ACTION_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'create', label: '생성' },
  { value: 'update', label: '수정' },
  { value: 'delete', label: '삭제' },
  { value: 'login', label: '로그인' },
  { value: 'logout', label: '로그아웃' },
];

const ENTITY_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'content', label: '콘텐츠' },
  { value: 'book', label: '도서' },
  { value: 'user', label: '사용자' },
  { value: 'admin', label: '관리자' },
  { value: 'setting', label: '설정' },
  { value: 'kiosk_config', label: '키오스크 설정' },
];

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-violet-100 text-violet-700',
  logout: 'bg-slate-100 text-slate-700',
};

const ACTION_LABELS: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  login: '로그인',
  logout: '로그아웃',
};

const ENTITY_LABELS: Record<string, string> = {
  content: '콘텐츠',
  book: '도서',
  user: '사용자',
  admin: '관리자',
  setting: '설정',
  kiosk_config: '키오스크 설정',
};

export default function AuditSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLogs(json.logs || []);
      setTotal(json.total || 0);
    } catch {
      toast.error('감사 로그를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const handleApplyFilters = () => {
    setPage(1);
    fetchLogs();
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      return parsed;
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5 min-w-[120px]">
              <label className="text-xs font-medium text-muted-foreground">액션</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[120px]">
              <label className="text-xs font-medium text-muted-foreground">엔티티</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">시작일</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-[140px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">종료일</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-[140px]"
              />
            </div>
            <Button onClick={handleApplyFilters} size="sm" className="h-9">
              <Filter className="w-4 h-4 mr-1.5" />
              필터 적용
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 감사 로그 테이블 */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">시간</TableHead>
                  <TableHead className="hidden md:table-cell">IP</TableHead>
                  <TableHead>액션</TableHead>
                  <TableHead>엔티티</TableHead>
                  <TableHead className="hidden lg:table-cell">상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      감사 로그가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const details = parseDetails(log.details);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${ACTION_COLORS[log.action] || ''}`}
                          >
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ENTITY_LABELS[log.entity] || log.entity}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[300px] truncate">
                          {details ? (
                            typeof details === 'object' ? (
                              <span className="font-mono">
                                {JSON.stringify(details).slice(0, 100)}
                              </span>
                            ) : (
                              String(details).slice(0, 100)
                            )
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            전체 {total}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9"
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
