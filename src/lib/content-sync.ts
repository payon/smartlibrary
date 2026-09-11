/**
 * 콘텐츠 동기화 모듈
 *
 * [기능]
 * - 키오스크 화면별 기본 콘텐츠 정의
 * - 콘텐츠 변경 이력 관리
 * - 기본값으로 리셋 기능
 */

// ============================================================================
// 기본 콘텐츠 아이템 정의
// ============================================================================

/** 콘텐츠 아이템 타입 */
export interface DefaultContentItem {
  key: string;
  value: string;
  type: string; // text | image | color | json | number
  screen: string; // kiosk screen name
  label: string; // Korean display name for admin UI
}

/** 키오스크 기본 콘텐츠 아이템 목록 */
export const DEFAULT_CONTENT_ITEMS: DefaultContentItem[] = [
  // ── 대기 화면 (idle) ──
  { key: 'idle.title', value: '스마트 도서관에 오신 것을 환영합니다', type: 'text', screen: 'idle', label: '대기 화면 제목' },
  { key: 'idle.subtitle', value: '화면을 터치하여 시작하세요', type: 'text', screen: 'idle', label: '대기 화면 부제목' },
  { key: 'idle.background_color', value: '#1e3a5f', type: 'color', screen: 'idle', label: '대기 화면 배경색' },
  { key: 'idle.logo_url', value: '/logo.svg', type: 'image', screen: 'idle', label: '대기 화면 로고 이미지' },

  // ── 메인 메뉴 (main-menu) ──
  { key: 'mainmenu.title', value: '이용하실 서비스를 선택해주세요', type: 'text', screen: 'main-menu', label: '메인 메뉴 제목' },
  { key: 'mainmenu.loan_button_text', value: '도서 대여', type: 'text', screen: 'main-menu', label: '대여 버튼 텍스트' },
  { key: 'mainmenu.return_button_text', value: '도서 반납', type: 'text', screen: 'main-menu', label: '반납 버튼 텍스트' },
  { key: 'mainmenu.search_button_text', value: '도서 검색', type: 'text', screen: 'main-menu', label: '검색 버튼 텍스트' },

  // ── 인증 화면 (auth) ──
  { key: 'auth.scan_title', value: '도서증을 스캔해주세요', type: 'text', screen: 'auth', label: '스캔 안내 제목' },
  { key: 'auth.pin_title', value: '비밀번호 4자리를 입력해주세요', type: 'text', screen: 'auth', label: 'PIN 입력 안내' },
  { key: 'auth.scan_instruction', value: '바코드를 스캐너에 보여주세요', type: 'text', screen: 'auth', label: '스캔 안내 설명' },

  // ── 대여 화면 (loan) ──
  { key: 'loan.select_title', value: '대여할 도서를 선택해주세요', type: 'text', screen: 'loan', label: '도서 선택 안내' },
  { key: 'loan.confirm_title', value: '대여 내역을 확인해주세요', type: 'text', screen: 'loan', label: '대여 확인 제목' },
  { key: 'loan.complete_title', value: '대여가 완료되었습니다', type: 'text', screen: 'loan', label: '대여 완료 제목' },
  { key: 'loan.max_count', value: '2', type: 'number', screen: 'loan', label: '최대 대여 권수' },
  { key: 'loan.period_days', value: '15', type: 'number', screen: 'loan', label: '대여 기간(일)' },

  // ── 반납 화면 (return) ──
  { key: 'return.insert_title', value: '반납할 도서를 투입구에 넣어주세요', type: 'text', screen: 'return', label: '반납 안내 제목' },
  { key: 'return.confirm_title', value: '반납 도서를 확인해주세요', type: 'text', screen: 'return', label: '반납 확인 제목' },
  { key: 'return.complete_title', value: '반납이 완료되었습니다', type: 'text', screen: 'return', label: '반납 완료 제목' },

  // ── 글로벌 설정 ──
  { key: 'global.library_name', value: '스마트 도서관', type: 'text', screen: 'global', label: '도서관 이름' },
  { key: 'global.primary_color', value: '#2563eb', type: 'color', screen: 'global', label: '메인 컬러' },
  { key: 'global.secondary_color', value: '#16a34a', type: 'color', screen: 'global', label: '보조 컬러' },
  { key: 'global.font_family', value: 'Pretendard, sans-serif', type: 'text', screen: 'global', label: '기본 폰트' },
  { key: 'global.idle_timeout_sec', value: '120', type: 'number', screen: 'global', label: '대기 시간 초과(초)' },
];

/**
 * 특정 화면의 기본 콘텐츠 가져오기
 *
 * @param screen - 화면 이름
 * @returns 해당 화면의 기본 콘텐츠 아이템 배열
 */
export function getDefaultContentForScreen(screen: string): DefaultContentItem[] {
  return DEFAULT_CONTENT_ITEMS.filter((item) => item.screen === screen);
}

/**
 * 키로 기본 콘텐츠 값 가져오기
 *
 * @param key - 콘텐츠 키
 * @returns 기본값 또는 undefined
 */
export function getDefaultValue(key: string): string | undefined {
  return DEFAULT_CONTENT_ITEMS.find((item) => item.key === key)?.value;
}

/**
 * 모든 기본 콘텐츠를 key→value 맵으로 가져오기
 */
export function getDefaultContentMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of DEFAULT_CONTENT_ITEMS) {
    map[item.key] = item.value;
  }
  return map;
}
