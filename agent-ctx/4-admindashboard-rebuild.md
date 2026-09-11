# Task 4 - AdminDashboard Rebuild

## Task
Completely rebuild AdminDashboard component at `/home/z/my-project/src/components/admin/AdminDashboard.tsx`

## Work Completed

### Replaced basic CMS editor with full admin dashboard:

1. **Sidebar Navigation** (collapsible on mobile):
   - 7 nav items with Korean labels and Lucide icons:
     - 대시보드 개요 (overview) - LayoutDashboard
     - 콘텐츠 관리 (content) - Palette
     - 도서 관리 (books) - BookOpen
     - 이용자 관리 (users) - Users
     - 분석 대시보드 (analytics) - BarChart3
     - 시스템 설정 (settings) - Settings
     - 감사 로그 (audit) - FileText
   - Desktop: Fixed aside at 240px width (hidden on mobile, shown on lg+)
   - Mobile: Sheet drawer (left side) triggered by hamburger menu

2. **Top Header Bar**:
   - Hamburger menu button (mobile only, lg:hidden)
   - Dashboard title based on activeSection
   - Right side actions:
     - Notification bell with unread count badge (destructive Badge, 9+ overflow)
     - Dropdown. - DropdownMenu with notification list, scroll area, "모두 읽음" button
     - Admin user name + role badge (hidden on very small screens)
     - Logout button (LogOut icon)
     - "키오스크로 돌아가기" button (outline, mobile only as sidebar has it on desktop)

3. **Main Content Area**:
   - AnimatePresence + motion.div for smooth page transitions
   - Section content rendered based on activeSection
   - All 7 section components imported and used

### Technical Details:
- Uses `useAdminStore` for: isAuthenticated, adminUser, activeSection, setActiveSection, sidebarOpen/setSidebarOpen, logout, notifications, unreadCount, markAllAsRead, markAsRead
- Uses `useAppStore` for: setAdminMode
- shadcn/ui components used: Sheet, SheetContent, SheetTitle, Button, Badge, Separator, ScrollArea, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
- Lucide icons: LayoutDashboard, Palette, BookOpen, Users, BarChart3, Settings, FileText, Menu, Bell, LogOut, Monitor, CheckCheck
- framer-motion for page transitions (opacity + y-axis slide)
- Korean labels throughout
- Responsive: sidebar is Sheet on mobile, fixed aside on desktop (lg breakpoint)
- Sidebar width: 240px
- Clean, professional design with active state highlighting
- Lint passes with 0 errors
