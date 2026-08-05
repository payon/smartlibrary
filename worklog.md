# SmartLib Sim - Worklog

---
Task ID: 1
Agent: Main Orchestrator
Task: Set up project foundation

Work Log:
- Analyzed PRD and planned architecture for Next.js adaptation
- Prisma schema already configured with SimUser, Book, SimLoan, LearningProgress, Scenario models
- Setting up senior-friendly CSS variables, Zustand store, TTS utility, layout

Stage Summary:
- Foundation architecture planned
- Prisma schema confirmed ready
- Starting foundation implementation

---
Task ID: 2-a
Agent: API Routes Builder
Task: Build all API routes for SmartLib Sim

Work Log:
- Created `src/app/api/seed/route.ts` (POST) — clears all tables and seeds books + scenarios from constants
- Created `src/app/api/users/route.ts` (POST) — creates SimUser with auto-generated LIB-XXXXXXXX card number, defaults to mobile card type
- Created `src/app/api/users/[id]/route.ts` (GET) — returns user with active loans (includes book info)
- Created `src/app/api/users/[id]/card/route.ts` (POST) — reissues card with new number, supports mobile/physical types
- Created `src/app/api/books/route.ts` (GET) — searches by title, author, or category; returns all if no query
- Created `src/app/api/loans/route.ts` (GET, POST) — lists user loans; creates loan with validation (max 5 active, no overdue, available copies check)
- Created `src/app/api/loans/[id]/return/route.ts` (POST) — returns book, increments copies, calculates overdue days/fee
- Created `src/app/api/loans/[id]/extend/route.ts` (POST) — extends due date by 7 days, prevents double extension
- Created `src/app/api/progress/route.ts` (GET, POST, PUT) — get/create/upsert learning progress; upsert uses min(bestTime) and max(stars)
- Created `src/app/api/progress/certificate/route.ts` (GET) — checks if all scenarios completed, returns eligibility + completion date
- All routes use `export const dynamic = 'force-dynamic'` for fresh data
- All error messages in Korean
- Lint passes cleanly with zero errors

Stage Summary:
- 10 API route files created covering seed, users, books, loans, and progress endpoints
- Full CRUD + business logic validation for library simulation operations
- Ready for frontend integration

---
Task ID: 2-b
Agent: Frontend Layout & Views Builder
Task: Build core layout, TopBar, OnboardingView, HomeView, SettingsView, and page.tsx view switching

Work Log:
- Updated `src/app/layout.tsx` — set lang="ko", system sans-serif font, Toaster from sonner (not shadcn wrapper to avoid next-themes dependency), wrapped children in div#app-root with min-h-screen flex flex-col, metadata title set to "스마트 도서관 시뮬레이터 | SmartLib Sim"
- Updated `src/app/page.tsx` — 'use client' component that reads currentView/fontSize/highContrast from Zustand store, applies font-size and high-contrast classes to root div, switches between OnboardingView/HomeView/SettingsView/PlaceholderView based on currentView, calls /api/seed on first mount (once via ref guard), redirects from onboarding→home if already completed
- Created `src/components/TopBar.tsx` — sticky fixed top bar with bg-primary text-primary-foreground, back/home/settings buttons (48x48 touch targets), TTS on title change via useEffect, floating help button (bottom-right, gentlePulse animation, Volume2 icon) that opens a Dialog with current screen explanation and "다시 듣기" TTS replay button
- Created `src/components/OnboardingView.tsx` — 5-step onboarding with framer-motion slide transitions (AnimatePresence), Step 1: Welcome with BookOpen icon animation, Step 2: Touch practice (6 tappable circles with color feedback), Step 3: Swipe practice (animated arrow indicators), Step 4: Font size selection (3 options with live preview), Step 5: Ready screen with "시작하기" button, progress dots at bottom, large prev/next buttons, TTS reads each step
- Created `src/components/HomeView.tsx` — greeting with user name or "환영합니다!", user profile card (if registered) showing name/card number/card type, registration CTA (if no user), quick stats cards (total stars, completed scenarios), grid of scenario cards from SCENARIOS constant with mapped icons, difficulty badges (초급/중급), star ratings, completion checkmarks, fetches progress from /api/progress on mount
- Created `src/components/SettingsView.tsx` — font size selector (3 options with visual preview), high contrast toggle (Switch), TTS toggle (Switch) that syncs with tts.ts setTtsEnabled, kiosk timeout selector (RadioGroup: 30초/60초/90초), "학습 초기화" button with AlertDialog confirmation (re-seeds data), "처음부터 다시" button with AlertDialog confirmation (clears user, resets onboarding, navigates to onboarding), all labels use text-body class

