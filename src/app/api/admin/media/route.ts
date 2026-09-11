/**
 * 미디어 자산 관리 API 라우트
 *
 * [GET] /api/admin/media
 * 미디어 자산 목록을 조회합니다.
 *
 * [POST] /api/admin/media
 * 미디어 파일을 업로드합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/** 업로드 디렉토리 */
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/** 허용된 MIME 타입 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'audio/mpeg',
  'audio/ogg',
];

/** 최대 파일 크기 (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 미디어 자산 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'content:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
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

    return NextResponse.json({ media, total, page, pageSize });
  } catch (error) {
    console.error('미디어 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '미디어 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 미디어 파일 업로드
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'content:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 10MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // MIME 타입 검증
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식입니다: ${file.type}` },
        { status: 400 }
      );
    }

    // 업로드 디렉토리 생성
    await mkdir(UPLOAD_DIR, { recursive: true });

    // 고유 파일명 생성
    const ext = path.extname(file.name) || '.' + file.type.split('/')[1];
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // 파일 저장
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // DB에 메타데이터 저장
    const mediaAsset = await db.mediaAsset.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: `/uploads/${filename}`,
        uploadedBy: payload.userId,
      },
    });

    // 감사 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'create',
      entity: 'content',
      entityId: mediaAsset.id,
      details: { filename, originalName: file.name, size: file.size, mimeType: file.type },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      media: mediaAsset,
      message: '파일이 업로드되었습니다',
    });
  } catch (error) {
    console.error('미디어 업로드 오류:', error);
    return NextResponse.json(
      { error: '파일을 업로드하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
