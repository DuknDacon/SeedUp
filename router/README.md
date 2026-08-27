# SeedUp Router

**목적**: 기능①(BenefitUp-Agent, 정책·금융 매칭)과 기능②(Roadmap-Agent, 자산관리
로드맵)를 **한 대화**에서 자연스럽게 오갈 수 있게 하는 얇은 라우터 서비스.

## 원칙

- **BenefitUp-Agent 코드도, Roadmap-Agent 코드도 건드리지 않는다.**
  두 에이전트는 각자 자기 프로세스로 돌고, 라우터는 그 앞단에 HTTP로만 붙는다.
- 라우터는 native tool calling을 쓰지만, 그 툴은 딱 두 개 —
  `ask_policy_agent`, `ask_roadmap_agent`. 각 툴은 하위 에이전트의 HTTP
  엔드포인트를 호출할 뿐. 하위 에이전트의 내부 tool loop과는 레벨이 달라 충돌
  없음.
- 응답 스키마는 SeedUp 프론트의 `ChatBlock[]` 계약 그대로. 라우터는 하위
  에이전트가 준 블록을 **재요약하지 않고** relay만 한다.

## 대화 흐름

```
[사용자 turn]
    ↓
[라우터 에이전트]  ← Gemini Flash + 2 delegate tools
    ├── ask_policy_agent  ─ HTTP ─→ BenefitUp-Agent  (policy thread)
    └── ask_roadmap_agent ─ HTTP ─→ Roadmap-Agent    (roadmap thread)
    ↓
[블록들 그대로 프론트로]
```

- 매 turn 라우터가 다시 판단 → sticky delegation 없음 → 화제 전환 자연스러움.
- 한 turn에 둘 다 필요하면 툴 병렬 호출.
- 라우터 자신의 thread에 `policy_thread_id`, `roadmap_thread_id`를 들고 있어
  하위 에이전트가 자기 대화 이력을 유지할 수 있게 함.

## 실행

라우터는 시작 시 `SeedUp/.env.local` (또는 `.env`) 을 자동으로 읽는다 —
프론트와 **같은 파일 하나**로 환경변수를 공유. 따로 export 안 해도 됨.
하위 에이전트(BenefitUp-Agent, Roadmap-Agent) 의 크레덴셜은 각자 자기
레포의 `.env` 에서 관리하므로, 여기 SeedUp `.env.local` 에는
엔드포인트 URL 과 라우터 자체 LLM 키만 들어간다.

```bash
# 최초 1회
cp ../.env.example ../.env.local
# 그 파일에서 GOOGLE_API_KEY(라우터 자체 LLM), BENEFIT_API, ROADMAP_API 를 채운다.

cd SeedUp/router
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8030
```

하위 에이전트는 각 레포의 docker-compose 로 띄운다:

```bash
docker compose --parallel 1 -f docker-compose.benefit.yml up -d --build
docker compose -f ../Roadmap-Agent/docker-compose.roadmap.yml up -d
```

셸에 이미 `BENEFIT_API=...` 같은 값이 export 돼 있으면 그것이 우선 —
`.env.local` 은 비어 있는 값만 채우는 방식이라 개발자 개인 override 가 항상 이김.

## Roadmap-Agent 대화형 API — 이미 있음 (재발견)

처음엔 "Roadmap-Agent 에 `/api/chat` 이 없다" 로 알려졌으나, 실제로는
**같은 `POST /api/v1/roadmaps` 에 대화형이 얹혀 있음**:

- request 에 `threadId`(UUID) + `question` 추가 → thread 별 대화 상태 유지
- response 의 `chatReply` / `conversationStatus` / `conversationIntent`
  / `requestPatch` 로 자연어 응답과 조건 patch 반환
- 내부적으로 `RoadmapConversationGraph` + `SqliteConversationStore` 사용

따라서 `app/roadmap_client.py` 는 이 계약을 직접 부른다. Roadmap-Agent
자체 코드는 여전히 안 건드림.

## Slot-filling

Roadmap-Agent 는 매 요청마다 프로필 전량(`birthDate`, `monthlyBudget`,
`targetDate`, `householdSize`, region codes, …) 을 요구한다. BenefitUp
프로필만 있는 사용자는 이 중 일부가 없으므로:

- 유추 가능한 필드(`regionProvinceCode`, `regionDistrictCode`, `region`,
  `maritalStatus`, `employed`, income 필드)는 `_build_payload` 가 자동 파생
- 유추 불가능한 슬롯(`birthDate`, `monthlyBudget`, `targetDate`,
  `householdSize`)이 부족하면 API 를 부르지 않고 `profile_ask` 블록으로
  프론트에 반환 → 채팅 안 미니 폼으로 사용자에게 그 슬롯만 물어봄

## requestPatch 반영

로드맵 대화 도중 사용자가 조건 변경("월 70만원으로 바꿔줘") 을 요청하면
Roadmap-Agent 가 `requestPatch` 로 delta 를 돌려준다. 라우터는:

1. `RouterState.profile` 에 patch 병합 (다음 turn 부터 반영)
2. 응답의 `profilePatch` 필드로 프론트에 전달 (localStorage 동기화)
