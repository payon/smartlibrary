# Agent Configuration Document

## 스마트 도서관 무인 키오스크 시뮬레이터 — 에이전트 설정

---

## 1. 에이전트 개요

### 1.1 역할 정의

| 에이전트 | 역할 | 기술 |
|---|---|---|
| **개발 에이전트** | 코드 작성, 컴포넌트 개발, API 구현 | full-stack-developer, general-purpose |
| **탐색 에이전트** | 코드베이스 구조 파악, 파일 검색 | Explore |
| **설계 에이전트** | 구현 계획, 아키텍처 트레이드오프 | Plan |
| **스타일링 에이전트** | CSS, 반응형, 애니메이션, 레이아웃 | frontend-styling-expert |
| **브라우저 에이전트** | E2E 검증, 인터랙션 테스트 | agent-browser |

---

## 2. 워크플로우

### 2.1 개발 워크플로우

```
요청 수신
    │
    ▼
┌───────────────┐
│ 1. 요청 분석  │  ← 요구사항 파악, 스킬 매칭
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 2. 탐색       │  ← Explore 에이전트로 코드베이스 파악
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 3. 설계       │  ← Plan 에이전트로 구현 계획 수립
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 4. 프론트엔드 │  ← UI 컴포넌트 먼저 작성 (사용자 가시성)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 5. 백엔드     │  ← API Routes, DB 스키마 작성
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 6. 스타일링   │  ← frontend-styling-expert로 CSS/레이아웃 조정
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 7. 검증       │  ← Agent Browser로 E2E 검증
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 8. 수정       │  ← 오류 발견 시 4~7 반복
└───────┬───────┘
        │
        ▼
    완료
```

### 2.2 병렬 실행 전략

독립적인 작업은 병렬로 실행:

```
병렬 그룹 A:
  ├── Explore 에이전트 (코드베이스 파악)
  └── Plan 에이전트 (구현 계획)

병렬 그룹 B (A 완료 후):
  ├── 프론트엔드 컴포넌트 작성
  └── API Route 작성

병렬 그룹 C (B 완료 후):
  ├── 스타일링 조정
  └── E2E 검증
```

---

## 3. 작업 추적

### 3.1 Todo 시스템

```typescript
// TodoWrite로 작업 추적
interface Todo {
  id: string;           // "1", "2-a", "2-b", "3" (글로벌 순서 + 병렬 표시)
  content: string;      // 작업 설명
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}
```

### 3.2 상태 전환 규칙

```
pending → in_progress  (작업 시작 시)
in_progress → completed  (작업 완료 시)
in_progress → in_progress  (블로커 발생 시, 새 하위 작업 추가)
```

### 3.3 우선순위 기준

| 우선순위 | 기준 | 예시 |
|---|---|---|
| **high** | 화면 가시성, 코어 플로우 차단 | 대기 화면 미표시, 대출 불가 |
| **medium** | 기능 동작, 규칙 준수 | 2권 제한 미적용, 애니메이션 누락 |
| **low** | 미래 기능, 개선 사항 | TTS 안내, 시나리오 학습 |

---

## 4. 워크로그

### 4.1 워크로그 파일

```
경로: /home/z/my-project/worklog.md
```

### 4.2 워크로그 형식

```markdown
---
Task ID: <task id>
Agent: <agent name>
Task: <the task you were asked to do>

Work Log:
- <concrete step 1>
- <concrete step 2>
- ...

Stage Summary:
- <key results / important decisions / produced artifacts>
```

### 4.3 워크로그 활용

- 각 에이전트는 작업 시작 전 기존 워크로그 읽기
- 작업 완료 후 워크로그에 기록 추가 (append 모드)
- 기존 내용 덮어쓰기 금지

---

## 5. 스킬 활용 가이드

### 5.1 프로젝트에 적용 가능한 스킬

| 스킬 | 용도 | 호출 시점 |
|---|---|---|
| `agent-browser` | E2E 검증, 화면 렌더링 확인 | 코드 작성 완료 후 |
| `frontend-styling-expert` | CSS, 반응형, 애니메이션 | UI 컴포넌트 작성 시 |
| `image-generation` | 도서 표지 이미지 생성 | 시드 데이터 업데이트 시 |
| `image-search` | 도서 표지 이미지 검색 | Unsplash 대안 |
| `web-search` | ECO 키오스크 정보 검색 | 화면 설계 참조 |
| `VLM` | 화면 스크린샷 분석 | UI 검증 시 |