Stage Summary:
- 6 files modified/created: layout.tsx, page.tsx, TopBar.tsx, OnboardingView.tsx, HomeView.tsx, SettingsView.tsx
- All views are rendered in page.tsx based on Zustand store state (single-page view switching)
- Placeholder components for unbuilt views (registration, card-issuance, book-search, counter-loan, counter-return, kiosk-loan, kiosk-return, learning-progress, completion)
- Lint passes with 0 errors, 0 warnings
- Dev server compiles successfully, /api/seed endpoint confirmed working

---
Task ID: 2-c
Agent: Registration & Card Issuance Builder
Task: Build RegistrationView and CardIssuanceView with full multi-step form, animations, and API integration

Work Log:
- Created `src/components/RegistrationView.tsx` — 7-step registration form with:
  - Step 1: 이름 입력 — input-senior, real-time validation (min 2 chars), TTS on label and errors
  - Step 2: 생년월일 입력 — 8-digit only, validates date correctness and year range (1900–2020), placeholder shows example format
  - Step 3: 전화번호 입력 — auto-format to XXX-XXXX-XXXX, validates 010 prefix and 11 digits
  - Step 4: 주소 입력 — textarea with input-senior style, hint about 시/군/구 being sufficient
  - Step 5: 약관 동의 — long Korean terms text (7 articles) in scrollable div with custom-scrollbar, scroll progress bar, large checkbox button disabled until 90% scrolled
  - Step 6: 본인확인 시뮬레이션 — fake ID card UI (name, birth date, address, phone), camera icon, "촬영하기" button triggers 2-second scan line animation then success overlay
  - Step 7: 가입 완료 — POST to /api/users, stores user via setCurrentUser, CSS confettiFall animation with 10 colored pieces, large green CheckCircle spring animation, shows name and card number, "도서증 발급받기" → card-issuance, "홈으로" → home
  - Step progress bar at top (7 segments, primary for active, emerald for done, muted for pending), step counter text
  - Back/Next buttons with btn-senior, Previous/홈으로 on step 1
  - framer-motion AnimatePresence slide transitions (left/right based on direction)
  - Mission mode: completeMissionStep() called after step 5 agreement
  - All text Korean, TTS reads each step on enter
- Created `src/components/CardIssuanceView.tsx` — 3-phase card issuance with:
  - Phase 'select': Two large option cards — 모바일 도서증 (Phone icon + QR code placeholder) and 실물 도서증 (CreditCard icon + gradient preview), both with descriptions
  - Phase 'issuing': Spinner animation with selected type icon, "도서증을 발급하고 있습니다..." text
  - Phase 'display': Conditional rendering based on card type:
    - Mobile card: Phone frame mockup (rounded-2xl with notch), white screen showing library name, user name, card number, large QR code grid (11x11 pattern), issue date
    - Physical card: Credit card proportions (aspect-ratio 1.586/1), emerald gradient, library name, avatar with first character, card number
  - Star stamp spring animation on issuance completion
  - Save button ("저장하기" / "지갑에 저장하기") with toast feedback
  - Reissue section: "도서증을 분실했나요?" with dashed border, AlertDialog confirmation, POST to /api/users/[id]/card toggles card type
  - If user already has card, skips selection and goes directly to display
  - Mission mode: completeMissionStep() on completion
  - TTS reads instructions and completion messages
- Updated `src/app/page.tsx` — imported RegistrationView and CardIssuanceView, added switch cases for 'registration' and 'card-issuance', removed those entries from PLACEHOLDER_VIEWS

Stage Summary:
- 3 files created/modified: RegistrationView.tsx, CardIssuanceView.tsx, page.tsx
- Registration: 7-step form with full validation, TTS, confetti, ID verification simulation
- Card Issuance: 3-phase flow (select → issuing → display) with mobile/physical card types, reissue support
- Lint passes with 0 errors, 0 warnings
- Dev server compiles successfully

---
Task ID: 2-d
Agent: Book Search, Counter Loan & Return Builder
Task: Build BookSearchView, CounterLoanView, and CounterReturnView with full multi-step flows, animations, API integration, and senior-friendly UI

