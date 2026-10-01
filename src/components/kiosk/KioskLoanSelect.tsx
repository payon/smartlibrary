/**
 * 도서 대출 선택 화면
 *
 * [기능]
 * - 검색 바 및 카테고리 필터 (CMS 관리)
 * - 도서 그리드 (2열) 표시
 * - 도서 선택/해제
 * - 선택된 도서 칩 표시
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import type { BookItem, LoanItem } from '@/stores/useAppStore';
import { BOOK_CATEGORIES, MAX_LOAN_COUNT } from '@/lib/constants';
import { Search, X, ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CmsText } from '@/components/kiosk/CmsText';
import BookDetailModal from '@/components/kiosk/BookDetailModal';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskLoanSelect() {
  const loanSelectTitle = useCmsText('loanselect.title', '도서를 선택해주세요');
  const theme = useScreenTheme('loan-select');
  useKioskSpeak(`${loanSelectTitle}. 도서를 선택해주세요. 최대 2권까지 대출할 수 있습니다.`);
  const { selectedBooks, addBook, removeBook, setScreen, prevScreen, authenticatedUser, setKioskMode } = useAppStore();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [activeLoanCount, setActiveLoanCount] = useState<number | null>(null);
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);

  /** 내 활성 대출 권수 조회 (상한 도달 시 반납 유도) */
  useEffect(() => {
    if (!authenticatedUser) return;
    fetch(`/api/loans?userId=${authenticatedUser.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((loans: LoanItem[]) => {
        setActiveLoanCount(loans.filter((l) => l.status === 'active').length);
      })
      .catch(() => {});
  }, [authenticatedUser]);

  /** 반납하러 가기 (대출 상한 도달 시, 회원증 인식부터) */
  const handleGoReturn = () => {
    setKioskMode('return');
    setScreen('auth-scan');
  };

  /** 도서 목록 조회 */
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category !== '전체') params.set('category', category);
        const res = await fetch(`/api/books?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setBooks(data);
        }
      } catch {
        toast.error('도서 목록을 불러오지 못했습니다');
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, [search, category]);

  /** 필터링된 도서 목록 (클라이언트 사이드 추가 필터링) */
  const filteredBooks = useMemo(() => {
    return books.filter((b) => b.availableCopies > 0);
  }, [books]);

  const cmsContent = useAppStore((s) => s.cmsContent);

  /** 도서 선택/해제 토글 */
  const toggleBook = (book: BookItem) => {
    if (selectedBooks.some((b) => b.id === book.id)) {
      removeBook(book.id);
    } else {
      if (selectedBooks.length >= MAX_LOAN_COUNT) {
        const warning = cmsContent['loanselect.max_selection_warning'] || `최대 ${MAX_LOAN_COUNT}권까지 대출할 수 있습니다`;
        toast.error(warning);
        return;
      }
      addBook(book);
    }
  };

  /** 다음 단계로 이동 (선택 → 회원인증) */
  const handleNext = () => {
    if (selectedBooks.length === 0) return;
    setScreen('auth-scan');
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서대출" />
      <EcoSteps steps={LOAN_STEPS} current={1} />
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="loanselect.title" fallback="도서를 선택해주세요" />
        </h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-slate-500 text-sm">
            최대 {MAX_LOAN_COUNT}권까지 대출할 수 있습니다
          </p>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
            selectedBooks.length >= MAX_LOAN_COUNT
              ? 'bg-amber-100 text-amber-700'
              : selectedBooks.length > 0
                ? 'bg-sky-100 text-sky-700'
                : 'bg-slate-100 text-slate-500'
          }`}>
            <span>{selectedBooks.length}/{MAX_LOAN_COUNT}권 선택됨</span>
            {selectedBooks.length >= MAX_LOAN_COUNT && (
              <span className="text-amber-500 text-xs">(최대)</span>
            )}
          </div>
        </div>
      </header>

      {/* 대출 상한 도달 안내 (이미 빌린 경우 반납 유도) */}
      {activeLoanCount !== null && activeLoanCount >= MAX_LOAN_COUNT && (
        <div className="mx-5 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-center gap-2">
          <p className="flex-1 text-sm text-amber-700">
            이미 {activeLoanCount}권을 대출 중입니다. 새로 빌리려면 먼저 반납해주세요.
          </p>
          <button
            onClick={handleGoReturn}
            className="shrink-0 h-10 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold"
          >
            반납하러 가기
          </button>
        </div>
      )}

      {/* 검색 바 */}
      <div className="px-5 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="제목, 저자로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-slate-100 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-sky-400/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* 카테고리 필터 탭 */}
      <div className="px-5 mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {BOOK_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              category === cat
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 선택된 도서 칩 영역 */}
      {selectedBooks.length > 0 && (
        <div className="px-5 mb-2 flex gap-2 overflow-x-auto no-scrollbar py-1">
          {selectedBooks.map((book) => (
            <motion.button
              key={book.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => removeBook(book.id)}
              className="flex items-center gap-1.5 bg-sky-100 text-sky-700 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
            >
              {book.title.length > 8 ? book.title.slice(0, 8) + '...' : book.title}
              <X className="w-3 h-3" />
            </motion.button>
          ))}
        </div>
      )}

      {/* 도서 그리드 */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>대출 가능한 도서가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredBooks.map((book) => {
              const isSelected = selectedBooks.some((b) => b.id === book.id);
              const isAtLimit = !isSelected && selectedBooks.length >= MAX_LOAN_COUNT;
              return (
                <motion.div
                  key={book.id}
                  layout
                  className={`relative bg-white rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected ? 'border-sky-500 shadow-md' : isAtLimit ? 'border-slate-200 opacity-50' : 'border-slate-100'
                  }`}
                >
                  {/* 도서 표지 (탭 → 상세) */}
                  <button
                    onClick={() => setDetailBook(book)}
                    className="aspect-[2/3] bg-slate-100 relative w-full text-left"
                    aria-label={`${book.title} 상세 보기`}
                  >
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className={`w-full h-full object-cover ${isAtLimit ? 'grayscale' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Search className="w-8 h-8" />
                      </div>
                    )}
                    {/* 선택 체크 표시 */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                    {/* 한도 초과 오버레이 */}
                    {isAtLimit && (
                      <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                        <span className="text-xs font-semibold text-slate-400 bg-white/80 px-2 py-1 rounded">
                          선택 불가
                        </span>
                      </div>
                    )}
                  </button>

                  {/* 도서 정보 */}
                  <div className="p-2.5">
                    <p className={`text-xs font-semibold line-clamp-1 ${isAtLimit ? 'text-slate-400' : 'text-slate-800'}`}>
                      {book.title}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isAtLimit ? 'text-slate-300' : 'text-slate-400'}`}>
                      {book.author}
                    </p>
                    <button
                      onClick={() => toggleBook(book)}
                      disabled={isAtLimit}
                      className={`mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? 'bg-red-50 text-red-600'
                          : isAtLimit
                            ? 'bg-slate-50 text-slate-300'
                            : 'bg-sky-50 text-sky-600'
                      }`}
                    >
                      {isSelected ? '선택 취소' : isAtLimit ? '선택 불가' : '선택'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <footer className="pb-8 px-5 flex gap-3">
        <button
          onClick={prevScreen}
          className="eco-btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={handleNext}
          disabled={selectedBooks.length === 0}
          className="eco-btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CmsText contentKey="loanselect.confirm_button_text" fallback="다음 단계" />
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
      <EcoTicker />
      <BookDetailModal
        book={detailBook}
        books={filteredBooks}
        onClose={() => setDetailBook(null)}
        onSelectBook={(b) => setDetailBook(b)}
      />
    </div>
  );
}
