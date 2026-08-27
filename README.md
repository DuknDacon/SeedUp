# SeedUp — 사회초년생 시드머니 빌드업 AI 비서

두 개 기능으로 구성됨.
- **① 정책 금융 매칭** — `../BenefitUp-Agent` 가 백엔드.
- **② AI 자산관리 로드맵** — `../Roadmap-Agent` 가 백엔드.

이 저장소(`SeedUp`)는 **두 기능의 공통 웹 프론트엔드 + 라우터**다.
두 하위 에이전트는 각자 레포에서 자기 Docker compose 로 뜨고,
SeedUp 은 그 앞단에 HTTP 로만 붙는다.

---

## 🚀 전체 프로젝트 실행 방법

### 최초 실행 세팅 (처음 한 번만)

```bash
# 1) router 가상환경 생성
cd router
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 2) 하위 에이전트 Docker 컨테이너 빌드 & 기동
cd ~/BenefitUp-Agent
# app/api 두 서비스가 같은 이미지(benefitup-agent:latest)를 공유하므로
# 병렬 빌드 시 "already exists" 충돌이 남 — --parallel 1 로 순차 빌드
docker compose --parallel 1 -f docker-compose.benefit.yml up -d --build

cd ~/Roadmap-Agent
docker compose -f docker-compose.roadmap.yml up -d
```

### 실행 (매번)

```bash
# 백엔드 라우터 (:8030)
cd router && source .venv/bin/activate && uvicorn app.main:app --reload --port 8030

# 프론트 (:3000) — 새 터미널
npm run dev
```

### 로그 확인

```bash
docker logs -f roadmap-api
docker logs -f benefitup-api
```

---

## 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **TanStack Query** — 서버 데이터·캐싱·로딩 상태
- **Tailwind CSS** — 유틸리티 스타일

---

## 실행 (상세)

프론트 + 라우터만 로컬로 띄우고, 하위 두 에이전트는 각자 레포의 Docker
compose 로 띄운다.

