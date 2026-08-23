# SeedUp — 사회초년생 시드머니 빌드업 AI 비서

두 개 기능으로 구성됨.
- **① 정책 금융 매칭** — `../BenefitUp-Agent` 가 백엔드.
- **② AI 자산관리 로드맵** — `../Roadmap-Agent` 가 백엔드.

이 저장소(`SeedUp`)는 **두 기능의 공통 웹 프론트엔드 + 라우터**다.
두 하위 에이전트는 각자 레포에서 자기 Docker compose 로 뜨고,
SeedUp 은 그 앞단에 HTTP 로만 붙는다.

---

## 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **TanStack Query** — 서버 데이터·캐싱·로딩 상태
- **Tailwind CSS** — 유틸리티 스타일

---

## 실행

프론트 + 라우터만 로컬로 띄우고, 하위 두 에이전트는 각자 레포의 Docker
compose 로 띄운다.

```bash
# ① 하위 에이전트 백엔드 (각자 자기 .env 관리)
docker compose -f ../BenefitUp-Agent/docker-compose.benefit.yml up -d
docker compose -f ../Roadmap-Agent/docker-compose.roadmap.yml up -d

# ② SeedUp 라우터 (:8030) — 두 에이전트 앞단에서 delegate
cd router
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8030
cd ..

# ③ 프론트 (:3000)
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 의 `NEXT_PUBLIC_API_MODE=mock` 으로 두면 백엔드 없이도
UI 는 완전히 동작 (`services/mockData.ts`, `mockRoadmapData.ts` 사용).

---

## 폴더 구조

```
SeedUp/
├── src/
│   ├── app/                       # Next.js 라우팅 (얇은 페이지 wrapper 만)
│   │   ├── page.tsx               # 랜딩 (/)
│   │   ├── onboarding/            # 프로필 입력 (/onboarding)
│   │   ├── policy/                # 매칭 결과 (/policy) + 상세 (/policy/[id])
│   │   └── chat/                  # AI 상담 (/chat)
│   │
│   ├── features/
│   │   ├── policy/                # 기능① 정책 매칭 UI
│   │   │   ├── ProfileForm.tsx
│   │   │   ├── PolicyCard.tsx
│   │   │   ├── PolicyList.tsx
│   │   │   └── chat/              # 정책 상담 챗 (policy 응집)
│   │   │       └── ChatWindow.tsx
│   │   └── roadmap/               # 기능② 담당자 placeholder
│   │       └── README.md
│   │
│   ├── lib/                       # 공통 유틸 (features 간 공유)
│   │   ├── queryClient.tsx        # TanStack Query provider
│   │   ├── profileStorage.ts      # localStorage 저장 (인증 붙기 전 임시)
│   │   └── format.ts              # 표시용 포맷터
│   │
│   ├── services/                  # API 클라이언트 (mock↔live 스위치)
│   │   ├── policyApi.ts           # 매칭·상세 조회
│   │   ├── chatApi.ts             # 챗
│   │   └── mockData.ts            # BenefitUp-Agent 실제 DB 데이터
│   │
│   └── types/
│       └── api.ts                 # 프론트-백엔드 계약 타입
```

### 폴더 규칙

- **`app/`** — Next.js 가 강제하는 라우팅 폴더. 각 `page.tsx` 는 얇은 wrapper 로만
  두고 실제 UI는 `features/` 컴포넌트를 import 해서 렌더.
- **`features/<feature>/`** — 한 기능에만 속하는 UI 컴포넌트. **다른 feature 폴더에
  의존하지 말 것**.
- **`features/policy/chat/`** — 정책 상담용 챗 UI. 지금은 기능①에만 쓰이므로
  policy 하위에 응집. 향후 기능②에서도 챗 UI 가 필요해지면 `features/roadmap/chat/`
  으로 각자 두거나 `features/_chat/` 로 뽑는 걸 검토.
- **`lib/`** — feature 간 공유되는 유틸/훅/provider.
- **`services/`** — 두 기능이 모두 부르는 API 클라이언트. mock↔live 스위치 지점.
- **`types/api.ts`** — 프론트-백엔드 계약 타입. 두 기능의 모든 API 스키마가 여기 모임.

---

## 협업 가이드 (기능① ↔ 기능② 분업)

이 저장소는 **두 담당자가 한 프론트를 공유**한다. 각자 자기 영역만 건드리고
공통부(`lib/`, `services/`, `types/`)는 **합의 후에** 수정하는 게 원칙.

### 담당 구역 한눈에

| 폴더 | 기능① 정책 매칭 (김민중) | 기능② 자산관리 로드맵 (담당자) |
|---|---|---|
| `src/app/` | `page.tsx`, `onboarding/`, `policy/`, `chat/` | **`roadmap/` 라우트 추가** |
| `src/features/` | `policy/` (자유롭게 수정) | **`roadmap/` 아래 자유롭게 추가** |
| `src/lib/` | 공유 — 수정 시 서로 알리기 | 공유 — 수정 시 서로 알리기 |
| `src/services/` | `policyApi.ts`, `chatApi.ts` | **`roadmapApi.ts` 신규 추가** |
| `src/types/api.ts` | `UserProfile`, `PolicyMatch*` | **`Roadmap*` 타입 append** |

### 기능② 담당자가 시작하는 순서

1. **라우트 만들기** — `src/app/roadmap/page.tsx` 에 얇은 wrapper 하나.
   내용은 `features/roadmap/` 컴포넌트만 import.
   ```tsx
   // src/app/roadmap/page.tsx
   import { RoadmapView } from "@/features/roadmap/RoadmapView";
   export default function Page() { return <RoadmapView />; }
   ```
2. **UI는 전부 `src/features/roadmap/` 안에** — 컴포넌트 이름·구조는 자유.
   `features/policy/` 는 절대 import 하지 말 것 (반대 방향도 마찬가지).
   공통 UI가 필요하면 먼저 얘기 → `lib/` 로 승격.
3. **API 호출은 `src/services/roadmapApi.ts` 로 뽑기** — 컴포넌트에서 fetch
   직접 호출 금지. mock↔live 스위치를 `policyApi.ts` 와 동일한 패턴으로.
4. **응답 타입은 `src/types/api.ts` 하단에 append** — 파일을 새로 만들지 말고
   한 파일에 모아서 백엔드 담당자가 한 곳만 보면 되도록.
5. **사용자 프로필이 필요하면 `lib/profileStorage.ts` 재사용** — 온보딩에서 이미
   저장 중이라 로드맵도 같은 profile 을 읽으면 됨.

### 금지선 (merge conflict 예방)

- ❌ `features/policy/` ↔ `features/roadmap/` 서로 import 하지 않기
- ❌ 같은 파일을 양쪽에서 동시에 수정하지 않기 — `lib/`, `services/`, `types/api.ts`
  는 **PR 전에 슬랙에서 한 번 sync**
- ❌ `app/layout.tsx` 같은 전역 파일은 임의로 수정 금지 (같이 논의)

### 공유 지점 (여기서만 만난다)

```
                기능①                   기능②
                  │                       │
                  ▼                       ▼
        features/policy/          features/roadmap/
                  │                       │
                  └───────────┬───────────┘
                              ▼
                  lib/  ·  services/  ·  types/api.ts
                              │
                              ▼
                  BenefitUp-Agent (FastAPI, 예정)
