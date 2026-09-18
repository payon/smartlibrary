/**
 * 도서카드 발급 관리 섹션
 *
 * [역할]
 * - 도서카드 발급 신청 목록 조회 (상태별 필터)
 * - 승인/거부/발급/취소 액션
 * - 관리자 직접 발급
 * - 신청 상세 정보 다이얼로그
 * - 발급 통계 대시보드
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Search, Loader2,
  Plus, Eye, Trash2, CardIcon, UserPlus, AlertCircle
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
import { toast } from 'sonner';

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
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-sky-100 text-sky-700',
  issued: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const CARD_TYPE_LABELS: Record<string, string> = {
  mobile: '모바일',
  physical: '실물카드',
};

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
    <div className="space-y-4">
      {/* ── 통계 카드 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">전체</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-amber-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-amber-600 mb-1 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> 대기
            </div>
            <div className="text-xl font-bold text-amber-700">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-sky-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-sky-600 mb-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 승인
            </div>
            <div className="text-xl font-bold text-sky-700">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-emerald-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-emerald-600 mb-1 flex items-center justify-center gap-1">
              <CreditCard className="w-3 h-3" /> 발급완료
            </div>
            <div className="text-xl font-bold text-emerald-700">{stats.issued}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-rose-200 col-span-2 sm:col-span-1">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-rose-600 mb-1 flex items-center justify-center gap-1">
              <XCircle className="w-3 h-3" /> 거부
            </div>
            <div className="text-xl font-bold text-rose-700">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── 필터 & 액션 바 ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름, 전화번호, 카드번호 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => fetchCards(search, statusFilter, cardTypeFilter)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCards(search, statusFilter, cardTypeFilter)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); fetchCards(search, v, cardTypeFilter); }}>
            <SelectTrigger className="h-10 w-28">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기</SelectItem>
              <SelectItem value="approved">승인</SelectItem>
              <SelectItem value="issued">발급완료</SelectItem>
              <SelectItem value="rejected">거부</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cardTypeFilter} onValueChange={(v) => { setCardTypeFilter(v); fetchCards(search, statusFilter, v); }}>
            <SelectTrigger className="h-10 w-28">
              <SelectValue placeholder="유형" />
            </SelectTrigger>
            <SelectContent>
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
              className="h-9 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => { setStatusFilter('pending'); fetchCards(search, 'pending', cardTypeFilter); }}
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              대기 {stats.pending}건
            </Button>
          )}
          <Button onClick={() => setIssueDialogOpen(true)} className="h-10">
            <Plus className="w-4 h-4 mr-1.5" />
            직접 발급
          </Button>
        </div>
      </div>

      {/* ── 도서카드 목록 테이블 ───────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>신청자</TableHead>
                  <TableHead className="hidden md:table-cell">전화번호</TableHead>
                  <TableHead>카드유형</TableHead>
                  <TableHead>카드번호</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="hidden lg:table-cell">신청일</TableHead>
                  <TableHead className="text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : cards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      도서카드 발급 신청이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  cards.map((card) => (
                    <TableRow key={card.id} className="group">
                      <TableCell className="font-medium text-sm">{card.applicantName}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{card.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CARD_TYPE_LABELS[card.cardType] || card.cardType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {card.cardNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_COLORS[card.status] || ''}`}>
                          {STATUS_LABELS[card.status] || card.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(card.appliedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {/* 상세 보기 */}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(card)}>
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* 상태별 액션 */}
                          {card.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleApprove(card)} disabled={saving}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => openReject(card)} disabled={saving}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(card.status === 'approved' || card.status === 'pending') && card.status !== 'issued' && (
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                              onClick={() => handleIssue(card)} disabled={saving}
                              title="카드 발급"
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}
                          {card.status !== 'issued' && (
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600"
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

      {/* ── 상세 정보 다이얼로그 ──────────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              도서카드 신청 상세
            </DialogTitle>
            <DialogDescription>도서카드 발급 신청 상세 정보입니다.</DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="grid gap-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">신청자</span>
                  <p className="font-medium">{selectedCard.applicantName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">생년월일</span>
                  <p className="font-medium">{selectedCard.birthDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">전화번호</span>
                  <p className="font-medium">{selectedCard.phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">주소</span>
                  <p className="font-medium">{selectedCard.address || '-'}</p>
                </div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">카드유형</span>
                  <p className="font-medium">{CARD_TYPE_LABELS[selectedCard.cardType]}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">상태</span>
                  <Badge className={`text-xs ${STATUS_COLORS[selectedCard.status]}`}>
                    {STATUS_LABELS[selectedCard.status]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">카드번호</span>
                  <p className="font-mono font-medium">{selectedCard.cardNumber || '미발급'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">신청일</span>
                  <p className="font-medium">{formatDateTime(selectedCard.appliedAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">승인일</span>
                  <p className="font-medium">{formatDateTime(selectedCard.approvedAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">발급일</span>
                  <p className="font-medium">{formatDateTime(selectedCard.issuedAt)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedCard?.status === 'pending' && (
              <>
                <Button
                  variant="outline" className="text-rose-600 border-rose-300 hover:bg-rose-50"
                  onClick={() => { setDetailDialogOpen(false); openReject(selectedCard); }}
                >
                  거부
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => { setDetailDialogOpen(false); handleApprove(selectedCard); }} disabled={saving}
                >
                  승인
                </Button>
              </>
            )}
            {(selectedCard?.status === 'approved' || selectedCard?.status === 'pending') && selectedCard?.status !== 'issued' && (
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={() => { setDetailDialogOpen(false); handleIssue(selectedCard); }} disabled={saving}
              >
                <CreditCard className="w-4 h-4 mr-1" />
                발급
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 거부 다이얼로그 ───────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              도서카드 신청 거부
            </DialogTitle>
            <DialogDescription>
              '{selectedCard?.applicantName}'님의 도서카드 신청을 거부합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>거부 사유 (선택)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거부 사유를 입력하세요..."
              className="mt-1.5"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(''); }}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject} disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              거부
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 직접 발급 다이얼로그 ───────────────────────────────────── */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              도서카드 직접 발급
            </DialogTitle>
            <DialogDescription>
              관리자가 직접 도서카드를 발급합니다. 이용자 계정도 함께 생성됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>이름 *</Label>
              <Input
                value={issueForm.applicantName}
                onChange={(e) => setIssueForm((f) => ({ ...f, applicantName: e.target.value }))}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-1.5">
              <Label>생년월일 (8자리) *</Label>
              <Input
                value={issueForm.birthDate}
                onChange={(e) => setIssueForm((f) => ({ ...f, birthDate: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="19900101"
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label>전화번호 *</Label>
              <Input
                value={issueForm.phone}
                onChange={(e) => setIssueForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="010-1234-5678"
              />
            </div>
            <div className="space-y-1.5">
              <Label>주소 (선택)</Label>
              <Input
                value={issueForm.address}
                onChange={(e) => setIssueForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="서울시 강남구"
              />
            </div>
            <div className="space-y-1.5">
              <Label>카드 유형</Label>
              <Select value={issueForm.cardType} onValueChange={(v) => setIssueForm((f) => ({ ...f, cardType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">모바일 (자동 승인)</SelectItem>
                  <SelectItem value="physical">실물카드 (담당자 승인)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleDirectIssue} disabled={saving}>
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
