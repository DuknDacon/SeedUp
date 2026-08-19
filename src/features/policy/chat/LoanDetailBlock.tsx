/**
 * 특정 대출 상품 하나를 챗 안에서 더 자세히 보여줄 때(금리 옵션 등).
 * "이 중에 금리 제일 낮은 건?" 같은 후속 질문의 답으로 쓰인다.
 */
import Link from "next/link";
import type { LoanRateOption, Policy } from "@/types/api";
import { formatKrw, formatRateRange } from "@/lib/format";

export function LoanDetailBlock({
  item,
  rateOptions,
}: {
  item: Policy;
  rateOptions?: LoanRateOption[];
}) {
  return (
    <div className="mt-2 rounded-lg border bg-white p-3 max-w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href={`/policy/${item.id}`}
          className="font-medium text-sm text-slate-900 hover:text-brand-700"
        >
          {item.title} ›
        </Link>
        {item.operatingInstitution && (
          <span className="text-xs text-slate-500">
            {item.operatingInstitution}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-600">
        한도 {formatKrw(item.loanLimitKrw)} · 금리{" "}
        {formatRateRange(item.interestRateMin, item.interestRateMax)}
      </div>

      {rateOptions && rateOptions.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="text-slate-400">
                <th className="pr-3 py-1 font-medium">상환방식</th>
                <th className="pr-3 py-1 font-medium">금리유형</th>
                <th className="pr-3 py-1 font-medium">금리</th>
              </tr>
            </thead>
            <tbody>
              {rateOptions.map((r, i) => (
                <tr key={i} className="border-t text-slate-700">
                  <td className="pr-3 py-1">{r.repaymentMethod ?? "-"}</td>
                  <td className="pr-3 py-1">{r.rateType ?? "-"}</td>
                  <td className="pr-3 py-1">{formatRateRange(r.rateMin, r.rateMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
