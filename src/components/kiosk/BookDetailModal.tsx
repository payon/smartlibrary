/**
 * 도서 상세 모달 — 실기기 참조 (책바구니 담기 + 연관도서)
 *
 * [기능]
 * - 표지/제목/저자/출판사/대출상태/서가위치 표시
 * - 책바구니 담기 버튼
 * - 같은 카테고리 연관도서 (탭 시 교체)
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBasket, MapPin } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { BookItem } from '@/stores/useAppStore';
import { MAX_LOAN_COUNT } from '@/lib/constants';
import { toast } from 'sonner';
import { CmsText } from '@/components/kiosk/CmsText';

interface BookDetailModalProps {
  book: BookItem | null;
  books: BookItem[];
  onClose: () => void;
  onSelectBook: (book: BookItem) => void;
}

export default function BookDetailModal({ book, books, onClose, onSelectBook }: BookDetailModalProps) {
  const selectedBooks = useAppStore((s) => s.selectedBooks);
  const addBook = useAppStore((s) => s.addBook);

  const related = book
    ? books.filter((b) => b.id !== book.id && b.category === book.category).slice(0, 5)
    : [];

  const handleAdd = () => {
    if (!book) return;
    if (selectedBooks.some((b) => b.id === book.id)) {
      toast.success('이미 책바구니에 담겨 있습니다');
      return;
    }
    if (selectedBooks.length >= MAX_LOAN_COUNT) {
      toast.error(`최대 ${MAX_LOAN_COUNT}권까지 대출할 수 있습니다`);
      return;
    }
    addBook(book);
    toast.success(`"${book.title}" 담기 완료`);
  };

  return (
    <AnimatePresence>
      {book && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${book.title} 상세 정보`}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto kiosk-scroll bg-white rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 bg-sky-50 rounded-t-2xl border-b border-sky-100">
              <p className="text-lg font-bold text-slate-500 tracking-widest">상 세 정 보</p>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center"
                aria-label="상세 닫기"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 본문 */}
            <div className="p-5">
              <div className="flex gap-4">
                <div className="w-24 h-36 rounded-lg bg-slate-100 shrink-0 overflow-hidden border border-slate-200">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-800 leading-snug">{book.title}</p>
                  <dl className="text-sm text-slate-600 mt-2 space-y-1">
                    <div className="flex gap-2">
                      <dt className="text-slate-400 shrink-0">저자</dt>
                      <dd>{book.author}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400 shrink-0">출판사</dt>
                      <dd>{book.publisher}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400 shrink-0">상태</dt>
                      <dd className={book.availableCopies > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                        {book.availableCopies > 0 ? '대출 가능' : '대출 중'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400 shrink-0">서가</dt>
                      <dd className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {book.shelfLocation}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={book.availableCopies <= 0}
                className="eco-btn-primary w-full mt-4 disabled:opacity-40"
              >
                <ShoppingBasket className="w-5 h-5" />
                <CmsText contentKey="bookdetail.add_button" fallback="책바구니 담기" />
              </button>

              {/* 연관도서 */}
              {related.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-sky-600 mb-2">
                    <CmsText contentKey="bookdetail.related_title" fallback="연관도서" />
                  </p>
                  <div className="flex gap-2 overflow-x-auto kiosk-scroll pb-1">
                    {related.map((rel) => (
                      <button
                        key={rel.id}
                        onClick={() => onSelectBook(rel)}
                        className="shrink-0 w-16 text-center"
                        aria-label={`연관도서 ${rel.title} 보기`}
                      >
                        <div className="w-16 h-24 rounded-md bg-slate-100 overflow-hidden border border-slate-200">
                          {rel.coverUrl ? (
                            <img src={rel.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-600 truncate mt-1">{rel.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
