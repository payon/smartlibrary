/**
 * 키오스크 시뮬레이션 상수 정의 모듈
 *
 * [내용]
 * - 시드 도서 데이터 (15권, 표지 이미지 포함)
 * - 학습 시나리오 정의 (7개)
 * - 대출 규정 상수 (최대 권수, 대출 기간, 연체 배수)
 * - 키오스크 화면 타입 정의
 */

// ============================================================================
// 시드 도서 데이터 (표지 이미지 URL 포함)
// ============================================================================

/** 도서관 시뮬레이션용 시드 도서 데이터 */
export const SEED_BOOKS = [
  {
    isbn: '9788932917245',
    title: '연금술사',
    author: '파울로 코엘료',
    publisher: '문학동네',
    publishYear: 2009,
    category: '소설',
    shelfLocation: '2층 A-05',
    totalCopies: 3,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788954641015',
    title: '어린왕자',
    author: '생텍쥐페리',
    publisher: '열린책들',
    publishYear: 2009,
    category: '소설',
    shelfLocation: '2층 A-12',
    totalCopies: 5,
    availableCopies: 3,
    coverUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788901216237',
    title: '백년의 고독',
    author: '가브리엘 가르시아 마르케스',
    publisher: '문학과지성사',
    publishYear: 2011,
    category: '소설',
    shelfLocation: '2층 B-03',
    totalCopies: 2,
    availableCopies: 1,
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788937460783',
    title: '채식주의자',
    author: '한강',
    publisher: '창비',
    publishYear: 2007,
    category: '소설',
    shelfLocation: '2층 B-08',
    totalCopies: 4,
    availableCopies: 4,
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788950910089',
    title: '날개',
    author: '이상',
    publisher: '현대문학',
    publishYear: 2012,
    category: '소설',
    shelfLocation: '2층 A-01',
    totalCopies: 3,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788901257781',
    title: '무례한 여자들이 만드는 세계',
    author: '정세랑',
    publisher: '문학과지성사',
    publishYear: 2020,
    category: '소설',
    shelfLocation: '2층 B-15',
    totalCopies: 3,
    availableCopies: 3,
    coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788934984206',
    title: '사피엔스',
    author: '유발 하라리',
    publisher: '김영사',
    publishYear: 2015,
    category: '인문',
    shelfLocation: '3층 C-02',
    totalCopies: 4,
    availableCopies: 1,
    coverUrl: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788901277192',
    title: '죽음의 수용소에서',
    author: '빅터 프랭클',
    publisher: '문학과지성사',
    publishYear: 2014,
    category: '인문',
    shelfLocation: '3층 C-07',
    totalCopies: 3,
    availableCopies: 3,
    coverUrl: 'https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788937444066',
    title: '나는 왜 너를 사랑하는가',
    author: '알랭 드 보통',
    publisher: '창비',
    publishYear: 2014,
    category: '인문',
    shelfLocation: '3층 C-11',
    totalCopies: 2,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788937832588',
    title: '미래를 바꾸는 10가지 마법',
    author: '최장순',
    publisher: '을유문화사',
    publishYear: 2016,
    category: '과학',
    shelfLocation: '4층 D-03',
    totalCopies: 2,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788937439109',
    title: '당신의 파편',
    author: '신형철',
    publisher: '창비',
    publishYear: 2018,
    category: '시',
    shelfLocation: '2층 A-20',
    totalCopies: 3,
    availableCopies: 3,
    coverUrl: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788954681660',
    title: '도둑맞은 집중력',
    author: '요한 하리',
    publisher: '열린책들',
    publishYear: 2023,
    category: '인문',
    shelfLocation: '3층 C-15',
    totalCopies: 5,
    availableCopies: 4,
    coverUrl: 'https://images.unsplash.com/photo-1553729459-uj6mw2q6z7s?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788901274191',
    title: '21세기를 위한 21가지 제언',
    author: '유발 하라리',
    publisher: '김영사',
    publishYear: 2022,
    category: '인문',
    shelfLocation: '3층 C-02',
    totalCopies: 3,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788945079496',
    title: '내가 틀릴 수도 있습니다',
    author: '한스 로슬링',
    publisher: '비즈니스북스',
    publishYear: 2018,
    category: '과학',
    shelfLocation: '4층 D-08',
    totalCopies: 3,
    availableCopies: 3,
    coverUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=200&h=300&fit=crop',
  },
  {
    isbn: '9788997402009',
    title: '그림으로 보는 한국의 역사',
    author: '박은봉',
    publisher: '웅진주니어',
    publishYear: 2019,
    category: '역사',
    shelfLocation: '3층 E-01',
    totalCopies: 4,
    availableCopies: 2,
    coverUrl: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=200&h=300&fit=crop',
  },
];

