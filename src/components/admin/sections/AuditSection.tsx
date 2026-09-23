/**
 * 감사 로그 뷰어 섹션
 *
 * [역할]
 * - 필터: 액션, 엔티티, 날짜 범위
 * - 감사 로그 테이블 (타임스탬프, 사용자, 액션, 엔티티, 상세)
 * - 페이지네이션
 *
 * [Enhanced]
 * - 키오스크 다크 테마 (bg-slate-900 카드, bg-slate-800 테이블 헤더)
 * - 필터 카드: 다크 bg + 다크 입력
 * - 액션 배지: vivd kiosk colors (emerald-500 create, sky-500 update, rose-500 delete, violet-500 login, slate-500 logout)
 * - 테이블: full dark theme
 * - 페이지네이션: 다크 styled 버튼
 * - 타임라인 인디케이터: vertical line on left side of each log row
 * - 섹션 헤더: sky-blue gradient underline accent
 * - Skeletons: bg-slate-800
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
import Image from 'next/image';

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
  { value: 'all', label: '전체' },
  { value: 'create', label: '생성' },
  { value: 'update', label: '수정' },
  { value: 'delete', label: '삭제' },
  { value: 'login', label: '로그인' },
  { value: 'logout', label: '로그아웃' },
];

const ENTITY_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'content', label: '콘텐츠' },
  { value: 'book', label: '도서' },
  { value: 'user', label: '사용자' },
  { value: 'admin', label: '관리자' },
  { value: 'setting', label: '설정' },
  { value: 'kiosk_config', label: '키오스크 설정' },
];

/* Vivid kiosk action badge colors */
const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500 text-white',
  update: 'bg-sky-500 text-white',
  delete: 'bg-rose-500 text-white',
  login: 'bg-violet-500 text-white',
  logout: 'bg-slate-500 text-white',
};

/* Timeline dot colors per action */
const ACTION_DOT_COLORS: Record<string, string> = {
  create: 'bg-emerald-400',
  update: 'bg-sky-400',
  delete: 'bg-rose-400',
  login: 'bg-violet-400',
  logout: 'bg-slate-400',
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
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  /** Ensure Select value is never empty; default to 'all' */
  const safeActionFilter = actionFilter || 'all';
  const safeEntityFilter = entityFilter || 'all';
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (safeActionFilter && safeActionFilter !== 'all') params.set('action', safeActionFilter);
      if (safeEntityFilter && safeEntityFilter !== 'all') params.set('entity', safeEntityFilter);
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
  }, [page, safeActionFilter, safeEntityFilter, fromDate, toDate]);

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
      {/* ──────── Section Header with sky-blue gradient underline ──────── */}
      <div className="flex items-center gap-3 mb-2">
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800">
          <Image
            src="/images/admin/kiosk-device.png"
            alt="키오스크 단말기"
            width={32}
            height={32}
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          감사 로그
          <span className="block w-16 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent rounded-full" />
        </h2>
      </div>

      {/* ──────── 필터 바 (Dark) ──────── */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5 min-w-[120px]">
              <label className="text-xs font-medium text-slate-400">액션</label>
              <Select value={safeActionFilter} onValueChange={(v) => { setActionFilter(v || 'all'); setPage(1); }}>
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-sky-500">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-slate-200 focus:bg-slate-700 focus:text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[120px]">
              <label className="text-xs font-medium text-slate-400">엔티티</label>
              <Select value={safeEntityFilter} onValueChange={(v) => { setEntityFilter(v || 'all'); setPage(1); }}>
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-sky-500">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-slate-200 focus:bg-slate-700 focus:text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">시작일</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-[140px] bg-slate-800 border-slate-700 text-white focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">종료일</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-[140px] bg-slate-800 border-slate-700 text-white focus:ring-sky-500"
              />
            </div>
            <button
              onClick={handleApplyFilters}
              className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md"
            >
              <Filter className="w-4 h-4" />
              필터 적용
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ──────── 감사 로그 테이블 (Dark) ──────── */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-800 hover:bg-slate-800 border-slate-700">
                  <TableHead className="w-[160px] text-slate-300">시간</TableHead>
                  <TableHead className="hidden md:table-cell text-slate-300">IP</TableHead>
                  <TableHead className="text-slate-300">액션</TableHead>
                  <TableHead className="text-slate-300">엔티티</TableHead>
                  <TableHead className="hidden lg:table-cell text-slate-300">상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-700">
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full bg-slate-800" /></TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      감사 로그가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, index) => {
                    const details = parseDetails(log.details);
                    const dotColor = ACTION_DOT_COLORS[log.action] || 'bg-slate-400';
                    const isLast = index === logs.length - 1;
                    return (
                      <TableRow key={log.id} className="border-slate-700 hover:bg-slate-800/60 transition-colors duration-150">
                        {/* Time cell with timeline indicator */}
                        <TableCell className="text-xs text-slate-400 relative">
                          <div className="flex items-start gap-2">
                            {/* Timeline dot and vertical line */}
                            <div className="flex flex-col items-center shrink-0 mt-0.5">
                              <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                              {!isLast && (
                                <div className="w-0.5 flex-1 min-h-[24px] bg-slate-700/60 mt-1" />
                              )}
                            </div>
                            <span>
                              {new Date(log.timestamp).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-slate-400 font-mono">
                          {log.ipAddress || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${ACTION_COLORS[log.action] || 'bg-slate-700 text-slate-300'}`}
                          >
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-300">
                          {ENTITY_LABELS[log.entity] || log.entity}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-slate-400 max-w-[300px] truncate">
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

      {/* ──────── 페이지네이션 (Dark styled) ──────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            전체 {total}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </Button>
            <span className="text-sm text-slate-300">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
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
