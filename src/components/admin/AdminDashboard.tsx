/**
 * 관리자 대시보드 컴포넌트
 *
 * [기능]
 * - 사이드바 네비게이션 (데스크톱: 고정, 모바일: Sheet 드로어)
 * - 상단 헤더 바 (햄버거 메뉴, 제목, 알림, 사용자 정보, 로그아웃)
 * - 메인 콘텐츠 영역 (8개 섹션 전환, framer-motion 페이지 전환)
 * - 한국어 라벨 전면 적용
 *
 * [디자인]
 * - 키오스크 스타일 다크 네이비 사이드바
 * - 스카이블루 액센트 컬러
 * - 글래스모피즘 헤더
 * - 키오스크 브랜딩 요소
 *
 * [참고]
 * - useAdminStore: 인증, 섹션 전환, 사이드바, 알림, 권한
 * - useAppStore: 관리자 모드 토글
 * - 8개 섹션 컴포넌트는 sections/ 폴더에 위치
 */

'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Palette,
  BookOpen,
  CreditCard,
  Users,
  BarChart3,
  Smartphone,
  Settings,
  FileText,
  Menu,
  Bell,
  LogOut,
  User,
  CheckCheck,
  Library,
  ArrowLeft,
  Monitor,
  PictureInPicture2,
} from 'lucide-react';

// --- Stores ---
import { useAdminStore, type AdminSection } from '@/stores/useAdminStore';
import { useAppStore } from '@/stores/useAppStore';

// --- Section Components ---
import OverviewSection from '@/components/admin/sections/OverviewSection';
import ContentSection from '@/components/admin/sections/ContentSection';
import BooksSection from '@/components/admin/sections/BooksSection';
import CardsSection from '@/components/admin/sections/CardsSection';
import UsersSection from '@/components/admin/sections/UsersSection';
import AnalyticsSection from '@/components/admin/sections/AnalyticsSection';
import PwaIconSection from '@/components/admin/sections/PwaIconSection';
import SettingsSection from '@/components/admin/sections/SettingsSection';
import AuditSection from '@/components/admin/sections/AuditSection';

// --- Kiosk Preview ---
import KioskPreview from '@/components/admin/KioskPreview';
import ProfileDialog from '@/components/admin/ProfileDialog';

// --- UI Components ---
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
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
  { id: 'cards', label: '도서카드 발급', icon: CreditCard },
  { id: 'users', label: '이용자 관리', icon: Users },
  { id: 'analytics', label: '분석 대시보드', icon: BarChart3 },
  { id: 'pwa', label: 'PWA 아이콘', icon: Smartphone },
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
  cards: '도서카드 발급',
  users: '이용자 관리',
  analytics: '분석 대시보드',
  pwa: 'PWA 아이콘',
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
    case 'cards':
      return <CardsSection />;
    case 'users':
      return <UsersSection />;
    case 'analytics':
      return <AnalyticsSection />;
    case 'pwa':
      return <PwaIconSection />;
    case 'settings':
      return <SettingsSection />;
    case 'audit':
      return <AuditSection />;
    default:
      return <OverviewSection />;
  }
}

// ============================================================================
// 사이드바 브랜딩 헤더 컴포넌트
// ============================================================================

function SidebarBranding() {
  return (
    <div className="flex flex-col items-center gap-2 py-5 px-4">
      {/* 라이브러리 아이콘 - 글로우 */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
            transform: 'scale(2)',
          }}
        />
        <div className="relative w-10 h-10 rounded-xl flex items-center justify-center border border-sky-400/20"
          style={{ backgroundColor: 'rgba(14,165,233,0.1)' }}
        >
          <Library className="w-5 h-5 text-sky-400" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-sm font-bold tracking-widest text-white">
          SMART LIBRARY
        </h2>
        <p className="text-[10px] text-slate-500 mt-0.5 tracking-wider">관리자</p>
      </div>
    </div>
  );
}

