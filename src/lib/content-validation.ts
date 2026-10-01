/**
 * 콘텐츠 값 타입별 검증 모듈
 *
 * [설계]
 * - 저장 시 HTML 이스케이프를 하지 않음 (React가 렌더 시점에 이스케이프)
 *   - 기존 sanitizeString은 `/` → `&#x2F;` 로 바꿔 이미지 URL을破壊했음
 * - 타입별 화이트리스트 검증으로 인젝션 방지
 *   - color: hex 또는 rgb()/rgba() 만 허용
 *   - image: 상대경로(/...) 또는 https:// 만 허용 (javascript:/data: 차단)
 *   - json: 파싱 가능해야 함 / number: 숫자여야 함 / text: 길이 제한
 */

const MAX_TEXT_LENGTH = 2000;

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const RGB_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0+)\s*)?\)$/;

/** RGB 각 채널 0~255 검사 */
function isValidRgb(value: string): boolean {
  const m = RGB_RE.exec(value);
  if (!m) return false;
  const [, r, g, b] = m;
  return [r, g, b].every((n) => {
    const v = parseInt(n, 10);
    return v >= 0 && v <= 255;
  });
}

/** 색상값 검증 (hex 또는 rgb()/rgba()) */
export function isValidColor(value: string): boolean {
  if (typeof value !== 'string' || value.length > 100) return false;
  const v = value.trim();
  return HEX_RE.test(v) || isValidRgb(v);
}

/** 이미지 URL 검증 (상대경로 또는 https, 빈 값 허용) */
export function isValidImageUrl(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  if (value.length > 500) return false;
  const v = value.trim();
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  if (v.startsWith('https://')) return true;
  return false;
}

export interface ContentValidation {
  ok: boolean;
  error?: string;
}

/**
 * 콘텐츠 타입별 값 검증
 * @param type - text | image | color | json | number
 * @param value - 저장할 값
 */
export function validateContentValue(type: string, value: unknown): ContentValidation {
  if (typeof value !== 'string') {
    return { ok: false, error: '값은 문자열이어야 합니다.' };
  }

  switch (type) {
    case 'color':
      if (!isValidColor(value)) {
        return { ok: false, error: '색상은 hex(#RRGGBB) 또는 rgb()/rgba() 형식이어야 합니다.' };
      }
      return { ok: true };
    case 'image':
      if (!isValidImageUrl(value)) {
        return { ok: false, error: '이미지는 / 로 시작하는 상대경로 또는 https:// URL이어야 합니다.' };
      }
      return { ok: true };
    case 'json':
      if (value.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: `콘텐츠 값은 ${MAX_TEXT_LENGTH}자를 초과할 수 없습니다.` };
      }
      try {
        JSON.parse(value);
      } catch {
        return { ok: false, error: '유효한 JSON 형식이 아닙니다.' };
      }
      return { ok: true };
    case 'number':
      if (value.trim() === '' || Number.isNaN(Number(value))) {
        return { ok: false, error: '숫자 형식이어야 합니다.' };
      }
      return { ok: true };
    case 'text':
    default:
      if (value.length > MAX_TEXT_LENGTH) {
        return { ok: false, error: `콘텐츠 값은 ${MAX_TEXT_LENGTH}자를 초과할 수 없습니다.` };
      }
      return { ok: true };
  }
}
