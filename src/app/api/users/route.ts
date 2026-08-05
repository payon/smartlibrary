import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function generateCardNumber(): string {
  const digits = Math.floor(10000000 + Math.random() * 90000000)
  return `LIB-${digits}`
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, birthDate, phone, address } = body

    if (!name || !birthDate || !phone) {
      return NextResponse.json(
        { error: '이름, 생년월일, 전화번호는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    const cardNumber = generateCardNumber()
    const today = new Date().toISOString().split('T')[0]

    const user = await db.simUser.create({
      data: {
        name,
        birthDate,
        phone,
        address: address ?? null,
        cardType: 'mobile',
        cardNumber,
        cardIssued: today,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('회원가입 오류:', error)
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