// ============================================================================
// 사이드바 네비게이션 리스트 (키오스크 스타일)
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
              group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
              transition-all duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-sky-400/50
              ${
                isActive
                  ? 'text-sky-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
            style={isActive ? {
              backgroundColor: 'rgba(56,189,248,0.08)',
              borderLeft: '3px solid #38bdf8',
              paddingLeft: '9px', // 12px - 3px border
            } : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={`size-5 shrink-0 ${
                isActive
                  ? 'text-sky-400'
                  : 'text-slate-500 group-hover:text-slate-300'
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
// 키오스크로 돌아가기 버튼 (키오스크 스타일)
// ============================================================================

function KioskBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium
        text-slate-400 hover:text-teal-400 border border-white/[0.06] hover:border-teal-400/30
        transition-all duration-150 hover:bg-teal-400/[0.06]"
    >
      <ArrowLeft className="size-4" />
      <span>키오스크로 돌아가기</span>
    </button>
  );
}

// ============================================================================
// 사이드바 공통 콘텐츠 (데스크톱/모바일 공통)
// ============================================================================

function SidebarContent({
  activeSection,
  onNavigate,
  onBackToKiosk,
}: {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onBackToKiosk: () => void;
}) {
  return (
    <>
      {/* 브랜딩 */}
      <SidebarBranding />

      {/* 구분선 */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* 네비게이션 */}
      <ScrollArea className="flex-1 py-4">
        <SidebarNav
          activeSection={activeSection}
          onNavigate={onNavigate}
        />
      </ScrollArea>

      {/* 사이드바 푸터 */}
      <div className="p-4 border-t border-white/[0.06]">
        <KioskBackButton onClick={onBackToKiosk} />
      </div>
    </>
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

  // --- 키오스크 프리뷰 상태 ---
  const [showKioskPreview, setShowKioskPreview] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // 서버 로그아웃 실패 시에도 클라이언트 상태는 초기화
    }
    logout();
  };

  const handleBackToKiosk = () => {
    setAdminMode(false);
  };

  // 미인증 시 렌더링하지 않음 (AdminLogin이 page.tsx에서 분기 처리)
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0b1120' }}>
      {/* ================================================================
          데스크톱 사이드바 (lg 이상에서만 표시)
          ================================================================ */}
      <aside
        className="hidden lg:flex lg:w-[240px] lg:flex-col lg:border-r border-white/[0.06]"
        style={{
          background: 'linear-gradient(180deg, #0f1729 0%, #0b1120 100%)',
        }}
      >
        <SidebarContent
          activeSection={activeSection}
          onNavigate={handleNavigate}
          onBackToKiosk={handleBackToKiosk}
        />
      </aside>

      {/* ================================================================
          모바일 사이드바 (Sheet 드로어, lg 미만에서만 표시)
          ================================================================ */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[240px] p-0 border-white/[0.06]"
          style={{
            background: 'linear-gradient(180deg, #0f1729 0%, #0b1120 100%)',
          }}
        >
          <SheetTitle className="sr-only">관리자 메뉴</SheetTitle>
          <div className="flex flex-col h-full">
            <SidebarContent
              activeSection={activeSection}
              onNavigate={(section) => {
                handleNavigate(section);
                setSidebarOpen(false);
              }}
              onBackToKiosk={() => {
                handleBackToKiosk();
                setSidebarOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          메인 영역 (헤더 + 콘텐츠)
          ================================================================ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* --- 상단 헤더 바 --- */}
        <header
          className="flex h-16 items-center gap-4 border-b border-white/[0.06] px-4 lg:px-6"
          style={{
            background: 'linear-gradient(90deg, rgba(15,23,41,0.95) 0%, rgba(15,23,41,0.85) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* 모바일 햄버거 메뉴 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-400 hover:text-white hover:bg-white/[0.06]"
            onClick={() => setSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu className="size-5" />
          </Button>

          {/* 온라인 상태 표시 점 + 대시보드 제목 */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <div className="size-2.5 rounded-full bg-emerald-400" />
              <div className="absolute size-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
            </div>
            <h1 className="text-lg font-semibold text-white tracking-wide truncate">{sectionTitle}</h1>
          </div>

          {/* 스페이서 */}
          <div className="flex-1" />

          {/* 우측 액션 영역 */}
          <div className="flex items-center gap-2">
            {/* 키오스크 프리뷰 토글 */}
            <Button
              variant="ghost"
              size="icon"
              className={`relative transition-all duration-200 ${showKioskPreview ? 'text-sky-400 bg-sky-400/10 hover:bg-sky-400/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}
              onClick={() => setShowKioskPreview(!showKioskPreview)}
              aria-label="키오스크 프리뷰"
              title="키오스크 프리뷰"
            >
              <PictureInPicture2 className="size-4" />
            </Button>
            {/* 알림 벨 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  aria-label={`알림: 읽지 않은 ${unreadCount}건`}
                >
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] leading-none font-bold rounded-full text-white"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80" style={{ backgroundColor: '#0f1729', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-semibold text-white">알림</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs text-slate-400 hover:text-sky-400"
                      onClick={markAllAsRead}
                    >
                      <CheckCheck className="size-3 mr-1" />
                      모두 읽음
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">
                    알림이 없습니다
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    {notifications.slice(0, 10).map((notif) => (
                      <DropdownMenuItem
                        key={notif.id}
                        className="flex items-start gap-3 px-3 py-2.5 cursor-pointer text-slate-300 hover:bg-white/[0.04] focus:bg-white/[0.04]"
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                        }}
                      >
                        {/* 읽음/안읽음 표시 */}
                        <div className="mt-1.5 shrink-0">
                          {notif.isRead ? (
                            <div className="size-2 rounded-full bg-slate-600" />
                          ) : (
                            <div className="size-2 rounded-full bg-sky-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              notif.isRead
                                ? 'text-slate-500'
                                : 'font-medium text-white'
                            }`}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {notif.message}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6 bg-white/[0.08]" />

            {/* 관리자 사용자 정보 */}
            {adminUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.06] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 cursor-pointer">
                    <span className="text-sm font-medium text-slate-300 truncate max-w-[120px]">
                      {adminUser.name}
                    </span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full tracking-wider"
                      style={{
                        backgroundColor: 'rgba(56,189,248,0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56,189,248,0.2)',
                      }}
                    >
                      {roleLabel}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" style={{ backgroundColor: '#0f1729', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <DropdownMenuItem
                    className="cursor-pointer text-slate-300 hover:bg-white/[0.04] focus:bg-white/[0.04]"
                    onClick={() => setProfileOpen(true)}
                  >
                    <User className="size-4 mr-2" />
                    내 프로필
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem
                    className="cursor-pointer text-slate-300 hover:bg-white/[0.04] focus:bg-white/[0.04]"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4 mr-2" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

            {/* 로그아웃 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-white/[0.06]"
              onClick={handleLogout}
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut className="size-4" />
            </Button>

            {/* 키오스크로 돌아가기 버튼 (모바일만) */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-slate-400 hover:text-teal-400 hover:bg-teal-400/[0.06]"
              onClick={handleBackToKiosk}
            >
              <Monitor className="size-4" />
              <span className="hidden sm:inline">키오스크로</span>
            </Button>
          </div>
        </header>

        {/* --- 메인 콘텐츠 영역 --- */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: '#0f1729' }}
        >
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

      {/* ================================================================
          키오스크 프리뷰 플로팅 패널
          ================================================================ */}
      {showKioskPreview && (
        <KioskPreview onClose={() => setShowKioskPreview(false)} />
      )}

      {/* ================================================================
          키오스크 프리뷰 플로팅 토글 버튼 (프리뷰가 닫혀있을 때만 표시)
          ================================================================ */}
      {!showKioskPreview && (
        <button
          onClick={() => setShowKioskPreview(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #0f2744, #1e3a5f)',
            border: '1px solid rgba(56,189,248,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 12px rgba(56,189,248,0.1)',
          }}
          aria-label="키오스크 프리뷰 열기"
          title="키오스크 프리뷰"
        >
          <Monitor className="w-5 h-5 text-sky-400" />
        </button>
      )}
    </div>
  );
}
