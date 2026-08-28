# features/roadmap — 기능② 자산관리 & 시드머니 로드맵

**기능②(AI 자산관리 & 시드머니 로드맵)** 관련 화면 컴포넌트를 담는 폴더. 더 이상 빈 스텁이
아니라 실제로 로드맵 결과를 렌더링하는 컴포넌트가 들어 있다.

---

## 현재 구성

```
features/roadmap/
└── RoadmapPlanBlock.tsx          # 로드맵 결과 카드(추천/대안, 배분, 근거, 경고 등) 렌더러
```

- **`RoadmapPlanBlock.tsx`** — `RoadmapResponse`(`types/api.ts`) 하나를 받아 추천/대안
  시나리오 카드, 배분 차트, 근거·경고 목록을 그린다. 통합 `/chat` 화면
  (`components/chat/ChatWindow.tsx`) 오른쪽 결과 패널에서 쓴다 —
  `components/chat/ChatBlockRenderer.tsx` 가 `roadmap_plan` 블록을 이 컴포넌트로 연결.

> 예전에는 조건 입력 폼부터 챗까지 포함한 단독 `/roadmap` 페이지(`RoadmapExperience.tsx`)가
> 따로 있었으나, Mixed Content 문제(HTTPS 프론트 → HTTP 백엔드 직접 호출 차단)와 통합
> 챗과의 중복 UX 때문에 2026-08-28 제거했다. 이제 로드맵은 통합 `/chat` 하나로만 제공한다.

## 계약 타입

`RoadmapRequest`/`RoadmapResponse`(`src/types/api.ts` §기능 2)는 아직 손으로 유지한다.
`package.json` 의 `gen:roadmap-api-types` 스크립트(`ROADMAP_OPENAPI_URL` 기준
`openapi-typescript` 실행 → `types/generated/roadmap.gen.ts`)는 `gen:api-types`(기능①,
`backend.gen.ts`)와 동일한 방식으로 자동 생성 전환하기 위해 추가해 둔 것이다. 실제
전환(수동 타입 제거 + `roadmap.gen.ts` 재수출)은 아직 하지 않았다 — Roadmap-Agent 백엔드가
로컬에서 떠 있을 때 한 번 실행해서 생성 결과를 확인한 뒤 진행할 것.

## 통합 챗(`/chat`)에서의 동작

`components/chat/ChatWindow.tsx` 가 두 기능의 유일한 진입점이다. 개인정보 입력 폼
제출 직후 자동으로 "입력한 조건으로 자산관리 로드맵을 만들어줘" 메시지를 보내
기능②를 호출하고, 응답의 `roadmap_plan` 블록을 오른쪽 패널에 이 폴더의
`RoadmapPlanBlock`으로 렌더링한다. 기능② 필수 입력이 부족하면 `profile_ask` 블록이
와서 같은 오른쪽 패널에 추가 입력 폼으로 뜬다.

라우터(`Roadmap-Agent` backend)의 기능①/② 분기 규칙 자체는 이 폴더 담당 범위가
아니다 — 정책을 깊게 묻는 질문이 들어왔을 때 기능①로 전환하는 라우팅은 기능① 담당자가
연결하기로 합의됨.