Work Log:
- Created `src/components/BookSearchView.tsx` — comprehensive book search view with:
  - Large search input with Search icon and input-senior class, placeholder "책 제목이나 저자를 검색해보세요"
  - Microphone button for voice search using Web Speech API (SpeechRecognition), with listening state indicator
  - Large "검색하기" button fetching from /api/books?query=...
  - Search results displayed as large card-senior card list with category-based colored covers (소설=rose, 인문=amber, 과학=teal, 시=violet, 역사=sky)
  - Each card: book cover placeholder with BookOpen icon, title (text-heading), author (text-body), publisher/year (text-caption), shelf location badge, availability status (green "대출 가능" / red "대출 중"), "빌리기" button for available books
  - Empty state with BookX icon: "검색 결과가 없습니다"
  - Shelf map (P1): simplified floor map with floor selector (2층/3층/4층), shelf grid with colored rectangles representing shelves, pulsing indicator on target location via framer-motion, location info bar
  - Popular books section (P2): horizontal scrollable cards showing first 4 books from /api/books as "인기 도서" with TrendingUp icon
  - Mission mode: mission steps display with completion tracking, completeMissionStep() on search+select
  - TTS on mount and search results
- Created `src/components/CounterLoanView.tsx` — 6-step counter borrowing simulation with:
  - Pre-requisite check: if no user, shows "먼저 회원가입을 해주세요" with registration button
  - Step 1 도서증 제시: Visual counter/desk scene with librarian avatar, user's library card (emerald gradient with card number/name), "도서증을 제시합니다" button triggers card slide-up animation, librarian confirms with "네, 확인했습니다"
  - Step 2 빌릴 책 선택: Fetches available books from /api/books, large card list with custom 48px checkboxes, selected books summary with badges, current active loan count display, max 5 books limit with toast warning
  - Step 3 대여 권수 초과 시뮬레이션: Shows if user already has 5 active loans, "대여 권수를 초과했습니다! (최대 5권)" with AlertTriangle icon, current loans list with due dates, "반납 후 다시 오세요" message, navigation to counter-return
  - Step 4 연체 도서 시뮬레이션: Shows overdue loans with rose-colored cards, overdue days calculation, "연체된 도서가 있습니다. 먼저 반납해주세요." message, navigate to counter-return button
  - Step 5 대여 확인: Summary table of selected books with 14-day due dates, AlertDialog confirmation "정말 대여하시겠습니까?", POST to /api/loans for each book
  - Step 6 대여 완료/영수증: Success screen with green CheckCircle spring animation, receipt card (dashed border) showing user name/card number, each book with due date, total count, "연장은 1회 가능합니다 (7일)" note, star stamp in mission mode
  - Step progress bar (6 segments) at top, framer-motion AnimatePresence slide transitions
  - Mission mode: completeMissionStep() on card presentation, book selection, and loan completion
- Created `src/components/CounterReturnView.tsx` — 4-step counter return simulation with:
  - Pre-requisite check: if no user → registration, if no active loans → "반납할 도서가 없습니다"
  - Step 1 반납할 책 선택: Fetches active loans from /api/loans?userId=..., cards with book title/author, loan/due dates, days remaining (green >7, yellow 1-7, red overdue), large 48px checkboxes, "선택한 책: N권" counter
  - Step 2 책 스캔 시뮬레이션: Sequential scan simulation with barcode placeholder (striped div), scan-line CSS animation (1.5s per book), "삑!" text + green CheckCircle on completion, auto-advance with interval, progress counter "N/M권 스캔 완료"
  - Step 3 연체료 계산: If overdue books exist, calculates overdue days per book (100원/일), shows itemized fee list, total fee, simulation disclaimer "이것은 시뮬레이션입니다. 실제 비용이 청구되지 않습니다."; no overdue → "정상 반납" message
  - Step 4 반납 완료: Success animation with CheckCircle, "반납 확인증" receipt card (dashed border) with user name, returned books list, return date, "정상 반납" or "연체 반납 (연체료: X원)", POST to /api/loans/[id]/return for each loan, star stamp in mission mode, "홈으로" button
  - Step progress bar (4 segments), framer-motion animations throughout
  - Mission mode: completeMissionStep() on scan completion and return completion
- Updated `src/app/page.tsx` — imported all three new views, added switch cases for 'book-search', 'counter-loan', 'counter-return', removed from PLACEHOLDER_VIEWS

