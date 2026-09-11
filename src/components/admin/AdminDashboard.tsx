/**
 * 관리자 대시보드 컴포넌트
 *
 * [기능]
 * - 사이드바 네비게이션 (데스크톱: 고정, 모바일: Sheet 드로어)
 * - 상단 헤더 바 (햄버거 메뉴, 제목, 알림, 사용자 정보, 로그아웃)
 * - 메인 콘텐츠 영역 (7개 섹션 전환, framer-motion 페이지 전환)
 * - 한국어 라벨 전면 적용
 *
 * [참고]
 * - useAdminStore: 인증, 섹션 전환, 사이드바, 알림, 권한
 * - useAppStore: 관리자 모드 토글
 * - 7개 섹션 컴포넌트는 sections/ 폴더에 위치
 */

'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Palette,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  FileText,
  Menu,
  Bell,
  LogOut,
  Monitor,
  CheckCheck,
  X,
} from 'lucide-react';

// --- Stores ---
import { useAdminStore, type AdminSection } from '@/stores/useAdminStore';
import { useAppStore } from '@/stores/useAppStore';

// --- Section Components ---
import OverviewSection from '@/components/admin/sections/OverviewSection';
import ContentSection from '@/components/admin/sections/ContentSection';
import BooksSection from '@/components/admin/sections/BooksSection';
import UsersSection from '@/components/admin/sections/UsersSection';
import AnalyticsSection from '@/components/admin/sections/AnalyticsSection';
import SettingsSection from '@/components/admin/sections/SettingsSection';
import AuditSection from '@/components/admin/sections/AuditSection';

// --- UI Components ---
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// 사이드바 네비게이션 항목 정의
// ============================================================================

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '대시보드 개요', icon: LayoutDashboard },
  { id: 'content', label: '콘텐츠 관리', icon: Palette },
  { id: 'books', label: '도서 관리', icon: BookOpen },
  { id: 'users', label: '이용자 관리', icon: Users },
  { id: 'analytics', label: '분석 대시보드', icon: BarChart3 },
  { id: 'settings', label: '시스템 설정', icon: Settings },
  { id: 'audit', label: '감사 로그', icon: FileText },
];

// ============================================================================
// 섹션 제목 매핑
// ============================================================================

const SECTION_TITLES: Record<AdminSection, string> = {
  overview: '대시보드 개요',
  content: '콘텐츠 관리',
  books: '도서 관리',
  users: '이용자 관리',
  analytics: '분석 대시보드',
  settings: '시스템 설정',
  audit: '감사 로그',
};

// ============================================================================
// 역할 표시명 매핑
// ============================================================================

const ROLE_LABELS: Record<string, string> = {
  super_admin: '최고관리자',
  admin: '관리자',
  operator: '운영자',
};

// ============================================================================
// 페이지 전환 애니메이션 설정
// ============================================================================

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.2,
  ease: 'easeOut',
};

// ============================================================================
// 섹션 렌더러
// ============================================================================

function SectionContent({ section }: { section: AdminSection }) {
  switch (section) {
    case 'overview':
      return <OverviewSection />;
    case 'content':
      return <ContentSection />;
    case 'books':
      return <BooksSection />;
    case 'users':
      return <UsersSection />;
    case 'analytics':
      return <AnalyticsSection />;
    case 'settings':
      return <SettingsSection />;
    case 'audit':
      return <AuditSection />;
    default:
      return <OverviewSection />;
  }
}

// ============================================================================
// 사이드바 네비게이션 리스트 (공통 컴포넌트)
// ============================================================================

