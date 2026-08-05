import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Verify PIN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { pin, action } = body

    const user = await db.simUser.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    // Setup PIN (first time or change)
    if (action === 'set') {
      if (!pin || !/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: '4자리 비밀번호를 입력해주세요.' },
          { status: 400 },
        )
      }
      // Check uniqueness
      const existingPin = await db.simUser.findUnique({ where: { pin } })
      if (existingPin && existingPin.id !== id) {
        return NextResponse.json(
          { error: '이미 사용 중인 비밀번호입니다. 다른 번호를 선택해주세요.' },
          { status: 400 },
        )
      }
      const updatedUser = await db.simUser.update({
        where: { id },
        data: { pin },
      })
      return NextResponse.json(updatedUser)
    }

    // Verify PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: '4자리 비밀번호를 입력해주세요.' },
        { status: 400 },
      )
    }

    if (!user.pin) {
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 도서증 발급 시 비밀번호를 설정해주세요.' },
        { status: 400 },
      )
    }

    if (user.pin !== pin) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 },
      )
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('PIN 오류:', error)
    return NextResponse.json(
      { error: '비밀번호 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