```bash
# ① 하위 에이전트 백엔드 (각자 자기 .env 관리)
# BenefitUp-Agent 는 app/api 가 같은 이미지를 공유해서 --parallel 1 필요
docker compose -f ../BenefitUp-Agent/docker-compose.benefit.yml up -d --build --parallel 1
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
├── router/                        # 통합 라우터 (FastAPI, :8030) — 기능①·② delegate
│   └── app/
│       ├── main.py                 # POST /api/chat 진입점
│       ├── router_graph.py         # Gemini 툴 선택(ask_policy_agent/ask_roadmap_agent)
│       ├── policy_client.py        # BenefitUp-Agent /api/v2/policy HTTP 클라이언트
│       ├── roadmap_client.py       # Roadmap-Agent /api/v1/roadmaps HTTP 클라이언트
│       └── schemas.py              # ChatRequestIn/ChatResponseOut/UserProfileIn (wire 스키마)
│
├── src/
│   ├── app/                       # Next.js 라우팅 (얇은 페이지 wrapper 만)
│   │   ├── page.tsx               # 랜딩 (/)
│   │   ├── onboarding/            # 프로필 입력 (/onboarding)
│   │   ├── policy/[id]/           # 정책 상세 (/policy/[id])
│   │   ├── roadmap/               # 단독 로드맵 화면 (/roadmap) — 라우터 안 거침
│   │   └── chat/                  # 통합 AI 상담 (/chat) — 기능①·② 공용, 라우터 경유
│   │
│   ├── components/chat/           # 통합 /chat 전용 UI (기능①·② 공유)
│   │   ├── ChatWindow.tsx          # 대화 상태, 프로필 폼 게이트, 좌(대화)/우(결과) 레이아웃
│   │   ├── ChatBlockRenderer.tsx   # 블록 타입별로 features/policy·roadmap 컴포넌트에 위임
│   │   ├── IntegratedProfileForm.tsx  # 기능①·② 공통 최소 필드 입력 폼
│   │   └── ProfileAskForm.tsx      # profile_ask 블록용 추가 입력 미니 폼
│   │
│   ├── features/
│   │   ├── policy/                 # 기능① 정책 매칭 UI
│   │   │   ├── ProfileForm.tsx      # (레거시) 온보딩 단독 폼
│   │   │   ├── PolicyCard.tsx
│   │   │   └── chat/                # ChatBlockRenderer 가 위임하는 블록별 렌더러
│   │   │       ├── PolicyResultBlock.tsx
│   │   │       ├── LoanDetailBlock.tsx
│   │   │       ├── RecommendationsBlockView.tsx
│   │   │       └── SqlResultTable.tsx
│   │   └── roadmap/                # 기능② 자산관리 로드맵 UI
│   │       ├── RoadmapPlanBlock.tsx        # 로드맵 결과 카드 — 단독/통합 화면 공용
│   │       └── components/
│   │           └── RoadmapExperience.tsx   # 단독 /roadmap 페이지 전체 흐름(폼+챗)
│   │
│   ├── lib/                       # 공통 유틸 (features 간 공유)
│   │   ├── queryClient.tsx        # TanStack Query provider
│   │   ├── profileStorage.ts      # localStorage 저장 (인증 붙기 전 임시)
│   │   └── format.ts              # 표시용 포맷터
│   │
│   ├── services/                  # API 클라이언트 (mock↔live 스위치)
│   │   ├── policyApi.ts           # 정책 상세 조회 (BenefitUp-Agent 직결)
│   │   ├── chatApi.ts             # 통합 /chat — 라우터 POST /api/chat 호출
│   │   ├── roadmapApi.ts          # 단독 /roadmap — Roadmap-Agent 직결
│   │   ├── mockData.ts            # 기능① mock 데이터
│   │   └── mockRoadmapData.ts     # 기능② mock 데이터
│   │
│   └── types/
│       ├── api.ts                 # 프론트-백엔드 계약 타입 (수기 유지 + 재수출)
│       └── generated/
│           ├── backend.gen.ts     # BenefitUp-Agent OpenAPI → openapi-typescript (수정 금지)
│           └── roadmap.gen.ts     # Roadmap-Agent OpenAPI → openapi-typescript (수정 금지)
```

### 폴더 규칙

- **`app/`** — Next.js 가 강제하는 라우팅 폴더. 각 `page.tsx` 는 얇은 wrapper 로만
  두고 실제 UI는 `features/`·`components/` 컴포넌트를 import 해서 렌더.
- **`router/`** — 기능①·②를 오케스트레이션하는 별도 FastAPI 프로세스(:8030). Python
  이라 `src/`(Next.js)와는 별개로 자기 `.venv`를 쓴다.
- **`components/chat/`** — 통합 `/chat` 화면 전용, 기능①·②가 함께 쓰는 UI. 두 기능
  중 하나에만 속하지 않으므로 `features/` 밑에 두지 않았다.
- **`features/<feature>/`** — 한 기능에만 속하는 UI 컴포넌트. **다른 feature 폴더에
  직접 의존하지 말 것** — 공유가 필요하면 `components/chat/ChatBlockRenderer.tsx`처럼
  중립 레이어가 양쪽을 import한다.
- **`lib/`** — feature 간 공유되는 유틸/훅/provider.
- **`services/`** — API 클라이언트. mock↔live 스위치 지점. 기능②는 라우터 경유(`chatApi.ts`)와
  직결(`roadmapApi.ts`) 두 경로를 모두 가진다 (자세한 흐름은 아래 §아키텍처).
- **`types/api.ts`** — 프론트-백엔드 계약 타입. 백엔드가 이미 채우는 스키마
  (`UserProfileIn`, `ChatRequestIn/Out`, `RoadmapRequest/Response` 등)는
  `types/generated/{backend,roadmap}.gen.ts`에서 재수출하고, 아직 백엔드 엔드포인트가
  없는 것(`Policy`, `PolicyDetailResponse` 등)만 이 파일에서 손으로 유지한다. 백엔드
  스키마가 바뀌면 `npm run gen:api-types`(기능①) / `npm run gen:roadmap-api-types`(기능②)
  로 해당 생성 파일만 재생성하면 됨.