```

---

## 아키텍처

```
[SeedUp 웹]                    [BenefitUp-Agent (FastAPI, 예정)]
──────────                      ─────────────────────────────
services/policyApi.ts  ──POST──►  /api/policy/match
                                  ↓ LangGraph 그래프 실행
                                  · RAG (search_policy_plan)
                                  · SQL 서브에이전트
                                  · LLM 재랭킹·근거 생성
services/chatApi.ts   ──POST──►  /api/chat  (thread_id 기반)
```

- 프론트는 **계약 타입(`src/types/api.ts`)만 알면 됨**. 백엔드 내부 구현이
  바뀌어도 응답 스키마만 유지되면 손댈 필요 없음.
- 계약 타입은 `../BenefitUp-Agent/docs/policy_match_schema.md` **§5(유저
  프로필)**, **§7.2(반환 필드)** 를 그대로 반영.

### mock ↔ live 스위치

`.env.local` 에서:

```
NEXT_PUBLIC_API_MODE=mock   # 기본, mockData.ts 사용
NEXT_PUBLIC_API_MODE=live   # BenefitUp-Agent FastAPI 호출
NEXT_PUBLIC_API_BASE=http://localhost:8010
```

live 로 스위치할 때 컴포넌트 코드는 **한 줄도 안 바뀜.** `services/*` 안의
fetch 분기만 사용됨.

---

## 백엔드(BenefitUp-Agent) 담당자에게 필요한 것

BenefitUp-Agent 는 지금 LangGraph CLI 챗봇이다. 웹에서 부르려면 얇은
FastAPI 래퍼가 필요:

- `POST /api/policy/match` — body: `{ profile: UserProfile, limit? }` →
  `PolicyMatchResponse`
- `GET  /api/policy/{id}` — `PolicyDetailResponse`
- `POST /api/chat` — body: `{ threadId, message, profile? }` → `ChatResponse`

각 응답 스키마는 `src/types/api.ts` 참고. **필드 이름·의미가 이 파일과
일치해야** 웹이 자동으로 붙는다.

---

## 다음 단계

- [ ] BenefitUp-Agent 에 FastAPI 래퍼 추가 (담당자: 김민중)
- [ ] 기능②(로드맵) UI 골격 추가 — 다른 담당자와 공통 컴포넌트 조율
- [ ] 로그인/인증 도입 → localStorage → 서버 프로필로 이관
- [ ] 지역 셀렉트 (법정동 코드를 사람이 읽는 지역명으로) UI 개선
- [ ] "저장한 정책" 기능 추가 (기능②의 로드맵 재료로 사용)
