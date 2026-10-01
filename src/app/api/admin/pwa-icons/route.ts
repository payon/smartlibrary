/**
 * PWA/TWA 아이콘 관리 API 라우트
 *
 * [GET] /api/admin/pwa-icons
 * 현재 아이콘 파일 상태(존재/크기)를 반환합니다.
 *
 * [POST] /api/admin/pwa-icons (content:write)
 * 원본 이미지 1장으로 전 규격 아이콘을 자동 생성합니다.
 * - 일반: 32/180/192/512/1024px (cover 정사각형 크롭)
 * - maskable 192/512px: 80% 영역에 배치 + 테마 배경 패딩 (어댑티브 아이콘 규격)
 * - 생성 파일은 manifest.json / layout.tsx가 참조하는 고정 경로에 덮어씀
 */

import { NextRequest } from 'next/server';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';
import { stat, writeFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/** 아이콘 디렉토리 */
const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');

/** 허용 소스 MIME */
const ALLOWED_SOURCE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** 최대 소스 크기 (10MB) */
const MAX_SOURCE_SIZE = 10 * 1024 * 1024;

/** 최소 소스 해상도 (긴 변 기준) */
const MIN_SOURCE_DIMENSION = 512;

/** maskable 패딩 배경색 (앱 테마) */
const MASKABLE_BACKGROUND = '#0f172a';

interface IconSpec {
  file: string;
  size: number;
  maskable: boolean;
}

/** 생성 규격 (manifest.json + layout.tsx 참조와 일치) */
const ICON_SPECS: IconSpec[] = [
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'icon-180.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-1024.png', size: 1024, maskable: false },
  { file: 'maskable-icon-192.png', size: 192, maskable: true },
  { file: 'maskable-icon-512.png', size: 512, maskable: true },
];

/**
 * 현재 아이콘 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'content:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const icons = await Promise.all(
      ICON_SPECS.map(async (spec) => {
        try {
          const st = await stat(path.join(ICONS_DIR, spec.file));
          return {
            file: spec.file,
            url: `/icons/${spec.file}`,
            size: spec.size,
            maskable: spec.maskable,
            exists: true,
            bytes: st.size,
            mtime: st.mtime.toISOString(),
          };
        } catch {
          return {
            file: spec.file,
            url: `/icons/${spec.file}`,
            size: spec.size,
            maskable: spec.maskable,
            exists: false,
            bytes: 0,
            mtime: null,
          };
        }
      })
    );

    return json({ icons });
  } catch (error) {
    console.error('PWA 아이콘 조회 오류:', error);
    return json({ error: '아이콘 상태를 조회하는 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 원본 이미지로 전 규격 아이콘 생성
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'content:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return json({ error: '원본 이미지 파일이 필요합니다.' }, 400);
    }
    if (file.size > MAX_SOURCE_SIZE) {
      return json({ error: '원본 이미지는 10MB를 초과할 수 없습니다.' }, 400);
    }
    if (file.size === 0) {
      return json({ error: '빈 파일은 업로드할 수 없습니다.' }, 400);
    }
    if (!(ALLOWED_SOURCE_MIME as readonly string[]).includes(file.type)) {
      return json({ error: '원본은 PNG/JPEG/WebP 형식이어야 합니다.' }, 400);
    }

    const input = new Uint8Array(await file.arrayBuffer());
    const sharp = (await import('sharp')).default;

    const meta = await sharp(input).metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    if (longest < MIN_SOURCE_DIMENSION) {
      return json(
        { error: `원본 해상도가 너무 낮습니다. 긴 변 ${MIN_SOURCE_DIMENSION}px 이상 권장.` },
        400
      );
    }

    const results: Array<{ file: string; size: number; bytes: number }> = [];
    for (const spec of ICON_SPECS) {
      let pipeline = sharp(input).resize(spec.size, spec.size, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: false,
      });

      if (spec.maskable) {
        // 어댑티브 아이콘 세이프존: 80% 영역에 배치 후 테마 배경으로 패딩
        const inner = Math.round((spec.size * 80) / 100);
        const resized = await sharp(input)
          .resize(inner, inner, { fit: 'cover', position: 'centre' })
          .toBuffer();
        pipeline = sharp({
          create: {
            width: spec.size,
            height: spec.size,
            channels: 4,
            background: MASKABLE_BACKGROUND,
          },
        }).composite([{ input: resized, gravity: 'center' }]);
      }

      const buffer = await pipeline.png().toBuffer();
      await writeFile(path.join(ICONS_DIR, spec.file), buffer);
      results.push({ file: spec.file, size: spec.size, bytes: buffer.length });
    }

    await logAudit({
      userId: auth.payload.userId,
      action: 'update',
      entity: 'content',
      details: { pwaIconsRegenerated: true, count: results.length, source: file.name },
      ipAddress: getClientIp(request),
    });

    return json({
      icons: results,
      message: `PWA 아이콘 ${results.length}종이 생성되었습니다. 단말 캐시에 따라 반영까지 시간이 걸릴 수 있습니다.`,
    });
  } catch (error) {
    console.error('PWA 아이콘 생성 오류:', error);
    return json({ error: '아이콘을 생성하는 중 오류가 발생했습니다.' }, 500);
  }
}
