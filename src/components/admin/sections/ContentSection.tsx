/**
 * 콘텐츠 관리 섹션
 *
 * [역할]
 * - 키오스크 화면별 콘텐츠 편집
 * - 텍스트, 색상, 이미지, JSON 타입 지원
 * - 개별/일괄 저장
 * - 기본값 복원
 * - 키오스크 스크린 프리뷰 패널
 */

'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import {
  Save, RotateCcw, Loader2, ImageIcon, Type, Palette, FileJson,
  Library, CreditCard, ScanLine, Lock, BookOpen, Monitor,
  ArrowRight, Home, Plus, ChevronUp, ChevronDown, Trash2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import AdminHero from '@/components/admin/AdminHero';

interface ContentItem {
  id: string;
  key: string;
  value: string;
  type: string; // text | image | color | json | number
  screen: string;
  label: string;
  sortOrder?: number;
}

const SCREENS = [
  { value: 'idle', label: '대기 화면' },
  { value: 'main-menu', label: '메인 메뉴' },
  { value: 'auth-scan', label: '인증 스캔' },
  { value: 'auth-pin', label: '인증 PIN' },
  { value: 'loan-select', label: '대출 선택' },
  { value: 'loan-confirm', label: '대출 확인' },
  { value: 'loan-complete', label: '대출 완료' },
  { value: 'loan-dispense', label: '도서 수령' },
  { value: 'loan-history', label: '대출 이력' },
  { value: 'receipt', label: '영수증 발급' },
  { value: 'return-insert', label: '반납 투입' },
  { value: 'return-scanning', label: '반납 스캔' },
  { value: 'return-confirm', label: '반납 확인' },
  { value: 'return-complete', label: '반납 완료' },
  { value: 'card-apply', label: '카드 발급선택' },
  { value: 'card-form', label: '카드 개인정보' },
  { value: 'card-pending', label: '카드 승인대기' },
  { value: 'card-complete', label: '카드 발급완료' },
  { value: 'global', label: '전역 설정' },
] as const;

/** Screen preview mock content renderer */
function ScreenPreview({ screen, backgroundStyle }: { screen: string; backgroundStyle?: CSSProperties }) {
  const screenLabel = SCREENS.find((s) => s.value === screen)?.label || screen;

  const renderContent = () => {
    switch (screen) {
      case 'idle':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-sky-400/20 rounded-full blur-xl" />
              <Library className="w-12 h-12 text-sky-400 relative z-10" />
            </div>
            <p className="text-sky-400 text-sm font-bold tracking-widest">SMART</p>
            <p className="text-sky-400 text-sm font-bold tracking-widest">LIBRARY</p>
            <p className="text-slate-500 text-[10px] mt-2">터치하여 시작</p>
          </div>
        );
      case 'main-menu':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-sky-400 text-xs font-bold tracking-wider mb-2">메인 메뉴</p>
            {[
              { icon: CreditCard, label: '도서카드 발급', color: 'bg-sky-500' },
              { icon: BookOpen, label: '도서 대출', color: 'bg-emerald-500' },
              { icon: ArrowRight, label: '도서 반납', color: 'bg-amber-500' },
            ].map((btn, i) => (
              <div
                key={i}
                className={`w-full ${btn.color} rounded-lg py-2.5 px-3 flex items-center gap-2`}
              >
                <btn.icon className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-medium">{btn.label}</span>
              </div>
            ))}
          </div>
        );
      case 'auth-scan':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-sky-400/20 rounded-full blur-lg" />
              <ScanLine className="w-12 h-12 text-sky-400 relative z-10" />
            </div>
            <p className="text-white text-sm font-medium">도서카드를</p>
            <p className="text-white text-sm font-medium">스캔하세요</p>
            <div className="w-20 h-1 bg-sky-500/30 rounded mt-2" />
          </div>
        );
      case 'auth-pin':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Lock className="w-10 h-10 text-sky-400" />
            <p className="text-white text-sm font-medium">PIN 번호 입력</p>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '←'].map((k, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center text-[10px] text-slate-300"
                >
                  {k}
                </div>
              ))}
            </div>
          </div>
        );
      case 'loan-select':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <BookOpen className="w-10 h-10 text-emerald-400" />
            <p className="text-white text-sm font-medium">도서를 선택하세요</p>
            <div className="w-full px-4 space-y-1.5 mt-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-full h-6 bg-slate-700/60 rounded flex items-center px-2"
                >
                  <div className="w-3 h-3 bg-slate-600 rounded-sm mr-2" />
                  <div className="w-16 h-1.5 bg-slate-600 rounded" />
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Monitor className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-xs font-medium">{screenLabel}</p>
            <p className="text-slate-600 text-[10px]">화면 미리보기</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-slate-400 text-xs font-medium">스크린 프리뷰</p>
      <div
        className="w-[200px] h-[320px] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-lg"
        style={{ background: '#0b1120', ...backgroundStyle }}
      >
        {/* Top status bar mockup */}
        <div className="h-6 bg-slate-800/80 flex items-center justify-between px-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[8px] text-slate-400">온라인</span>
          </div>
          <span className="text-[8px] text-slate-500">12:00</span>
        </div>
        {/* Screen content */}
        <div className="h-[calc(100%-24px)]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

