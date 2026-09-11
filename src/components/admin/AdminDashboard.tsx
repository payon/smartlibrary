/**
 * 관리자 대시보드 컴포넌트
 *
 * [기능]
 * - CMS 콘텐츠 관리
 * - 관리자 인증 (간이 로그인)
 * - 키오스크로 돌아가기
 *
 * [참고]
 * - 이 컴포넌트는 키오스크 관리자 모드에서 렌더링됩니다.
 * - adminMode가 true일 때 page.tsx에서 조건부 렌더링됩니다.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ArrowLeft, Save, RotateCcw, Eye, LogIn } from 'lucide-react';
import { toast } from 'sonner';

/** 관리자 대시보드 기본 콘텐츠 키 목록 */
const CMS_KEYS = [
  { key: 'idle.title', label: '대기 화면 제목', fallback: 'SMART LIBRARY' },
  { key: 'idle.subtitle', label: '대기 화면 부제목', fallback: '무인 도서대출반납기' },
  { key: 'idle.pulse_text', label: '터치 안내 텍스트', fallback: '화면을 터치하여 시작하세요' },
  { key: 'idle.background_color', label: '대기 화면 배경색', fallback: '#0b1120' },
  { key: 'mainmenu.title', label: '메인 메뉴 제목', fallback: 'SMART LIBRARY' },
  { key: 'mainmenu.loan_button_text', label: '대출 버튼 텍스트', fallback: '도서 대출' },
  { key: 'mainmenu.return_button_text', label: '반납 버튼 텍스트', fallback: '도서 반납' },
  { key: 'authscan.title', label: '인증 화면 제목', fallback: '회원인증' },
  { key: 'authscan.instruction', label: '인증 안내 텍스트', fallback: '회원증을 가져다 대세요' },
  { key: 'authscan.demo_button_text', label: '데모 버튼 텍스트', fallback: '회원증 없이 이용하기' },
  { key: 'authpin.title', label: 'PIN 화면 제목', fallback: '비밀번호 입력' },
  { key: 'loanselect.title', label: '도서 선택 제목', fallback: '도서를 선택해주세요' },
  { key: 'loanconfirm.title', label: '대출 확인 제목', fallback: '대출 정보를 확인해주세요' },
  { key: 'loancomplete.title', label: '대출 완료 제목', fallback: '대출완료' },
  { key: 'returninsert.title', label: '반납 안내 제목', fallback: '도서반납' },
  { key: 'returninsert.instruction', label: '반납 안내 텍스트', fallback: '반납할 도서를 하나씩 넣어주세요' },
  { key: 'returnscanning.title', label: '반납 스캔 제목', fallback: '도서반납' },
  { key: 'returnconfirm.title', label: '반납 확인 제목', fallback: '반납 정보를 확인해주세요' },
  { key: 'returncomplete.title', label: '반납 완료 제목', fallback: '반납완료' },
  { key: 'returncomplete.message', label: '반납 완료 메시지', fallback: '도서가 정상적으로 반납되었습니다.' },
];

export default function AdminDashboard() {
  const { setAdminMode, adminAuthenticated, setAdminAuthenticated, cmsContent, setCmsContent } = useAppStore();
  const [email, setEmail] = useState('admin@library.kr');
  const [password, setPassword] = useState('');
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'preview'>('content');

  /** 로컬 편집 상태를 CMS 콘텐츠로 초기화 */
  useEffect(() => {
    setEditingContent({ ...cmsContent });
  }, [cmsContent]);

  /** 관리자 로그인 */
  const handleLogin = async () => {
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setAdminAuthenticated(true);
        toast.success('관리자 로그인 성공');
      } else {
        toast.error('로그인에 실패했습니다');
      }
    } catch {
      toast.error('네트워크 오류');
    }
  };

  /** 콘텐츠 저장 */
  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = CMS_KEYS.map((item) => ({
        key: item.key,
        value: editingContent[item.key] || item.fallback,
      }));

      const res = await fetch('/api/admin/content/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: changes }),
      });

      if (res.ok) {
        toast.success('콘텐츠가 저장되었습니다');
        // 스토어 즉시 업데이트
        const newContent: Record<string, string> = {};
        for (const change of changes) {
          newContent[change.key] = change.value;
        }
        setCmsContent({ ...cmsContent, ...newContent }, Date.now());
      } else {
        toast.error('저장에 실패했습니다');
      }
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  /** 콘텐츠 리셋 */
  const handleReset = async () => {
    try {
      const res = await fetch('/api/admin/content/reset', { method: 'POST' });
      if (res.ok) {
        toast.success('콘텐츠가 초기화되었습니다');
        // 편집 상태도 리셋
        const resetContent: Record<string, string> = {};
        for (const item of CMS_KEYS) {
          resetContent[item.key] = item.fallback;
        }
        setEditingContent(resetContent);
        setCmsContent({ ...cmsContent, ...resetContent }, Date.now());
      }
    } catch {
      toast.error('초기화에 실패했습니다');
    }
  };

  /** 키오스크로 돌아가기 */
  const handleBackToKiosk = () => {
    setAdminMode(false);
  };

  // 로그인되지 않은 경우 로그인 화면 표시
  if (!adminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-xl font-bold text-slate-800 text-center mb-6">관리자 로그인</h1>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 outline-none"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                로그인
              </button>
            </div>
            <button
              onClick={handleBackToKiosk}
              className="w-full mt-4 py-2 text-slate-500 hover:text-slate-700 text-sm transition-colors"
            >
              키오스크로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 로그인된 경우 대시보드 표시
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToKiosk}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="키오스크로 돌아가기"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">CMS 콘텐츠 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'content' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            편집
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1" />
            미리보기
          </button>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 'content' ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {CMS_KEYS.map((item) => (
              <div key={item.key} className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">{item.label}</label>
                  <code className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{item.key}</code>
                </div>
                {item.key.includes('color') ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editingContent[item.key] || item.fallback}
                      onChange={(e) =>
                        setEditingContent((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editingContent[item.key] || item.fallback}
                      onChange={(e) =>
                        setEditingContent((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editingContent[item.key] || ''}
                    onChange={(e) =>
                      setEditingContent((prev) => ({ ...prev, [item.key]: e.target.value }))
                    }
                    placeholder={item.fallback}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-400 outline-none"
                  />
                )}
              </div>
            ))}

            {/* 저장/리셋 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleReset}
                className="py-3 px-6 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm transition-colors border border-slate-200 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                초기화
              </button>
            </div>
          </div>
        ) : (
          /* 미리보기 탭 */
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
              <div className="p-4 bg-slate-800 text-white text-center">
                <p className="text-lg font-bold">
                  {editingContent['idle.title'] || 'SMART LIBRARY'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {editingContent['idle.subtitle'] || '무인 도서대출반납기'}
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">메인 메뉴</p>
                  <p className="text-sm font-medium">
                    {editingContent['mainmenu.loan_button_text'] || '도서 대출'} / {editingContent['mainmenu.return_button_text'] || '도서 반납'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">인증</p>
                  <p className="text-sm font-medium">
                    {editingContent['authscan.title'] || '회원인증'} → {editingContent['authpin.title'] || '비밀번호 입력'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">대출/반납</p>
                  <p className="text-sm font-medium">
                    {editingContent['loancomplete.title'] || '대출완료'} / {editingContent['returncomplete.title'] || '반납완료'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
