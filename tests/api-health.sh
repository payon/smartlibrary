#!/bin/bash
# API 건전성 검사 (doc/harness.md 5.1)
set -u
BASE="${BASE_URL:-http://localhost:3000}"

echo "=== API Health Check ==="
echo -n "Server: "
curl -s "$BASE/api" | head -c 200; echo

echo -n "Books: "
curl -s "$BASE/api/books" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('books', d if isinstance(d,list) else [])))" 2>/dev/null || echo "check manually"

echo -n "PIN lookup rate-limit (expect 200 or 429, never PIN leak): "
curl -s "$BASE/api/users" -H "X-PIN: 1234" | head -c 200; echo

echo "=== Done (seed is admin-only; run via dashboard) ==="