---

## 협업 가이드 (기능① ↔ 기능② 분업)

이 저장소는 **두 담당자가 한 프론트를 공유**한다. 각자 자기 영역만 건드리고
공통부(`lib/`, `services/`, `types/`)는 **합의 후에** 수정하는 게 원칙.

### 담당 구역 한눈에

| 폴더 | 기능① 정책 매칭 (김민중) | 기능② 자산관리 로드맵 (수빈) |
|---|---|---|
| `src/app/` | `page.tsx`, `onboarding/`, `policy/[id]/` | `roadmap/` |
| `src/app/chat/`, `src/components/chat/` | 공유 — 통합 상담 화면, 수정 시 서로 알리기 | 공유 — 통합 상담 화면, 수정 시 서로 알리기 |
| `src/features/` | `policy/` | `roadmap/` |
| `src/lib/` | 공유 — 수정 시 서로 알리기 | 공유 — 수정 시 서로 알리기 |
| `src/services/` | `policyApi.ts`, `chatApi.ts`(공유) | `roadmapApi.ts`, `mockRoadmapData.ts` |
| `src/types/api.ts` | `UserProfile`, `Policy*`, `ChatRequest/Response` | `Roadmap*` 타입 (`roadmap.gen.ts` 재수출) |
| `router/` | — (BenefitUp-Agent 클라이언트만) | — (Roadmap-Agent 클라이언트만) |

### 금지선 (merge conflict 예방)

- ❌ `features/policy/` ↔ `features/roadmap/` 서로 import 하지 않기 — 공유가
  필요하면 `components/chat/ChatBlockRenderer.tsx`처럼 중립 레이어를 거친다.
- ❌ 같은 파일을 양쪽에서 동시에 수정하지 않기 — `lib/`, `services/`, `types/api.ts`,
  `components/chat/`는 **PR 전에 슬랙에서 한 번 sync**
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
        components/chat/  ·  lib/  ·  services/  ·  types/api.ts
                              │
                              ▼
                       SeedUp/router (:8030)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         BenefitUp-Agent(:8010)   Roadmap-Agent(:8001)
```

---

## 아키텍처 / 실행 흐름

프론트에는 서로 독립된 두 진입점이 있다 — 기능②(로드맵)만 단독으로 쓰는
화면과, 기능①·②를 라우터로 통합한 화면.

```
① 단독 /roadmap 페이지          ② 통합 /chat 페이지
   (RoadmapExperience.tsx)         (components/chat/ChatWindow.tsx)
        │                                  │
        │ 직접 호출                         │ 라우터 경유
        ▼                                  ▼
Roadmap-Agent 백엔드 (:8001)      SeedUp/router (:8030)
                                          │
                                ┌─────────┴─────────┐
                                ▼                   ▼
                     BenefitUp-Agent(:8010)   Roadmap-Agent(:8001)
                     /api/v2/policy           /api/v1/roadmaps
