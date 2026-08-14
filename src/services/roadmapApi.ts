import type { ApiError, RoadmapRequest, RoadmapResponse } from "@/types/api";

export async function createRoadmap(request: RoadmapRequest, question = ""): Promise<RoadmapResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_ROADMAP_API_URL ?? "http://localhost:8001";
  const response = await fetch(`${baseUrl}/api/v1/roadmaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, question }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(error?.message ?? "로드맵 서버에 연결하지 못했습니다.");
  }
  return response.json() as Promise<RoadmapResponse>;
}
