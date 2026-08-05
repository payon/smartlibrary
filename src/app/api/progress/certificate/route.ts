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

    const totalScenarios = await db.scenario.count()

    if (totalScenarios === 0) {
      return NextResponse.json({
        eligible: false,
        completedCount: 0,
        totalScenarios: 0,
        completionDate: null,
      })
    }

    const completedRecords = await db.learningProgress.findMany({
      where: { userId, completed: true },
      select: { scenarioId: true, updatedAt: true },
    })

    const completedScenarioIds = new Set(completedRecords.map((r) => r.scenarioId))
    const completedCount = completedScenarioIds.size

    // Check if the user has completed ALL scenarios
    const allScenarios = await db.scenario.findMany({
      select: { id: true },
    })
    const allCompleted = allScenarios.every((s) => completedScenarioIds.has(s.id))

    // Find the latest completion date
    let completionDate: string | null = null
    if (allCompleted && completedRecords.length > 0) {
      completionDate = completedRecords
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
        .updatedAt.toISOString()
    }

    return NextResponse.json({
      eligible: allCompleted,
      completedCount,
      totalScenarios,
      completionDate,
    })
  } catch (error) {
    console.error('수료증 확인 오류:', error)
    return NextResponse.json(
      { error: '수료증 확인 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
