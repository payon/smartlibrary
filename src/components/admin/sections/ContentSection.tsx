/**
 * 콘텐츠 관리 섹션
 *
 * [역할]
 * - 키오스크 화면별 콘텐츠 편집
 * - 텍스트, 색상, 이미지, JSON 타입 지원
 * - 개별/일괄 저장
 * - 기본값 복원
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, RotateCcw, Loader2, ImageIcon, Type, Palette, FileJson } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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
      text: 'bg-emerald-100 text-emerald-700',
      image: 'bg-blue-100 text-blue-700',
      color: 'bg-violet-100 text-violet-700',
      json: 'bg-amber-100 text-amber-700',
      number: 'bg-slate-100 text-slate-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  const renderField = (item: ContentItem) => {
    const currentValue = editedValues[item.key] ?? item.value;
    const isChanged = currentValue !== item.value;

    switch (item.type) {
      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={currentValue || '#000000'}
              onChange={(e) => handleValueChange(item.key, e.target.value)}
              className="w-12 h-12 rounded-lg border-2 cursor-pointer shrink-0"
            />
            <Input
              value={currentValue}
              onChange={(e) => handleValueChange(item.key, e.target.value)}
              className="flex-1 h-12"
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
              className="h-12"
              placeholder="이미지 URL 입력"
            />
            {currentValue && (
              <div className="w-32 h-24 rounded-lg overflow-hidden border bg-muted">
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
            className="min-h-[120px] font-mono text-sm"
            placeholder="JSON 형식으로 입력"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(item.key, e.target.value)}
            className="h-12"
          />
        );
      default:
        return (
          <Input
            value={currentValue}
            onChange={(e) => handleValueChange(item.key, e.target.value)}
            className="h-12"
          />
        );
    }
  };

  const changedCount = items.filter(
    (item) => editedValues[item.key] !== undefined && editedValues[item.key] !== item.value
  ).length;

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {changedCount > 0 && (
            <Badge variant="secondary" className="text-sm">
              {changedCount}개 변경됨
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-9"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            기본값 복원
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkSave}
            disabled={bulkSaving || changedCount === 0}
            className="h-9"
          >
            {bulkSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            일괄 저장
          </Button>
        </div>
      </div>

      {/* 화면 탭 */}
      <Tabs value={activeScreen} onValueChange={setActiveScreen}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {SCREENS.map((screen) => (
            <TabsTrigger
              key={screen.value}
              value={screen.value}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm rounded-lg border border-border"
            >
              {screen.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCREENS.map((screen) => (
          <TabsContent key={screen.value} value={screen.value} className="mt-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">해당 화면에 편집 가능한 콘텐츠가 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const isChanged = (editedValues[item.key] ?? item.value) !== item.value;
                  const isSaving = saving.has(item.key);

                  return (
                    <Card key={item.id} className={`shadow-sm ${isChanged ? 'ring-2 ring-primary/30' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(item.type)}
                              <Label className="text-sm font-medium">{item.label}</Label>
                              <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${getTypeBadge(item.type)}`}>
                                {item.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {item.key}
                              </span>
                              {isChanged && (
                                <Badge variant="default" className="text-xs px-1.5 py-0">
                                  변경됨
                                </Badge>
                              )}
                            </div>
                            {renderField(item)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSave(item.key)}
                            disabled={!isChanged || isSaving}
                            className="h-9 shrink-0 mt-6"
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
