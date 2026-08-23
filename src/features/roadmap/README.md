# features/roadmap — 기능② 자산관리 & 시드머니 로드맵

이 폴더는 **기능②(AI 자산관리 & 시드머니 로드맵)** UI 컴포넌트를 담기 위한 자리다.
현재는 다른 담당자가 개발 중이라 비어 있음.

---

## 담당자에게

### 이 폴더에 넣을 것
- 로드맵 관련 **화면 조각(컴포넌트)**만.
  - 예: `RoadmapChart.tsx`, `MonthlyPlanCard.tsx`, `GoalForm.tsx`
- 이 폴더 안의 컴포넌트는 **다른 features/ 폴더에 의존하지 말 것**.
  공통 부품이 필요하면 `src/lib/` 또는 새로 `src/features/roadmap/shared/` 를 만들어 사용.

### 이 폴더에 넣지 않을 것
- **페이지 라우팅** — `src/app/roadmap/page.tsx` 에 얇은 wrapper 만 두고,
  실제 UI 는 여기 컴포넌트를 import 해서 렌더링.
- **API 클라이언트** — `src/services/roadmapApi.ts` 로 분리.
- **계약 타입** — `src/types/api.ts` 에 추가 (프론트-백엔드 계약이므로 한 곳에 모음).
- **공통 유틸/훅** — `src/lib/` 로.

---

## 폴더 구조 관례 (기능①의 `features/policy/` 참고)

```
features/roadmap/
├── RoadmapChart.tsx           # 컴포넌트
├── GoalForm.tsx
├── MonthlyPlanCard.tsx
└── (선택) subFeature/         # 하위 기능이 커지면 서브폴더
    └── ...
```

계약 타입은 `src/types/api.ts` 에 아래처럼 추가하는 걸 권장:

```ts
// src/types/api.ts

export type RoadmapGoal = {
  targetKrw: number;
  targetDate: string;    // ISO date
  purpose: '주거' | '결혼' | '창업' | ...;
};

export type RoadmapPlan = {
  monthlyContributionKrw: number;
  milestones: RoadmapMilestone[];
  recommendedProducts: RecommendedProduct[];
};
// ... 등
```

그리고 API 클라이언트:

```ts
// src/services/roadmapApi.ts
export async function generateRoadmap(
  profile: UserProfile,
  goal: RoadmapGoal,
): Promise<RoadmapPlan> {
  // mock ↔ live 스위치는 policyApi.ts 를 참고
}
```

---

## 기능① 과의 연계

- **기능①의 프로필** (`src/types/api.ts` 의 `UserProfile`) 을 그대로 재사용할 것.
  → 두 기능이 같은 프로필로 동작하도록 유지.
- 기능①에서 **저장한 정책** 을 기능②의 로드맵 재료로 넘길 여지가 있음
  (예: "청년도약계좌를 로드맵에 넣기"). 향후 계약 타입에 반영 예정.

## 화면 통합: 이제 기능①/②는 별도 페이지가 아니라 하나의 챗 화면을 공유합니다

`/chat` (`components/chat/ChatWindow.tsx`) 하나가 두 기능의 유일한 진입점입니다.
더 이상 "프로필 입력 → 카드 리스트" 같은 원샷 화면은 없고, 모든 응답은
`ChatBlock[]` (`types/api.ts`) 로 와서 `components/chat/ChatBlockRenderer.tsx` 가
타입별로 렌더링합니다. 그래서 화제가 정책금융 ↔ 로드맵으로 넘어가도 같은 대화
안에서 자연스럽게 이어집니다.

**로드맵 담당자가 할 일은 이미 자리 잡아둔 스텁 2개를 채우는 것뿐입니다:**

1. `features/roadmap/RoadmapPlanBlock.tsx` — 지금은 "개발 중" placeholder.
   실제 로드맵 결과 UI로 교체하세요. (이 폴더의 다른 컴포넌트가 필요하면 여기 추가.)
2. `types/api.ts` 의 `RoadmapPlanPayload`(현재 `Record<string, unknown>` placeholder) 를
   실제 `RoadmapPlan` 타입으로 교체하고, `ChatBlock` 의
   `{ type: "roadmap_plan"; plan: RoadmapPlanPayload }` 도 그 타입을 쓰도록 갱신.

`ChatBlockRenderer` 는 이미 `RoadmapPlanBlock` 을 `roadmap_plan` 블록에 연결해뒀으므로,
그 외 챗 화면/전송 로직은 건드릴 필요가 없습니다. 반대로 로드맵 쪽 백엔드가
`ChatResponse{ threadId, blocks }` 계약(`services/chatApi.ts` 참고)만 지켜서
`roadmap_plan`/`text`/`suggested_replies` 블록을 응답에 섞어 주면, 프론트는
어느 기능이 답했는지 신경 쓸 필요가 없습니다.
