import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SEED_BOOKS, SCENARIOS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await db.simLoan.deleteMany()
    await db.learningProgress.deleteMany()
    await db.simUser.deleteMany()
    await db.book.deleteMany()
    await db.scenario.deleteMany()

    const bookCount = await db.book.createMany({ data: SEED_BOOKS })

    const scenarioCount = await db.scenario.createMany({ data: SCENARIOS })

    return NextResponse.json({
      success: true,
      books: bookCount.count,
      scenarios: scenarioCount.count,
    })
  } catch (error) {
    console.error('시드 데이터 초기화 오류:', error)
    return NextResponse.json(
      { error: '데이터 초기화 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
