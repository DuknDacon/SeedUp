/**
 * 거주지 검색-선택 컴포넌트. 법정동 코드를 직접 외워 입력하는 대신, 시군구명을
 * 검색해서 고르면 지역명+코드가 한 번에 채워진다.
 * 데이터: src/data/regionCodes.json (Roadmap-Agent의 행정구역 참고자료 사본, 18개 시도·300개 시군구).
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import regionData from "@/data/regionCodes.json";

type RawDistrict = { code: string; name: string };
type RawProvince = { code: string; name: string; districts?: RawDistrict[] };

type RegionOption = {
  code: string;
  label: string; // "서울특별시 종로구"
};

const ALL_REGIONS: RegionOption[] = (regionData.regions as RawProvince[]).flatMap(
  (province) =>
    (province.districts ?? []).map((district) => ({
      code: district.code,
      label: `${province.name} ${district.name}`,
    })),
);

export function RegionSearchSelect({
  value,
  onSelect,
}: {
  /** 현재 선택된 지역명 (표시용) */
  value: string;
  onSelect: (region: { name: string; code: string }) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const keyword = query.trim().replace(/\s+/g, "").toLowerCase();
    if (!keyword) return ALL_REGIONS.slice(0, 8);
    return ALL_REGIONS.filter((r) =>
      r.label.replace(/\s+/g, "").toLowerCase().includes(keyword),
    ).slice(0, 8);
  }, [query]);

  function pick(option: RegionOption) {
    setQuery(option.label);
    setOpen(false);
    onSelect({ name: option.label, code: option.code });
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="예: 종로, 강남, 수원 팔달"
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {results.map((r) => (
            <li key={r.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-brand-50"
              >
                <MapPin size={13} className="text-brand-500 flex-shrink-0" />
                <span className="text-slate-700">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
