/**
 * 대기 메인 포털 (실기기 참조)
 *
 * [기능]
 * - 배너 캐러셀 + 대출/반납 대버튼 (대출은 도서선택부터)
 * - 부버튼: 회원가입/대출이력/설문조사/이용안내
 * - 비콘 대출 안내 스트립 + 인기/추천/신착 (탭 → 상세 모달)
 * - 밀양 안내(miryang-main) 다음 화면, 무조작 복귀는 miryang-main으로
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import type { BookItem } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { useCmsText } from '@/hooks/useCmsContent';
import { EcoTicker } from '@/components/kiosk/eco/EcoChrome';
import BookDetailModal from '@/components/kiosk/BookDetailModal';
import KioskA11yBar from '@/components/kiosk/KioskA11yBar';
import KioskGuide from '@/components/kiosk/KioskGuide';
import {
  BookOpen,
  ArrowDownToLine,
  UserPlus,
  History,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Crown,
  Radio,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

/** 포털 부버튼 정의 (표시 여부·순서는 CMS portal.subbuttons) */
const SUBBUTTON_DEFS = [
  { id: 'signup', label: '회원가입', Icon: UserPlus },
  { id: 'history', label: '대출이력', Icon: History },
  { id: 'survey', label: '설문조사', Icon: FileText },
  { id: 'guide', label: '이용안내', Icon: CircleHelp },
] as const;

const BANNER_KEYS = ['idle.banner_1', 'idle.banner_2', 'idle.banner_3'];

