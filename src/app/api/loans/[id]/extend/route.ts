import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EXTEND_DAYS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const loan = await db.simLoan.findUnique({ where: { id } })

    if (!loan) {
      return NextResponse.json(
        { error: '대출 기록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    if (loan.status !== 'active') {
      return NextResponse.json(
        { error: '활성 대출만 연장할 수 있습니다.' },
        { status: 400 },
      )
    }

    if (loan.extended) {
      return NextResponse.json(
        { error: '이미 한 번 연장된 도서입니다. 더 이상 연장할 수 없습니다.' },
        { status: 400 },
      )
    }

    const currentDue = new Date(loan.dueDate)
    currentDue.setDate(currentDue.getDate() + EXTEND_DAYS)
    const newDueDate = currentDue.toISOString().split('T')[0]

    const updatedLoan = await db.simLoan.update({
      where: { id },
      data: {
        dueDate: newDueDate,
        extended: true,
      },
      include: { book: true },
    })

    return NextResponse.json(updatedLoan)
  } catch (error) {
    console.error('연장 오류:', error)
    return NextResponse.json(
      { error: '대출 연장 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