Stage Summary:
- 4 files created/modified: BookSearchView.tsx, CounterLoanView.tsx, CounterReturnView.tsx, page.tsx
- Book Search: full search with voice input, results cards, shelf map visualization, popular books, mission integration
- Counter Loan: 6-step flow with card presentation animation, book selection, limit/overdue handling, receipt
- Counter Return: 4-step flow with sequential barcode scan simulation, overdue fee calculation, return certificate
- All views use TopBar, card-senior, btn-senior, input-senior, text-title/heading/body/caption, TTS, mission mode
- Lint passes with 0 errors, 0 warnings
- Dev server compiles successfully

---
Task ID: 2-e
Agent: Kiosk, Learning Progress, and Completion Builder
Task: Build KioskLoanView, KioskReturnView, LearningProgressView, and CompletionView

Work Log:
- Created `src/components/KioskLoanView.tsx` — 5-step kiosk borrowing simulation with:
  - Kiosk frame: kiosk-frame CSS class (dark bg, max 480px), no TopBar — custom kiosk header with gradient blue-to-purple
  - Timeout bar: red progress bar at top using framer-motion animate width 100%→0% over kioskTimeoutSeconds, resets on any touch/click
  - Warning TTS at 10 seconds before timeout: "곧 초기화됩니다. 계속하시려면 화면을 터치해주세요"
  - On timeout: fade overlay with Clock icon, TTS "시간이 초과되었습니다", auto-reset to start after 2s
  - "처음으로" and "도움말" buttons always visible at bottom of screen
  - Step 1 (시작 화면): Two large kiosk-style buttons — "📚 도서 대여" (green) and "📖 도서 반납" (blue)
  - Step 2 (도서증 스캔): Large QR scan area with dashed border, scan line animation (scan-line CSS), QR code placeholder grid (11x11), user card number display, 2-second scan animation with "삑! 스캔 완료", auto-advance
  - Step 3 (도서 바코드 스캔): Fetches available books from /api/books, book list with Barcode icons and selection, barcode scan area with emerald scan-line, "삑!" success flash per book, max 5 books limit, scanned books list with remove option
  - Step 4 (대여 확인): Summary with borrower name, card number, count; each book with due date (14 days); large "대여 완료" green button; AlertDialog confirmation
  - Step 5 (완료 화면): Spring-animated CheckCircle, receipt card (white, dashed border) with borrower info and book list, "영수증 출력" button (toast simulation), POST to /api/loans for each book
  - Mission mode: completeMissionStep() on card scan and loan completion
  - TTS guides through each step
- Created `src/components/KioskReturnView.tsx` — 4-step kiosk return simulation with:
  - Same kiosk frame, timeout bar, and navigation as KioskLoanView
  - Step 1 (서비스 선택): Same start screen with 대여/반납 buttons, pre-checks for active loans
  - Step 2 (반납 모드): Fetches active loans from /api/loans?userId=..., "반납할 책을 투입구에 넣어주세요" message, visual book drop slot (rounded-top opening + body + base), book slide-into-slot animation (framer-motion y:-80→0, opacity 1→0, 1.5s easeIn), "삑!" success flash, progress counter "N/M권 반납 완료", returned books summary with emerald styling
  - Step 3 (반납 목록 확인): Each returned book with status (정상 반납 in emerald, 연체 반납 in rose), overdue days and fee calculation (100원/일), total fee summary in amber, "시뮬레이션입니다. 실제 비용이 없습니다." disclaimer
  - Step 4 (완료): Return confirmation card (반납 확인증), "영수증 출력 여부" toggle (예/아니오 buttons), conditional print button with toast, POST to /api/loans/[id]/return for each book
  - Mission mode: completeMissionStep() on each book insertion and final completion
- Created `src/components/LearningProgressView.tsx` — Learning management dashboard with:
  - TopBar with title="학습 진행도"
  - Overview Stats: 3-column grid showing total stars (amber Star icon), completed scenarios (emerald CheckCircle), average stars (purple Trophy)
  - Star Stamp Collection: 7-column grid of scenario slots, each shows filled gold star with star-stamp animation or numbered empty circle, scenario title abbreviation below
  - Mission Mode Section: If active — shows current mission title, step progress bar, "이어하기" and "그만두기" buttons; if inactive — "미션 시작하기" button that finds first incomplete scenario and navigates to its view
  - Scenario Progress List: For each of 7 scenarios — icon, title, difficulty badge (초급/중급), status badge (완료/진행중/미시작 with color coding), progress bar (steps completed/total), star rating (0-3), attempts count, best time with Clock icon, "다시 하기" button with AlertDialog reset confirmation (PUT to /api/progress)
  - Certificate Section: Fetches from /api/progress/certificate?userId=...; if eligible — Award icon with spring animation, "수료증 획득!" label, completion date, "수료증 보기" button → completion view; if not eligible — Lock icon, "N/7 시나리오 완료" with progress bar
  - TTS on mount
