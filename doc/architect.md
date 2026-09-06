# Architect (Architecture Document)

## 스마트 도서관 무인 키오스크 시뮬레이터 — 시스템 아키텍처

---

## 1. 시스템 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 (터치 스크린)                    │
└────────────────────────┬────────────────────────────────┘
                         │ 터치 이벤트
                         ▼
┌─────────────────────────────────────────────────────────┐
│              프레젠테이션 계층 (React/Next.js)            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │ IdleScreen │  │ MainMenu  │  │ AuthScan  │ ...       │
│  └───────────┘  └───────────┘  └───────────┘           │
│         ▲              ▲              ▲                   │
│         └──────────────┴──────────────┘                  │
│                    Zustand Store                         │
│              (screen, kioskMode, user,                   │
│               selectedBooks, returnedLoans)              │
└────────────────────────┬────────────────────────────────┘
                         │ fetch / api
                         ▼
┌─────────────────────────────────────────────────────────┐
│              API 계층 (Next.js Route Handlers)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ /api/    │ │ /api/    │ │ /api/    │ │ /api/    │  │
│  │ books    │ │ loans    │ │ users    │ │ seed     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│         ▲                                               │
│         │ 보안 미들웨어 (security.ts)                    │
│         │ - Rate Limit, XSS, Validation, Headers        │
└─────────┼───────────────────────────────────────────────┘
          │ Prisma Client
          ▼
┌─────────────────────────────────────────────────────────┐
│              데이터 계층 (SQLite via Prisma)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ SimUser  │ │  Book    │ │ SimLoan  │ │Scenario  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                     dev.db (SQLite)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 모듈 아키텍처

### 2.1 디렉토리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 루트 레이아웃 (한국어 lang, Toaster)
│   ├── page.tsx                  # 진입점 (dynamic import, ssr: false)
│   ├── globals.css               # 글로벌 스타일 + 키오스크 CSS
│   └── api/                      # API Route Handlers
│       ├── route.ts              # GET /api (헬스체크)
│       ├── seed/route.ts         # POST /api/seed
│       ├── books/route.ts        # GET /api/books
│       ├── loans/
│       │   ├── route.ts          # GET/POST /api/loans
│       │   └── [id]/
│       │       ├── return/route.ts   # POST /api/loans/[id]/return
│       │       └── extend/route.ts   # POST /api/loans/[id]/extend
│       └── users/
│           ├── route.ts          # GET/POST /api/users
│           └── [id]/
│               ├── route.ts      # GET /api/users/[id]
│               ├── card/route.ts # POST /api/users/[id]/card
│               └── pin/route.ts  # POST /api/users/[id]/pin
├── components/
│   ├── kiosk/                    # 키오스크 화면 컴포넌트 (11개)
│   │   ├── KioskApp.tsx          # 클라이언트 전용 컨테이너
│   │   ├── KioskIdleScreen.tsx   # 대기 화면
│   │   ├── KioskMainMenu.tsx     # 메인 메뉴
│   │   ├── KioskAuthScan.tsx     # RFID 스캔
│   │   ├── KioskAuthPin.tsx      # PIN 입력
│   │   ├── KioskLoanSelect.tsx   # 도서 선택
│   │   ├── KioskLoanConfirm.tsx  # 대출 확인
│   │   ├── KioskLoanComplete.tsx # 대출 완료
│   │   ├── KioskReturnInsert.tsx # 반납 투입
│   │   ├── KioskReturnScanning.tsx # 반납 스캔
│   │   ├── KioskReturnConfirm.tsx # 반납 확인
│   │   └── KioskReturnComplete.tsx # 반납 완료
│   └── ui/                       # shadcn/ui 프리미티브 (40+)
├── stores/
│   └── useAppStore.ts            # Zustand 전역 스토어
├── lib/
│   ├── constants.ts              # 시드 데이터, 상수, 시나리오
│   ├── security.ts               # 보안 모듈
│   ├── db.ts                     # Prisma 클라이언트 싱글톤
│   ├── utils.ts                  # cn() 유틸리티
│   └── tts.ts                    # TTS (Web Speech API)
├── hooks/
│   ├── use-pwa.ts                # PWA 훅
│   ├── use-mobile.ts             # 모바일 감지 훅
│   └── use-toast.ts              # 토스트 훅
└── (기타 레거시 컴포넌트)
```

### 2.2 의존성 그래프

```
page.tsx
  └── KioskApp.tsx (dynamic import)
        ├── useAppStore (Zustand)
        ├── KioskIdleScreen
        ├── KioskMainMenu
        ├── KioskAuthScan
        ├── KioskAuthPin
        ├── KioskLoanSelect
        ├── KioskLoanConfirm
        ├── KioskLoanComplete
        ├── KioskReturnInsert
        ├── KioskReturnScanning
        ├── KioskReturnConfirm
        └── KioskReturnComplete

