/**
 * PWA/TWA 아이콘 관리 섹션
 *
 * [역할]
 * - 원본 이미지 1장으로 manifest/TWA 규격 아이콘 자동 생성
 * - 기기별 적용 규격 안내 (모바일/태블릿/데스크톱/iOS/마스크블)
 * - 현재 아이콘 미리보기 + 재생성
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Smartphone, Upload, RefreshCw, Loader2, Monitor, Tablet, AppWindow, Apple } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAdminStore } from '@/stores/useAdminStore';
import AdminHero from '@/components/admin/AdminHero';

interface PwaIconStatus {
  file: string;
  url: string;
  size: number;
  maskable: boolean;
  exists: boolean;
  bytes: number;
  mtime: string | null;
}

/** 기기별 사용 규격 안내 */
const DEVICE_MAP = [
  { device: '모바일 (Android)', icon: Smartphone, spec: '192px + maskable 192px', desc: '홈화면 설치·스플래시·적응형 아이콘' },
  { device: '태블릿', icon: Tablet, spec: '192px / 512px', desc: '런처 해상도에 따라 자동 선택' },
  { device: '데스크톱 (Chrome/Edge)', icon: Monitor, spec: '512px', desc: '앱 설치 프롬프트·작업 표시줄' },
  { device: 'PWA 스플래시·스토어', icon: AppWindow, spec: '512px / 1024px', desc: '실행 화면·마스크블 폴백' },
  { device: 'iOS (Safari)', icon: Apple, spec: '180px (apple-touch-icon)', desc: '홈화면 추가 전용 규격' },
];

export default function PwaIconSection() {
  const hasWrite = useAdminStore((s) => s.hasPermission)('content:write');
  const [icons, setIcons] = useState<PwaIconStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(() => Date.now());

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pwa-icons');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIcons(data.icons || []);
    } catch {
      toast.error('아이콘 상태를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSelect = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('원본은 PNG/JPEG/WebP 형식이어야 합니다.');
      return;
    }
    setSourceFile(file);
    const url = URL.createObjectURL(file);
    setSourcePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleGenerate = async () => {
    if (!sourceFile) {
      toast.error('원본 이미지를 먼저 선택해주세요.');
      return;
    }
    setGenerating(true);
    try {
      const form = new FormData();
      form.append('file', sourceFile);
      const res = await fetch('/api/admin/pwa-icons', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      toast.success(data.message);
      setCacheBust(Date.now());
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminHero
        icon={Smartphone}
        title="PWA / TWA 아이콘 관리"
        subtitle="원본 1장으로 전 기기 규격을 자동 생성합니다"
        accent="sky"
      />

      <div className="relative">
        <h2 className="text-xl font-bold text-white">PWA 아이콘</h2>
        <div className="absolute -bottom-1 left-0 h-0.5 w-32 bg-gradient-to-r from-sky-500 via-sky-400 to-transparent" />
      </div>

      {!hasWrite && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4 text-sm text-slate-400">
            읽기 전용 권한입니다. 아이콘 변경은 콘텐츠 쓰기 권한이 필요합니다.
          </CardContent>
        </Card>
      )}

      {/* 현재 아이콘 미리보기 */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">현재 적용 아이콘</p>
          {loading ? (
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-16 h-16 rounded-xl bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 flex-wrap">
              {icons.map((icon) => (
                <div key={icon.file} className="flex flex-col items-center gap-1.5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center">
                    {icon.exists ? (
                      <img
                        src={`${icon.url}?v=${cacheBust}`}
                        alt={icon.file}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">없음</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{icon.size}px</span>
                  {icon.maskable && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-violet-500/20 text-violet-400 border border-violet-500/30">
                      maskable
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 원본 업로드 + 생성 */}
      {hasWrite && (
        <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-200">원본 이미지로 재생성</p>
            <p className="text-xs text-slate-400">
              정사각형 PNG 권장 (긴 변 1024px 이상). 32/180/192/512/1024px + maskable 2종을 자동 생성하며,
              기존 아이콘 파일을 덮어씁니다.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {sourcePreview && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-600 bg-slate-800">
                  <img src={sourcePreview} alt="원본 미리보기" className="w-full h-full object-contain" />
                </div>
              )}
              <label className="h-10 px-4 flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-600 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer">
                <Upload className="w-4 h-4" />
                원본 선택
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleSelect(e.target.files?.[0])}
                />
              </label>
              <button
                onClick={handleGenerate}
                disabled={generating || !sourceFile}
                className="h-10 px-4 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 text-white text-sm font-medium hover:from-sky-500 hover:to-sky-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {generating ? '생성 중...' : '아이콘 생성'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 기기별 적용 안내 */}
      <Card className="bg-slate-900 text-white border-slate-700 shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">기기별 적용 규격</p>
          <div className="space-y-2">
            {DEVICE_MAP.map((row) => (
              <div key={row.device} className="flex items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2.5">
                <row.icon className="w-5 h-5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium">
                    {row.device}
                    <span className="ml-2 text-xs font-mono text-sky-300">{row.spec}</span>
                  </p>
                  <p className="text-xs text-slate-400">{row.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            21/24/32인치 키오스크 모니터는 브라우저 해상도에 따라 192px 또는 512px 아이콘이 자동 선택됩니다.
            변경 후 단말 캐시(최대 1년)에 따라 반영이 지연될 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
