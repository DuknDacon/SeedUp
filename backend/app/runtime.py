from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

import roadmap_agent
from roadmap_agent.config import load_env_file
from roadmap_agent.gemini import GeminiEmbeddingClient, GeminiRoadmapExplainer
from roadmap_agent.ports import PolicyRepository, RagRetriever, RoadmapExplainer, SavingsProductRepository
from roadmap_agent.repositories import (
    PostgresPolicyRepository,
    PostgresSavingsProductRepository,
    postgres_connection_factory_from_env,
)
from roadmap_agent.retrieval import FallbackRagRetriever, LocalRagRetriever, PostgresVectorRagRetriever


def _enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _load_server_environment() -> Path:
    agent_root = Path(roadmap_agent.__file__).resolve().parents[2]
    load_env_file(agent_root / ".env")
    load_env_file(Path(__file__).resolve().parents[1] / ".env")
    return agent_root


@dataclass(frozen=True)
class Runtime:
    policy_repository: PolicyRepository | None = None
    savings_repository: SavingsProductRepository | None = None
    retriever: RagRetriever | None = None
    explainer: RoadmapExplainer | None = None


@lru_cache(maxsize=1)
def get_runtime() -> Runtime:
    agent_root = _load_server_environment()
    factory = None
    policies = None
    savings = None
    retriever = None
    explainer = None

    if all(os.getenv(name) for name in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")):
        factory = postgres_connection_factory_from_env()
        policies = PostgresPolicyRepository(factory)
        savings = PostgresSavingsProductRepository(factory)

    if _enabled("ENABLE_VECTOR_RAG") and factory is not None:
        rag_root = agent_root / "data" / "rag"
        retriever = FallbackRagRetriever(
            PostgresVectorRagRetriever(factory, GeminiEmbeddingClient()),
            LocalRagRetriever(rag_root),
        )

    if _enabled("ENABLE_GEMINI"):
        explainer = GeminiRoadmapExplainer()

    return Runtime(
        policy_repository=policies,
        savings_repository=savings,
        retriever=retriever,
        explainer=explainer,
    )
