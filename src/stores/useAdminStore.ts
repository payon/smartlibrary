/**
 * 관리자 대시보드 전역 상태 관리 스토어 (Zustand)
 *
 * [역할]
 * - 관리자 인증 상태 관리
 * - 대시보드 섹션 전환
 * - 사이드바 열림/닫힘
 * - 알림 관리
 * - 권한 확인
 */

import { create } from 'zustand';
import { ROLE_PERMISSIONS } from '@/lib/permissions';

// ============================================================================
// 타입 정의
// ============================================================================

export type AdminSection = 'overview' | 'content' | 'books' | 'cards' | 'users' | 'analytics' | 'pwa' | 'settings' | 'audit';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string; // super_admin | admin | operator
}

export interface AdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================================
// 스토어 인터페이스
// ============================================================================

interface AdminState {
  // 인증
  isAuthenticated: boolean;
  adminUser: AdminUser | null;
  setAdminUser: (user: AdminUser | null) => void;
  logout: () => void;

  // UI
  activeSection: AdminSection;
  setActiveSection: (section: AdminSection) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // 알림
  notifications: AdminNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AdminNotification, 'id' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;

  // 권한
  hasPermission: (permission: string) => boolean;

  // 로딩
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

// ============================================================================
// Zustand 스토어 생성
// ============================================================================

export const useAdminStore = create<AdminState>((set, get) => ({
  // 인증
  isAuthenticated: false,
  adminUser: null,
  setAdminUser: (user) => set({
    adminUser: user,
    isAuthenticated: !!user,
  }),
  logout: () => {
    set({
      adminUser: null,
      isAuthenticated: false,
      activeSection: 'overview',
    });
  },

  // UI
  activeSection: 'overview',
  setActiveSection: (section) => set({ activeSection: section, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // 알림
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    const newNotification: AdminNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const notifications = [newNotification, ...state.notifications].slice(0, 50);
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      return { notifications, unreadCount };
    });
  },
  markAsRead: (id) => set((state) => {
    const notifications = state.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
  }),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    unreadCount: 0,
  })),
  removeNotification: (id) => set((state) => {
    const notifications = state.notifications.filter((n) => n.id !== id);
    return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
  }),

  // 권한
  hasPermission: (permission) => {
    const { adminUser } = get();
    if (!adminUser) return false;
    const permissions = ROLE_PERMISSIONS[adminUser.role] || [];
    // super_admin은 모든 권한 보유
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  },

  // 로딩
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