interface MediaAsset {
  id: string;
  path: string;
  fileName?: string;
  mimeType?: string;
}

/** Parse hex (#rgb / #rrggbb) to r/g/b, returns null when invalid */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Derive r/g/b/a from current color value (rgb()/rgba() or hex). */
function parseColorValue(value: string): { r: string; g: string; b: string; a: string } {
  const rgba = value.trim().match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/
  );
  if (rgba) {
    return { r: rgba[1], g: rgba[2], b: rgba[3], a: rgba[4] ?? '' };
  }
  const rgb = hexToRgb(value);
  if (rgb) {
    return { r: String(rgb.r), g: String(rgb.g), b: String(rgb.b), a: '' };
  }
  return { r: '', g: '', b: '', a: '' };
}

const BUTTON_ORDER_OPTIONS = [
  { value: 'card', label: '도서카드 발급' },
  { value: 'loan', label: '도서 대출' },
  { value: 'return', label: '도서 반납' },
] as const;

const DEFAULT_BUTTON_ORDER = ['card', 'loan', 'return'];

/** Parse button_order JSON defensively: filter unknown, append missing. */
function parseButtonOrder(raw: string): string[] {
  const known: string[] = BUTTON_ORDER_OPTIONS.map((o) => o.value);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_BUTTON_ORDER];
    const filtered = parsed.filter(
      (v): v is string => typeof v === 'string' && known.includes(v)
    );
    const deduped = [...new Set(filtered)];
    for (const k of known) {
      if (!deduped.includes(k)) deduped.push(k);
    }
    return deduped;
  } catch {
    return [...DEFAULT_BUTTON_ORDER];
  }
}

