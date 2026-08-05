import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function generateCardNumber(): string {
  const digits = Math.floor(10000000 + Math.random() * 90000000)
  return `LIB-${digits}`
}

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { cardType } = body

    if (!cardType || !['mobile', 'physical'].includes(cardType)) {
      return NextResponse.json(
        { error: '도서증 종류는 mobile 또는 physical이어야 합니다.' },
        { status: 400 },
      )
    }

    const user = await db.simUser.findUnique({ where: { id } })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    // Reissue: generate new card number
    const newCardNumber = generateCardNumber()
    const today = new Date().toISOString().split('T')[0]

    const updatedUser = await db.simUser.update({
      where: { id },
      data: {
        cardType,
        cardNumber: newCardNumber,
        cardIssued: today,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('도서증 발급 오류:', error)
    return NextResponse.json(
      { error: '도서증 발급 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
