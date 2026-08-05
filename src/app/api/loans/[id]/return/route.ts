import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const returnDateStr = body.returnDate ?? new Date().toISOString().split('T')[0]

    const loan = await db.simLoan.findUnique({
      where: { id },
      include: { book: true },
    })

    if (!loan) {
      return NextResponse.json(
        { error: '대출 기록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    if (loan.status === 'returned') {
      return NextResponse.json(
        { error: '이미 반납된 도서입니다.' },
        { status: 400 },
      )
    }

    const returnDate = new Date(returnDateStr)
    const dueDate = new Date(loan.dueDate)
    returnDate.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)

    const diffMs = returnDate.getTime() - dueDate.getTime()
    const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    // 연체일수만큼 대여 정지 (연체료 없음)
    const penaltyDays = overdueDays * OVERDUE_BLOCK_MULTIPLIER

    const updatedLoan = await db.simLoan.update({
      where: { id },
      data: {
        status: 'returned',
        returnDate: returnDateStr,
      },
      include: { book: true },
    })

    await db.book.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    })

    return NextResponse.json({
      loan: updatedLoan,
      overdueDays,
      penaltyDays,
    })
  } catch (error) {
    console.error('반납 오류:', error)
    return NextResponse.json(
      { error: '도서 반납 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
