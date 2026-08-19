import type { ApiError, RoadmapRequest, RoadmapResponse } from "@/types/api";
import { buildMockRoadmapResponse } from "./mockRoadmapData";

const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock"; // "mock" | "live"

export async function createRoadmap(
  request: RoadmapRequest,
  question = "",
  threadId?: string,
): Promise<RoadmapResponse> {
  if (API_MODE !== "live") {
    await sleep(600); // 로딩 흉내
    return buildMockRoadmapResponse(request, question);
  }

  const baseUrl = process.env.NEXT_PUBLIC_ROADMAP_API_URL ?? "http://localhost:8001";
  const response = await fetch(`${baseUrl}/api/v1/roadmaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, question, threadId }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(error?.message ?? "로드맵 서버에 연결하지 못했습니다.");
  }
  return response.json() as Promise<RoadmapResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