function SidebarNav({
  activeSection,
  onNavigate,
}: {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`
              group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
              transition-all duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-ring
              ${
                isActive
                  ? 'bg-primary/10 text-primary shadow-xs'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={`size-5 shrink-0 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground group-hover:text-accent-foreground'
              }`}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function AdminDashboard() {
  // --- Store ---
  const {
    isAuthenticated,
    adminUser,
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
    logout,
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
  } = useAdminStore();

  const { setAdminMode } = useAppStore();

  // --- 파생 상태 ---
  const sectionTitle = SECTION_TITLES[activeSection];

  const roleLabel = useMemo(() => {
    if (!adminUser) return '';
    return ROLE_LABELS[adminUser.role] || adminUser.role;
  }, [adminUser]);

  // --- 핸들러 ---
  const handleNavigate = (section: AdminSection) => {
    setActiveSection(section);
  };

  const handleLogout = () => {
    logout();
  };

  const handleBackToKiosk = () => {
    setAdminMode(false);
  };

  // 미인증 시 렌더링하지 않음 (AdminLogin이 page.tsx에서 분기 처리)
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ================================================================
          데스크톡 사이드바 (lg 이상에서만 표시)
          ================================================================ */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:border-r bg-card">
        {/* 사이드바 헤더 */}
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <Monitor className="size-5 text-primary shrink-0" />
          <span className="text-base font-bold truncate">관리자 대시보드</span>
        </div>

        {/* 네비게이션 */}
        <ScrollArea className="flex-1 py-4">
          <SidebarNav
            activeSection={activeSection}
            onNavigate={handleNavigate}
          />
        </ScrollArea>

        {/* 사이드바 푸터 */}
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleBackToKiosk}
          >
            <Monitor className="size-4" />
            키오스크로 돌아가기
          </Button>
        </div>
      </aside>

      {/* ================================================================
          모바일 사이드바 (Sheet 드로어, lg 미만에서만 표시)
          ================================================================ */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[240px] p-0">
          <SheetTitle className="sr-only">관리자 메뉴</SheetTitle>

          {/* 드로어 헤더 */}
          <div className="flex h-16 items-center gap-2 px-6 border-b">
            <Monitor className="size-5 text-primary shrink-0" />
            <span className="text-base font-bold truncate">관리자 대시보드</span>
          </div>

          {/* 네비게이션 */}
          <ScrollArea className="flex-1 py-4">
            <SidebarNav
              activeSection={activeSection}
              onNavigate={handleNavigate}
            />
          </ScrollArea>

          {/* 드로어 푸터 */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                handleBackToKiosk();
                setSidebarOpen(false);
              }}
            >
              <Monitor className="size-4" />
              키오스크로 돌아가기
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          메인 영역 (헤더 + 콘텐츠)
          ================================================================ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* --- 상단 헤더 바 --- */}
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
          {/* 모바일 햄버거 메뉴 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu className="size-5" />
          </Button>

          {/* 대시보드 제목 */}
          <h1 className="text-lg font-semibold truncate">{sectionTitle}</h1>

          {/* 스페이서 */}
          <div className="flex-1" />

          {/* 우측 액션 영역 */}
          <div className="flex items-center gap-2">
            {/* 알림 벨 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={`알림: 읽지 않은 ${unreadCount}건`}
                >
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] leading-none"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-semibold">알림</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs text-muted-foreground"
                      onClick={markAllAsRead}
                    >
                      <CheckCheck className="size-3 mr-1" />
                      모두 읽음
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    알림이 없습니다
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    {notifications.slice(0, 10).map((notif) => (
                      <DropdownMenuItem
                        key={notif.id}
                        className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                        }}
                      >
                        {/* 읽음/안읽음 표시 */}
                        <div className="mt-1.5 shrink-0">
                          {notif.isRead ? (
                            <div className="size-2 rounded-full bg-muted-foreground/30" />
                          ) : (
                            <div className="size-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              notif.isRead
                                ? 'text-muted-foreground'
                                : 'font-medium text-foreground'
                            }`}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {notif.message}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6" />

            {/* 관리자 사용자 정보 */}
            {adminUser && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {adminUser.name}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {roleLabel}
                </Badge>
              </div>
            )}

            {/* 로그아웃 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut className="size-4" />
            </Button>

            {/* 키오스크로 돌아가기 버튼 (데스크톡에서는 사이드바에 있으므로 모바일만) */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={handleBackToKiosk}
            >
              <Monitor className="size-4" />
              <span className="hidden sm:inline">키오스크로</span>
            </Button>
          </div>
        </header>

        {/* --- 메인 콘텐츠 영역 --- */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={pageTransition}
              className="h-full"
            >
              <SectionContent section={activeSection} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
