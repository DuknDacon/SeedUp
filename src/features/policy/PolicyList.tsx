/**
 * 저장된 프로필로 매칭 결과 리스트를 그리는 client 컴포넌트.
 * localStorage 는 client 에서만 접근 가능하므로 이 부분은 클라이언트 전용.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { matchPolicies } from "@/services/policyApi";
import { loadProfile } from "@/lib/profileStorage";
import type { UserProfile } from "@/types/api";
import { PolicyCard } from "./PolicyCard";

export function PolicyList() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  const query = useQuery({
    queryKey: ["policyMatch", profile],
    queryFn: () => matchPolicies({ profile: profile! }),
    enabled: !!profile,
  });

  if (!hydrated) return <Loading />;

  if (!profile) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-slate-600 mb-4">
          먼저 프로필을 입력해야 매칭이 가능합니다.
        </p>
        <Link
          href="/onboarding"
          className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg"
        >
          프로필 입력하러 가기 →
        </Link>
      </div>
    );
  }

  if (query.isLoading) return <Loading />;

  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        매칭 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  const policies = query.data?.policies ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          총 <b className="text-slate-900">{policies.length}</b>건 매칭
        </span>
        <Link href="/onboarding" className="text-brand-700 hover:underline">
          프로필 수정
        </Link>
      </div>
      {policies.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-center text-slate-500">
          조건에 맞는 정책을 찾지 못했어요. 프로필을 조정해 보세요.
        </div>
      ) : (
        policies.map((p) => <PolicyCard key={p.id} policy={p} />)
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border bg-white p-4 animate-pulse h-32"
        />
      ))}
    </div>
  );
}