// ============================================================================
// 학습 시나리오 데이터
// ============================================================================

/** 도서관 이용 학습 시나리오 정의 */
export const SCENARIOS = [
  {
    id: 'scenario-signup',
    title: '회원가입 하기',
    description: '도서관 회원가입을 통해 새로운 회원증을 만들어봅시다.',
    difficulty: 'beginner',
    category: 'signup',
    orderIndex: 0,
    stepsJson: JSON.stringify([
      { step: 1, title: '이름 입력하기', description: '본인의 이름을 정확히 입력해주세요.' },
      { step: 2, title: '생년월일 입력하기', description: '주민등록상 생년월일 8자리를 입력해주세요.' },
      { step: 3, title: '전화번호 입력하기', description: '휴대전화 번호를 입력해주세요.' },
      { step: 4, title: '주소 입력하기', description: '현재 거주하시는 주소를 입력해주세요.' },
      { step: 5, title: '비밀번호 설정하기', description: '키오스크 대여용 4자리 비밀번호를 설정합니다.' },
      { step: 6, title: '가입 완료하기', description: '모든 정보를 확인하고 가입을 완료합니다.' },
    ]),
  },
  {
    id: 'scenario-card',
    title: '도서증 발급받기',
    description: '모바일 도서증과 실물 도서증을 발급받아봅시다.',
    difficulty: 'beginner',
    category: 'card',
    orderIndex: 1,
    stepsJson: JSON.stringify([
      { step: 1, title: '도서증 종류 선택', description: '모바일 도서증 또는 실물 도서증을 선택합니다.' },
      { step: 2, title: '도서증 발급 확인', description: '발급된 도서증을 확인합니다.' },
      { step: 3, title: '도서증 저장하기', description: '발급된 도서증을 안전하게 저장합니다.' },
    ]),
  },
  {
    id: 'scenario-search',
    title: '도서 검색하기',
    description: '원하는 책을 검색하고 위치를 확인해봅시다.',
    difficulty: 'beginner',
    category: 'loan',
    orderIndex: 2,
    stepsJson: JSON.stringify([
      { step: 1, title: '검색창 열기', description: '검색창을 눌러 검색을 시작합니다.' },
      { step: 2, title: '책 제목 검색', description: '찾고 싶은 책의 제목이나 저자를 입력합니다.' },
      { step: 3, title: '검색 결과 확인', description: '검색 결과에서 원하는 책을 찾습니다.' },
      { step: 4, title: '대출 가능 확인', description: '책이 대출 가능한지 확인합니다.' },
    ]),
  },
  {
    id: 'scenario-counter-loan',
    title: '창구에서 책 빌리기',
    description: '카운터에서 사서님께 도서증을 보여주고 책을 빌려봅시다.',
    difficulty: 'beginner',
    category: 'loan',
    orderIndex: 3,
    stepsJson: JSON.stringify([
      { step: 1, title: '도서증 제시하기', description: '사서님께 도서증을 보여주세요.' },
      { step: 2, title: '빌릴 책 선택하기', description: '빌리고 싶은 책을 선택합니다.' },
      { step: 3, title: '대여 확인하기', description: '대여 내역을 확인합니다.' },
      { step: 4, title: '반납일 확인하기', description: '반납일을 확인하고 영수증을 받습니다.' },
    ]),
  },
  {
    id: 'scenario-counter-return',
    title: '창구에서 책 반납하기',
    description: '빌린 책을 카운터에서 반납하는 방법을 배워봅시다.',
    difficulty: 'beginner',
    category: 'return',
    orderIndex: 4,
    stepsJson: JSON.stringify([
      { step: 1, title: '반납할 책 선택하기', description: '반납할 책을 선택합니다.' },
      { step: 2, title: '책 스캔하기', description: '사서님이 책 바코드를 스캔합니다.' },
      { step: 3, title: '반납 확인하기', description: '반납이 완료되었는지 확인합니다.' },
    ]),
  },
  {
    id: 'scenario-kiosk-loan',
    title: '키오스크로 책 빌리기',
    description: '무인 키오스크를 이용해 스스로 책을 빌려봅시다.',
    difficulty: 'intermediate',
    category: 'kiosk',
    orderIndex: 5,
    stepsJson: JSON.stringify([
      { step: 1, title: '키오스크 시작하기', description: '키오스크 화면을 터치하여 도서 대여를 선택합니다.' },
      { step: 2, title: '책 선택하기', description: '빌릴 책을 최대 10권까지 선택합니다. 자동으로 바코드가 스캔됩니다.' },
      { step: 3, title: '도서증 바코드 스캔', description: '모바일 도서증 또는 실물 도서증의 바코드를 스캔합니다.' },
      { step: 4, title: '비밀번호 입력', description: '설정한 4자리 비밀번호를 입력합니다.' },
      { step: 5, title: '대여 완료 확인', description: '대여 내역을 확인하고 완료를 누릅니다.' },
    ]),
  },
  {
    id: 'scenario-kiosk-return',
    title: '키오스크로 책 반납하기',
    description: '무인 키오스크를 이용해 스스로 책을 반납해봅시다.',
    difficulty: 'intermediate',
    category: 'kiosk',
    orderIndex: 6,
    stepsJson: JSON.stringify([
      { step: 1, title: '반납 모드 선택', description: '키오스크에서 반납을 선택합니다.' },
      { step: 2, title: '책 투입구에 넣기', description: '반납할 책을 투입구에 넣습니다.' },
      { step: 3, title: '반납 목록 확인', description: '반납된 책 목록을 확인합니다.' },
      { step: 4, title: '반납 완료하기', description: '반납을 완료합니다.' },
    ]),
  },
];

