/**
 * 시스템 설정 섹션
 *
 * [역할]
 * - 대출 규칙 설정 (최대 권수, 대출 기간, 연체 배수)
 * - 키오스크 설정 (자동 타임아웃, 유지보수 모드)
 * - 알림 설정
 * - DB 초기화
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface KioskConfig {
  id: string;
  key: string;
  value: string;
  label: string;
  category: string;
}

export default function SettingsSection() {
  const [configs, setConfigs] = useState<KioskConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setConfigs(json.configs || []);
      const vals: Record<string, string> = {};
      (json.configs || []).forEach((c: KioskConfig) => {
        vals[c.key] = c.value;
      });
      setEditedValues(vals);
    } catch {
      toast.error('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    const value = editedValues[key];
    if (value === undefined) return;

    setSaving(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '저장 실패');
      }
      setConfigs((prev) =>
        prev.map((c) => (c.key === key ? { ...c, value } : c))
      );
      toast.success('설정이 저장되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const handleResetDB = async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('데이터베이스가 초기화되었습니다.');
    } catch {
      toast.error('데이터베이스 초기화에 실패했습니다.');
    }
  };

  // 카테고리별 그룹핑
  const groupedConfigs = configs.reduce<Record<string, KioskConfig[]>>((acc, config) => {
    if (!acc[config.category]) acc[config.category] = [];
    acc[config.category].push(config);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    loan: '대출 규칙 설정',
    kiosk: '키오스크 설정',
    notification: '알림 설정',
    general: '일반 설정',
  };

  const categoryDescriptions: Record<string, string> = {
    loan: '도서 대출 및 반납과 관련된 규칙을 설정합니다.',
    kiosk: '키오스크 하드웨어 및 동작 관련 설정입니다.',
    notification: '시스템 알림 및 안내 메시지 설정입니다.',
    general: '기타 시스템 설정입니다.',
  };

  const renderConfigField = (config: KioskConfig) => {
    const currentValue = editedValues[config.key] ?? config.value;
    const isChanged = currentValue !== config.value;
    const isSaving = saving === config.key;

    // Boolean 타입인 경우 Switch로 렌더링
    if (config.value === 'true' || config.value === 'false') {
      const checked = currentValue === 'true';
      return (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">{config.label}</Label>
            {isChanged && (
              <Badge variant="default" className="text-xs ml-2">변경됨</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={checked}
              onCheckedChange={(v) => handleValueChange(config.key, String(v))}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(config.key)}
              disabled={!isChanged || isSaving}
              className="h-8"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      );
    }

    // Number 타입인 경우
    if (!isNaN(Number(config.value)) && config.value !== '' && config.value !== '0' && config.key.includes('timeout') || config.key.includes('period') || config.key.includes('max') || config.key.includes('multiplier') || config.key.includes('count')) {
      return (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium min-w-[140px]">{config.label}</Label>
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(config.key, e.target.value)}
            className="h-9 w-28"
          />
          {isChanged && (
            <Badge variant="default" className="text-xs">변경됨</Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(config.key)}
            disabled={!isChanged || isSaving}
            className="h-8"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </Button>
        </div>
      );
    }

    // 기본 텍스트
    return (
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium min-w-[140px]">{config.label}</Label>
        <Input
          value={currentValue}
          onChange={(e) => handleValueChange(config.key, e.target.value)}
          className="h-9 flex-1"
        />
        {isChanged && (
          <Badge variant="default" className="text-xs">변경됨</Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSave(config.key)}
          disabled={!isChanged || isSaving}
          className="h-8"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-9 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(groupedConfigs).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            설정 항목이 없습니다. 시드 데이터를 먼저 실행해주세요.
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedConfigs).map(([category, items]) => (
          <Card key={category} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {categoryLabels[category] || category}
              </CardTitle>
              <CardDescription>
                {categoryDescriptions[category] || ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((config) => (
                <div key={config.key}>
                  {renderConfigField(config)}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Separator />

      {/* 위험 구역 */}
      <Card className="shadow-sm border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            위험 구역
          </CardTitle>
          <CardDescription>
            주의: 이 작업은 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <AlertDialog>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">데이터베이스 초기화</p>
                <p className="text-xs text-muted-foreground">모든 데이터를 삭제하고 기본 데이터로 재설정합니다.</p>
              </div>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-9">
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  DB 초기화
                </Button>
              </AlertDialogTrigger>
            </div>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  모든 대출 기록, 사용자, 도서 데이터가 삭제되고 기본 시드 데이터로 복원됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetDB} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  초기화
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
