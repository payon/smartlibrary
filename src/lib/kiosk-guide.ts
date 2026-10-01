/**
 * 키오스크 따라하기 가이드 기본 스텝
 *
 * [설계]
 * - 화면별 도움말 단계 (시니어 눈높이, 짧은 문장)
 * - 관리자가 `guide.{screen}` JSON 키로 덮어쓸 수 있음 (형식: {title, steps[]})
 * - 파싱 실패 시 아래 기본값 사용
 */

export interface GuideContent {
  title: string;
  steps: string[];
}

type ScreenKey =
  | 'idle' | 'miryang-main' | 'signup-guide' | 'main-menu'
  | 'card-apply' | 'card-form' | 'card-pending' | 'card-complete'
  | 'auth-scan' | 'auth-pin'
  | 'loan-select' | 'loan-confirm' | 'loan-dispense' | 'loan-history' | 'receipt' | 'loan-complete'
  | 'return-insert' | 'return-scanning' | 'return-confirm' | 'return-complete';

export const DEFAULT_GUIDES: Record<ScreenKey, GuideContent> = {
  'miryang-main': {
    title: '도서관 안내',
    steps: [
      '스마트도서관 이용 방법을 확인하세요.',
      '준비가 되면 “시작하기”를 눌러 이용을 시작합니다.',
    ],
  },
  'signup-guide': {
    title: '회원가입 방법',
    steps: [
      '도서관 방문 회원가입 순서를 확인하세요.',
      '신분증을 지참하고 2층 종합자료실을 방문하세요.',
    ],
  },
  idle: {
    title: '시작하기',
    steps: [
      '화면 아무 곳이나 손가락으로 가볍게 터치하세요.',
      '다음 화면에서 원하시는 서비스를 고릅니다.',
      '소리가 나오지 않으면 하단 스피커 버튼을 켜세요.',
    ],
  },
  'main-menu': {
    title: '서비스 선택',
    steps: [
      '처음 오셨다면 “도서카드 발급”부터 연습해 보세요.',
      '책을 빌리려면 “도서 대출”을 누릅니다.',
      '빌린 책을 돌려주려면 “도서 반납”을 누릅니다.',
    ],
  },
  'card-apply': {
    title: '도서증 종류 고르기',
    steps: [
      '핸드폰으로 바로 쓰는 도서증은 “모바일”을 고릅니다.',
      '플라스틱 카드를 받으려면 “실물”을 고릅니다.',
      '연습이므로 편한 것을 고르셔도 됩니다.',
    ],
  },
  'card-form': {
    title: '개인정보 입력 (연습용)',
    steps: [
      '이 화면은 연습용입니다. 진짜 개인정보를 쓰지 마세요.',
      '“데모 정보로 채우기” 버튼을 누르면 연습용 정보가 자동 입력됩니다.',
      '직접 입력해도 됩니다. 생년월일은 숫자 8자리입니다.',
      '다 썼으면 “신청하기”를 누릅니다.',
    ],
  },
  'card-pending': {
    title: '승인 대기',
    steps: [
      '실물 도서증은 담당자 승인이 필요합니다.',
      '연습 화면에서는 잠시 후 자동으로 넘어갑니다.',
      '그만두려면 “취소”를 누릅니다.',
    ],
  },
  'card-complete': {
    title: '발급 완료',
    steps: [
      '도서증 번호를 확인하세요.',
      '바로 책을 빌리려면 “도서 대출하러 가기”를 누릅니다.',
      '끝내려면 “확인”을 누릅니다.',
    ],
  },
  'auth-scan': {
    title: '회원증 대기',
    steps: [
      '실제 기기에서는 회원증을 리더기에 갖다 댑니다.',
      '연습 화면에서는 잠시 후 자동으로 넘어갑니다.',
      '바로 넘어가려면 “회원증 없이 이용하기”를 누릅니다.',
    ],
  },
  'auth-pin': {
    title: '비밀번호 입력',
    steps: [
      '숫자 버튼을 눌러 4자리를 입력합니다.',
      '4자리가 되면 자동으로 확인됩니다.',
      '틀렸으면 지우기 버튼으로 지우고 다시 입력합니다.',
    ],
  },
  'loan-select': {
    title: '도서 선택',
    steps: [
      '빌리고 싶은 책의 “선택” 버튼을 누릅니다.',
      '한 번에 최대 2권까지 빌릴 수 있습니다.',
      '위 검색창에 제목이나 저자를 쳐서 찾을 수 있습니다.',
      '다 골랐으면 “다음 단계”를 누릅니다.',
    ],
  },
  'loan-confirm': {
    title: '대출 확인',
    steps: [
      '빌릴 책과 반납 날짜를 확인하세요.',
      '맞으면 “대출하기”를 누릅니다.',
      '바꾸려면 “이전”을 눌러 다시 고릅니다.',
    ],
  },
  'loan-complete': {
    title: '대출 완료',
    steps: [
      '대출이 끝났습니다. 반납 날짜를 꼭 확인하세요.',
      '“확인하기”를 누르면 처음으로 돌아갑니다.',
    ],
  },
  'loan-dispense': {
    title: '도서 수령',
    steps: [
      '배출구에서 도서를 한 권씩 수령하세요.',
      '화면에 나오는 순서대로 받으면 됩니다.',
      '다 받으면 자동으로 넘어갑니다.',
    ],
  },
  'loan-history': {
    title: '대출 이력',
    steps: [
      '지금 빌린 책과 반납 날짜를 확인하세요.',
      '돌려줄 책이 있으면 “반납하러 가기”를 누릅니다.',
    ],
  },
  receipt: {
    title: '영수증 발급',
    steps: [
      '영수증이 필요하면 “출력”을 누릅니다.',
      '필요 없으면 “출력 안 함”을 누릅니다.',
      '둘 중 하나를 누르면 마무리 화면으로 갑니다.',
    ],
  },
  'return-insert': {
    title: '도서 투입',
    steps: [
      '실제 기기에서는 책을 반납구에 한 권씩 넣습니다.',
      '연습 화면에서는 잠시 후 자동으로 인식됩니다.',
      '빌린 책이 없으면 안내 문구가 나옵니다.',
    ],
  },
  'return-scanning': {
    title: '도서 인식',
    steps: [
      '인식된 책 목록을 확인하세요.',
      '책을 더 넣으려면 “더 넣기”를 누릅니다.',
      '다 넣었으면 “반납하기”를 누릅니다.',
    ],
  },
  'return-confirm': {
    title: '반납 확인',
    steps: [
      '돌려줄 책 목록을 확인하세요.',
      '맞으면 “반납하기”를 누릅니다.',
      '바꾸려면 “이전”을 누릅니다.',
    ],
  },
  'return-complete': {
    title: '반납 완료',
    steps: [
      '반납이 끝났습니다.',
      '“확인하기”를 누르면 처음으로 돌아갑니다.',
    ],
  },
};

/**
 * CMS JSON 덮어쓰기를 합친 가이드 조회
 * @param screen - 화면 키 (kebab-case)
 * @param cmsContent - 스토어 CMS 맵
 */
export function resolveGuide(
  screen: string,
  cmsContent: Record<string, string>
): GuideContent {
  const fallback =
    DEFAULT_GUIDES[screen as ScreenKey] || { title: '도움말', steps: [] as string[] };
  const raw = cmsContent[`guide.${screen}`];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<GuideContent>;
    if (!Array.isArray(parsed.steps)) return fallback;
    return {
      title: typeof parsed.title === 'string' && parsed.title ? parsed.title : fallback.title,
      steps: parsed.steps.filter((s) => typeof s === 'string').slice(0, 10),
    };
  } catch {
    return fallback;
  }
}
