---
Task ID: 5
Agent: API Route Agent
Task: Create/fix missing API routes for admin dashboard

Work Log:
- Read worklog.md and all existing API route patterns (auth login, content CRUD, admin-auth, audit-logger, content-cache, security)
- Read Prisma schema to understand all DB models (AdminUser, AdminSession, ContentItem, ContentVersion, AuditLog, KioskConfig, MediaAsset, Notification, SystemHealth)
- Checked all existing API route files (29 total)
- Read and verified existing routes: settings, notifications, audit, users, users/[id], books, books/[id] - all correct and follow standard auth pattern

Created 6 new API route files:
1. `/api/admin/content/[key]/route.ts` - GET single content by key (with 5 recent versions), PUT update content by key (with versioning + cache invalidation + audit)
2. `/api/admin/content/versions/[key]/route.ts` - GET version history for a content item (paginated)
3. `/api/admin/kiosk/route.ts` - GET health check (active users, loans, books, content, sessions, system metrics), POST reset kiosk (cache invalidation, expired session cleanup, optional full reset)
4. `/api/admin/media/route.ts` - GET list media (paginated, filterable by mimeType), POST upload media (FormData, file validation, MIME type check, size limit 10MB, local file storage + DB metadata)
5. `/api/admin/auth/change-password/route.ts` - POST change password (current password verification, new password validation, rate limiting 5 per 5min, audit logging)
6. `/api/content/version/route.ts` - GET content version number (public, no auth, for kiosk 30s polling)

Modified 1 existing route file:
1. `/api/admin/settings/route.ts` - Added `grouped` field to GET response (configs grouped by category), kept flat `configs` list for backward compatibility

All routes follow standard auth pattern:
- `export const dynamic = 'force-dynamic'`
- Cookie-based token auth (admin_token)
- verifyToken + hasPermission checks
- Audit logging for mutations
- Korean error messages

Lint: 0 errors
