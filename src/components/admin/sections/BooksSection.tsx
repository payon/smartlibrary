/**
 * 도서 관리 섹션
 *
 * [역할]
 * - 도서 목록 테이블 (표지, 제목, 저자, 카테고리, 재고, 대출가능)
 * - 검색 및 카테고리 필터
 * - 도서 추가/수정/삭제 다이얼로그
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, BookOpen } from 'lucide-react';
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

export default function BooksSection() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
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

  return (
    <div className="space-y-4">
      {/* 상단 바: 검색 + 필터 + 추가 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="제목, 저자, ISBN 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[140px] h-10">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} className="h-10">
          <Plus className="w-4 h-4 mr-1.5" />
          도서 추가
        </Button>
      </div>

      {/* 도서 목록 테이블 */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">표지</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="hidden md:table-cell">저자</TableHead>
                  <TableHead className="hidden lg:table-cell">카테고리</TableHead>
                  <TableHead className="text-center">재고</TableHead>
                  <TableHead className="text-center">대출가능</TableHead>
                  <TableHead className="text-center w-24">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : books.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      도서가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        {book.coverUrl ? (
                          <div className="w-10 h-14 rounded overflow-hidden bg-muted">
                            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{book.title}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{book.author}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{book.author}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {book.category && (
                          <Badge variant="secondary" className="text-xs">{book.category}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{book.totalCopies}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={book.availableCopies > 0 ? 'default' : 'destructive'} className="text-xs">
                          {book.availableCopies}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(book)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(book)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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

      {/* 도서 추가/수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAdding ? '도서 추가' : '도서 수정'}</DialogTitle>
            <DialogDescription>
              {isAdding ? '새로운 도서 정보를 입력하세요.' : '도서 정보를 수정하세요.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ISBN *</Label>
                <Input
                  value={form.isbn}
                  onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                  placeholder="978..."
                  disabled={!isAdding}
                />
              </div>
              <div className="space-y-1.5">
                <Label>출판년도</Label>
                <Input
                  type="number"
                  value={form.publishYear ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, publishYear: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>저자 *</Label>
                <Input
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>출판사</Label>
                <Input
                  value={form.publisher ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>카테고리</Label>
                <Select
                  value={form.category ?? ''}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== '전체').map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>책장 위치</Label>
                <Input
                  value={form.shelfLocation ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                  placeholder="2층 A-05"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>총 권수</Label>
                <Input
                  type="number"
                  value={form.totalCopies}
                  onChange={(e) => setForm((f) => ({ ...f, totalCopies: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>대출 가능 권수</Label>
                <Input
                  type="number"
                  value={form.availableCopies}
                  onChange={(e) => setForm((f) => ({ ...f, availableCopies: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>표지 이미지 URL</Label>
              <Input
                value={form.coverUrl ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {isAdding ? '등록' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>도서 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{selectedBook?.title}&quot;을(를) 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
