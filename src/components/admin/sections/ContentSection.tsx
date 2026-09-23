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

import { useEffect, useState, useCallback } from 'react';
import {
  Save, RotateCcw, Loader2, ImageIcon, Type, Palette, FileJson,
  Library, CreditCard, ScanLine, Lock, BookOpen, Monitor,
  ArrowRight, Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Image from 'next/image';

interface ContentItem {
  id: string;
  key: string;
  value: string;
  type: string; // text | image | color | json | number
  screen: string;
  label: string;
}

const SCREENS = [
  { value: 'idle', label: '대기 화면' },
  { value: 'main-menu', label: '메인 메뉴' },
  { value: 'auth-scan', label: '인증 스캔' },
  { value: 'auth-pin', label: '인증 PIN' },
  { value: 'loan-select', label: '대출 선택' },
  { value: 'loan-confirm', label: '대출 확인' },
  { value: 'loan-complete', label: '대출 완료' },
  { value: 'return-insert', label: '반납 투입' },
  { value: 'return-scanning', label: '반납 스캔' },
  { value: 'return-confirm', label: '반납 확인' },
  { value: 'return-complete', label: '반납 완료' },
  { value: 'global', label: '전역 설정' },
] as const;

/** Screen preview mock content renderer */
function ScreenPreview({ screen }: { screen: string }) {
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
        style={{ background: '#0b1120' }}
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

export default function ContentSection() {
  const [activeScreen, setActiveScreen] = useState('idle');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

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
    const isChanged = currentValue !== item.value;
    const inputBase = 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-sky-500';

    switch (item.type) {
      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={currentValue || '#000000'}
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
        );
      case 'image':
        return (
          <div className="space-y-2">
            <Input
              value={currentValue}
              onChange={(e) => handleValueChange(item.key, e.target.value)}
              className={`h-12 ${inputBase}`}
              placeholder="이미지 URL 입력"
            />
            {currentValue && (
              <div className="w-32 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                <img
                  src={currentValue}
                  alt="콘텐츠 이미지 미리보기"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        );
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

  return (
    <div className="space-y-4">
      {/* ──────── Hero Banner ──────── */}
      <div className="relative w-full h-[100px] rounded-xl overflow-hidden border border-slate-700 mb-2">
        <Image
          src="/images/admin/content-hero.png"
          alt="콘텐츠 배너"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6">
          <div>
            <p className="text-lg font-bold text-white">키오스크 화면 편집</p>
            <p className="text-sm text-slate-300">각 화면의 텍스트, 색상, 이미지를 커스터마이징합니다</p>
          </div>
        </div>
      </div>

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
                    {items.map((item) => {
                      const isChanged = (editedValues[item.key] ?? item.value) !== item.value;
                      const isSaving = saving.has(item.key);

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
                              <Button
                                size="sm"
                                onClick={() => handleSave(item.key)}
                                disabled={!isChanged || isSaving}
                                className="h-9 shrink-0 mt-6 bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </Button>
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
                <ScreenPreview screen={screen.value} />
              </div>
            </div>

            {/* Mobile preview - shown above editor on smaller screens */}
            <div className="lg:hidden mt-4 flex justify-center">
              <ScreenPreview screen={screen.value} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
