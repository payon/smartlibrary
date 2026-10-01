'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAdminStore } from '@/stores/useAdminStore';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '최고관리자',
  admin: '관리자',
  operator: '운영자',
};

export default function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const adminUser = useAdminStore((s) => s.adminUser);
  const setAdminUser = useAdminStore((s) => s.setAdminUser);

  const [name, setName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // 다이얼로그가 열릴 때 이름 필드를 현재 이름으로 초기화
  const handleOpenChange = (next: boolean) => {
    if (next && adminUser) {
      setName(adminUser.name);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    onOpenChange(next);
  };

  const handleSaveName = async () => {
    if (!adminUser) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    setNameSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${adminUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '이름 변경에 실패했습니다.');
      setAdminUser({ ...adminUser, name: data.user?.name ?? trimmed });
      toast.success(data.message || '이름이 변경되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이름 변경에 실패했습니다.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('모든 비밀번호 항목을 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      toast.success(data.message || '비밀번호가 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  const initial = (adminUser?.name || '?').charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-sky-400" />내 프로필
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            내 정보 확인 및 이름/비밀번호를 변경합니다.
          </DialogDescription>
        </DialogHeader>

        {/* (a) 내 정보 표시 */}
        {adminUser && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 border border-slate-700 p-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold bg-sky-500/20 text-sky-400 shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{adminUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{adminUser.email}</p>
            </div>
            <Badge className="bg-sky-500 text-white text-xs shrink-0">
              {ROLE_LABELS[adminUser.role] || adminUser.role}
            </Badge>
          </div>
        )}

        {/* (b) 이름 변경 */}
        <div className="space-y-2 rounded-lg border border-slate-700 p-3">
          <Label className="text-slate-300 text-sm font-medium">이름 변경</Label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
            />
            <Button
              onClick={handleSaveName}
              disabled={nameSaving}
              className="shrink-0 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white"
            >
              저장
            </Button>
          </div>
        </div>

        {/* (c) 비밀번호 변경 */}
        <div className="space-y-2 rounded-lg border border-slate-700 p-3">
          <Label className="text-slate-300 text-sm font-medium">비밀번호 변경</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="현재 비밀번호"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-sky-500"
          />
          <p className="text-xs text-slate-500">
            8자 이상·영문 대소문자/숫자/특수문자 중 3종 이상 포함
          </p>
          <Button
            onClick={handleChangePassword}
            disabled={pwSaving}
            className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white"
          >
            비밀번호 변경
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
