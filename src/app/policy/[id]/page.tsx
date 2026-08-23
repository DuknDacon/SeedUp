"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getPolicy } from "@/services/policyApi";
import {
  formatAgeRange,
  formatKrw,
  formatRateRange,
} from "@/lib/format";

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["policy", id],
    queryFn: () => getPolicy(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="py-8 text-slate-500">불러오는 중…</div>;
  if (isError || !data)
    return (
      <div className="py-8 text-red-600">
        정책 정보를 불러오지 못했어요.{" "}
        <Link href="/chat" className="underline">
          챗으로 돌아가기
        </Link>
      </div>
    );

  const p = data.policy;

  return (
    <article className="space-y-6 py-4">
      <div>
        <Link
          href="/chat"
          className="text-sm text-brand-700 hover:underline"
        >
          ← 대화로 돌아가기
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">{p.title}</h1>
        {p.categoryMajor && (
          <div className="mt-2 flex gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {p.categoryMajor}
            </span>
            {p.isAlwaysOpen && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                상시 접수
              </span>
            )}
          </div>
        )}
      </header>

      {p.summary && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">개요</h2>
          <p className="text-slate-800 leading-relaxed">{p.summary}</p>
        </section>
      )}

      <section className="rounded-xl border bg-brand-50 p-5">
        <h2 className="text-sm font-semibold text-brand-700 mb-2">
          ✨ 왜 매칭됐어요?
        </h2>
        <p className="text-slate-800">{p.matchReason}</p>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500 mb-3">
          지원 조건
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Row label="연령">
            {formatAgeRange(p.ageRange.min, p.ageRange.max)}
          </Row>
          <Row label="지역">
            {p.regionNames.length ? p.regionNames.join(", ") : "정보 없음"}
          </Row>
          <Row label="고용형태">
            {p.employmentTypes.length
              ? p.employmentTypes.join(", ")
              : "제한 없음"}
          </Row>
          <Row label="연소득 상한">{formatKrw(p.annualIncomeMaxKrw)}</Row>
          {p.itemType === "loan" && (
            <>
              <Row label="대출 한도">{formatKrw(p.loanLimitKrw)}</Row>
              <Row label="금리">
                {formatRateRange(p.interestRateMin, p.interestRateMax)}
              </Row>
              {p.repaymentMethod && (
                <Row label="상환 방법">{p.repaymentMethod}</Row>
              )}
            </>
          )}
          {p.applicationEndDate && (
            <Row label="접수 마감">{p.applicationEndDate}</Row>
          )}
        </dl>
      </section>

      {(p.operatingInstitution || p.supervisingInstitution) && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">기관</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {p.operatingInstitution && (
              <Row label="운영기관">{p.operatingInstitution}</Row>
            )}
            {p.supervisingInstitution && (
              <Row label="주관기관">{p.supervisingInstitution}</Row>
            )}
          </dl>
        </section>
      )}

      {p.description && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">
            상세 내용
          </h2>
          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
            {p.description}
          </p>
        </section>
      )}

      <div className="flex gap-3 pt-2">
        {p.applicationUrl && (
          <a
            href={p.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 text-center bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700"
          >
            신청하러 가기 →
          </a>
        )}
        <Link
          href="/chat"
          className="flex-1 py-3 text-center border border-brand-600 text-brand-700 font-semibold rounded-lg hover:bg-brand-50"
        >
          AI에게 더 묻기
        </Link>
      </div>
    </article>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}
