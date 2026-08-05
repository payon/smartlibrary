import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 연장은 불가 — 항상 거부
  return NextResponse.json(
    { error: '도서 대출 연장이 불가합니다. 반납일을 준수해주세요.' },
    { status: 400 },
  )
}
