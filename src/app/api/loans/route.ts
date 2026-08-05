import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 },
      )
    }

    const loans = await db.simLoan.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { loanDate: 'desc' },
    })

    return NextResponse.json(loans)
  } catch (error) {
    console.error('대출 목록 조회 오류:', error)
    return NextResponse.json(
      { error: '대출 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, bookId, method } = body

    if (!userId || !bookId) {
      return NextResponse.json(
        { error: 'userId와 bookId는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    if (!method || !['counter', 'kiosk'].includes(method)) {
      return NextResponse.json(
        { error: '대출 방법은 counter 또는 kiosk이어야 합니다.' },
        { status: 400 },
      )
    }

    const user = await db.simUser.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    // Check overdue loans
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdueLoans = await db.simLoan.findMany({
      where: {
        userId,
        status: 'active',
        dueDate: { lt: today.toISOString().split('T')[0] },
      },
    })
    if (overdueLoans.length > 0) {
      return NextResponse.json(
        { error: '연체된 도서가 있어 대출할 수 없습니다. 먼저 반납해주세요.' },
        { status: 400 },
      )
    }

    // Check max active loans
    const activeLoanCount = await db.simLoan.count({
      where: { userId, status: 'active' },
    })
    if (activeLoanCount >= MAX_LOAN_COUNT) {
      return NextResponse.json(
        { error: `대출 가능한 권수(${MAX_LOAN_COUNT}권)를 초과했습니다.` },
        { status: 400 },
      )
    }

    const book = await db.book.findUnique({ where: { id: bookId } })
    if (!book) {
      return NextResponse.json(
        { error: '도서를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    if (book.availableCopies <= 0) {
      return NextResponse.json(
        { error: '대출 가능한 복본이 없습니다.' },
        { status: 400 },
      )
    }

    const loanDate = new Date().toISOString().split('T')[0]
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS)
    const dueDateStr = dueDate.toISOString().split('T')[0]

    const loan = await db.simLoan.create({
      data: {
        userId,
        bookId,
        loanDate,
        dueDate: dueDateStr,
        status: 'active',
        method,
      },
      include: { book: true },
    })

    await db.book.update({
      where: { id: bookId },
      data: { availableCopies: { decrement: 1 } },
    })

    return NextResponse.json(loan, { status: 201 })
  } catch (error) {
    console.error('대출 오류:', error)
    return NextResponse.json(
      { error: '도서 대출 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