export default function KioskPortal() {
  const idleTitle = useCmsText('idle.title', 'SMART LIBRARY');
  useKioskSpeak(`${idleTitle}. 원하시는 서비스를 선택하세요.`);
  const { setScreen, setKioskMode } = useAppStore();
  const cmsContent = useAppStore((s) => s.cmsContent);

  const [bannerIdx, setBannerIdx] = useState(0);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  /** 배너 이미지 목록 (CMS, 빈 값 제외) */
  const banners = BANNER_KEYS.map((k) => cmsContent[k] || '').filter(
    (v) => v.startsWith('/') || v.startsWith('https://')
  );

  /** 부버튼 구성 (CMS, signup 제외가 기본) */
  const subbuttonOrder = (() => {
    try {
      const parsed: unknown = JSON.parse(
        cmsContent['portal.subbuttons'] || '["history","survey","guide"]'
      );
      if (!Array.isArray(parsed)) return ['history', 'survey', 'guide'];
      const known = SUBBUTTON_DEFS.map((d) => d.id);
      return (parsed as unknown[]).filter(
        (v): v is (typeof SUBBUTTON_DEFS)[number]['id'] =>
          typeof v === 'string' && (known as string[]).includes(v)
      );
    } catch {
      return ['history', 'survey', 'guide'];
    }
  })();

  /** 히어로 동영상 (CMS, mp4) */
  const heroVideo = (() => {
    const v = cmsContent['portal.hero_video'] || '';
    return v.endsWith('.mp4') && (v.startsWith('/') || v.startsWith('https://')) ? v : '';
  })();

  /** 설문조사 버튼 표시 여부 (관리자, 기본 숨김) */
  const surveyEnabled = (cmsContent['portal.survey_enabled'] || '').trim().toLowerCase() === 'true';
  const visibleSubbuttons = subbuttonOrder.filter(
    (id) => id !== 'survey' || surveyEnabled
  );

  const handleSubbutton = (id: string) => {
    switch (id) {
      case 'signup':
        goSignup();
        break;
      case 'history':
        goHistory();
        break;
      case 'survey':
        toast.info('설문조사 기간이 아닙니다.');
        break;
      case 'guide':
      default:
        setGuideOpen(true);
        break;
    }
  };

  /** 배너 자동 순환 (5초) */
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setBannerIdx((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  /** 도서 목록 조회 */
  useEffect(() => {
    fetch('/api/books')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: BookItem[]) => setBooks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const goLoan = useCallback(() => {
    setKioskMode('loan');
    useAppStore.getState().clearSelectedBooks();
    useAppStore.getState().clearReturnedLoans();
    useAppStore.getState().setAuthenticatedUser(null);
    setScreen('loan-select');
  }, [setKioskMode, setScreen]);

  const goReturn = useCallback(() => {
    setKioskMode('return');
    setScreen('auth-scan');
  }, [setKioskMode, setScreen]);

  const goSignup = useCallback(() => {
    setKioskMode('card');
    setScreen('card-apply');
  }, [setKioskMode, setScreen]);

  const goHistory = useCallback(() => {
    setScreen('loan-history');
  }, [setScreen]);

  const popular = books.slice(0, 4);
  const recommended = books.slice(4, 8);
  const fresh = [...books]
    .sort((a, b) => (b.publishYear || 0) - (a.publishYear || 0))
    .slice(0, 4);

  const sections = [
    { title: '인기 도서', list: popular },
    { title: '추천 도서', list: recommended },
    { title: '신착 도서', list: fresh },
  ];

  return (
    <div className="kiosk-screen eco-bg flex flex-col">
      {/* 상단 히어로: 동영상 우선, 없으면 배너 캐러셀 */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-gradient-to-br from-sky-200 via-sky-100 to-emerald-50">
        {heroVideo ? (
          <video
            src={heroVideo}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            aria-label="도서관 안내 동영상"
          />
        ) : (
        <>
        <AnimatePresence mode="wait">
          {banners.length > 0 ? (
            <motion.img
              key={bannerIdx}
              src={banners[bannerIdx % banners.length]}
              alt="도서관 안내 배너"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <p className="text-xl font-bold text-slate-700 leading-relaxed">
                도서관을 방문하지 않아도
                <br />
                도서 <span className="text-sky-600">대출</span>과{' '}
                <span className="text-emerald-600">반납</span>을 한 번에!
              </p>
              <p className="text-sm text-slate-500 tracking-[0.3em] mt-2">SMART LIBRARY</p>
            </div>
          )}
        </AnimatePresence>
        {/* 캐러셀 도트 + 화살표 */}
        {banners.length > 1 && (
          <>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === bannerIdx % banners.length ? 'w-4 bg-sky-500' : 'w-1.5 bg-slate-300'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setBannerIdx((i) => (i + banners.length - 1) % banners.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 text-slate-600 flex items-center justify-center"
              aria-label="이전 배너"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setBannerIdx((i) => (i + 1) % banners.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 text-slate-600 flex items-center justify-center"
              aria-label="다음 배너"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        {/* 이용안내 버튼 */}
        <button
          onClick={() => setGuideOpen(true)}
          className="absolute top-2 right-2 min-w-11 min-h-11 px-3 rounded-xl bg-sky-500/90 text-white text-sm font-bold flex items-center gap-1 shadow"
          aria-label="이용안내 열기"
        >
          <CircleHelp className="w-5 h-5" />
          이용안내
        </button>
        </>
        )}
      </div>

      {/* 대출/반납 대버튼 */}
      <div className="px-5 pt-3 grid grid-cols-2 gap-3 shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={goLoan}
          className="rounded-2xl py-4 flex flex-col items-center gap-1 text-white font-bold text-xl shadow-lg"
          style={{ background: 'linear-gradient(180deg, #9db8e8 0%, #7b9bd4 100%)' }}
          aria-label="도서 대출"
        >
          <BookOpen className="w-7 h-7" />
          대 출
          <span className="text-xs font-normal opacity-80">Check out</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={goReturn}
          className="rounded-2xl py-4 flex flex-col items-center gap-1 text-white font-bold text-xl shadow-lg"
          style={{ background: 'linear-gradient(180deg, #7fd4e8 0%, #4fb3d4 100%)' }}
          aria-label="도서 반납"
        >
          <ArrowDownToLine className="w-7 h-7" />
          반 납
          <span className="text-xs font-normal opacity-80">Return</span>
        </motion.button>
      </div>

      {/* 부버튼 (관리자 구성 순서대로, 설문조사는 표시 플래그 적용) */}
      <div className={`px-5 pt-3 grid gap-2 shrink-0 ${visibleSubbuttons.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {visibleSubbuttons.map((id) => {
          const def = SUBBUTTON_DEFS.find((d) => d.id === id)!;
          return (
            <button
              key={id}
              onClick={() => handleSubbutton(id)}
              className="rounded-xl bg-white border border-slate-200 py-2.5 flex flex-col items-center gap-1 text-slate-600 text-xs font-semibold shadow-sm"
            >
              <def.Icon className="w-5 h-5 text-sky-500" />
              {def.label}
            </button>
          );
        })}
      </div>

      {/* 비콘 대출 안내 스트립 */}
      <div className="mx-5 mt-3 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 flex items-center gap-2 shrink-0">
        <Radio className="w-4 h-4 text-sky-500 shrink-0" />
        <p className="text-xs text-sky-700">
          <strong>비콘 대출</strong> — 별도 앱 없이 이 화면에서 바로 대출하세요.
        </p>
      </div>

      {/* 도서 섹션 */}
      <main className="flex-1 overflow-y-auto kiosk-scroll px-5 py-3 space-y-4">
        {sections.map((sec) => (
          <section key={sec.title} aria-label={sec.title}>
            <div className="flex items-center gap-1.5 mb-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-800">{sec.title}</h2>
            </div>
            {sec.list.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">도서를 불러오는 중...</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {sec.list.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => setDetailBook(book)}
                    className="text-center"
                    aria-label={`${book.title} 상세 보기`}
                  >
                    <div className="aspect-[2/3] rounded-md bg-white overflow-hidden border border-slate-200 shadow-sm">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-600 truncate mt-1">{book.title}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>

      {/* 접근성 툴바 + 티커 */}
      <div className="px-5 pb-2 flex justify-center shrink-0">
        <KioskA11yBar dark={false} />
      </div>
      <EcoTicker />

      <BookDetailModal
        book={detailBook}
        books={books}
        onClose={() => setDetailBook(null)}
        onSelectBook={(b) => setDetailBook(b)}
      />
      {guideOpen && <KioskGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
