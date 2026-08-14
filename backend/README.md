# SeedUp backend

FastAPI adapter for the Feature 2 `Roadmap-Agent` package.

## Local setup

From the `SeedUp` repository root:

```bash
python -m venv backend/.venv
source backend/.venv/bin/activate
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
