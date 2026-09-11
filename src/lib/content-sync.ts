/**
 * 콘텐츠 동기화 모듈
 *
 * [기능]
 * - 키오스크 화면별 기본 콘텐츠 정의 (11개 화면 + 글로벌)
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

/** 키오스크 기본 콘텐츠 아이템 목록 (11개 화면 + 글로벌, 총 47개) */
export const DEFAULT_CONTENT_ITEMS: DefaultContentItem[] = [
  // ── 대기 화면 (idle) ──
  { key: 'idle.title', value: '스마트 도서관에 오신 것을 환영합니다', type: 'text', screen: 'idle', label: '대기 화면 제목' },
  { key: 'idle.subtitle', value: '화면을 터치하여 시작하세요', type: 'text', screen: 'idle', label: '대기 화면 부제목' },
  { key: 'idle.pulse_text', value: '터치하세요', type: 'text', screen: 'idle', label: '대기 화면 터치 안내' },
  { key: 'idle.background_color', value: '#1e3a5f', type: 'color', screen: 'idle', label: '대기 화면 배경색' },
  { key: 'idle.logo_url', value: '/logo.svg', type: 'image', screen: 'idle', label: '대기 화면 로고 이미지' },

  // ── 메인 메뉴 (main-menu) ──
  { key: 'mainmenu.title', value: '이용하실 서비스를 선택해주세요', type: 'text', screen: 'main-menu', label: '메인 메뉴 제목' },
  { key: 'mainmenu.loan_button_text', value: '도서 대여', type: 'text', screen: 'main-menu', label: '대여 버튼 텍스트' },
  { key: 'mainmenu.return_button_text', value: '도서 반납', type: 'text', screen: 'main-menu', label: '반납 버튼 텍스트' },
  { key: 'mainmenu.loan_button_icon', value: 'BookOpen', type: 'text', screen: 'main-menu', label: '대여 버튼 아이콘' },
  { key: 'mainmenu.return_button_icon', value: 'BookCheck', type: 'text', screen: 'main-menu', label: '반납 버튼 아이콘' },

  // ── 인증 스캔 (auth-scan) ──
  { key: 'authscan.title', value: '도서증을 스캔해주세요', type: 'text', screen: 'auth-scan', label: '스캔 인증 제목' },
  { key: 'authscan.instruction', value: '바코드를 스캐너에 보여주세요', type: 'text', screen: 'auth-scan', label: '스캔 안내 설명' },
  { key: 'authscan.demo_button_text', value: '데모 체험하기', type: 'text', screen: 'auth-scan', label: '데모 버튼 텍스트' },
  { key: 'authscan.demo_pin', value: '1234', type: 'text', screen: 'auth-scan', label: '데모 PIN 번호' },

  // ── 인증 PIN (auth-pin) ──
  { key: 'authpin.title', value: '비밀번호 4자리를 입력해주세요', type: 'text', screen: 'auth-pin', label: 'PIN 입력 제목' },
  { key: 'authpin.instruction', value: '4자리 비밀번호를 입력하세요', type: 'text', screen: 'auth-pin', label: 'PIN 입력 안내' },

  // ── 대여 선택 (loan-select) ──
  { key: 'loanselect.title', value: '대여할 도서를 선택해주세요', type: 'text', screen: 'loan-select', label: '도서 선택 제목' },
  { key: 'loanselect.instruction', value: '도서를 스캔하거나 검색하세요', type: 'text', screen: 'loan-select', label: '도서 선택 안내' },
  { key: 'loanselect.max_books_text', value: '최대 2권까지 대여 가능합니다', type: 'text', screen: 'loan-select', label: '최대 대여 안내' },
  { key: 'loanselect.search_placeholder', value: '도서명 또는 ISBN 검색', type: 'text', screen: 'loan-select', label: '검색 입력 안내' },

  // ── 대여 확인 (loan-confirm) ──
  { key: 'loanconfirm.title', value: '대여 내역을 확인해주세요', type: 'text', screen: 'loan-confirm', label: '대여 확인 제목' },
  { key: 'loanconfirm.confirm_button_text', value: '대여 확인', type: 'text', screen: 'loan-confirm', label: '대여 확인 버튼' },
  { key: 'loanconfirm.cancel_button_text', value: '취소', type: 'text', screen: 'loan-confirm', label: '대여 취소 버튼' },

  // ── 대여 완료 (loan-complete) ──
  { key: 'loancomplete.title', value: '대여가 완료되었습니다', type: 'text', screen: 'loan-complete', label: '대여 완료 제목' },
  { key: 'loancomplete.message', value: '도서 대여가 정상적으로 처리되었습니다', type: 'text', screen: 'loan-complete', label: '대여 완료 메시지' },
  { key: 'loancomplete.receipt_text', value: '영수증을 출력하시겠습니까?', type: 'text', screen: 'loan-complete', label: '영수증 출력 안내' },

  // ── 반납 투입 (return-insert) ──
  { key: 'returninsert.title', value: '반납할 도서를 투입구에 넣어주세요', type: 'text', screen: 'return-insert', label: '반납 투입 제목' },
  { key: 'returninsert.instruction', value: '도서를 투입구에 한 권씩 넣어주세요', type: 'text', screen: 'return-insert', label: '반납 투입 안내' },
  { key: 'returninsert.sensor_image_url', value: '/images/book-sensor.svg', type: 'image', screen: 'return-insert', label: '센서 안내 이미지' },

  // ── 반납 스캔 (return-scanning) ──
  { key: 'returnscanning.title', value: '도서를 스캔하고 있습니다', type: 'text', screen: 'return-scanning', label: '반납 스캔 제목' },
  { key: 'returnscanning.instruction', value: '잠시만 기다려주세요', type: 'text', screen: 'return-scanning', label: '반납 스캔 안내' },

  // ── 반납 확인 (return-confirm) ──
  { key: 'returnconfirm.title', value: '반납 도서를 확인해주세요', type: 'text', screen: 'return-confirm', label: '반납 확인 제목' },
  { key: 'returnconfirm.confirm_button_text', value: '반납 확인', type: 'text', screen: 'return-confirm', label: '반납 확인 버튼' },
  { key: 'returnconfirm.cancel_button_text', value: '취소', type: 'text', screen: 'return-confirm', label: '반납 취소 버튼' },

  // ── 반납 완료 (return-complete) ──
  { key: 'returncomplete.title', value: '반납이 완료되었습니다', type: 'text', screen: 'return-complete', label: '반납 완료 제목' },
  { key: 'returncomplete.message', value: '도서 반납이 정상적으로 처리되었습니다', type: 'text', screen: 'return-complete', label: '반납 완료 메시지' },

  // ── 글로벌 설정 ──
  { key: 'global.library_name', value: '스마트 도서관', type: 'text', screen: 'global', label: '도서관 이름' },
  { key: 'global.library_subtitle', value: '시민과 함께하는 평생학습 도서관', type: 'text', screen: 'global', label: '도서관 부제목' },
  { key: 'global.primary_color', value: '#2563eb', type: 'color', screen: 'global', label: '메인 컬러' },
  { key: 'global.accent_color', value: '#16a34a', type: 'color', screen: 'global', label: '강조 컬러' },
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
