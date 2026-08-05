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
    const { cardType, pin } = body

    if (!cardType || !['mobile', 'physical'].includes(cardType)) {
      return NextResponse.json(
        { error: '도서증 종류는 mobile 또는 physical이어야 합니다.' },
        { status: 400 },
      )
    }

    // If PIN is provided, set it (for users who didn't set PIN during registration)
    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: '4자리 비밀번호를 입력해주세요.' },
          { status: 400 },
        )
      }
      const existingPin = await db.simUser.findUnique({ where: { pin } })
      if (existingPin && existingPin.id !== id) {
        return NextResponse.json(
          { error: '이미 사용 중인 비밀번호입니다. 다른 번호를 선택해주세요.' },
          { status: 400 },
        )
      }
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

    const updateData: Record<string, string> = {
      cardType,
      cardNumber: newCardNumber,
      cardIssued: today,
    }

    // Set PIN if provided and user doesn't have one yet
    if (pin && !user.pin) {
      updateData.pin = pin
    }

    const updatedUser = await db.simUser.update({
      where: { id },
      data: updateData,
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