```

- **① 단독 `/roadmap`** — `services/roadmapApi.ts`가 라우터를 거치지 않고
  Roadmap-Agent 백엔드에 바로 붙는다. 계약 타입은 `types/generated/roadmap.gen.ts`
  (Roadmap-Agent 자신의 OpenAPI에서 생성).
- **② 통합 `/chat`** — `services/chatApi.ts`가 라우터의 `POST /api/chat`
  하나만 호출한다. 라우터가 메시지를 보고 `ask_policy_agent`(기능①,
  BenefitUp-Agent `/api/v2/policy` 호출) 또는 `ask_roadmap_agent`(기능②,
  Roadmap-Agent `/api/v1/roadmaps` 호출) 중 하나를 골라 실행한 뒤, 결과를
  `ChatResponseOut { threadId, blocks[] }` 하나로 합쳐 돌려준다. 계약 타입은
  `types/generated/backend.gen.ts`(BenefitUp-Agent 자신의 OpenAPI에서 생성 —
  라우터는 `blocks`를 재해석 없이 그대로 통과시키므로, 블록 모양의 단일
  출처는 여전히 BenefitUp-Agent다).
- 프론트는 **계약 타입(`src/types/api.ts`)만 알면 됨**. 백엔드 내부 구현이
  바뀌어도 응답 스키마만 유지되면 손댈 필요 없음.

### mock ↔ live 스위치

`.env.local` 에서:

```
NEXT_PUBLIC_API_MODE=mock   # 기본, mockData.ts / mockRoadmapData.ts 사용
NEXT_PUBLIC_API_MODE=live   # 아래 두 URL로 실제 호출
NEXT_PUBLIC_API_BASE=http://localhost:8030          # 통합 /chat → 라우터
NEXT_PUBLIC_ROADMAP_API_URL=http://localhost:8001   # 단독 /roadmap → Roadmap-Agent 직결
```

live 로 스위치할 때 컴포넌트 코드는 **한 줄도 안 바뀜.** `services/*` 안의
fetch 분기만 사용됨.

---

## 백엔드(BenefitUp-Agent) 계약

BenefitUp-Agent 의 FastAPI 래퍼(`backend/api/app.py`)는 이미 붙어있고,
지금은 **단일 챗 엔드포인트로 통합**됐다. 예전 설계(`/api/policy/match`,
`/api/policy/{id}`, `/api/chat` 3분할)는 폐기.

- `GET  /health` — 헬스체크
- `POST /api/v2/policy` — body: `ChatRequestIn { threadId, message, profile? }`
  → `ChatResponseOut { threadId, blocks[] }`
  - 정책 매칭 결과도 이 엔드포인트가 챗 응답의 `sql_table` / `recommendations`
    블록으로 함께 내려준다. 별도 매칭용 엔드포인트는 없음.
  - "정책 상세(`/api/policy/{id}`)" 는 SQL 서브에이전트가 질문마다 다른
    컬럼을 SELECT 하는 구조라 안정적으로 만들 수 없어 백엔드에서 의도적으로
    제공하지 않는다 (`api/schemas.py` 상단 주석 참고).

### 블록 타입 (`ChatResponseOut.blocks[]`)

| type | 용도 |
|---|---|
| `text` | LLM 최종 답변 텍스트 |
| `sources` | 근거 URL 목록 |
| `sql_table` | SQL 서브에이전트가 실행한 SELECT 원시 결과 (개발 확인용) |
| `recommendations` | LLM 이 실제 언급한 row 만 URL 붙인 AI 추천 카드 |

프론트 쪽 `policy_results` / `loan_detail` / `suggested_replies` 블록은 아직
BenefitUp-Agent가 채워주지 않는 **placeholder** — `types/api.ts` 안에서 손으로
유지되고 있고, 언젠가 백엔드가 채우기 시작하면 지우고 generated 쪽에서
딸려오게 하면 됨.

`roadmap_plan`/`profile_ask`는 더 이상 placeholder가 아니다 — 라우터가
Roadmap-Agent(`/api/v1/roadmaps`)의 실제 응답을 그대로 실어보내는 블록(`plan`
필드의 타입은 `types/generated/roadmap.gen.ts`에서 온다)과, 필수 입력이 부족할
때 라우터가 직접 만들어 보내는 슬롯필링 폼이다.

### 스키마 동기화

각 스키마 필드 이름·의미는 BenefitUp-Agent 의 `api/schemas.py`(Pydantic 원본) 이
단일 출처(source of truth). 프론트가 붙이는 방식:

```bash
# 백엔드 띄운 상태
npm run gen:api-types
# 또는 백엔드 안 띄운 상태 (BenefitUp-Agent 에서 정적 openapi.json 뽑아둠)
BACKEND_OPENAPI_URL=../BenefitUp-Agent/backend/api/openapi.json npm run gen:api-types
```

→ `src/types/generated/backend.gen.ts` 가 갱신되고, `types/api.ts` 재수출이
자동으로 딸려간다. 그 시점에 컴포넌트 쪽에서 필드가 안 맞으면 `tsc`/`next build`
가 컴파일 타임에 에러로 잡아준다.