export default function ContentSection() {
  const [activeScreen, setActiveScreen] = useState('idle');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [libraryFor, setLibraryFor] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addScreen, setAddScreen] = useState('idle');
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState('text');
  const [addLabel, setAddLabel] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());

  const fetchContent = useCallback(async (screen: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/content?screen=${screen}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.items || []);
      // Initialize edited values
      const vals: Record<string, string> = {};
      (json.items || []).forEach((item: ContentItem) => {
        vals[item.key] = item.value;
      });
      setEditedValues(vals);
    } catch {
      toast.error('콘텐츠를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent(activeScreen);
  }, [activeScreen, fetchContent]);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (key: string, file: File) => {
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '업로드 실패');
      handleValueChange(key, data.media.path);
      toast.success('이미지 업로드 완료');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const openLibrary = async (key: string) => {
    setLibraryFor(key);
    setLibraryLoading(true);
    try {
      const res = await fetch('/api/admin/media?mimeType=image&pageSize=24');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLibraryItems(data.media || []);
    } catch {
      toast.error('미디어 라이브러리를 불러오는데 실패했습니다.');
      setLibraryItems([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    const value = editedValues[key];
    if (value === undefined) return;

    setSaving((prev) => new Set(prev).add(key));
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '저장 실패');
      }
      // Update local item
      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, value } : item))
      );
      toast.success(`"${key}" 저장 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleBulkSave = async () => {
    // Find changed items
    const changedItems = items.filter(
      (item) => editedValues[item.key] !== undefined && editedValues[item.key] !== item.value
    );

    if (changedItems.length === 0) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }

    setBulkSaving(true);
    try {
      const res = await fetch('/api/admin/content/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: changedItems.map((item) => ({
            key: item.key,
            value: editedValues[item.key],
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${changedItems.length}개 항목 저장 완료`);
      // Refresh
      await fetchContent(activeScreen);
    } catch {
      toast.error('일괄 저장에 실패했습니다.');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/admin/content/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      toast.success('기본값으로 복원되었습니다.');
      await fetchContent(activeScreen);
    } catch {
      toast.error('복원에 실패했습니다.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const orderA = a.sortOrder ?? index;
    const orderB = b.sortOrder ?? target;
    setRowBusy((prev) => new Set(prev).add(a.key).add(b.key));
    try {
      for (const payload of [
        { key: a.key, value: editedValues[a.key] ?? a.value, sortOrder: orderB },
        { key: b.key, value: editedValues[b.key] ?? b.value, sortOrder: orderA },
      ]) {
        const res = await fetch('/api/admin/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || '순서 변경 실패');
        }
      }
      await fetchContent(activeScreen);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '순서 변경에 실패했습니다.');
    } finally {
      setRowBusy((prev) => {
        const next = new Set(prev);
        next.delete(a.key);
        next.delete(b.key);
        return next;
      });
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`"${key}" 삭제?`)) return;
    setRowBusy((prev) => new Set(prev).add(key));
    try {
      const res = await fetch(`/api/admin/content?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || '삭제 실패');
      }
      toast.success(`"${key}" 삭제 완료`);
      await fetchContent(activeScreen);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setRowBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAdd = async () => {
    const name = addName.trim();
    if (!addScreen || !name || !addLabel.trim() || !addType) {
      toast.error('모든 필드를 입력해주세요.');
      return;
    }
    const fullKey = `${addScreen}.${name}`;
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: fullKey,
          value: addValue,
          type: addType,
          screen: addScreen,
          label: addLabel.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || '추가 실패');
      }
      toast.success(`"${fullKey}" 추가 완료`);
      setAddOpen(false);
      setAddName('');
      setAddLabel('');
      setAddValue('');
      setAddType('text');
      await fetchContent(activeScreen);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '추가에 실패했습니다.');
    } finally {
      setAddSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'color': return <Palette className="w-4 h-4" />;
      case 'json': return <FileJson className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      image: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
      color: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
      json: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      number: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    };
    return colors[type] || 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
  };

  const renderField = (item: ContentItem) => {
    const currentValue = editedValues[item.key] ?? item.value;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isChanged = currentValue !== item.value;
    const inputBase = 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-sky-500';

    if (item.key === 'mainmenu.button_order') {
      const order = parseButtonOrder(currentValue);
      const moveOrder = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= order.length) return;
        const next = [...order];
        [next[idx], next[j]] = [next[j], next[idx]];
        handleValueChange(item.key, JSON.stringify(next));
      };
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">키오스크 메인 화면 버튼 순서 (위→아래)</p>
          <div className="space-y-1.5">
            {order.map((v, idx) => {
              const opt = BUTTON_ORDER_OPTIONS.find((o) => o.value === v);
              return (
                <div
                  key={v}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2"
                >
                  <span className="text-xs font-medium text-white flex-1">
                    {idx + 1}. {opt?.label ?? v}
                    <span className="ml-2 font-mono text-[11px] text-slate-500">{v}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => moveOrder(idx, -1)}
                    disabled={idx === 0}
                    className="h-7 w-7 p-0 border-slate-700 text-slate-200"
                    aria-label="위로"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => moveOrder(idx, 1)}
                    disabled={idx === order.length - 1}
                    className="h-7 w-7 p-0 border-slate-700 text-slate-200"
                    aria-label="아래로"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    switch (item.type) {
      case 'color': {
        const { r, g, b, a } = parseColorValue(currentValue);
        const pickerValue =
          hexToRgb(currentValue)
            ? (currentValue.length === 4
                ? rgbToHex(
                    hexToRgb(currentValue)!.r,
                    hexToRgb(currentValue)!.g,
                    hexToRgb(currentValue)!.b
                  )
                : currentValue)
            : r !== '' && g !== '' && b !== ''
              ? rgbToHex(Number(r), Number(g), Number(b))
              : '#000000';
        const emitRgb = (nr: string, ng: string, nb: string, na: string) => {
          const ir = Math.max(0, Math.min(255, Number(nr)));
          const ig = Math.max(0, Math.min(255, Number(ng)));
          const ib = Math.max(0, Math.min(255, Number(nb)));
          if (Number.isNaN(ir) || Number.isNaN(ig) || Number.isNaN(ib)) return;
          if (na !== '' && Number(na) < 1) {
            handleValueChange(item.key, `rgba(${ir}, ${ig}, ${ib}, ${na})`);
          } else {
            handleValueChange(item.key, `rgb(${ir}, ${ig}, ${ib})`);
          }
        };
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={pickerValue}
                onChange={(e) => handleValueChange(item.key, e.target.value)}
                className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer shrink-0"
              />
              <Input
                value={currentValue}
                onChange={(e) => handleValueChange(item.key, e.target.value)}
                className={`flex-1 h-12 ${inputBase}`}
                placeholder="#000000"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-400 shrink-0">R</Label>
              <Input
                type="number"
                min={0}
                max={255}
                value={r}
                onChange={(e) => emitRgb(e.target.value, g === '' ? '0' : g, b === '' ? '0' : b, a)}
                className={`h-9 ${inputBase}`}
              />
              <Label className="text-xs text-slate-400 shrink-0">G</Label>
              <Input
                type="number"
                min={0}
                max={255}
                value={g}
                onChange={(e) => emitRgb(r === '' ? '0' : r, e.target.value, b === '' ? '0' : b, a)}
                className={`h-9 ${inputBase}`}
              />
              <Label className="text-xs text-slate-400 shrink-0">B</Label>
              <Input
                type="number"
                min={0}
                max={255}
                value={b}
                onChange={(e) => emitRgb(r === '' ? '0' : r, g === '' ? '0' : g, e.target.value, a)}
                className={`h-9 ${inputBase}`}
              />
              <Label className="text-xs text-slate-400 shrink-0">A</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={a}
                placeholder="1"
                onChange={(e) => emitRgb(r === '' ? '0' : r, g === '' ? '0' : g, b === '' ? '0' : b, e.target.value)}
                className={`h-9 ${inputBase}`}
              />
            </div>
          </div>
        );
      }
      case 'image': {
        const isUploading = !!uploading[item.key];
        const inputId = `image-upload-${item.key}`;
        return (
          <div className="space-y-2">
            <Input
              value={currentValue}
              onChange={(e) => handleValueChange(item.key, e.target.value)}
              className={`h-12 ${inputBase}`}
              placeholder="이미지 URL 입력"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUploading}
                onClick={() => document.getElementById(inputId)?.click()}
                className="h-8 border-slate-700 text-slate-200"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                업로드
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openLibrary(item.key)}
                className="h-8 border-slate-700 text-slate-200"
              >
                라이브러리
              </Button>
              <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleImageUpload(item.key, file);
                }}
              />
            </div>
            {currentValue && (
              <div>
                <div className="w-32 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                  <img
                    src={currentValue}
                    alt="콘텐츠 이미지 미리보기"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-1 break-all">{currentValue}</p>
              </div>
            )}
          </div>
        );
      }
      case 'json':
        return (
          <Textarea
            value={currentValue}
            onChange={(e) => handleValueChange(item.key, e.target.value)}
            className={`min-h-[120px] font-mono text-sm ${inputBase}`}
            placeholder="JSON 형식으로 입력"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(item.key, e.target.value)}
            className={`h-12 ${inputBase}`}
          />
        );
      default:
        return (
          <Input
            value={currentValue}
            onChange={(e) => handleValueChange(item.key, e.target.value)}
            className={`h-12 ${inputBase}`}
          />
        );
    }
  };

  const changedCount = items.filter(
    (item) => editedValues[item.key] !== undefined && editedValues[item.key] !== item.value
  ).length;

  // Live preview background: lookup saved values, overlay unsaved edits
  const valueLookup: Record<string, string> = {};
  items.forEach((item) => {
    valueLookup[item.key] = item.value;
  });
  Object.assign(valueLookup, editedValues);

  const getPreviewStyle = (tabValue: string): CSSProperties | undefined => {
    const img = (valueLookup[`${tabValue}.background_image_url`] ?? '').trim();
    if (img && (img.startsWith('/') || img.startsWith('https://'))) {
      return { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    const color = (valueLookup[`${tabValue}.background_color`] ?? '').trim();
    if (color) {
      return { background: color };
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* ──────── Hero Banner ──────── */}
      <AdminHero icon={Type} title="키오스크 화면 편집" subtitle="각 화면의 텍스트, 색상, 이미지를 커스터마이징합니다" accent="violet" />

      {/* Section Header with sky-blue gradient underline */}
      <div className="relative">
        <h2 className="text-xl font-bold text-white">콘텐츠 관리</h2>
        <div className="absolute -bottom-1 left-0 h-0.5 w-32 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent" />
      </div>

      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {changedCount > 0 && (
            <Badge className="text-sm bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {changedCount}개 변경됨
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAddScreen(activeScreen);
              setAddOpen(true);
            }}
            className="h-9 px-3 text-sm rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            콘텐츠 추가
          </button>
          <button
            onClick={handleReset}
            className="h-9 px-3 text-sm rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 text-slate-200 hover:from-slate-500 hover:to-slate-600 transition-all flex items-center gap-1.5 border border-slate-500/30"
          >
            <RotateCcw className="w-4 h-4" />
            기본값 복원
          </button>
          <button
            onClick={handleBulkSave}
            disabled={bulkSaving || changedCount === 0}
            className="h-9 px-3 text-sm rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 text-white hover:from-sky-400 hover:to-sky-500 transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            일괄 저장
          </button>
        </div>
      </div>

      {/* 화면 탭 */}
      <Tabs value={activeScreen} onValueChange={setActiveScreen}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-900 p-1.5 border border-slate-700 rounded-xl">
          {SCREENS.map((screen) => (
            <TabsTrigger
              key={screen.value}
              value={screen.value}
              className="data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-sky-500/20 px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              {screen.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCREENS.map((screen) => (
          <TabsContent key={screen.value} value={screen.value} className="mt-4">
            <div className="flex gap-6 items-start">
              {/* Editor area */}
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="bg-slate-900 border-slate-700">
                        <CardContent className="p-4">
                          <Skeleton className="h-10 w-full bg-slate-800" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <Card className="bg-slate-900 border-slate-700">
                    <CardContent className="p-8 text-center">
                      <p className="text-slate-400">해당 화면에 편집 가능한 콘텐츠가 없습니다.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                {items.map((item, index) => {
                      const isChanged = (editedValues[item.key] ?? item.value) !== item.value;
                      const isSaving = saving.has(item.key);
                      const isBusy = isSaving || rowBusy.has(item.key);

                      return (
                        <Card
                          key={item.id}
                          className={`bg-slate-900 border-slate-700 text-white shadow-sm ${isChanged ? 'ring-2 ring-sky-500/40' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sky-400">{getTypeIcon(item.type)}</span>
                                  <Label className="text-sm font-medium text-white">{item.label}</Label>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeBadge(item.type)}`}>
                                    {item.type}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {item.key}
                                  </span>
                                  {isChanged && (
                                    <Badge className="text-xs px-1.5 py-0 bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                      변경됨
                                    </Badge>
                                  )}
                                </div>
                                {renderField(item)}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0 mt-6">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(item.key)}
                                  disabled={!isChanged || isBusy}
                                  className="h-9 bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </Button>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMove(index, -1)}
                                    disabled={index === 0 || isBusy}
                                    className="h-7 w-7 p-0 border-slate-700 text-slate-200"
                                    aria-label="위로 이동"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMove(index, 1)}
                                    disabled={index === items.length - 1 || isBusy}
                                    className="h-7 w-7 p-0 border-slate-700 text-slate-200"
                                    aria-label="아래로 이동"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(item.key)}
                                    disabled={isBusy}
                                    className="h-7 w-7 p-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    aria-label="삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Screen Preview Panel - visible on lg screens, above editor on mobile */}
              <div className="hidden lg:block shrink-0 sticky top-4">
                <ScreenPreview screen={screen.value} backgroundStyle={getPreviewStyle(screen.value)} />
              </div>
            </div>

            {/* Mobile preview - shown above editor on smaller screens */}
            <div className="lg:hidden mt-4 flex justify-center">
              <ScreenPreview screen={screen.value} backgroundStyle={getPreviewStyle(screen.value)} />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add content dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">콘텐츠 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">화면</Label>
              <Select value={addScreen} onValueChange={setAddScreen}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="화면 선택" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {SCREENS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">키 이름</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="예: subtitle"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-500 font-mono">
                전체 키: {addScreen}.{addName.trim() || '...'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">타입</Label>
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="타입 선택" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {['text', 'image', 'color', 'json', 'number'].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">표시 이름</Label>
              <Input
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="표시 이름 입력"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">값</Label>
              <Textarea
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="값 입력"
                className="min-h-[100px] bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="border-slate-700 text-slate-200"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={addSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media library picker modal */}
      {libraryFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <p className="text-sm font-medium text-white">미디어 라이브러리 (이미지)</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLibraryFor(null)}
                className="h-8 border-slate-700 text-slate-200"
              >
                닫기
              </Button>
            </div>
            <div className="overflow-y-auto p-4">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                </div>
              ) : libraryItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  등록된 이미지가 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {libraryItems.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleValueChange(libraryFor, m.path);
                        setLibraryFor(null);
                      }}
                      className="group overflow-hidden rounded-lg border border-slate-700 bg-slate-800 hover:border-sky-500"
                    >
                      <img
                        src={m.path}
                        alt={m.fileName || m.path}
                        className="h-24 w-full object-contain"
                        loading="lazy"
                      />
                      <p className="truncate px-1 py-1 text-[10px] text-slate-500 font-mono">
                        {m.path}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
