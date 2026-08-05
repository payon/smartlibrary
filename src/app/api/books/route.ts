import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim()

    if (query) {
      const books = await db.book.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { category: { contains: query } },
          ],
        },
        orderBy: { title: 'asc' },
      })
      return NextResponse.json(books)
    }

    const books = await db.book.findMany({
      orderBy: { title: 'asc' },
    })

    return NextResponse.json(books)
  } catch (error) {
    console.error('도서 검색 오류:', error)
    return NextResponse.json(
      { error: '도서를 검색하는 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