- Created `src/components/CompletionView.tsx` — Certificate celebration view with:
  - TopBar with title="수료증"
  - Confetti animation: 30 pieces with varied colors, sizes, delays, falling with rotation (5 seconds)
  - Decorative certificate card: border-4 amber, amber/yellow gradient background, corner decorations (span elements with border styles), rotating Sparkles icon, title "스마트 도서관 이용 수료증", Award divider, user name (large), certificate body text in 3 lines, completion date, spring-animated seal (rounded-full border-4 with Award icon), "스마트 도서관 시뮬레이터" label
  - Action buttons: "홈으로 돌아가기" (primary), "다시 학습하기" (outlined, opens AlertDialog confirmation, re-seeds data)
  - TTS congratulation message on mount
- Updated `src/app/page.tsx` — imported all 4 new views, added switch cases for 'kiosk-loan', 'kiosk-return', 'learning-progress', 'completion', removed PLACEHOLDER_VIEWS map and PlaceholderView component entirely

Stage Summary:
- 5 files created/modified: KioskLoanView.tsx, KioskReturnView.tsx, LearningProgressView.tsx, CompletionView.tsx, page.tsx
- Kiosk Loan: 5-step self-service borrowing with QR/card scan simulation, barcode scanning, receipt, timeout system
- Kiosk Return: 4-step self-service return with book drop slot animation, overdue fee calculation, receipt toggle
- Learning Progress: Comprehensive dashboard with stats, star stamp grid, mission mode, scenario list with progress bars, certificate eligibility
- Completion: Decorative certificate with confetti, seal animation, reset functionality
- All views use Korean text, TTS, framer-motion animations, senior-friendly CSS classes, mission mode integration
- Lint passes with 0 errors, 0 warnings
- Dev server compiles successfully

---
Task ID: 3-fix
Agent: AnimatePresence Fixer
Task: Fix AnimatePresence rendering issues causing blank screens during step transitions

Work Log:
- Replaced `import { motion, AnimatePresence } from 'framer-motion'` with `import { motion } from 'framer-motion'` in all 6 files
- CardIssuanceView.tsx: Removed `AnimatePresence mode="wait"` wrapping 3 phase conditionals (select/issuing/display), replaced each child motion.div exit/x animations with `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}`
- KioskLoanView.tsx: Removed 3 AnimatePresence usages: (1) timeout overlay → simple conditional + motion.div fade, (2) `mode="wait"` wrapping 5 step transitions → key-based fade-in, (3) book scan flash → conditional + motion.div. Total 7 motion.div children simplified.
- KioskReturnView.tsx: Removed 5 AnimatePresence usages: (1) timeout overlay, (2) `mode="wait"` wrapping 4 step transitions, (3) insertingBookId animation, (4) insertSuccess flash. Total 6 motion.div children simplified.
- CounterLoanView.tsx: Removed `AnimatePresence mode="wait"` wrapping 6 step transitions. All 6 motion.div children changed from x-slide to y-fade pattern.
- CounterReturnView.tsx: Removed `AnimatePresence mode="wait"` wrapping 4 step transitions. All 4 motion.div children changed from x-slide to y-fade pattern.
- BookSearchView.tsx: Removed 2 AnimatePresence usages: (1) search results list (staggered items) → kept delay but removed wrapper, (2) selectedBook shelf map panel → conditional + motion.div fade-in replacing height animation.
- No unused variant definitions or direction state variables found in any file
- All business logic, event handlers, API calls, and non-animation functionality preserved unchanged

Stage Summary:
- 6 files modified: CardIssuanceView, KioskLoanView, KioskReturnView, CounterLoanView, CounterReturnView, BookSearchView
- All AnimatePresence removed from project view components (shadcn ui component wrappers in drawer.tsx/resizable.tsx untouched)
- Step transitions now use simple key-based motion.div fade-in ({ opacity: 0→1, y: 12→0 }, 0.25s) without exit animations
- Eliminates blank screen issue caused by AnimatePresence mode="wait" waiting for exit before mounting new content
- Lint passes with 0 errors, 0 warnings
- Dev server compiles successfully with all routes returning 200

