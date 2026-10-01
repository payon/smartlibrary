/**
 * 도서 관리 섹션
 *
 * [역할]
 * - 도서 목록 테이블/그리드 뷰 (표지, 제목, 저자, 카테고리, 재고, 대출가능)
 * - 검색 및 카테고리 필터
 * - 도서 추가/수정/삭제 다이얼로그
 * - 키오스크 다크 테마 + 그리드/카드 뷰
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, BookOpen, LayoutGrid, List } from 'lucide-react';
import AdminHero from '@/components/admin/AdminHero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishYear: number | null;
  category: string | null;
  coverUrl: string | null;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string | null;
  _count?: { loans: number };
}

const CATEGORIES = ['전체', '소설', '인문', '과학', '역사', '시'];

/** Category badge colors using kiosk accent palette */
const CATEGORY_COLORS: Record<string, string> = {
  소설: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  인문: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  과학: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  역사: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  시: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const getCategoryBadgeClass = (category: string | null) => {
  if (!category) return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return CATEGORY_COLORS[category] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
};

const emptyBook: Omit<Book, 'id' | '_count'> = {
  isbn: '',
  title: '',
  author: '',
  publisher: '',
  publishYear: null,
  category: '',
  coverUrl: '',
  totalCopies: 3,
  availableCopies: 3,
  shelfLocation: '',
};

/** Book cover component with fallback */
function BookCover({
  coverUrl,
  title,
  size = 'table',
}: {
  coverUrl: string | null;
  title: string;
  size?: 'table' | 'grid';
}) {
  if (size === 'grid') {
    if (coverUrl) {
      return (
        <div className="w-full aspect-[3/4] overflow-hidden bg-slate-800">
          <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className="w-full aspect-[3/4] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-slate-600" />
      </div>
    );
  }

  // table size
  if (coverUrl) {
    return (
      <div className="w-12 h-16 rounded overflow-hidden bg-slate-800">
        <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-12 h-16 rounded bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
      <BookOpen className="w-5 h-5 text-slate-600" />
    </div>
  );
}

export default function BooksSection() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [form, setForm] = useState(emptyBook);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category && category !== '전체') params.set('category', category);
      const res = await fetch(`/api/admin/books?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setBooks(json.books || []);
    } catch {
      toast.error('도서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleAdd = () => {
    setIsAdding(true);
    setForm(emptyBook);
    setSelectedBook(null);
    setEditDialogOpen(true);
  };

  const handleEdit = (book: Book) => {
    setIsAdding(false);
    setSelectedBook(book);
    setForm({
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      publisher: book.publisher || '',
      publishYear: book.publishYear,
      category: book.category || '',
      coverUrl: book.coverUrl || '',
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      shelfLocation: book.shelfLocation || '',
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (book: Book) => {
    setSelectedBook(book);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.isbn || !form.title || !form.author) {
      toast.error('ISBN, 제목, 저자는 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      if (isAdding) {
        const res = await fetch('/api/admin/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '등록 실패');
        }
        toast.success('도서가 등록되었습니다.');
      } else if (selectedBook) {
        const res = await fetch(`/api/admin/books/${selectedBook.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '수정 실패');
        }
        toast.success('도서가 수정되었습니다.');
      }
      setEditDialogOpen(false);
      await fetchBooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedBook) return;
    try {
      const res = await fetch(`/api/admin/books/${selectedBook.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제 실패');
      }
      toast.success('도서가 삭제되었습니다.');
      setDeleteDialogOpen(false);
      await fetchBooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  const inputBase = 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-sky-500';

  return (
    <div className="space-y-4">
      {/* Section Header with hero banner + gradient underline */}
      <AdminHero icon={BookOpen} title="도서 관리" subtitle="도서 등록, 수정, 재고 관리" accent="emerald" />

      {/* 상단 바: 검색 + 필터 + 뷰 토글 + 추가 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="제목, 저자, ISBN 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-9 h-10 ${inputBase}`}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={`w-[140px] h-10 ${inputBase}`}>
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-white focus:bg-slate-800 focus:text-white">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`h-10 w-10 flex items-center justify-center transition-colors ${
              viewMode === 'table'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`h-10 w-10 flex items-center justify-center transition-colors ${
              viewMode === 'grid'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="h-10 px-4 text-sm rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 text-white hover:from-sky-400 hover:to-sky-500 transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          도서 추가
        </button>
      </div>

      {/* 도서 목록 */}
      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <Card className="bg-slate-900 border-slate-700 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800 hover:bg-slate-800 border-slate-700">
                    <TableHead className="w-20 text-slate-400">표지</TableHead>
                    <TableHead className="text-slate-400">제목</TableHead>
                    <TableHead className="hidden md:table-cell text-slate-400">저자</TableHead>
                    <TableHead className="hidden lg:table-cell text-slate-400">카테고리</TableHead>
                    <TableHead className="text-center text-slate-400">재고</TableHead>
                    <TableHead className="text-center text-slate-400">대출가능</TableHead>
                    <TableHead className="text-center w-24 text-slate-400">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-slate-700">
                        <TableCell colSpan={7}>
                          <Skeleton className="h-10 w-full bg-slate-800" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : books.length === 0 ? (
                    <TableRow className="border-slate-700">
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        도서가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    books.map((book) => (
                      <TableRow key={book.id} className="border-slate-700 hover:bg-slate-800/60 transition-colors duration-150">
                        <TableCell>
                          <BookCover coverUrl={book.coverUrl} title={book.title} size="table" />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-white">{book.title}</p>
                            <p className="text-xs text-slate-400 md:hidden">{book.author}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-slate-300">{book.author}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {book.category && (
                            <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryBadgeClass(book.category)}`}>
                              {book.category}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-300">{book.totalCopies}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`text-xs ${
                              book.availableCopies > 0
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {book.availableCopies}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(book)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(book)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-700">
                <Skeleton className="w-full aspect-[3/4] bg-slate-800 rounded-t-xl" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-3/4 bg-slate!-800 mb-2" />
                  <Skeleton className="h-3 w-1/2 bg-slate-800" />
                </CardContent>
              </Card>
            ))
          ) : books.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
              <BookOpen className="w-12 h-12 mb-3 text-slate-600" />
              <p>도서가 없습니다.</p>
            </div>
          ) : (
            books.map((book) => (
              <Card
                key={book.id}
                className="bg-slate-900 border-slate-700 text-white overflow-hidden group hover:border-slate-600 transition-colors duration-200"
              >
                {/* Cover image - top 60% */}
                <BookCover coverUrl={book.coverUrl} title={book.title} size="grid" />
                {/* Info */}
                <CardContent className="p-3 space-y-2">
                  <p className="font-medium text-sm text-white truncate" title={book.title}>
                    {book.title}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{book.author}</p>
                  {book.category && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${getCategoryBadgeClass(book.category)}`}>
                      {book.category}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>재고: {book.totalCopies}</span>
                    <span>•</span>
                    <span className={book.availableCopies > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      대출가능: {book.availableCopies}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-700/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(book)}
                      className="h-7 flex-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 text-xs"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      수정
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(book)}
                      className="h-7 flex-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 도서 추가/수정 다이얼로그 - Dark styled */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{isAdding ? '도서 추가' : '도서 수정'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {isAdding ? '새로운 도서 정보를 입력하세요.' : '도서 정보를 수정하세요.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">ISBN *</Label>
                <Input
                  value={form.isbn}
                  onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                  placeholder="978..."
                  disabled={!isAdding}
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">출판년도</Label>
                <Input
                  type="number"
                  value={form.publishYear ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, publishYear: e.target.value ? Number(e.target.value) : null }))}
                  className={inputBase}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputBase}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">저자 *</Label>
                <Input
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">출판사</Label>
                <Input
                  value={form.publisher ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                  className={inputBase}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">카테고리</Label>
                <Select
                  value={form.category ?? ''}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger className={inputBase}>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {CATEGORIES.filter((c) => c !== '전체').map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-white focus:bg-slate-800 focus:text-white">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">책장 위치</Label>
                <Input
                  value={form.shelfLocation ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                  placeholder="2층 A-05"
                  className={inputBase}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">총 권수</Label>
                <Input
                  type="number"
                  value={form.totalCopies}
                  onChange={(e) => setForm((f) => ({ ...f, totalCopies: Number(e.target.value) }))}
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">대출 가능 권수</Label>
                <Input
                  type="number"
                  value={form.availableCopies}
                  onChange={(e) => setForm((f) => ({ ...f, availableCopies: Number(e.target.value) }))}
                  className={inputBase}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">표지 이미지 URL</Label>
              <Input
                value={form.coverUrl ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
                placeholder="https://..."
                className={inputBase}
              />
              {/* Live preview of cover URL */}
              {form.coverUrl && (
                <div className="w-24 h-32 rounded overflow-hidden border border-slate-700 bg-slate-800">
                  <img
                    src={form.coverUrl}
                    alt="미리보기"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              취소
            </Button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-4 text-sm rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 text-white hover:from-sky-400 hover:to-sky-500 transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAdding ? '등록' : '저장'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 - Dark styled */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">도서 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              &quot;{selectedBook?.title}&quot;을(를) 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