### 5.2 스킬 호출 프로세스

```
1. 스킬 필요성 판단
2. Skill(command="skill-name") 호출
3. 스킬 지침 숙지
4. 스킬 지침에 따라 구현
5. 결과 확인
```

---

## 6. 서브에이전트 지침

### 6.1 공통 지침 (모든 서브에이전트)

```
1. Task ID를 전달받아야 함
2. 시작 전 /home/z/my-project/worklog.md 읽기
3. 완료 후 worklog.md에 기록 추가
4. 절대 경로 사용 (/home/z/my-project/...)
5. 한국어 UI 텍스트 유지
6. MAX_LOAN_COUNT = 2 준수
7. ECO 화면 스타일 준수
```

### 6.2 개발 에이전트 추가 지침

```
1. 프론트엔드 먼저 작성 (사용자 가시성 우선)
2. 'use client' 지시문 필요 시 추가
3. dynamic(ssr: false) 유지
4. Zustand 스토어로 화면 전환
5. shadcn/ui 컴포넌트 우선 사용
6. API Route로 백엔드 구현
7. 보안 모듈 (security.ts) 적용
```

### 6.3 스타일링 에이전트 추가 지침

```
1. .kiosk-frame (480px) 프레임 유지
2. .kiosk-btn (56px) 버튼 규격 유지
3. 세로 화면 기준 설계
4. 시니어 가독성 (최소 18px) 준수
5. ECO 색상 팔레트 사용 (초록/주황)
6. framer-motion 애니메이션 사용
7. Tailwind CSS 4 문법 준수
```

### 6.4 브라우저 에이전트 추가 지침

```
1. / 경로에서 시작
2. 대기 화면 렌더링 확인
3. 코어 인터랙션 수행 (버튼 클릭, PIN 입력)
4. 화면 전환 동작 확인
5. 콘솔 오류 확인
6. dev.log 최신 로그 확인
7. 반응형 레이아웃 확인 (모바일/데스크톱)
8. 스티키 푸터 확인
```

---

## 7. 디버깅 가이드

### 7.1 일반 오류 대응

| 오류 | 원인 | 대응 |
|---|---|---|
| 하이드레이션 미스매치 | SSR/CSR 불일치 | `dynamic(ssr: false)` 확인 |
| API 캐싱 오류 | Service Worker | sw.js.disabled 확인 |
| OOM 크래시 | 메모리 부족 | swap 확인, Chrome 리소스 제한 |
| 화면 공백 | 임포트 오류 | 콘솔 오류, 컴포넌트 경로 확인 |
| API 404 | Route Handler 경로 | api/ 디렉토리 구조 확인 |
| PIN 인증 실패 | 시드 미실행 | /api/seed 호출 확인 |

### 7.2 로그 확인 순서

```
1. dev.log 최신 로그 읽기
2. 브라우저 콘솔 오류 확인
3. API 응답 상태 코드 확인
4. Zustand 스토어 상태 확인
5. Prisma 쿼리 로그 확인 (log: [] → log: ['query'] 변경)
```

### 7.3 메모리 관리

```bash
# 현재 메모리 상태
free -h

# swap 확인
swapon --show

# Next.js 프로세스 메모리
ps aux | grep next | awk '{sum += $6} END {print sum/1024 "MB"}'

# Chrome 프로세스 메모리
ps aux | grep chrome | awk '{sum += $6} END {print sum/1024 "MB"}'
```

---

## 8. 배포 체크리스트

### 8.1 릴리즈 전 확인

```markdown
□ bun run lint 통과
□ dev 서버 정상 실행 (port 3000)
□ /api 헬스체크 응답
□ 대기 화면 렌더링
□ 대출 플로우 E2E 통과
□ 반납 플로우 E2E 통과
□ 2권 제한 동작
□ 반응형 레이아웃 정상
□ 콘솔 오류 0건
□ dev.log 오류 0건
□ worklog.md 최신 상태
```

### 8.2 알려진 제약

```
1. Chrome 메모리 제한 (~4GB RAM, 64MB /dev/shm)
2. Service Worker 비활성화 (오프라인 미지원)
3. 단일 포트 (3000)만 외부 노출
4. 실제 RFID 하드웨어 없음 (시뮬레이션만)
5. 실제 도서 이미지 없음 (Unsplash URL 사용)
6. 한국어만 지원
```
