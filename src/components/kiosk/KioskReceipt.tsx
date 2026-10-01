/**
 * 키오스크 영수증 컴포넌트 (대출/반납 공용)
 *
 * [기능]
 * - 실제 무인기기 영수증처럼 상세 내역 표시
 * - 이용자/일시/도서별 대출일·반납예정일·반납일·연체 여부
 * - 연체 페널티 (연체일수 → 대출불가 기간) 및 문자 발송 안내
 */

import { useAppStore } from '@/stores/useAppStore';
import { useCmsText } from '@/hooks/useCmsContent';
import { Smartphone, ReceiptText } from 'lucide-react';

/** 전화번호 마스킹 (01012345678 → 010-****-5678) */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) return '***';
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

/** YYYY-MM-DD → YYYY.MM.DD */
export function formatReceiptDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export interface ReceiptBookRow {
  title: string;
  author: string;
  loanDate: string;
  dueDate: string;
  returnDate?: string | null;
  overdueDays?: number;
}

interface KioskReceiptProps {
  kind: 'loan' | 'return';
  userName: string;
  cardNumber: string;
  phone: string | undefined | null;
  books: ReceiptBookRow[];
  /** 반납 시: 연체 페널티 요약 (대출불가 종료일) */
  penaltyNote?: string | null;
}

export default function KioskReceipt({
  kind,
  userName,
  cardNumber,
  phone,
  books,
  penaltyNote,
}: KioskReceiptProps) {
  const libraryName = useCmsText('global.library_name', '스마트 도서관');
  const now = new Date();
  const nowStr = `${formatReceiptDate(now.toISOString())} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const masked = maskPhone(phone);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-label={`${kind === 'loan' ? '대출' : '반납'} 영수증`}>
      {/* 영수증 헤더 */}
      <div className="px-4 pt-4 pb-3 text-center border-b border-dashed border-slate-300">
        <div className="flex items-center justify-center gap-1.5 text-slate-800">
          <ReceiptText className="w-4 h-4" />
          <p className="font-bold">{libraryName}</p>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {kind === 'loan' ? '도서 대출 영수증' : '도서 반납 영수증'} · {nowStr}
        </p>
      </div>

      {/* 이용자 정보 */}
      <div className="px-4 py-2.5 border-b border-dashed border-slate-300 text-xs text-slate-600 space-y-0.5">
        <p>이용자: <span className="font-semibold text-slate-800">{userName}</span></p>
        <p>카드번호: <span className="font-mono">{cardNumber}</span></p>
      </div>

      {/* 도서별 상세 */}
      <div className="px-4 py-2.5 border-b border-dashed border-slate-300">
        {books.map((b, idx) => (
          <div key={idx} className="py-1.5 border-b border-slate-100 last:border-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{idx + 1}. {b.title}</p>
            <p className="text-xs text-slate-500">{b.author}</p>
            <p className="text-xs text-slate-600 mt-0.5 font-mono">
              대출 {formatReceiptDate(b.loanDate)} → 예정 {formatReceiptDate(b.dueDate)}
              {kind === 'return' && b.returnDate && (
                <> → 반납 {formatReceiptDate(b.returnDate)}</>
              )}
            </p>
            {kind === 'return' && (b.overdueDays || 0) > 0 && (
              <p className="text-xs text-red-600 font-semibold mt-0.5">
                연체 {b.overdueDays}일
              </p>
            )}
          </div>
        ))}
        <p className="text-xs text-slate-600 mt-1.5">
          합계 <span className="font-bold text-slate-800">{books.length}권</span>
        </p>
      </div>

      {/* 연체 페널티 안내 */}
      {penaltyNote && (
        <div className="px-4 py-2.5 border-b border-dashed border-slate-300 bg-red-50">
          <p className="text-xs text-red-700 font-semibold">⚠ 연체 안내</p>
          <p className="text-xs text-red-600 mt-0.5">{penaltyNote}</p>
        </div>
      )}

      {/* 문자 발송 안내 (시뮬레이션) */}
      {masked && (
        <div className="px-4 py-2.5 flex items-start gap-2 bg-sky-50">
          <Smartphone className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700">
            {kind === 'loan' ? '대출' : '반납'} 완료 문자를 {masked}번으로 발송했습니다
          </p>
        </div>
      )}

      {/* 푸터 */}
      <p className="text-center text-xs text-slate-400 py-2.5">이용해 주셔서 감사합니다</p>
    </div>
  );
}