각 화면 컴포넌트:
  ├── useAppStore (상태 읽기/쓰기)
  ├── /api/* (fetch 호출)
  ├── framer-motion (애니메이션)
  ├── lucide-react (아이콘)
  └── shadcn/ui (버튼, 카드 등)
```

---

## 3. 데이터 흐름 아키텍처

### 3.1 대출 플로우 데이터 흐름

```
[Idle]
  │ 터치
  ▼
[MainMenu] ──── kioskMode: 'loan' ────▶
  │
  ▼
[AuthScan] ──── 시뮬레이션 2s ────▶
  │
  ▼
[AuthPin] ──── PIN 입력 ────▶ POST /api/users?pin=XXXX
  │                               │
  │                    authenticatedUser 설정
  ▼
[LoanSelect] ──── GET /api/books?search=&category=
  │                 │
  │        selectedBooks (최대 2개)
  ▼
[LoanConfirm] ──── POST /api/loans { userId, bookIds[] }
  │                    │
  │           availableCopies 감소
  ▼
[LoanComplete] ──── GET /api/users/[id] (갱신된 대출 목록)
  │
  ▼ (자동/수동)
[Idle]
```

### 3.2 반납 플로우 데이터 흐름

```
[Idle]
  │ 터치
  ▼
[MainMenu] ──── kioskMode: 'return' ────▶
  │
  ▼
[AuthScan] → [AuthPin] (동일)
  │
  ▼
[ReturnInsert] ──── GET /api/loans?userId=X (활성 대출 조회)
  │                   │
  │          returnedLoans 설정 (자동 감지 2s)
  ▼
[ReturnScanning] ──── RFID 스캔 애니메이션
  │                    │
  │          "더 넣기" → [ReturnInsert] (추가 반납)
  ▼
[ReturnConfirm] ──── POST /api/loans/[id]/return (각 도서)
  │                    │
  │           availableCopies 증가
  ▼
[ReturnComplete]
  │
  ▼ (자동/수동)
[Idle]
```

---

## 4. 컴포넌트 아키텍처

### 4.1 화면 라우터 패턴

```typescript
// KioskApp.tsx — ScreenRouter
function ScreenRouter({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle':           return <KioskIdleScreen />;
    case 'main-menu':      return <KioskMainMenu />;
    case 'auth-scan':      return <KioskAuthScan />;
    case 'auth-pin':       return <KioskAuthPin />;
    case 'loan-select':    return <KioskLoanSelect />;
    case 'loan-confirm':   return <KioskLoanConfirm />;
    case 'loan-complete':  return <KioskLoanComplete />;
    case 'return-insert':  return <KioskReturnInsert />;
    case 'return-scanning':return <KioskReturnScanning />;
    case 'return-confirm': return <KioskReturnConfirm />;
    case 'return-complete':return <KioskReturnComplete />;
    default:               return <KioskIdleScreen />;
  }
}
```

### 4.2 AnimatePresence 래핑

```typescript
<AnimatePresence mode="wait">
  <motion.div
    key={screen}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    <ScreenRouter screen={screen} />
  </motion.div>
</AnimatePresence>
```

### 4.3 공통 컴포넌트 패턴

각 키오스크 화면 컴포넌트의 공통 구조:

```typescript
export default function KioskXxxScreen() {
  // 1. Zustand 스토어 접근
  const { screen, setScreen, ... } = useAppStore();

  // 2. 로컬 상태
  const [loading, setLoading] = useState(false);

  // 3. 이펙트 (타이머, 자동 전환 등)
  useEffect(() => { ... }, []);

  // 4. 이벤트 핸들러
  const handleAction = () => { ... };

  // 5. 렌더
  return (
    <div className="kiosk-screen">
      {/* 화면 내용 */}
    </div>
  );
}
```

---

## 5. API 아키텍처

### 5.1 Route Handler 패턴

```typescript
// 모든 API Route의 공통 구조
export async function GET(request: NextRequest) {
  // 1. 보안 헤더 설정
  const headers = getSecurityHeaders();

  // 2. Rate Limit 확인
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: '...' }, { status: 429, headers });
  }

  // 3. 입력 검증
  // 4. 비즈니스 로직
  // 5. DB 쿼리 (Prisma)
  // 6. 응답 반환
}
```

### 5.2 Prisma 싱글톤

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const db = globalForPrisma.prisma || new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

---

## 6. 배포 아키텍처

### 6.1 단일 프로세스

```
Next.js (port 3000)
  ├── Static Assets  (/public)
  ├── SSR Pages      (/)
  └── API Routes     (/api/*)
```

### 6.2 게이트웨이 (Caddy)

```
외부 요청 → Caddy (역방향 프록시) → Next.js :3000
  - /api/*?XTransformPort=N → 포트 N 포워딩
  - / → Next.js 기본 포트
```

### 6.3 메모리 제약

| 항목 | 제한 | 대응 |
|---|---|---|
| RAM | ~4GB | swap 2GB 추가 |
| /dev/shm | 64MB | Chrome 제한적 |
| 프로세스 | 단일 Next.js | 미니 서비스는 별도 포트 |

---

## 7. 아키텍처 결정 기록 (ADR)

### ADR-001: CSR 전용 렌더링

**상황**: 키오스크는 서버 렌더링이 불필요, 하이드레이션 미스매치 발생
**결정**: `dynamic(() => import('...'), { ssr: false })` 사용
**결과**: 하이드레이션 오류 해결, 초기 로드 약간 지연

### ADR-002: Zustand 기반 화면 라우팅

**상황**: Next.js 파일시스템 라우팅은 키오스크 단일 페이지에 부적합
**결정**: Zustand `screen` 상태로 화면 전환, URL 변경 없음
**결과**: 화면 전환 빠름, 브라우저 히스토리 오염 없음

### ADR-003: SQLite 선택

**상황**: 프로토타입/시뮬레이터, 단일 사용자, 배포 복잡도 최소화
**결정**: SQLite + Prisma (파일 DB)
**결과**: DB 서버 불필요, 마이그레이션 간편

### ADR-004: Service Worker 비활성화

**상황**: SW가 API 응답을 캐싱하여 시뮬레이션 동작 방해
**결정**: sw.js → sw.js.disabled
**결과**: API 캐싱 문제 해결, 오프라인 기능 상실

### ADR-005: 최대 대출 2권

**상황**: ECO 실제 기기 정책, 한국 공공도서관 표준
**결정**: `MAX_LOAN_COUNT = 2` 상수화
**결과**: UI/API 양쪽에서 2권 초과 차단