// ============================================================================
// 대출 규정 상수
// ============================================================================

/** 최대 대출 가능 권수 */
export const MAX_LOAN_COUNT = 2;

/** 대출 기간 (일) - 연장 불가, 고정 15일 */
export const LOAN_PERIOD_DAYS = 15;

/** 연체 정지 배수 - 연체일수 × 이 값만큼 대여 정지 */
export const OVERDUE_BLOCK_MULTIPLIER = 1;

// ============================================================================
// 키오스크 화면 타입 정의
// ============================================================================

/** 키오스크 화면 이름 타입 */
export type KioskViewName =
  | 'idle'
  | 'main-menu'
  | 'card-apply'
  | 'card-form'
  | 'card-pending'
  | 'card-complete'
  | 'auth-scan'
  | 'auth-pin'
  | 'loan-select'
  | 'loan-confirm'
  | 'loan-complete'
  | 'return-insert'
  | 'return-scanning'
  | 'return-confirm'
  | 'return-complete';

/** 키오스크 모드 타입 */
export type KioskMode = 'loan' | 'return' | 'card' | null;

/** 키오스크 화면 상수 */
export const KIOSK_VIEWS = {
  IDLE: 'idle' as const,
  MAIN_MENU: 'main-menu' as const,
  CARD_APPLY: 'card-apply' as const,
  CARD_FORM: 'card-form' as const,
  CARD_PENDING: 'card-pending' as const,
  CARD_COMPLETE: 'card-complete' as const,
  AUTH_SCAN: 'auth-scan' as const,
  AUTH_PIN: 'auth-pin' as const,
  LOAN_SELECT: 'loan-select' as const,
  LOAN_CONFIRM: 'loan-confirm' as const,
  LOAN_COMPLETE: 'loan-complete' as const,
  RETURN_INSERT: 'return-insert' as const,
  RETURN_SCANNING: 'return-scanning' as const,
  RETURN_CONFIRM: 'return-confirm' as const,
  RETURN_COMPLETE: 'return-complete' as const,
};

/** 도서 카테고리 목록 */
export const BOOK_CATEGORIES = ['전체', '소설', '인문', '과학', '역사', '시'] as const;
