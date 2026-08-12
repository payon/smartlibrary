# Work Log

---
Task ID: 1
Agent: Main
Task: Fix hydration mismatch - screen not appearing

Work Log:
- Identified root cause: server-side rendering old components (TopBar, HomeView) that no longer exist in page.tsx
- .next cache contained stale compiled code from previous library app
- PwaStatus component and service worker were also causing hydration issues
- Fixed by creating KioskApp.tsx container and using `dynamic(() => import(...), { ssr: false })` in page.tsx
- This completely eliminates server-side rendering of kiosk components, preventing all hydration mismatches
- Removed PwaStatus from KioskApp (PWA SW was intercepting API calls and returning offline errors)
- Disabled service worker (renamed sw.js to sw.js.disabled) to prevent cached SW from blocking API requests
- Removed `| tee dev.log` from dev script (pipe was causing server instability)
- Changed KioskLoanConfirm to send all books in single API call (bookIds array) instead of per-book loop
- Disabled Prisma query logging to reduce memory usage
- Fixed CSP in next.config.ts (removed Unsplash from img-src since it was in security.ts only)

Stage Summary:
- Hydration mismatch: FIXED (dynamic ssr:false)
- Service worker intercepting APIs: FIXED (disabled SW)
- Loan API per-book calls: FIXED (batch with bookIds)
- Server stability: improved (removed tee pipe, disabled prisma logging)
- All 11 kiosk screens verified working via accessibility tree snapshots
- Full loan flow verified: idle → menu → auth-scan → PIN → book-select → confirm → complete
- Known limitation: agent-browser Chrome + Next.js dev server exceed sandbox memory limits (4GB RAM, 64MB /dev/shm)
