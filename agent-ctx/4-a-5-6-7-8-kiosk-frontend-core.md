# Task ID: 4-a, 5, 6, 7, 8 - Kiosk Frontend Core + Backend APIs + Database Seed

## Agent: Main Developer

## Work Log

### 1. Read and analyzed existing files
- Read worklog.md for context on previous work
- Analyzed existing constants.ts, useAppStore.ts, page.tsx, layout.tsx, globals.css
- Reviewed all existing API routes (seed, books, loans, loans/[id]/return, users)
- Reviewed prisma/schema.prisma (no modifications needed)
- Reviewed security.ts patterns
- Identified framer-motion import path (installed as 'framer-motion', not 'motion/react')

### 2. Updated `src/lib/constants.ts`
- Added `coverUrl` field to all 15 SEED_BOOKS entries using Unsplash book/library images
- Added `KIOSK_VIEWS` type and constants for all 11 kiosk screens
- Added `KioskViewName` type union: 'idle' | 'main-menu' | 'auth-scan' | 'auth-pin' | 'loan-select' | 'loan-confirm' | 'loan-complete' | 'return-insert' | 'return-scanning' | 'return-confirm' | 'return-complete'
- Added `KioskMode` type: 'loan' | 'return' | null
- Added `BOOK_CATEGORIES` constant array
- Kept MAX_LOAN_COUNT=10, LOAN_PERIOD_DAYS=15, OVERDUE_BLOCK_MULTIPLIER=1

### 3. Rewrote `src/stores/useAppStore.ts`
- Replaced old senior-friendly app store with kiosk-focused store
- Interface: screen, kioskMode, authenticatedUser, selectedBooks, returnedBooks, sensorActive
- Screen history management for prevScreen navigation
- PREV_SCREEN_MAP for predefined back navigation
- Book add/remove/clear actions for both loan and return flows

### 4. Updated `src/app/globals.css`
- Changed primary color from blue (#2563EB) to navy (#1e3a5f)
- Removed high-contrast variant and font-large/font-xlarge classes
- Added kiosk-frame styles (navy gradient, max-width 480px)
- Added .kiosk-screen, .kiosk-btn, .kiosk-dark-bg, .kiosk-light-bg classes
- Added .kiosk-scroll custom scrollbar and .no-scrollbar utility
- Added animations: sensorPulse, slideInLeft, slideInRight, fadeIn, scanRFID, scanPulse, successCheck, touchPulse, insertBounce, cardScanRing

### 5. Created 11 kiosk screen components in `src/components/kiosk/`

#### KioskIdleScreen.tsx
- Full-screen navy background with SMART LIBRARY branding
- Auto-rotating info slides (3 slides, 5s interval, AnimatePresence)
- Touch/click → main-menu, sensor simulation after 10s

#### KioskMainMenu.tsx
- Two large service buttons (도서 대출, 도서 반납)
- Real-time clock display
- 처음으로 button

#### KioskAuthScan.tsx
- RFID card scan simulation (2s auto-advance)
- Scanning ring animation, success message
- '회원증 없이 이용하기' demo skip option

#### KioskAuthPin.tsx
- 4-digit numeric keypad (1-9, 0, del)
- PIN dot indicators with animation
- Auto-confirm on 4th digit, API lookup with demo fallback

#### KioskLoanSelect.tsx
- Search bar + category filter tabs (전체, 소설, 인문, 과학, 역사, 시)
- 2-column book grid with cover images
- Selected book chips, max 10 limit enforcement

#### KioskLoanConfirm.tsx
- User info card, selected books list with due dates
- Loan API call (kiosk method), loading state

#### KioskLoanComplete.tsx
- Success checkmark animation
- Stats dashboard (대출 가능, 대출 중, 연체)
- Active loans list with return dates

#### KioskReturnInsert.tsx
- Book insertion guide with bounce animation
- 2s auto-detect simulation

#### KioskReturnScanning.tsx
- RFID pulse ring animations
- Scanning → complete state transition
- Detected books list, '더 넣기' and '반납 완료하기' buttons

#### KioskReturnConfirm.tsx
- Returned books list with 정상 반납 status
- Processing animation

#### KioskReturnComplete.tsx
- Success animation, returned books summary

### 6. Rewrote `src/app/page.tsx`
- Simple kiosk container with screen router
- AnimatePresence for fade transitions between screens
- Seed data initialization on mount
- PwaStatus component retained

### 7. Updated `src/app/layout.tsx`
- Changed theme color to #0f172a (navy)
- Changed colorScheme to 'dark'
- Updated metadata title/description for kiosk
- Set body background to #0f172a, overflow hidden
- Removed min-h-screen flex flex-col, added h-screen w-screen

### 8. Updated API routes

#### `src/app/api/seed/route.ts`
- Added demo user creation (김도서관, PIN 1234, phone 010-1234-5678)
- Returns demoUser info in response

#### `src/app/api/books/route.ts`
- Added ?search= and ?category= query param support
- Changed from 'query' to 'search' param name
- Combined search + category filters

#### `src/app/api/users/route.ts`
- Added GET handler for PIN-based user lookup (/?pin=xxxx)
- Rate limiting on PIN lookups
- Returns user array (empty if not found), PIN excluded from response

#### `src/app/api/loans/route.ts`
- Added support for 'demo-user' ID (bypasses user/penalty checks)
- Added bookIds array support for batch loans
- Maintained all security patterns (rate limiting, validation, overdue checks)

#### `src/lib/security.ts`
- Updated CSP img-src to allow images.unsplash.com for book covers

### 9. Verification
- `bun run db:push` - Schema already in sync
- `bun run lint` - All lint errors resolved (0 problems)
- Dev server compiles successfully (HTTP 200 on /)
- Fixed framer-motion import path issue (motion/react → framer-motion)

## Stage Summary
- Complete kiosk UI with 11 screens covering full loan/return flow
- Navy blue theme matching ECO kiosk design
- Portrait mode (480px max-width) with large touch targets (56px+ min height)
- All text in Korean, all comments in Korean
- Demo user (김도서관, PIN 1234) auto-created on seed
- API routes updated for kiosk requirements with security patterns maintained
