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

```bash
cd SeedUp/router
pip install -r requirements.txt
BENEFIT_API=http://localhost:8010 \
ROADMAP_API=http://localhost:8020 \
GOOGLE_API_KEY=... \
uvicorn app.main:app --reload --port 8030
```

프론트 `.env.local`:

```
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE=http://localhost:8030
```

## 확정 필요 (Roadmap-Agent 담당자와)

라우터의 `ask_roadmap_agent` 툴이 부를 엔드포인트가 필요합니다.
현재 Roadmap-Agent는 `POST /api/v1/roadmaps` 만 있고 대화형 엔드포인트가
없습니다. `app/roadmap_client.py`의 `TODO(roadmap-api)` 위치를 담당자와
합의된 계약으로 채워주세요.
