/**
 * 이용자 관리 섹션
 *
 * [역할]
 * - 관리자 계정 / 키오스크 이용자 탭
 * - 관리자: 이메일, 이름, 역할, 활성, 마지막 로그인
 * - 키오스크 이용자: 이름, 전화, 카드번호, 활성 대출
 * - 관리자 생성/수정 다이얼로그
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Search, Loader2, Users, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  super_admin: 'bg-rose-100 text-rose-700',
  admin: 'bg-blue-100 text-blue-700',
  operator: 'bg-emerald-100 text-emerald-700',
};

export default function UsersSection() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [kioskUsers, setKioskUsers] = useState<KioskUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskSearch, setKioskSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });

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
      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins" className="gap-1.5">
            <Users className="w-4 h-4" />
            관리자 계정
          </TabsTrigger>
          <TabsTrigger value="kiosk" className="gap-1.5">
            <UserCheck className="w-4 h-4" />
            키오스크 이용자
          </TabsTrigger>
        </TabsList>

        {/* 관리자 계정 탭 */}
        <TabsContent value="admins" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)} className="h-10">
              <Plus className="w-4 h-4 mr-1.5" />
              관리자 추가
            </Button>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead className="text-center">활성</TableHead>
                      <TableHead className="hidden md:table-cell">마지막 로그인</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : adminUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          관리자 계정이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-sm">{user.name}</TableCell>
                          <TableCell className="text-sm">{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(v) => handleUpdateRole(user, v)}
                            >
                              <SelectTrigger className="h-7 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="super_admin">최고관리자</SelectItem>
                                <SelectItem value="admin">관리자</SelectItem>
                                <SelectItem value="operator">운영자</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={() => handleToggleActive(user)}
                            />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
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
        </TabsContent>

        {/* 키오스크 이용자 탭 */}
        <TabsContent value="kiosk" className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="이름, 전화, 카드번호 검색..."
                value={kioskSearch}
                onChange={(e) => setKioskSearch(e.target.value)}
                onBlur={() => fetchKioskUsers(kioskSearch)}
                onKeyDown={(e) => e.key === 'Enter' && fetchKioskUsers(kioskSearch)}
                className="pl-9 h-10"
              />
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead className="hidden md:table-cell">전화번호</TableHead>
                      <TableHead>카드번호</TableHead>
                      <TableHead className="text-center">활성</TableHead>
                      <TableHead className="text-center">활성 대출</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">총 대출</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kioskLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : kioskUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          키오스크 이용자가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      kioskUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-sm">{user.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{user.phone}</TableCell>
                          <TableCell className="text-sm font-mono">
                            {user.cardNumber || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                              {user.isActive ? '활성' : '비활성'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={user.activeLoans > 0 ? 'default' : 'secondary'} className="text-xs">
                              {user.activeLoans}건
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell text-sm">
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
        </TabsContent>
      </Tabs>

      {/* 관리자 생성 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>관리자 계정 생성</DialogTitle>
            <DialogDescription>새로운 관리자 계정을 생성합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>이메일 *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@library.go.kr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-1.5">
              <Label>비밀번호 *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호 입력"
              />
            </div>
            <div className="space-y-1.5">
              <Label>역할 *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">최고관리자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="operator">운영자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleCreateAdmin} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
