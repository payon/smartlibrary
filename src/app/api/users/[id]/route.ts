import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const user = await db.simUser.findUnique({
      where: { id },
      include: {
        loans: {
          where: { status: 'active' },
          include: { book: true },
          orderBy: { loanDate: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('사용자 조회 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
