/**
 * 도서카드 발급 관리 섹션
 *
 * [역할]
 * - 도서카드 발급 신청 목록 조회 (상태별 필터)
 * - 승인/거부/발급/취소 액션
 * - 관리자 직접 발급
 * - 신청 상세 정보 다이얼로그
 * - 발급 통계 대시보드
 *
 * [Enhanced]
 * - 카드 비주얼 디자인 (신용카드 형태)
 * - 발급 워크플로우 파이프라인 시각화
 * - 키오스크 스타일 그라디언트 통계 카드
 * - 테이블 개선 (아이콘, 아바타, 생생한 배지, 호버)
 * - 카드 템플릿 프리뷰
 * - 키오스크 다크 테마
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Search, Loader2,
  Plus, Eye, Trash2, UserPlus, AlertCircle,
  Smartphone, BookOpen, ArrowRight, ChevronRight, IdCard,
  CheckSquare, Square, ListChecks, XSquare, FileCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import Image from 'next/image';

// ============================================================================
// 타입 정의
// ============================================================================

interface LibraryCard {
  id: string;
  applicantName: string;
  birthDate: string;
  phone: string;
  address: string | null;
  cardType: string;
  cardNumber: string | null;
  status: string;
  appliedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  issuedAt: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CardStats {
  total: number;
  pending: number;
  approved: number;
  issued: number;
  rejected: number;
}

// ============================================================================
// 상태 매핑
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  issued: '발급완료',
  rejected: '거부',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  approved: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  issued: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const STATUS_VIVID_COLORS: Record<string, string> = {
  pending: 'bg-amber-500 text-white',
  approved: 'bg-sky-500 text-white',
  issued: 'bg-emerald-500 text-white',
  rejected: 'bg-rose-500 text-white',
};

const CARD_TYPE_LABELS: Record<string, string> = {
  mobile: '모바일',
  physical: '실물카드',
};

// ============================================================================
// CardVisual 서브 컴포넌트 (신용카드 형태 디자인)
// ============================================================================

function CardVisual({ card }: { card: LibraryCard }) {
  const maskedNumber = card.cardNumber
    ? `**** **** **** ${card.cardNumber.slice(-4)}`
    : '**** **** **** ****';

  return (
    <div
      className="relative w-[340px] h-[200px] rounded-xl shadow-lg overflow-hidden flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2744)' }}
    >
      {/* 카드 내부 패턴 오버레이 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full border border-white/30 translate-x-16 -translate-y-16" />
        <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full border border-white/20 -translate-x-10 translate-y-10" />
      </div>

      {/* 상단: SMART LIBRARY 텍스트 + 도서관 아이콘 */}
      <div className="relative z-10 p-5 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-bold tracking-wider text-white/90">SMART LIBRARY</span>
        </div>
        <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-bold px-2">
          {CARD_TYPE_LABELS[card.cardType] || card.cardType}
        </Badge>
      </div>

      {/* 중간: 마스킹된 카드 번호 */}
      <div className="relative z-10 px-5 mt-2">
        <p className="text-lg font-mono tracking-[0.18em] text-white/80">{maskedNumber}</p>
      </div>

      {/* 하단: 신청자 이름 + 골드 라인 */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #c9a84c, #f0d68a, #c9a84c)' }} />
        <div className="px-5 py-3 flex items-end justify-between">
          <div>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Card Holder</span>
            <p className="text-sm font-semibold text-white/90 mt-0.5">{card.applicantName}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Status</span>
            <p className="text-xs font-semibold text-amber-400 mt-0.5">{STATUS_LABELS[card.status]}</p>
          </div>
        </div>
      </div>

      {/* EMV 칩 아이콘 */}
      <div className="absolute top-14 left-5 z-10 w-9 h-7 rounded-md" style={{ background: 'linear-gradient(135deg, #c9a84c, #a08030)' }}>
        <div className="w-full h-full grid grid-cols-3 grid-rows-2 p-0.5 gap-px">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-yellow-800/40 rounded-[1px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IssuanceWorkflowPipeline 서브 컴포넌트
// ============================================================================

function IssuanceWorkflowPipeline({ stats }: { stats: CardStats }) {
  const steps = [
    {
      id: 'apply',
      label: '신청',
      icon: UserPlus,
      count: stats.total,
      countLabel: `총 ${stats.total}건`,
      status: (stats.total > 0 ? 'completed' : 'pending') as 'active' | 'completed' | 'pending',
    },
    {
      id: 'review',
      label: '심사',
      icon: FileCheck,
      count: stats.pending,
      countLabel: `${stats.pending}건 대기`,
      status: (stats.pending > 0 ? 'active' : (stats.approved + stats.issued + stats.rejected > 0 ? 'completed' : 'pending')) as 'active' | 'completed' | 'pending',
    },
    {
      id: 'approve',
      label: '승인/거부',
      icon: CheckCircle2,
      count: stats.approved + stats.rejected,
      countLabel: `승인 ${stats.approved} / 거부 ${stats.rejected}`,
      status: (stats.approved > 0 ? 'active' : (stats.issued > 0 || stats.rejected > 0 ? 'completed' : 'pending')) as 'active' | 'completed' | 'pending',
    },
    {
      id: 'issue',
      label: '발급',
      icon: CreditCard,
      count: stats.issued,
      countLabel: `${stats.issued}건 완료`,
      status: (stats.issued > 0 ? 'completed' : 'pending') as 'completed' | 'pending',
    },
  ];

  const statusStyles = {
    completed: 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30',
    active: 'bg-sky-500 text-white border-sky-400 shadow-sky-500/30',
    pending: 'bg-slate-700 text-slate-300 border-slate-600',
  };

  const lineStyles = {
    completed: 'bg-emerald-500',
    active: 'bg-sky-500',
    pending: 'bg-slate-700',
  };

  const iconColorStyles = {
    completed: 'text-white',
    active: 'text-white',
    pending: 'text-slate-400',
  };

  return (
    <Card className="bg-slate-900 border-slate-700 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-sky-400" />
            발급 워크플로우
          </h3>
          <span className="text-xs text-slate-400">전체 {stats.total}건</span>
        </div>
        <div className="flex items-center justify-center">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                {/* 스텝 노드 */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-lg transition-all duration-300 ${statusStyles[step.status]}`}
                  >
                    <Icon className={`w-6 h-6 ${iconColorStyles[step.status]}`} />
                  </div>
                  <span className={`text-xs font-semibold ${step.status === 'pending' ? 'text-slate-400' : 'text-white'}`}>
                    {step.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    step.status === 'active' ? 'bg-sky-500/20 text-sky-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {step.countLabel}
                  </span>
                </div>

                {/* 연결 화살표 (마지막 제외) */}
                {idx < steps.length - 1 && (
                  <div className="flex items-center mx-2 sm:mx-4">
                    <div className={`w-8 sm:w-16 h-0.5 ${lineStyles[steps[idx + 1].status === 'pending' ? 'pending' : 'completed']}`} />
                    <ChevronRight className={`w-4 h-4 -ml-1 ${
                      steps[idx + 1].status === 'pending' ? 'text-slate-500' : 'text-emerald-500'
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ApplicantAvatar 서브 컴포넌트
// ============================================================================

function ApplicantAvatar({ name }: { name: string }) {
  const initials = name
    .split('')
    .filter((_, i) => i === 0 || (name.length > 2 && i === 1))
    .join('')
    .slice(0, 2);

  return (
    <Avatar className="w-8 h-8 border border-slate-600">
      <AvatarFallback className="bg-slate-700 text-slate-200 text-xs font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function CardsSection() {
  // 상태
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [stats, setStats] = useState<CardStats>({ total: 0, pending: 0, approved: 0, issued: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all');

  // 다이얼로그
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<LibraryCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  // 직접 발급 폼
  const [issueForm, setIssueForm] = useState({
    applicantName: '',
    birthDate: '',
    phone: '',
    address: '',
    cardType: 'mobile',
  });

  // 일괄 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState(false);

  /** 현재 필터링된 대기 중 카드 */
  const pendingCards = cards.filter((c) => c.status === 'pending');
  const allPendingSelected = pendingCards.length > 0 && pendingCards.every((c) => selectedIds.has(c.id));

  /** 개별 선택 토글 */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** 전체 대기 선택/해제 */
  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingCards.map((c) => c.id)));
    }
  };

  /** 일괄 승인 */
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchSaving(true);
    let success = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/admin/cards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        });
        if (res.ok) success++; else fail++;
      } catch { fail++; }
    }
    setBatchSaving(false);
    setSelectedIds(new Set());
    if (fail === 0) toast.success(`${success}건 승인 완료`);
    else toast.warning(`${success}건 승인, ${fail}건 실패`);
    await fetchCards(search, statusFilter, cardTypeFilter);
  };

  /** 일괄 거부 */
  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    setBatchSaving(true);
    let success = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/admin/cards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        });
        if (res.ok) success++; else fail++;
      } catch { fail++; }
    }
    setBatchSaving(false);
    setSelectedIds(new Set());
    if (fail === 0) toast.success(`${success}건 거부 완료`);
    else toast.warning(`${success}건 거부, ${fail}건 실패`);
    await fetchCards(search, statusFilter, cardTypeFilter);
  };

  // ==========================================================================
  // 데이터 로드
  // ==========================================================================

  const fetchCards = useCallback(async (searchVal?: string, statusVal?: string, cardTypeVal?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchVal) params.set('search', searchVal);
      if (statusVal && statusVal !== 'all') params.set('status', statusVal);
      if (cardTypeVal && cardTypeVal !== 'all') params.set('cardType', cardTypeVal);
      const res = await fetch(`/api/admin/cards?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCards(json.cards || []);
      if (json.stats) setStats(json.stats);
    } catch {
      toast.error('도서카드 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // ==========================================================================
  // 액션 핸들러
  // ==========================================================================

  const handleCardAction = async (cardId: string, action: string, extra?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '작업 실패');
      }
      const data = await res.json();
      toast.success(data.message || '작업이 완료되었습니다.');
      await fetchCards(search, statusFilter, cardTypeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '작업에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = (card: LibraryCard) => handleCardAction(card.id, 'approve');
  const handleIssue = (card: LibraryCard) => handleCardAction(card.id, 'issue');

  const handleReject = async () => {
    if (!selectedCard) return;
    await handleCardAction(selectedCard.id, 'reject', { reason: rejectReason });
    setRejectDialogOpen(false);
    setRejectReason('');
    setSelectedCard(null);
  };

  const handleDelete = async (card: LibraryCard) => {
    if (!confirm(`'${card.applicantName}'님의 도서카드 신청을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/cards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('도서카드 신청이 삭제되었습니다.');
      await fetchCards(search, statusFilter, cardTypeFilter);
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDirectIssue = async () => {
    const { applicantName, birthDate, phone } = issueForm;
    if (!applicantName || !birthDate || !phone) {
      toast.error('이름, 생년월일, 전화번호는 필수입니다.');
      return;
    }
    if (birthDate.length !== 8) {
      toast.error('생년월일은 8자리로 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '발급 실패');
      }
      const data = await res.json();
      toast.success(`도서카드가 발급되었습니다. (카드번호: ${data.card?.cardNumber})`);
      setIssueDialogOpen(false);
      setIssueForm({ applicantName: '', birthDate: '', phone: '', address: '', cardType: 'mobile' });
      await fetchCards(search, statusFilter, cardTypeFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '발급에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (card: LibraryCard) => {
    setSelectedCard(card);
    setDetailDialogOpen(true);
  };

  const openReject = (card: LibraryCard) => {
    setSelectedCard(card);
    setRejectDialogOpen(true);
  };

  // ==========================================================================
  // 렌더
  // ==========================================================================

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-';

  const formatDateTime = (d: string | null) =>
    d ? new Date(d).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-5">
      {/* ──────── Hero Banner ──────── */}
      <div className="relative w-full h-[100px] rounded-xl overflow-hidden border border-slate-700 mb-2">
        <Image
          src="/images/admin/card-process.png"
          alt="카드 발급 배너"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-lg font-bold text-white">도서카드 발급 관리</p>
            <p className="text-sm text-slate-300">신청부터 발급까지 전체 프로세스를 관리합니다</p>
          </div>
        </div>
      </div>

      {/* ── 섹션 헤더 (키오스크 스타일) ─────────────────────────────── */}
      <div className="relative">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-sky-500" />
          도서카드 발급 관리
        </h2>
        <div className="mt-1.5 h-[3px] w-32 rounded-full" style={{ background: 'linear-gradient(90deg, #0ea5e9, #38bdf8, transparent)' }} />
      </div>

      {/* ── 카드 발급 프로세스 비주얼 ─────────────────────────────── */}
      <div className="relative w-full h-[80px] rounded-xl overflow-hidden border border-slate-700/50">
        <Image
          src="/images/admin/card-process.png"
          alt="카드 발급 프로세스"
          fill
          className="object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-transparent to-slate-900/70" />
      </div>

      {/* ── 발급 워크플로우 파이프라인 ─────────────────────────────── */}
      <IssuanceWorkflowPipeline stats={stats} />

      {/* ── 통계 카드 (키오스크 그라디언트 스타일) ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* 전체 */}
        <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #475569, #334155)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
          <div className="relative z-10">
            <div className="text-xs text-white/60 mb-1 flex items-center gap-1">
              <IdCard className="w-3 h-3" /> 전체
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
        </div>
        {/* 대기 */}
        <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
          <div className="relative z-10">
            <div className="text-xs text-white/70 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> 대기
            </div>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </div>
        </div>
        {/* 승인 */}
        <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
          <div className="relative z-10">
            <div className="text-xs text-white/70 mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 승인
            </div>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </div>
        </div>
        {/* 발급완료 */}
        <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
          <div className="relative z-10">
            <div className="text-xs text-white/70 mb-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> 발급완료
            </div>
            <div className="text-2xl font-bold">{stats.issued}</div>
          </div>
        </div>
        {/* 거부 */}
        <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-md col-span-2 sm:col-span-1" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
          <div className="relative z-10">
            <div className="text-xs text-white/70 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> 거부
            </div>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </div>
        </div>
      </div>

      {/* ── 필터 & 액션 바 (키오스크 스타일) ────────────────────────── */}
      <Card className="bg-slate-900 border-slate-700 shadow-md">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="이름, 전화번호, 카드번호 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => fetchCards(search, statusFilter, cardTypeFilter)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCards(search, statusFilter, cardTypeFilter)}
                className="pl-9 h-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); fetchCards(search, v, cardTypeFilter); }}>
                <SelectTrigger className="h-10 w-28 bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="approved">승인</SelectItem>
                  <SelectItem value="issued">발급완료</SelectItem>
                  <SelectItem value="rejected">거부</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cardTypeFilter} onValueChange={(v) => { setCardTypeFilter(v); fetchCards(search, statusFilter, v); }}>
                <SelectTrigger className="h-10 w-28 bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="유형" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                  <SelectItem value="all">전체 유형</SelectItem>
                  <SelectItem value="mobile">모바일</SelectItem>
                  <SelectItem value="physical">실물카드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {stats.pending > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-amber-300 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-200"
                  onClick={() => { setStatusFilter('pending'); fetchCards(search, 'pending', cardTypeFilter); }}
                >
                  <AlertCircle className="w-4 h-4 mr-1" />
                  대기 {stats.pending}건
                </Button>
              )}
              <Button
                onClick={() => setIssueDialogOpen(true)}
                className="h-10 bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                직접 발급
              </Button>
            </div>
          </div>

          {/* 일괄 처리 바 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mt-3 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <ListChecks className="w-4 h-4 text-sky-400" />
              <span className="text-sm text-sky-300 font-medium">{selectedIds.size}건 선택됨</span>
              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleBatchApprove}
                disabled={batchSaving}
              >
                {batchSaving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                일괄 승인
              </Button>
              <Button
                size="sm"
                className="h-8 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleBatchReject}
                disabled={batchSaving}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                일괄 거부
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-slate-400 hover:text-white"
                onClick={() => setSelectedIds(new Set())}
              >
                선택 해제
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 도서카드 목록 테이블 (키오스크 다크 스타일) ──────────────── */}
      <Card className="bg-slate-900 border-slate-700 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-800 hover:bg-slate-800 border-slate-700">
                  <TableHead className="w-10 text-slate-300">
                    <button
                      onClick={toggleSelectAll}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-600 transition-colors"
                      title={allPendingSelected ? '전체 해제' : '대기 건 전체 선택'}
                    >
                      {allPendingSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-slate-300">신청자</TableHead>
                  <TableHead className="hidden md:table-cell text-slate-300">전화번호</TableHead>
                  <TableHead className="text-slate-300">카드유형</TableHead>
                  <TableHead className="text-slate-300">카드번호</TableHead>
                  <TableHead className="text-slate-300">상태</TableHead>
                  <TableHead className="hidden lg:table-cell text-slate-300">신청일</TableHead>
                  <TableHead className="text-center text-slate-300">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-700">
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full bg-slate-700" /></TableCell>
                    </TableRow>
                  ))
                ) : cards.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      도서카드 발급 신청이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  cards.map((card) => (
                    <TableRow
                      key={card.id}
                      className={`group border-slate-700 hover:bg-slate-800/60 transition-colors duration-150 ${selectedIds.has(card.id) ? 'bg-sky-500/5' : ''}`}
                    >
                      {/* 체크박스 */}
                      <TableCell className="w-10">
                        {card.status === 'pending' ? (
                          <button
                            onClick={() => toggleSelect(card.id)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-600 transition-colors"
                          >
                            {selectedIds.has(card.id) ? (
                              <CheckSquare className="w-4 h-4 text-sky-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 h-5 flex items-center justify-center">
                            <XSquare className="w-4 h-4 text-slate-700" />
                          </span>
                        )}
                      </TableCell>
                      {/* 신청자 - 아바타 + 이름 */}
                      <TableCell className="font-medium text-sm text-white">
                        <div className="flex items-center gap-2">
                          <ApplicantAvatar name={card.applicantName} />
                          <span>{card.applicantName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-300">{card.phone}</TableCell>
                      {/* 카드유형 - 아이콘 포함 */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {card.cardType === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className="text-xs text-slate-300">
                            {CARD_TYPE_LABELS[card.cardType] || card.cardType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-slate-300">
                        {card.cardNumber || '-'}
                      </TableCell>
                      {/* 상태 - 생생한 색상 배지 */}
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_VIVID_COLORS[card.status] || 'bg-slate-600 text-slate-200'}`}>
                          {STATUS_LABELS[card.status] || card.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-slate-400">
                        {formatDate(card.appliedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {/* 상세 보기 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                            onClick={() => openDetail(card)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* 상태별 액션 */}
                          {card.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                onClick={() => handleApprove(card)} disabled={saving}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                onClick={() => openReject(card)} disabled={saving}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(card.status === 'approved' || card.status === 'pending') && card.status !== 'issued' && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                              onClick={() => handleIssue(card)} disabled={saving}
                              title="카드 발급"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}
                          {card.status !== 'issued' && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                              onClick={() => handleDelete(card)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── 상세 정보 다이얼로그 (카드 비주얼 포함) ────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5 text-sky-400" />
              도서카드 신청 상세
            </DialogTitle>
            <DialogDescription className="text-slate-400">도서카드 발급 신청 상세 정보입니다.</DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4 py-2">
              {/* 카드 비주얼 */}
              <div className="flex justify-center">
                <CardVisual card={selectedCard} />
              </div>

              {/* 상세 정보 */}
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 text-xs">신청자</span>
                    <p className="font-medium text-white">{selectedCard.applicantName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">생년월일</span>
                    <p className="font-medium text-white">{selectedCard.birthDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">전화번호</span>
                    <p className="font-medium text-white">{selectedCard.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">주소</span>
                    <p className="font-medium text-white">{selectedCard.address || '-'}</p>
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 text-xs">카드유형</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {selectedCard.cardType === 'mobile' ? (
                        <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <p className="font-medium text-white">{CARD_TYPE_LABELS[selectedCard.cardType]}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">상태</span>
                    <Badge className={`text-xs mt-0.5 ${STATUS_VIVID_COLORS[selectedCard.status]}`}>
                      {STATUS_LABELS[selectedCard.status]}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">카드번호</span>
                    <p className="font-mono font-medium text-white">{selectedCard.cardNumber || '미발급'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">신청일</span>
                    <p className="font-medium text-white">{formatDateTime(selectedCard.appliedAt)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">승인일</span>
                    <p className="font-medium text-white">{formatDateTime(selectedCard.approvedAt)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">발급일</span>
                    <p className="font-medium text-white">{formatDateTime(selectedCard.issuedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedCard?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  className="text-rose-400 border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
                  onClick={() => { setDetailDialogOpen(false); openReject(selectedCard); }}
                >
                  거부
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setDetailDialogOpen(false); handleApprove(selectedCard); }} disabled={saving}
                >
                  승인
                </Button>
              </>
            )}
            {(selectedCard?.status === 'approved' || selectedCard?.status === 'pending') && selectedCard?.status !== 'issued' && (
              <Button
                className="bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => { setDetailDialogOpen(false); handleIssue(selectedCard); }} disabled={saving}
              >
                <CreditCard className="w-4 h-4 mr-1" />
                발급
              </Button>
            )}
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => setDetailDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 거부 다이얼로그 ───────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              도서카드 신청 거부
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              &apos;{selectedCard?.applicantName}&apos;님의 도서카드 신청을 거부합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-slate-300">거부 사유 (선택)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거부 사유를 입력하세요..."
              className="mt-1.5 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-rose-500 focus:border-rose-500"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => { setRejectDialogOpen(false); setRejectReason(''); }}
            >
              취소
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleReject} disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              거부
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 직접 발급 다이얼로그 (카드 템플릿 프리뷰 포함) ──────────── */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <UserPlus className="w-5 h-5 text-sky-400" />
              도서카드 직접 발급
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              관리자가 직접 도서카드를 발급합니다. 이용자 계정도 함께 생성됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2">
            {/* 좌측: 폼 */}
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">이름 *</Label>
                <Input
                  value={issueForm.applicantName}
                  onChange={(e) => setIssueForm((f) => ({ ...f, applicantName: e.target.value }))}
                  placeholder="홍길동"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">생년월일 (8자리) *</Label>
                <Input
                  value={issueForm.birthDate}
                  onChange={(e) => setIssueForm((f) => ({ ...f, birthDate: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="19900101"
                  maxLength={8}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">전화번호 *</Label>
                <Input
                  value={issueForm.phone}
                  onChange={(e) => setIssueForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">주소 (선택)</Label>
                <Input
                  value={issueForm.address}
                  onChange={(e) => setIssueForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="서울시 강남구"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">카드 유형</Label>
                <Select value={issueForm.cardType} onValueChange={(v) => setIssueForm((f) => ({ ...f, cardType: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="mobile">모바일 (자동 승인)</SelectItem>
                    <SelectItem value="physical">실물카드 (담당자 승인)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 우측: 카드 템플릿 프리뷰 */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[300px] aspect-[17/10] rounded-xl overflow-hidden shadow-xl border border-slate-600">
                <Image
                  src="/images/admin/card-template.png"
                  alt="카드 템플릿"
                  fill
                  className="object-cover"
                  priority
                />
                {/* 오버레이: 실시간 입력 정보 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs text-white/60 font-medium">신청자</p>
                  <p className="text-sm font-bold text-white truncate">
                    {issueForm.applicantName || '이름 입력'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-white/50 font-mono">
                      {issueForm.phone || '010-XXXX-XXXX'}
                    </p>
                    <Badge className="text-[9px] bg-white/20 text-white border-white/30 px-1.5">
                      {CARD_TYPE_LABELS[issueForm.cardType]}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">카드 템플릿 미리보기</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              onClick={() => setIssueDialogOpen(false)} disabled={saving}
            >
              취소
            </Button>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white"
              onClick={handleDirectIssue} disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <CreditCard className="w-4 h-4 mr-1" />
              발급
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
