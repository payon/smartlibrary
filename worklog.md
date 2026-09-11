---
Task ID: 1
Agent: Main
Task: 전체 백엔드 대시보드 구현

Work Log:
- 기존 doc/backend/*.md 파일 분석하여 구현 청사항 파악
- Prisma 스키마에 SystemHealth 모델 추가 (10개 테이블 총완성)
- DB 마이그레이션 성공 (bun run db:push)
- 시드 데이터 API 강화: 3개 관리자 계정 + 40개 CMS 콘텐츠 아이템 + 11개 키오스크 설정 생성
- AdminDashboard 재구축: 사이드바 네비게이션(7개 섹션) + 알림 드롭다운 + 반응형 레이아웃
- 누락된 API 라우트 6개 생성: content/[key], content/versions/[key], kiosk, media, auth/change-password, content/version
- 키오스크 콘텐츠 폴링 무한루프 버그 수정 (useCmsContent 훅)
- page.tsx 개선: 관리자 세션 복구 + CMS 폴링 활성화
- Lint 0 에러 확인
- 빌드 성공 확인
- API 엔드포인트 전면 검증 완료

Stage Summary:
- Prisma 스키마: 10개 테이블 (SimUser, Book, SimLoan, LearningProgress, Scenario, AdminUser, AdminSession, ContentItem, ContentVersion, AuditLog, KioskConfig, MediaAsset, Notification, SystemHealth)
- 시드 데이터: 관리자 3계정 (super_admin/admin/operator), CMS 콘텐츠 40개, 키오스크 설정 11개
- API 라우트: 42개 엔드포인트 구현 완료
- Admin UI: 7개 섹션 (개요/콘텐츠/도서/이용자/분석/설정/감사)
- 인증: JWT + bcrypt + RBAC (3역할 22권한)
- 콘텐츠 동기화: 30초 폴링 + 버전 비교
- 검증 결과: 로그인, 콘텐츠, 관리자 목록, 설정, 분석, 감사 로그 API 모두 200 응답
