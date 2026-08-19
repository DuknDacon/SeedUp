/**
 * SQL 서브에이전트가 실제로 실행한 SELECT 의 원시 결과를 보여주는 범용 테이블.
 *
 * policy_results(PolicyResultBlock)는 Policy 타입으로 정규화 가능한 표준 조회에만
 * 쓸 수 있고, 그 외 임의의 SELECT(컬럼 조합이 질문마다 달라짐)는 이 컴포넌트가
 * "table/columns/rows"라는 고정 봉투 스키마로 대신 보여준다 — 카드는 아니지만
 * 대화 중간에 자연스럽게 끼워지는 정해진 스키마 표시.
 */
export function SqlResultTable({
  tables,
  columns,
  rows,
  rowCount,
}: {
  tables: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}) {
  if (rowCount === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        조회 결과 없음{tables.length > 0 ? ` (${tables.join(", ")})` : ""}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-white overflow-hidden max-w-full">
      <div className="px-3 py-1.5 bg-slate-50 border-b text-xs font-medium text-slate-500">
        🗄️ DB 조회 결과 {rowCount}건{tables.length > 0 ? ` · ${tables.join(", ")}` : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] text-left whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 bg-slate-50">
              {columns.map((c) => (
                <th key={c} className="px-3 py-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t text-slate-700">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5">
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "-";
  return String(v);
}
