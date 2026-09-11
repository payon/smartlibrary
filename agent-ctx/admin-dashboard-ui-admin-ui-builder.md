# Admin Dashboard UI Implementation

## Task ID: admin-dashboard-ui
## Agent: admin-ui-builder

## Summary
Complete Admin Dashboard UI for the Smart Library Kiosk Simulator has been implemented. The admin dashboard is rendered within the same `/` route, toggled by `adminMode` state in the Zustand store.

## Files Created

### 1. `/src/stores/useAdminStore.ts`
Admin Zustand store with:
- Auth state (isAuthenticated, adminUser, logout)
- UI state (activeSection, sidebarOpen, toggleSidebar)
- Notifications (add, markAsRead, markAllAsRead, remove)
- Permission checking (hasPermission with role-based mapping)
- Loading state

### 2. `/src/components/admin/AdminLogin.tsx`
Login form with:
- Email + Password inputs
- Login API call to `/api/admin/auth/login`
- Error message display
- Test account hint
- Responsive design

### 3. `/src/components/admin/AdminDashboard.tsx`
Main dashboard container with:
- Left sidebar navigation (desktop: fixed, mobile: Sheet/hamburger)
- Top bar with admin name, role badge, notification bell, logout
- Main content area that switches between 7 sections
- Footer with "키오스크로 돌아가기" button
- Session check on mount
- Permission-gated navigation items

### 4. `/src/components/admin/sections/OverviewSection.tsx`
Dashboard overview with:
- 4 KPI cards (총 도서, 활성 대출, 연체, 오늘 대출)
- Recent 7-day loan trend bar visualization
- Popular books TOP 5
- Category distribution
- Quick actions (키오스크 초기화, 유지보수 모드, 데이터 새로고침)
- Fetches from `/api/admin/analytics`

### 5. `/src/components/admin/sections/ContentSection.tsx`
CMS content management with:
- 12 screen tabs (idle, main-menu, auth-scan, auth-pin, etc.)
- Type-aware field rendering (text=Input, color=color picker, image=URL+preview, json=Textarea, number=number input)
- Individual save per item
- Bulk save
- Reset to defaults
- Changed item tracking with visual indicators

### 6. `/src/components/admin/sections/BooksSection.tsx`
Book management with:
- Table with cover, title, author, category, stock, availability columns
- Search and category filter
- Add book dialog with full form
- Edit book dialog
- Delete book confirmation dialog
- Responsive table (columns hidden on mobile)

### 7. `/src/components/admin/sections/UsersSection.tsx`
User management with:
- Tabs: 관리자 계정 | 키오스크 이용자
- Admin users: role dropdown, active toggle, last login
- Create admin user dialog
- Kiosk users: search, active loans count, card number
- Role badges with color coding

### 8. `/src/components/admin/sections/AnalyticsSection.tsx`
Analytics dashboard with:
- Date range tabs (7일/30일/90일)
- Recharts LineChart for daily loan trends
- Recharts PieChart for category distribution
- Recharts BarChart for popular books ranking
- Stats cards (총 도서, 등록 이용자, 활성 대출, 연체)
- Today/week/month summary cards

### 9. `/src/components/admin/sections/SettingsSection.tsx`
System settings with:
- Category-grouped config display
- Boolean configs rendered as Switch
- Number configs rendered as number Input
- Text configs rendered as text Input
- Per-item save buttons
- Change tracking with visual indicators
- Danger zone: DB initialization with confirmation dialog

### 10. `/src/components/admin/sections/AuditSection.tsx`
Audit log viewer with:
- Filter bar: action dropdown, entity dropdown, date range inputs
- Audit log table with timestamp, IP, action badge, entity, details
- Pagination with page info
- Action/entity Korean labels with color-coded badges

### 11. `/src/app/page.tsx` (Updated)
- Integrated admin mode: when `adminMode` is true, shows AdminLogin (if not authenticated) or AdminDashboard (if authenticated)
- Kiosk UI still works when `adminMode` is false
- KioskIdleScreen already has admin mode entry button

## Architecture
- All components are `'use client'`
- Uses shadcn/ui components (Button, Card, Input, Table, Tabs, Dialog, Badge, Select, Textarea, Label, Switch, Skeleton, Sheet, ScrollArea, AlertDialog, Separator, Pagination)
- Uses Lucide icons
- Uses Recharts for analytics charts
- Korean language for all UI text
- Responsive design with Tailwind breakpoints
- Touch-friendly with min 44px touch targets
- Uses fetch() for API calls with relative URLs
- Uses sonner toast for notifications
- Loading states with Skeleton components
- Error handling with toast messages

## API Integration
All API endpoints match existing backend routes:
- `/api/admin/auth/login` (POST)
- `/api/admin/auth/session` (GET)
- `/api/admin/auth/logout` (POST)
- `/api/admin/analytics` (GET)
- `/api/admin/content` (GET/PUT)
- `/api/admin/content/bulk` (POST)
- `/api/admin/content/reset` (POST)
- `/api/admin/books` (GET/POST)
- `/api/admin/books/[id]` (PUT/DELETE)
- `/api/admin/users` (GET/POST)
- `/api/admin/users/[id]` (PUT/DELETE)
- `/api/admin/kiosk-users` (GET)
- `/api/admin/settings` (GET/PUT)
- `/api/admin/audit` (GET)
