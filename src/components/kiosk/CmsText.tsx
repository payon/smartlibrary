'use client';

import { useAppStore } from '@/stores/useAppStore';

/**
 * CMS 관리 텍스트 컴포넌트
 *
 * [기능]
 * - 콘텐츠 키로 CMS에서 텍스트를 조회
 * - CMS 콘텐츠가 없으면 fallback 텍스트 사용
 * - 다양한 HTML 태그로 렌더링 가능
 */

interface CmsTextProps {
  /** 콘텐츠 키 (예: "idle.title") */
  contentKey: string;
  /** CMS 콘텐츠가 없을 때 사용할 기본 텍스트 */
  fallback: string;
  /** CSS 클래스명 */
  className?: string;
  /** 렌더링할 HTML 태그 */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div';
}

export function CmsText({ contentKey, fallback, className, as: Tag = 'span' }: CmsTextProps) {
  const cmsContent = useAppStore((s) => s.cmsContent);
  const text = cmsContent[contentKey] || fallback;
  return <Tag className={className}>{text}</Tag>;
}
