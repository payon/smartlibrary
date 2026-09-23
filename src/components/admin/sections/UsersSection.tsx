/**
 * 이용자 관리 섹션
 *
 * [역할]
 * - 관리자 계정 / 키오스크 이용자 탭
 * - 관리자: 이메일, 이름, 역할, 활성, 마지막 로그인
 * - 키오스크 이용자: 이름, 전화, 카드번호, 활성 대출
 * - 관리자 생성/수정 다이얼로그
 *
 * [Enhanced]
 * - 키오스크 다크 테마 (bg-slate-900 카드, bg-slate-800 테이블 헤더)
 * - 역할 배지: rose-500/sky-500/emerald-500 bg + white text
 * - 사용자 아바타 서클 (이니셜)
 * - 탭 버튼: kiosk-style with sky-blue active indicator
 * - 관리자 추가 버튼: sky-blue gradient
 * - 섹션 헤더: sky-blue gradient underline accent
 * - 다이얼로그: dark bg (bg-slate-900)
 * - 스위치: sky-blue color
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Loader2, Users, UserCheck, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import Image from 'next/image';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface KioskUser {
  id: string;
  name: string;
  phone: string;
  cardNumber: string | null;
  isActive: boolean;
  activeLoans: number;
  totalLoans: number;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '최고관리자',
  admin: '관리자',
  operator: '운영자',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-rose-500 text-white',
  admin: 'bg-sky-500 text-white',
  operator: 'bg-emerald-500 text-white',
};

/* 사용자 아바타 서클 (이니셜) */
function UserAvatar({ name, role }: { name: string; role?: string }) {
  const initial = name.charAt(0).toUpperCase();
  const bgClass = role
    ? role === 'super_admin'
      ? 'bg-rose-500/20 text-rose-400'
      : role === 'admin'
        ? 'bg-sky-500/20 text-sky-400'
        : 'bg-emerald-500/20 text-emerald-400'
    : 'bg-slate-700 text-slate-300';

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${bgClass} shrink-0`}>
      {initial}
    </div>
  );
}

export default function UsersSection() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [kioskUsers, setKioskUsers] = useState<KioskUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskSearch, setKioskSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kioskDialogOpen, setKioskDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('admins');
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });
  const [kioskForm, setKioskForm] = useState({ name: '', birthDate: '', phone: '', address: '', pin: '' });

  const fetchAdminUsers = useCallback(async () => {
    try {
      setAdminLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAdminUsers(json.users || []);
    } catch {
      toast.error('관리자 목록을 불러오는데 실패했습니다.');
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const fetchKioskUsers = useCallback(async (searchVal?: string) => {
    try {
      setKioskLoading(true);
      const params = new URLSearchParams();
      if (searchVal) params.set('search', searchVal);
      const res = await fetch(`/api/admin/kiosk-users?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setKioskUsers(json.users || []);
    } catch {
      toast.error('키오스크 이용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setKioskLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
    fetchKioskUsers();
  }, [fetchAdminUsers, fetchKioskUsers]);

  const handleCreateAdmin = async () => {
    if (!form.email || !form.name || !form.password || !form.role) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '생성 실패');
      }
      toast.success('관리자 계정이 생성되었습니다.');
      setDialogOpen(false);
      setForm({ email: '', name: '', password: '', role: 'operator' });
      await fetchAdminUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /** 키오스크 이용자 생성 */
  const handleCreateKioskUser = async () => {
    if (!kioskForm.name || !kioskForm.birthDate || !kioskForm.phone || !kioskForm.pin) {
      toast.error('이름, 생년월일, 전화번호, PIN은 필수입니다.');
      return;
    }
    if (!/^\d{8}$/.test(kioskForm.birthDate)) {
      toast.error('생년월일은 8자리 숫자여야 합니다.');
      return;
    }
    if (!/^\d{10,11}$/.test(kioskForm.phone.replace(/[^0-9]/g, ''))) {
      toast.error('올바른 전화번호를 입력해주세요.');
      return;
    }
    if (!/^\d{4}$/.test(kioskForm.pin)) {
      toast.error('PIN은 4자리 숫자여야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/kiosk-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: kioskForm.name,
          birthDate: kioskForm.birthDate,
          phone: kioskForm.phone.replace(/[^0-9]/g, ''),
          address: kioskForm.address || null,
          pin: kioskForm.pin,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '생성 실패');
      }
      toast.success('키오스크 이용자가 등록되었습니다.');
      setKioskDialogOpen(false);
      setKioskForm({ name: '', birthDate: '', phone: '', address: '', pin: '' });
      await fetchKioskUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(user.isActive ? '계정이 비활성화되었습니다.' : '계정이 활성화되었습니다.');
      await fetchAdminUsers();
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleUpdateRole = async (user: AdminUser, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      toast.success('역할이 변경되었습니다.');
      await fetchAdminUsers();
    } catch {
      toast.error('역할 변경에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {/* ──────── Hero Banner ──────── */}
      <div className="relative w-full h-[100px] rounded-xl overflow-hidden border border-slate-700 mb-2">
        <Image
          src="/images/admin/users-hero.png"
          alt="이용자 배너"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-lg font-bold text-white">이용자 계정 관리</p>
            <p className="text-sm text-slate-300">관리자 및 키오스크 이용자 정보를 관리합니다</p>
          </div>
        </div>
      </div>

      {/* ──────── Section Header with sky-blue gradient underline ──────── */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          이용자 관리
          <span className="block w-16 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent rounded-full" />
        </h2>
      </div>

      {/* ──────── Kiosk-style Tab Buttons ──────── */}
      <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('admins')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'admins'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          <Users className="w-4 h-4" />
          관리자 계정
        </button>
        <button
          onClick={() => setActiveTab('kiosk')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'kiosk'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          키오스크 이용자
        </button>
      </div>

      {/* ──────── 관리자 계정 탭 ──────── */}
      {activeTab === 'admins' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setDialogOpen(true)}
              className="h-10 px-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md shadow-sky-500/20 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              관리자 추가
            </button>
          </div>

          <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800 hover:bg-slate-800 border-slate-700">
                      <TableHead className="text-slate-300">이름</TableHead>
                      <TableHead className="text-slate-300">이메일</TableHead>
                      <TableHead className="text-slate-300">역할</TableHead>
                      <TableHead className="text-center text-slate-300">활성</TableHead>
                      <TableHead className="hidden md:table-cell text-slate-300">마지막 로그인</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className="border-slate-700">
                          <TableCell colSpan={5}><Skeleton className="h-8 w-full bg-slate-800" /></TableCell>
                        </TableRow>
                      ))
                    ) : adminUsers.length === 0 ? (
                      <TableRow className="border-slate-700">
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                          관리자 계정이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminUsers.map((user) => (
                        <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/60 transition-colors duration-150">
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={user.name} role={user.role} />
                              <span className="text-white">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-300">{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(v) => handleUpdateRole(user, v)}
                            >
                              <SelectTrigger className="h-7 w-28 bg-slate-800 border-slate-600 text-slate-200 focus:ring-sky-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="super_admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">최고관리자</SelectItem>
                                <SelectItem value="admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">관리자</SelectItem>
                                <SelectItem value="operator" className="text-slate-200 focus:bg-slate-700 focus:text-white">운영자</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={() => handleToggleActive(user)}
                              className="data-[state=checked]:bg-sky-500"
                            />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-slate-400">
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR')
                              : '없음'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────── 키오스크 이용자 탭 ──────── */}
      {activeTab === 'kiosk' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setKioskDialogOpen(true)}
              className="h-10 px-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md shadow-sky-500/20 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            >
              <UserPlus className="w-4 h-4" />
              키오스크 이용자 등록
            </button>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="이름, 전화, 카드번호 검색..."
                value={kioskSearch}
                onChange={(e) => setKioskSearch(e.target.value)}
                onBlur={() => fetchKioskUsers(kioskSearch)}
                onKeyDown={(e) => e.key === 'Enter' && fetchKioskUsers(kioskSearch)}
                className="pl-9 h-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
          </div>

          <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800 hover:bg-slate-800 border-slate-700">
                      <TableHead className="text-slate-300">이름</TableHead>
                      <TableHead className="hidden md:table-cell text-slate-300">전화번호</TableHead>
                      <TableHead className="text-slate-300">카드번호</TableHead>
                      <TableHead className="text-center text-slate-300">활성</TableHead>
                      <TableHead className="text-center text-slate-300">활성 대출</TableHead>
                      <TableHead className="text-center hidden sm:table-cell text-slate-300">총 대출</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kioskLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-slate-700">
                          <TableCell colSpan={6}><Skeleton className="h-8 w-full bg-slate-800" /></TableCell>
                        </TableRow>
                      ))
                    ) : kioskUsers.length === 0 ? (
                      <TableRow className="border-slate-700">
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                          키오스크 이용자가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      kioskUsers.map((user) => (
                        <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/60 transition-colors duration-150">
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <UserAvatar name={user.name} />
                              <span className="text-white">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-slate-300">{user.phone}</TableCell>
                          <TableCell className="text-sm font-mono text-slate-300">
                            {user.cardNumber || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`text-xs ${user.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                              {user.isActive ? '활성' : '비활성'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`text-xs ${user.activeLoans > 0 ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                              {user.activeLoans}건
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell text-sm text-slate-300">
                            {user.totalLoans}건
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────── 키오스크 이용자 등록 다이얼로그 ──────── */}
      <Dialog open={kioskDialogOpen} onOpenChange={setKioskDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-sky-400" />
              키오스크 이용자 등록
            </DialogTitle>
            <DialogDescription className="text-slate-400">새로운 키오스크 이용자(SimUser)를 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">이름 *</Label>
              <Input
                value={kioskForm.name}
                onChange={(e) => setKioskForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">생년월일 (8자리) *</Label>
              <Input
                value={kioskForm.birthDate}
                onChange={(e) => setKioskForm((f) => ({ ...f, birthDate: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="19900101"
                maxLength={8}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">전화번호 *</Label>
              <Input
                type="tel"
                value={kioskForm.phone}
                onChange={(e) => setKioskForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="01012345678"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">주소 (선택)</Label>
              <Input
                value={kioskForm.address}
                onChange={(e) => setKioskForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="서울시 강남구 대치동"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">PIN (4자리 숫자) *</Label>
              <Input
                type="password"
                value={kioskForm.pin}
                onChange={(e) => setKioskForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="1234"
                maxLength={4}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
              <p className="text-xs text-slate-500">대출/반납 시 사용할 4자리 비밀번호입니다</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKioskDialogOpen(false)}
              disabled={saving}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              취소
            </Button>
            <button
              onClick={handleCreateKioskUser}
              disabled={saving}
              className="h-10 px-4 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              등록
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── 관리자 생성 다이얼로그 (Dark) ──────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">관리자 계정 생성</DialogTitle>
            <DialogDescription className="text-slate-400">새로운 관리자 계정을 생성합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">이메일 *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@library.go.kr"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">비밀번호 *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호 입력"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">역할 *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 focus:ring-sky-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="super_admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">최고관리자</SelectItem>
                  <SelectItem value="admin" className="text-slate-200 focus:bg-slate-700 focus:text-white">관리자</SelectItem>
                  <SelectItem value="operator" className="text-slate-200 focus:bg-slate-700 focus:text-white">운영자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              취소
            </Button>
            <button
              onClick={handleCreateAdmin}
              disabled={saving}
              className="h-10 px-4 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              생성
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
