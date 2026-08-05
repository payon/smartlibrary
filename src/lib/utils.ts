/**
 * 유틸리티 함수 모듈
 *
 * [내용]
 * - cn(): Tailwind CSS 클래스명 병합 유틸리티
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스명 병합 함수
 * clsx로 조건부 클래스를 결합하고, twMerge로 중복/충돌 클래스를 병합합니다.
 *
 * @param inputs - 병합할 클래스명 (문자열, 객체, 배열 등)
 * @returns 병합된 최종 클래스명 문자열
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
