/**
 * 미디어 자산 관리 API 라우트
 *
 * [GET] /api/admin/media
 * 미디어 자산 목록을 조회합니다.
 *
 * [POST] /api/admin/media
 * 미디어 파일을 업로드합니다. 래스터 이미지는 프론트 표시에 맞게
 * 자동으로 리사이즈됩니다 (긴 변 기준 최대 1920px, 비율 유지).
 *
 * [보안]
 * - 세션 DB 검증 포함 관리자 인증 (requireAdmin)
 * - MIME 화이트리스트 + 확장자 매핑 (사용자 파일명 확장자 무시)
 * - SVG 스크립트/이벤트핸들러 스캔 (동일 출처 스크립트 실행 방지)
 * - 파일 크기 10MB 제한
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/** 업로드 디렉토리 */
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/** 허용된 MIME 타입 → 저장 확장자 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
};

/** 리사이즈 제외 (원본 그대로 저장) */
const NO_RESIZE_TYPES = new Set(['image/gif', 'image/svg+xml', 'video/mp4']);

/** 최대 파일 크기 (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 리사이즈 기준 (긴 변 최대 px — 키오스크 표시용) */
const MAX_IMAGE_DIMENSION = 1920;

/** SVG 위험 패턴 (스크립트 실행 가능 요소) */
const SVG_DANGER_PATTERNS = [
  /<script[\s>]/i,
  /\son\w+\s*=/i, // onclick= 등 이벤트 핸들러
  /javascript:/i,
  /<foreignObject[\s>]/i,
  /<handler[\s>]/i,
  /<listener[\s>]/i,
];

/**
 * 미디어 자산 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'content:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
    );
    const mimeType = searchParams.get('mimeType') || undefined;

    const where: Record<string, unknown> = {};
    if (mimeType) {
      where.mimeType = { startsWith: mimeType };
    }

    const [media, total] = await Promise.all([
      db.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.mediaAsset.count({ where }),
    ]);

    return json({ media, total, page, pageSize });
  } catch (error) {
    console.error('미디어 목록 조회 오류:', error);
    return json(
      { error: '미디어 목록을 조회하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 미디어 파일 업로드
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
      return json(
        { error: '파일이 필요합니다.' },
        400
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { error: '파일 크기는 10MB를 초과할 수 없습니다.' },
        400
      );
    }
    if (file.size === 0) {
      return json({ error: '빈 파일은 업로드할 수 없습니다.' }, 400);
    }

    // MIME 타입 검증 (확장자는 서버 매핑 사용)
    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      return json(
        { error: `지원하지 않는 파일 형식입니다: ${file.type || 'unknown'}` },
        400
      );
    }

    let buffer: Uint8Array = new Uint8Array(await file.arrayBuffer());
    let width: number | undefined;
    let height: number | undefined;

    // SVG 위험 요소 스캔
    if (file.type === 'image/svg+xml') {
      const text = Buffer.from(buffer).toString('utf-8').slice(0, 200_000);
      for (const pattern of SVG_DANGER_PATTERNS) {
        if (pattern.test(text)) {
          return json(
            { error: '스크립트가 포함된 SVG는 업로드할 수 없습니다.' },
            400
          );
        }
      }
    } else if (!NO_RESIZE_TYPES.has(file.type)) {
      // 래스터 이미지 자동 리사이즈 (긴 변 1920px 초과 시 비율 유지 축소)
      try {
        const sharp = (await import('sharp')).default;
        const image = sharp(buffer, { animated: false });
        const meta = await image.metadata();
        width = meta.width;
        height = meta.height;
        const longest = Math.max(meta.width || 0, meta.height || 0);
        if (longest > MAX_IMAGE_DIMENSION) {
          buffer = await image
            .resize({
              width:
                (meta.width || 0) >= (meta.height || 0) ? MAX_IMAGE_DIMENSION : undefined,
              height:
                (meta.height || 0) > (meta.width || 0) ? MAX_IMAGE_DIMENSION : undefined,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .toBuffer();
          const resizedMeta = await sharp(buffer).metadata();
          width = resizedMeta.width;
          height = resizedMeta.height;
        }
      } catch {
        // 리사이즈 실패 시 원본 그대로 저장 (처리 중단하지 않음)
      }
    }

    // 업로드 디렉토리 생성
    await mkdir(UPLOAD_DIR, { recursive: true });

    // 고유 파일명 생성 (uuid v4 CSPRNG, 사용자 입력 미사용)
    const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // 파일 저장
    await writeFile(filePath, buffer);

    // DB에 메타데이터 저장
    const mediaAsset = await db.mediaAsset.create({
      data: {
        filename,
        originalName: file.name.slice(0, 200),
        mimeType: file.type,
        size: buffer.length,
        path: `/uploads/${filename}`,
        uploadedBy: auth.payload.userId,
      },
    });

    // 감사 로그 기록
    await logAudit({
      userId: auth.payload.userId,
      action: 'create',
      entity: 'content',
      entityId: mediaAsset.id,
      details: { filename, originalName: file.name, size: buffer.length, mimeType: file.type },
      ipAddress: getClientIp(request),
    });

    return json({
      media: mediaAsset,
      width,
      height,
      resized: width !== undefined && Math.max(width, height || 0) >= MAX_IMAGE_DIMENSION,
      message: '파일이 업로드되었습니다',
    });
  } catch (error) {
    console.error('미디어 업로드 오류:', error);
    return json(
      { error: '파일을 업로드하는 중 오류가 발생했습니다.' },
      500
    );
  }
}
