/**
 * CMS 미디어 모듈 (이미지 + 화면 배경 테마)
 *
 * [설계]
 * - 관리자가 등록한 이미지/배경색/배경이미지를 프론트에 즉시 반영
 * - 모든 URL은 화이트리스트 검증 (상대경로 또는 https만 허용)
 * - 색상은 hex만 허용 (CSS 인젝션 방지)
 * - 값이 비어있으면 기본 테마 유지 (fallbackColor)
 */

'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';

/** 이미지 URL 허용 검사: 상대경로(/...) 또는 https:// 만 허용 */
export function isSafeImageUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  if (url.startsWith('https://')) return true;
  return false;
}

/** 배경색 허용 검사: hex 또는 rgb()/rgba() */
export function isSafeColor(color: string): boolean {
  if (typeof color !== 'string' || color.length === 0 || color.length > 100) return false;
  const v = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
  const m =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0+)\s*)?\)$/.exec(
      v
    );
  if (!m) return false;
  return [m[1], m[2], m[3]].every((n) => {
    const num = parseInt(n, 10);
    return num >= 0 && num <= 255;
  });
}

// ============================================================================
// CmsImage — CMS 관리 이미지 (누락/깨짐 시 자동 숨김)
// ============================================================================

interface CmsImageProps {
  /** 콘텐츠 키 (예: "idle.logo_url") */
  contentKey: string;
  /** CMS 값이 없을 때 사용할 기본 이미지 (없으면 렌더 생략) */
  fallback?: string;
  /** 대체 텍스트 (접근성) */
  alt: string;
  /** 래퍼 클래스명 */
  className?: string;
  /** img 클래스명 */
  imgClassName?: string;
}

export function CmsImage({ contentKey, fallback = '', alt, className, imgClassName }: CmsImageProps) {
  const cmsContent = useAppStore((s) => s.cmsContent);
  const [broken, setBroken] = useState(false);

  const raw = cmsContent[contentKey] || '';
  const src = isSafeImageUrl(raw) ? raw : isSafeImageUrl(fallback) ? fallback : '';

  if (!src || broken) return null;

  return (
    <span className={className} role="img" aria-label={alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        onError={() => setBroken(true)}
        loading="lazy"
      />
    </span>
  );
}

// ============================================================================
// useScreenTheme — 화면 배경 테마 (배경이미지 > 배경색 > 기본값)
// ============================================================================

interface ScreenTheme {
  /** 루트 div의 style에 그대로 적용 */
  style: React.CSSProperties;
}

/**
 * 관리자 지정 화면 배경을 해석합니다.
 * - `{screen}.background_image_url` 우선, 다음 `{screen}.background_color`
 * - 맞춤 방식은 `{screen}.background_fit` (cover | contain, 기본 cover)
 *   - cover: 화면을 가득 채움 (잘릴 수 있음) / contain: 잘림 없이 맞춤
 * - 둘 다 비어있으면 fallbackColor (기존 디자인 유지)
 */
export function useScreenTheme(screen: string, fallbackColor?: string): ScreenTheme {
  const cmsContent = useAppStore((s) => s.cmsContent);

  const rawImage = cmsContent[`${screen}.background_image_url`] || '';
  const rawColor = cmsContent[`${screen}.background_color`] || '';
  const rawFit = cmsContent[`${screen}.background_fit`] || '';
  const fit = rawFit === 'contain' ? 'contain' : 'cover';

  if (isSafeImageUrl(rawImage)) {
    return {
      style: {
        backgroundImage: `url("${rawImage}")`,
        backgroundSize: fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      },
    };
  }

  if (isSafeColor(rawColor)) {
    return { style: { background: rawColor.trim() } };
  }

  return { style: fallbackColor ? { background: fallbackColor } : {} };
}
