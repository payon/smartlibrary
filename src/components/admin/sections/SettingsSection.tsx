/**
 * 시스템 설정 섹션
 *
 * [역할]
 * - 대출 규칙 설정 (최대 권수, 대출 기간, 연체 배수)
 * - 키오스크 설정 (자동 타임아웃, 유지보수 모드)
 * - 알림 설정
 * - DB 초기화
 *
 * [Enhanced]
 * - 키오스크 다크 테마 (bg-slate-900 카드, bg-slate-800 입력)
 * - 카테고리 카드: bg-slate-900 + white text + darker header areas
 * - 카테고리 아이콘: BookOpen(loan), Monitor(kiosk), Bell(notification), Wrench(general)
 * - 설정 필드: 다크 입력 (bg-slate-800), sky-blue 저장 버튼
 * - Boolean 스위치: sky-blue color
 * - 위험 구역 카드: bg-slate-900 + rose-500 accents
 * - 섹션 헤더: sky-blue gradient underline accent
 * - Skeletons: bg-slate-800
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Save, Loader2, AlertTriangle, RotateCcw,
  BookOpen, Monitor, Bell, Wrench,
} from 'lucide-react';
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

/* Category icons mapping */
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  loan: BookOpen,
  kiosk: Monitor,
  notification: Bell,
  general: Wrench,
};

const CATEGORY_ICON_COLORS: Record<string, string> = {
  loan: 'text-emerald-400',
  kiosk: 'text-sky-400',
  notification: 'text-amber-400',
  general: 'text-slate-400',
};

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
            <Label className="text-sm font-medium text-slate-200">{config.label}</Label>
            {isChanged && (
              <Badge className="text-xs ml-2 bg-sky-500 text-white">변경됨</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={checked}
              onCheckedChange={(v) => handleValueChange(config.key, String(v))}
              className="data-[state=checked]:bg-sky-500"
            />
            <button
              onClick={() => handleSave(config.key)}
              disabled={!isChanged || isSaving}
              className="h-8 px-3 flex items-center gap-1 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-xs font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </button>
          </div>
        </div>
      );
    }

    // Number 타입인 경우
    if (!isNaN(Number(config.value)) && config.value !== '' && config.value !== '0' && config.key.includes('timeout') || config.key.includes('period') || config.key.includes('max') || config.key.includes('multiplier') || config.key.includes('count')) {
      return (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium min-w-[140px] text-slate-200">{config.label}</Label>
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(config.key, e.target.value)}
            className="h-9 w-28 bg-slate-800 border-slate-700 text-white focus:ring-sky-500"
          />
          {isChanged && (
            <Badge className="text-xs bg-sky-500 text-white">변경됨</Badge>
          )}
          <button
            onClick={() => handleSave(config.key)}
            disabled={!isChanged || isSaving}
            className="h-8 px-3 flex items-center gap-1 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-xs font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            저장
          </button>
        </div>
      );
    }

    // 기본 텍스트
    return (
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium min-w-[140px] text-slate-200">{config.label}</Label>
        <Input
          value={currentValue}
          onChange={(e) => handleValueChange(config.key, e.target.value)}
          className="h-9 flex-1 bg-slate-800 border-slate-700 text-white focus:ring-sky-500"
        />
        {isChanged && (
          <Badge className="text-xs bg-sky-500 text-white">변경됨</Badge>
        )}
        <button
          onClick={() => handleSave(config.key)}
          disabled={!isChanged || isSaving}
          className="h-8 px-3 flex items-center gap-1 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-xs font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          저장
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ──────── Section Header with sky-blue gradient underline ──────── */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          시스템 설정
          <span className="block w-16 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent rounded-full" />
        </h2>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-slate-900 border-slate-700">
              <CardHeader>
                <Skeleton className="h-5 w-40 bg-slate-800" />
                <Skeleton className="h-4 w-64 bg-slate-800" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-9 w-full bg-slate-800" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(groupedConfigs).length === 0 ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8 text-center text-slate-400">
            설정 항목이 없습니다. 시드 데이터를 먼저 실행해주세요.
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedConfigs).map(([category, items]) => {
          const IconComp = CATEGORY_ICONS[category] || Wrench;
          const iconColor = CATEGORY_ICON_COLORS[category] || 'text-slate-400';
          return (
            <Card key={category} className="bg-slate-900 text-white border-slate-700 shadow-lg">
              <CardHeader className="pb-3 bg-slate-800/40 rounded-t-lg border-b border-slate-700/50">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <IconComp className={`w-5 h-5 ${iconColor}`} />
                  {categoryLabels[category] || category}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {categoryDescriptions[category] || ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {items.map((config) => (
                  <div key={config.key}>
                    {renderConfigField(config)}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      <Separator className="bg-slate-700" />

      {/* ──────── 위험 구역 (Dark bg + rose-500 accents) ──────── */}
      <Card className="bg-slate-900 text-white border-rose-500/30 shadow-lg">
        <CardHeader className="pb-3 bg-slate-800/40 rounded-t-lg border-b border-rose-500/20">
          <CardTitle className="text-lg text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            위험 구역
          </CardTitle>
          <CardDescription className="text-slate-400">
            주의: 이 작업은 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <AlertDialog>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">데이터베이스 초기화</p>
                <p className="text-xs text-slate-400">모든 데이터를 삭제하고 기본 데이터로 재설정합니다.</p>
              </div>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-9 bg-rose-600 hover:bg-rose-500 text-white">
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  DB 초기화
                </Button>
              </AlertDialogTrigger>
            </div>
            <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">정말 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  모든 대출 기록, 사용자, 도서 데이터가 삭제되고 기본 시드 데이터로 복원됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetDB}
                  className="bg-rose-600 text-white hover:bg-rose-500"
                >
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