---
Task ID: 3
Agent: Main Orchestrator
Task: Integration testing, bug fixes, and browser verification

Work Log:
- Discovered AnimatePresence mode="wait" causing blank screens during step transitions (RegistrationView)
- Fixed RegistrationView: replaced AnimatePresence slide variants with simple fade-in animation
- Fixed OnboardingView: same pattern
- Dispatched sub-agent (3-fix) to fix remaining 6 components (CardIssuanceView, KioskLoanView, KioskReturnView, CounterLoanView, CounterReturnView, BookSearchView)
- Added "시뮬레이션 종료하기" exit link to KioskLoanView and KioskReturnView bottom nav
- Removed unused Checkbox import and StepDirection type from RegistrationView
- Browser verification with agent-browser:
  - Onboarding: 5-step flow works correctly with fade transitions
  - Home: Shows personalized greeting, user profile card, 7 scenario cards with difficulty badges
  - Registration: Full 7-step flow verified (name→birth date→phone→address→terms scroll→ID scan→completion with confetti)
  - Book Search: Search API returns results, voice search button present, shelf map visualization
  - Kiosk Loan: Dark kiosk frame, timeout bar, QR scan, book selection with barcode scan, receipt
  - Settings: Font size 3 levels, high contrast toggle, TTS toggle, kiosk timeout selector
  - High contrast mode: Verified black background with yellow text
- Lint: 0 errors
- Dev server: Compiles successfully, all API routes return 200

Stage Summary:
- Critical AnimatePresence bug fixed across all 8 view components
- All P0 features verified working through browser automation
- Kiosk exit mechanism added
- Application is fully functional for M1 prototype delivery---
Task ID: 4
Agent: Main Orchestrator
Task: 무인키오스크 PIN 인증 시스템 도입

Work Log:
- Prisma 스키마에 SimUser 모델에 pin 필드 추가 (String?, @unique)
- db push로 스키마 적용, Prisma Client 재생성
- Zustand Store SimUser 인터페이스에 pin 필드 추가
- /api/users POST: PIN 4자리 필수 검증, 중복 PIN 체크, 저장
- /api/users/[id]/card POST: PIN 설정 지원 (기존 유저가 PIN 없을 때)
- /api/users/[id]/pin POST: PIN 설정(set) 및 검증(verify) 엔드포인트 신규 생성
- /api/loans POST: kiosk method 시 PIN 필수 검증 로직 추가
- RegistrationView 전면 수정: 8스텝으로 변경, 스텝 5에 PIN 설정 단계 추가
  - 숫자 패드 UI (1-9, 0, 삭제), PIN 입력 4칸 + 확인 4칸 디스플레이
  - 자동 전환 (입력 완료→확인), 일치/불일치 실시간 피드백
  - 단순 PIN 거부 (0000, 1111, 1234, 4321, 0123)
- CardIssuanceView 수정: PIN 미설정 유저에게 set-pin 페이즈 추가
  - 숫자 패드, 2단계 (입력→확인), 완료 후 카드 타입 선택으로 이동
- KioskLoanView 전면 개편: 새로운 키오스크 대여 플로우
  - 기존: 시작→도서증 QR스캔→책 바코드 개별 스캔→확인→완료 (5스텝)
  - 신규: 시작→책 5권 자동 스캔(체크박스 선택→자동스캔 버튼)→도서증 바코드 스캔→비밀번호 4자리 입력→확인→완료 (6스텝)
  - 스텝 진행 표시 바 추가 (시각적 단계 인디케이터)
  - PIN 입력 시 숫자 패드, ● 마스킹 디스플레이
  - PIN 검증 실패 시 에러 표시 후 재입력 유도
- 시나리오 stepsJson 업데이트: 회원가입에 PIN 설정 스텝, 키오스크 대여에 책 선택/비밀번호 스텝 추가

Stage Summary:
- 8개 파일 수정: schema.prisma, useAppStore.ts, users/route.ts, users/[id]/card/route.ts, users/[id]/pin/route.ts(신규), loans/route.ts, RegistrationView.tsx, CardIssuanceView.tsx, KioskLoanView.tsx, constants.ts
- 4자리 PIN이 회원가입 또는 도서증 발급 시 필수 설정
- 무인키오스크 대여 시: 책 자동 스캔→바코드 스캔→PIN 입력→대출
- Lint 0 에러, 브라우저에서 PIN 입력 단계 및 API 동작 확인
