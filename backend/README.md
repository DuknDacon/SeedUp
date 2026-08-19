# SeedUp backend

FastAPI adapter for the Feature 2 `Roadmap-Agent` package.

## Local setup

This backend shares one virtual environment with `Roadmap-Agent` instead of keeping
its own — `Roadmap-Agent` is installed into it as an editable package. The shared
venv lives one level above `SeedUp/` and `Roadmap-Agent/` (their common parent
folder). From the `SeedUp` repository root:

```bash
source ../.venv/bin/activate   # if it doesn't exist yet: python -m venv ../.venv
pip install -e ../Roadmap-Agent
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8001
```

Run the frontend in another terminal:

```bash
NEXT_PUBLIC_ROADMAP_API_URL=http://localhost:8001 npm run dev
```

- Health check: <http://localhost:8001/health>
- OpenAPI docs: <http://localhost:8001/docs>

The API always uses Roadmap-Agent's deterministic calculations. It uses local evidence by default.

At startup, the backend loads server-only settings from the adjacent `Roadmap-Agent/.env` and then `backend/.env`. Browser code never receives these values.

- Set the `POSTGRES_*` variables to use structured savings and policy repositories.
- Set `ENABLE_VECTOR_RAG=true` with PostgreSQL and `GEMINI_API_KEY` to use pgvector retrieval.
- Set `ENABLE_GEMINI=true` with `GEMINI_API_KEY` to generate the final explanation.

Keep both flags disabled during ordinary local UI development to avoid external API costs.

## Conversation session storage

Conversation state (LangGraph checkpoints keyed by `threadId`) is stored in a local SQLite
file so a session survives backend restarts, including `uvicorn --reload` picking up a code
change mid-test. Each thread is deleted automatically once it has been idle past its TTL — no
chat content is kept permanently.

- `CONVERSATION_STORE_PATH` (default: `backend/app/.data/conversations.sqlite`): file location.
- `CONVERSATION_TTL_SECONDS` (default: `1800`, 30 minutes): idle time before a thread's state is deleted.

The file (and its `-wal`/`-shm` companions) is git-ignored and safe to delete at any time —
doing so just resets every active conversation.
