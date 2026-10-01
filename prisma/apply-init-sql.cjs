// PostgreSQL 초기 스키마 적용 스크립트 (Prisma CLI 불필요)
// - prisma/pg-init.sql (migrate diff from-empty 결과)을 순서대로 실행
// - "Book" 테이블 존재 시 스킵 (멱등)
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const db = new PrismaClient();
  try {
    const check = await db.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Book' LIMIT 1`
    );
    if (Array.isArray(check) && check.length > 0) {
      console.log('[pg-init] schema already applied, skipping');
      return;
    }
    const sqlFile = path.join(__dirname, 'pg-init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^(--[^\n]*\n)+/, '').trim())
      .filter((s) => s.length > 0);
    console.log(`[pg-init] applying ${statements.length} statements...`);
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
    }
    console.log('[pg-init] schema applied successfully');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('[pg-init] FAILED:', err.message || err);
  process.exit(1);
});
