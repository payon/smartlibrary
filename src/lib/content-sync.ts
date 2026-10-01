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

/** 키오스크 기본 콘텐츠 아이템 목록 (15개 화면 + 글로벌, 텍스트/배경/이미지) */
export const DEFAULT_CONTENT_ITEMS: DefaultContentItem[] = [
  // ── 대기 화면 (idle) ──
  { key: 'idle.title', value: '스마트 도서관에 오신 것을 환영합니다', type: 'text', screen: 'idle', label: '대기 화면 제목' },
  { key: 'idle.subtitle', value: '화면을 터치하여 시작하세요', type: 'text', screen: 'idle', label: '대기 화면 부제목' },
  { key: 'idle.pulse_text', value: '터치하세요', type: 'text', screen: 'idle', label: '대기 화면 터치 안내' },
  { key: 'idle.background_color', value: '#1e3a5f', type: 'color', screen: 'idle', label: '대기 화면 배경색' },
  { key: 'idle.logo_url', value: '/logo.svg', type: 'image', screen: 'idle', label: '대기 화면 로고 이미지' },

  // ── 메인 메뉴 (main-menu) ──
  { key: 'mainmenu.title', value: '이용하실 서비스를 선택해주세요', type: 'text', screen: 'main-menu', label: '메인 메뉴 제목' },
  { key: 'mainmenu.card_button_text', value: '도서카드 발급', type: 'text', screen: 'main-menu', label: '카드발급 버튼 텍스트' },
  { key: 'mainmenu.loan_button_text', value: '도서 대여', type: 'text', screen: 'main-menu', label: '대여 버튼 텍스트' },
  { key: 'mainmenu.return_button_text', value: '도서 반납', type: 'text', screen: 'main-menu', label: '반납 버튼 텍스트' },
  { key: 'mainmenu.loan_button_icon', value: 'BookOpen', type: 'text', screen: 'main-menu', label: '대여 버튼 아이콘' },
  { key: 'mainmenu.return_button_icon', value: 'BookCheck', type: 'text', screen: 'main-menu', label: '반납 버튼 아이콘' },
  { key: 'mainmenu.button_order', value: '["card","loan","return"]', type: 'json', screen: 'main-menu', label: '메인 버튼 순서' },

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
  { key: 'loanselect.max_selection_warning', value: '최대 2권까지 대출할 수 있습니다', type: 'text', screen: 'loan-select', label: '초과 선택 경고' },
  { key: 'loanselect.search_placeholder', value: '도서명 또는 ISBN 검색', type: 'text', screen: 'loan-select', label: '검색 입력 안내' },
  { key: 'loanselect.confirm_button_text', value: '다음 단계', type: 'text', screen: 'loan-select', label: '다음 단계 버튼' },

  // ── 대여 확인 (loan-confirm) ──
  { key: 'loanconfirm.title', value: '대여 내역을 확인해주세요', type: 'text', screen: 'loan-confirm', label: '대여 확인 제목' },
  { key: 'loanconfirm.confirm_button_text', value: '대여 확인', type: 'text', screen: 'loan-confirm', label: '대여 확인 버튼' },
  { key: 'loanconfirm.cancel_button_text', value: '취소', type: 'text', screen: 'loan-confirm', label: '대여 취소 버튼' },

  // ── 대여 완료 (loan-complete) ──
  { key: 'loancomplete.title', value: '대여가 완료되었습니다', type: 'text', screen: 'loan-complete', label: '대여 완료 제목' },
  { key: 'loancomplete.message', value: '도서 대여가 정상적으로 처리되었습니다', type: 'text', screen: 'loan-complete', label: '대여 완료 메시지' },
  { key: 'loancomplete.receipt_text', value: '영수증을 출력하시겠습니까?', type: 'text', screen: 'loan-complete', label: '영수증 출력 안내' },
  { key: 'loancomplete.list_title', value: '대출 도서 목록', type: 'text', screen: 'loan-complete', label: '대출 목록 제목' },
  { key: 'loancomplete.confirm_button_text', value: '확인하기', type: 'text', screen: 'loan-complete', label: '확인 버튼' },

  // ── 반납 투입 (return-insert) ──
  { key: 'returninsert.title', value: '반납할 도서를 투입구에 넣어주세요', type: 'text', screen: 'return-insert', label: '반납 투입 제목' },
  { key: 'returninsert.instruction', value: '도서를 투입구에 한 권씩 넣어주세요', type: 'text', screen: 'return-insert', label: '반납 투입 안내' },
  { key: 'returninsert.instruction_sub', value: '도서를 넣으면 자동으로 인식됩니다', type: 'text', screen: 'return-insert', label: '반납 투입 보조 안내' },
  { key: 'returninsert.no_loans_title', value: '반납할 도서가 없습니다', type: 'text', screen: 'return-insert', label: '대출없음 제목' },
  { key: 'returninsert.no_loans_desc', value: '대출 중인 도서가 없습니다.', type: 'text', screen: 'return-insert', label: '대출없음 설명' },
  { key: 'returninsert.detected_text', value: '도서가 감지되었습니다', type: 'text', screen: 'return-insert', label: '도서 감지 문구' },
  { key: 'returninsert.sensor_image_url', value: '/images/book-sensor.svg', type: 'image', screen: 'return-insert', label: '센서 안내 이미지' },

  // ── 반납 스캔 (return-scanning) ──
  { key: 'returnscanning.title', value: '도서를 스캔하고 있습니다', type: 'text', screen: 'return-scanning', label: '반납 스캔 제목' },
  { key: 'returnscanning.instruction', value: '잠시만 기다려주세요', type: 'text', screen: 'return-scanning', label: '반납 스캔 안내' },
  { key: 'returnscanning.scanning_text', value: '도서가 인식되었습니다. 잠시 기다려주세요.', type: 'text', screen: 'return-scanning', label: '스캔 중 문구' },
  { key: 'returnscanning.complete_text', value: '스캔이 완료되었습니다', type: 'text', screen: 'return-scanning', label: '스캔 완료 문구' },
  { key: 'returnscanning.more_button_text', value: '더 넣기', type: 'text', screen: 'return-scanning', label: '더 넣기 버튼' },
  { key: 'returnscanning.complete_button_text', value: '반납 완료하기', type: 'text', screen: 'return-scanning', label: '반납 완료 버튼' },

  // ── 반납 확인 (return-confirm) ──
  { key: 'returnconfirm.title', value: '반납 도서를 확인해주세요', type: 'text', screen: 'return-confirm', label: '반납 확인 제목' },
  { key: 'returnconfirm.confirm_button_text', value: '반납 확인', type: 'text', screen: 'return-confirm', label: '반납 확인 버튼' },
  { key: 'returnconfirm.cancel_button_text', value: '취소', type: 'text', screen: 'return-confirm', label: '반납 취소 버튼' },

  // ── 반납 완료 (return-complete) ──
  { key: 'returncomplete.title', value: '반납이 완료되었습니다', type: 'text', screen: 'return-complete', label: '반납 완료 제목' },
  { key: 'returncomplete.message', value: '도서 반납이 정상적으로 처리되었습니다', type: 'text', screen: 'return-complete', label: '반납 완료 메시지' },
  { key: 'returncomplete.confirm_button_text', value: '확인하기', type: 'text', screen: 'return-complete', label: '확인 버튼' },

  // ── 도서증 발급 종류 선택 (card-apply) ──
  { key: 'cardapply.title', value: '도서증 발급', type: 'text', screen: 'card-apply', label: '발급 종류 제목' },
  { key: 'cardapply.subtitle', value: '발급 종류를 선택해주세요', type: 'text', screen: 'card-apply', label: '발급 종류 부제목' },
  { key: 'cardapply.mobile_title', value: '모바일 도서증 발급', type: 'text', screen: 'card-apply', label: '모바일 발급 제목' },
  { key: 'cardapply.mobile_desc', value: '즉시 발급, 자동 승인', type: 'text', screen: 'card-apply', label: '모바일 발급 설명' },
  { key: 'cardapply.physical_title', value: '실물 도서증 발급', type: 'text', screen: 'card-apply', label: '실물 발급 제목' },
  { key: 'cardapply.physical_desc', value: '담당자 승인 후 발급', type: 'text', screen: 'card-apply', label: '실물 발급 설명' },
  { key: 'cardapply.auto_title', value: '자동 발급 신청', type: 'text', screen: 'card-apply', label: '자동 발급 제목' },
  { key: 'cardapply.auto_desc', value: '개인정보 입력 후 자동 승인', type: 'text', screen: 'card-apply', label: '자동 발급 설명' },

  // ── 도서증 개인정보 입력 (card-form) ──
  { key: 'cardform.title', value: '개인정보 입력', type: 'text', screen: 'card-form', label: '개인정보 제목' },
  { key: 'cardform.name_label', value: '이름', type: 'text', screen: 'card-form', label: '이름 라벨' },
  { key: 'cardform.birthdate_label', value: '생년월일', type: 'text', screen: 'card-form', label: '생년월일 라벨' },
  { key: 'cardform.phone_label', value: '전화번호', type: 'text', screen: 'card-form', label: '전화번호 라벨' },
  { key: 'cardform.address_label', value: '주소', type: 'text', screen: 'card-form', label: '주소 라벨' },
  { key: 'cardform.submit_button_text', value: '신청하기', type: 'text', screen: 'card-form', label: '신청 버튼' },

  // ── 도서증 승인 대기 (card-pending) ──
  { key: 'cardpending.title', value: '발급 신청이 완료되었습니다', type: 'text', screen: 'card-pending', label: '신청 완료 제목' },
  { key: 'cardpending.approved_title', value: '승인이 완료되었습니다!', type: 'text', screen: 'card-pending', label: '승인 완료 제목' },
  { key: 'cardpending.wait_message', value: '담당자 승인을 기다려주세요', type: 'text', screen: 'card-pending', label: '승인 대기 문구' },
  { key: 'cardpending.approved_message', value: '발급 처리 중...', type: 'text', screen: 'card-pending', label: '승인 진행 문구' },
  { key: 'cardpending.summary_title', value: '신청 내역', type: 'text', screen: 'card-pending', label: '신청 내역 제목' },
  { key: 'cardpending.cancel_button_text', value: '취소', type: 'text', screen: 'card-pending', label: '취소 버튼' },

  // ── 도서증 발급 완료 (card-complete) ──
  { key: 'cardcomplete.title', value: '도서증 발급이 완료되었습니다!', type: 'text', screen: 'card-complete', label: '발급 완료 제목' },
  { key: 'cardcomplete.mobile_message', value: '모바일 도서증이 발급되었습니다', type: 'text', screen: 'card-complete', label: '모바일 완료 문구' },
  { key: 'cardcomplete.physical_message', value: '실물 도서증은 3영업일 내 발급됩니다', type: 'text', screen: 'card-complete', label: '실물 완료 문구' },
  { key: 'cardcomplete.go_loan_button_text', value: '도서 대출하러 가기', type: 'text', screen: 'card-complete', label: '대출 이동 버튼' },
  { key: 'cardcomplete.confirm_button_text', value: '확인', type: 'text', screen: 'card-complete', label: '확인 버튼' },

  // ── 화면별 배경 테마 (빈 값 = 기본 테마 유지) ──
  // 관리자가 배경색/배경이미지를 지정하면 프론트에 즉시 반영 (useScreenTheme)
  { key: 'idle.background_image_url', value: '', type: 'image', screen: 'idle', label: '대기 화면 배경이미지' },
  { key: 'main-menu.background_color', value: '', type: 'color', screen: 'main-menu', label: '메인 메뉴 배경색' },
  { key: 'main-menu.background_image_url', value: '', type: 'image', screen: 'main-menu', label: '메인 메뉴 배경이미지' },
  { key: 'auth-scan.background_color', value: '', type: 'color', screen: 'auth-scan', label: '스캔 화면 배경색' },
  { key: 'auth-scan.background_image_url', value: '', type: 'image', screen: 'auth-scan', label: '스캔 화면 배경이미지' },
  { key: 'auth-pin.background_color', value: '', type: 'color', screen: 'auth-pin', label: 'PIN 화면 배경색' },
  { key: 'auth-pin.background_image_url', value: '', type: 'image', screen: 'auth-pin', label: 'PIN 화면 배경이미지' },
  { key: 'loan-select.background_color', value: '', type: 'color', screen: 'loan-select', label: '도서선택 배경색' },
  { key: 'loan-select.background_image_url', value: '', type: 'image', screen: 'loan-select', label: '도서선택 배경이미지' },
  { key: 'loan-confirm.background_color', value: '', type: 'color', screen: 'loan-confirm', label: '대여확인 배경색' },
  { key: 'loan-confirm.background_image_url', value: '', type: 'image', screen: 'loan-confirm', label: '대여확인 배경이미지' },
  { key: 'loan-complete.background_color', value: '', type: 'color', screen: 'loan-complete', label: '대여완료 배경색' },
  { key: 'loan-complete.background_image_url', value: '', type: 'image', screen: 'loan-complete', label: '대여완료 배경이미지' },
  { key: 'return-insert.background_color', value: '', type: 'color', screen: 'return-insert', label: '반납투입 배경색' },
  { key: 'return-insert.background_image_url', value: '', type: 'image', screen: 'return-insert', label: '반납투입 배경이미지' },
  { key: 'return-scanning.background_color', value: '', type: 'color', screen: 'return-scanning', label: '반납스캔 배경색' },
  { key: 'return-scanning.background_image_url', value: '', type: 'image', screen: 'return-scanning', label: '반납스캔 배경이미지' },
  { key: 'return-confirm.background_color', value: '', type: 'color', screen: 'return-confirm', label: '반납확인 배경색' },
  { key: 'return-confirm.background_image_url', value: '', type: 'image', screen: 'return-confirm', label: '반납확인 배경이미지' },
  { key: 'return-complete.background_color', value: '', type: 'color', screen: 'return-complete', label: '반납완료 배경색' },
  { key: 'return-complete.background_image_url', value: '', type: 'image', screen: 'return-complete', label: '반납완료 배경이미지' },
  { key: 'card-apply.background_color', value: '', type: 'color', screen: 'card-apply', label: '발급선택 배경색' },
  { key: 'card-apply.background_image_url', value: '', type: 'image', screen: 'card-apply', label: '발급선택 배경이미지' },
  { key: 'card-form.background_color', value: '', type: 'color', screen: 'card-form', label: '개인정보 배경색' },
  { key: 'card-form.background_image_url', value: '', type: 'image', screen: 'card-form', label: '개인정보 배경이미지' },
  { key: 'card-pending.background_color', value: '', type: 'color', screen: 'card-pending', label: '승인대기 배경색' },
  { key: 'card-pending.background_image_url', value: '', type: 'image', screen: 'card-pending', label: '승인대기 배경이미지' },
  { key: 'card-complete.background_color', value: '', type: 'color', screen: 'card-complete', label: '발급완료 배경색' },
  { key: 'card-complete.background_image_url', value: '', type: 'image', screen: 'card-complete', label: '발급완료 배경이미지' },

  // ── 화면별 따라하기 가이드 (JSON: {"title": "...", "steps": [...]}) ──
  // 프론트 도움말(?) 패널 + 음성 안내에 사용. 파싱 실패 시 기본 가이드 사용
  { key: 'guide.idle', value: '{"title": "시작하기", "steps": ["화면 아무 곳이나 손가락으로 가볍게 터치하세요.", "다음 화면에서 원하시는 서비스를 고릅니다.", "소리가 나오지 않으면 하단 스피커 버튼을 켜세요."]}', type: 'json', screen: 'idle', label: '대기 따라하기 가이드' },
  { key: 'guide.main-menu', value: '{"title": "서비스 선택", "steps": ["처음 오셨다면 “도서카드 발급”부터 연습해 보세요.", "책을 빌리려면 “도서 대출”을 누릅니다.", "빌린 책을 돌려주려면 “도서 반납”을 누릅니다."]}', type: 'json', screen: 'main-menu', label: '메인메뉴 따라하기 가이드' },
  { key: 'guide.card-apply', value: '{"title": "도서증 종류 고르기", "steps": ["핸드폰으로 바로 쓰는 도서증은 “모바일”을 고릅니다.", "플라스틱 카드를 받으려면 “실물”을 고릅니다.", "연습이므로 편한 것을 고르셔도 됩니다."]}', type: 'json', screen: 'card-apply', label: '발급선택 따라하기 가이드' },
  { key: 'guide.card-form', value: '{"title": "개인정보 입력 (연습용)", "steps": ["이 화면은 연습용입니다. 진짜 개인정보를 쓰지 마세요.", "“데모 정보로 채우기” 버튼을 누르면 연습용 정보가 자동 입력됩니다.", "직접 입력해도 됩니다. 생년월일은 숫자 8자리입니다.", "다 썼으면 “신청하기”를 누릅니다."]}', type: 'json', screen: 'card-form', label: '개인정보 따라하기 가이드' },
  { key: 'guide.card-pending', value: '{"title": "승인 대기", "steps": ["실물 도서증은 담당자 승인이 필요합니다.", "연습 화면에서는 잠시 후 자동으로 넘어갑니다.", "그만두려면 “취소”를 누릅니다."]}', type: 'json', screen: 'card-pending', label: '승인대기 따라하기 가이드' },
  { key: 'guide.card-complete', value: '{"title": "발급 완료", "steps": ["도서증 번호를 확인하세요.", "바로 책을 빌리려면 “도서 대출하러 가기”를 누릅니다.", "끝내려면 “확인”을 누릅니다."]}', type: 'json', screen: 'card-complete', label: '발급완료 따라하기 가이드' },
  { key: 'guide.auth-scan', value: '{"title": "회원증 대기", "steps": ["실제 기기에서는 회원증을 리더기에 갖다 댑니다.", "연습 화면에서는 잠시 후 자동으로 넘어갑니다.", "바로 넘어가려면 “회원증 없이 이용하기”를 누릅니다."]}', type: 'json', screen: 'auth-scan', label: '스캔 따라하기 가이드' },
  { key: 'guide.auth-pin', value: '{"title": "비밀번호 입력", "steps": ["숫자 버튼을 눌러 4자리를 입력합니다.", "4자리가 되면 자동으로 확인됩니다.", "틀렸으면 지우기 버튼으로 지우고 다시 입력합니다."]}', type: 'json', screen: 'auth-pin', label: 'PIN 따라하기 가이드' },
  { key: 'guide.loan-select', value: '{"title": "도서 선택", "steps": ["빌리고 싶은 책의 “선택” 버튼을 누릅니다.", "한 번에 최대 2권까지 빌릴 수 있습니다.", "위 검색창에 제목이나 저자를 쳐서 찾을 수 있습니다.", "다 골랐으면 “다음 단계”를 누릅니다."]}', type: 'json', screen: 'loan-select', label: '도서선택 따라하기 가이드' },
  { key: 'guide.loan-confirm', value: '{"title": "대출 확인", "steps": ["빌릴 책과 반납 날짜를 확인하세요.", "맞으면 “대출하기”를 누릅니다.", "바꾸려면 “이전”을 눌러 다시 고릅니다."]}', type: 'json', screen: 'loan-confirm', label: '대여확인 따라하기 가이드' },
  { key: 'guide.loan-complete', value: '{"title": "대출 완료", "steps": ["대출이 끝났습니다. 반납 날짜를 꼭 확인하세요.", "“확인하기”를 누르면 처음으로 돌아갑니다."]}', type: 'json', screen: 'loan-complete', label: '대여완료 따라하기 가이드' },
  { key: 'guide.return-insert', value: '{"title": "도서 투입", "steps": ["실제 기기에서는 책을 반납구에 한 권씩 넣습니다.", "연습 화면에서는 잠시 후 자동으로 인식됩니다.", "빌린 책이 없으면 안내 문구가 나옵니다."]}', type: 'json', screen: 'return-insert', label: '반납투입 따라하기 가이드' },
  { key: 'guide.return-scanning', value: '{"title": "도서 인식", "steps": ["인식된 책 목록을 확인하세요.", "책을 더 넣으려면 “더 넣기”를 누릅니다.", "다 넣었으면 “반납하기”를 누릅니다."]}', type: 'json', screen: 'return-scanning', label: '반납스캔 따라하기 가이드' },
  { key: 'guide.return-confirm', value: '{"title": "반납 확인", "steps": ["돌려줄 책 목록을 확인하세요.", "맞으면 “반납하기”를 누릅니다.", "바꾸려면 “이전”을 누릅니다."]}', type: 'json', screen: 'return-confirm', label: '반납확인 따라하기 가이드' },
  { key: 'guide.return-complete', value: '{"title": "반납 완료", "steps": ["반납이 끝났습니다.", "“확인하기”를 누르면 처음으로 돌아갑니다."]}', type: 'json', screen: 'return-complete', label: '반납완료 따라하기 가이드' },

  // ── 화면별 배경 맞춤 방식 (cover: 화면 채우기 / contain: 잘림 없이 맞춤) ──
  { key: 'idle.background_fit', value: 'cover', type: 'text', screen: 'idle', label: '대기 배경 맞춤' },
  { key: 'main-menu.background_fit', value: 'cover', type: 'text', screen: 'main-menu', label: '메인메뉴 배경 맞춤' },
  { key: 'auth-scan.background_fit', value: 'cover', type: 'text', screen: 'auth-scan', label: '스캔 배경 맞춤' },
  { key: 'auth-pin.background_fit', value: 'cover', type: 'text', screen: 'auth-pin', label: 'PIN 배경 맞춤' },
  { key: 'loan-select.background_fit', value: 'cover', type: 'text', screen: 'loan-select', label: '도서선택 배경 맞춤' },
  { key: 'loan-confirm.background_fit', value: 'cover', type: 'text', screen: 'loan-confirm', label: '대여확인 배경 맞춤' },
  { key: 'loan-complete.background_fit', value: 'cover', type: 'text', screen: 'loan-complete', label: '대여완료 배경 맞춤' },
  { key: 'return-insert.background_fit', value: 'cover', type: 'text', screen: 'return-insert', label: '반납투입 배경 맞춤' },
  { key: 'return-scanning.background_fit', value: 'cover', type: 'text', screen: 'return-scanning', label: '반납스캔 배경 맞춤' },
  { key: 'return-confirm.background_fit', value: 'cover', type: 'text', screen: 'return-confirm', label: '반납확인 배경 맞춤' },
  { key: 'return-complete.background_fit', value: 'cover', type: 'text', screen: 'return-complete', label: '반납완료 배경 맞춤' },
  { key: 'card-apply.background_fit', value: 'cover', type: 'text', screen: 'card-apply', label: '발급선택 배경 맞춤' },
  { key: 'card-form.background_fit', value: 'cover', type: 'text', screen: 'card-form', label: '개인정보 배경 맞춤' },
  { key: 'card-pending.background_fit', value: 'cover', type: 'text', screen: 'card-pending', label: '승인대기 배경 맞춤' },
  { key: 'card-complete.background_fit', value: 'cover', type: 'text', screen: 'card-complete', label: '발급완료 배경 맞춤' },

  // ── 글로벌 설정 ──
  { key: 'global.library_name', value: '스마트 도서관', type: 'text', screen: 'global', label: '도서관 이름' },
  { key: 'global.library_subtitle', value: '시민과 함께하는 평생학습 도서관', type: 'text', screen: 'global', label: '도서관 부제목' },
  { key: 'global.primary_color', value: '#2563eb', type: 'color', screen: 'global', label: '메인 컬러' },
  { key: 'global.accent_color', value: '#16a34a', type: 'color', screen: 'global', label: '강조 컬러' },
  { key: 'ticker.weather', value: '맑음/13.0℃', type: 'text', screen: 'global', label: '티커 날씨' },
  { key: 'ticker.notice', value: '24시간 도서 대출/반납이 가능한 스마트도서관입니다.', type: 'text', screen: 'global', label: '티커 공지' },
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
