import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const progress = await db.learningProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('학습 진행도 조회 오류:', error)
    return NextResponse.json(
      { error: '학습 진행도를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, scenarioId, stepIndex, completed, attempts, bestTimeSec, stars } = body

    if (!userId || !scenarioId) {
      return NextResponse.json(
        { error: 'userId와 scenarioId는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    const progress = await db.learningProgress.create({
      data: {
        userId,
        scenarioId,
        stepIndex: stepIndex ?? 0,
        completed: completed ?? false,
        attempts: attempts ?? 0,
        bestTimeSec: bestTimeSec ?? null,
        stars: stars ?? 0,
      },
    })

    return NextResponse.json(progress, { status: 201 })
  } catch (error) {
    console.error('학습 진행도 저장 오류:', error)
    return NextResponse.json(
      { error: '학습 진행도 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, scenarioId, stepIndex, completed, attempts, bestTimeSec, stars } = body

    if (!userId || !scenarioId) {
      return NextResponse.json(
        { error: 'userId와 scenarioId는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    // Upsert: find existing record by userId + scenarioId
    const existing = await db.learningProgress.findFirst({
      where: { userId, scenarioId },
    })

    if (existing) {
      const updated = await db.learningProgress.update({
        where: { id: existing.id },
        data: {
          stepIndex: stepIndex !== undefined ? stepIndex : existing.stepIndex,
          completed: completed !== undefined ? completed : existing.completed,
          attempts: attempts !== undefined ? attempts : existing.attempts,
          bestTimeSec:
            bestTimeSec !== undefined
              ? bestTimeSec === null
                ? null
                : existing.bestTimeSec !== null
                  ? Math.min(existing.bestTimeSec, bestTimeSec)
                  : bestTimeSec
              : existing.bestTimeSec,
          stars:
            stars !== undefined
              ? Math.max(existing.stars, stars)
              : existing.stars,
        },
      })
      return NextResponse.json(updated)
    }

    // Create new if not found
    const created = await db.learningProgress.create({
      data: {
        userId,
        scenarioId,
        stepIndex: stepIndex ?? 0,
        completed: completed ?? false,
        attempts: attempts ?? 0,
        bestTimeSec: bestTimeSec ?? null,
        stars: stars ?? 0,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('학습 진행도 업데이트 오류:', error)
    return NextResponse.json(
      { error: '학습 진행도 업데이트 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
