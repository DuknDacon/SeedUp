"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";

export default function GlossaryPage() {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const all = Object.entries(GLOSSARY).sort(([a], [b]) => a.localeCompare(b, "ko"));
    const keyword = query.trim();
    if (!keyword) return all;
    return all.filter(
      ([term, desc]) => term.includes(keyword) || desc.includes(keyword),
    );
  }, [query]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 break-keep">
        📖 금융 용어 사전
      </h1>
      <p className="text-sm text-slate-500 mb-6 break-keep">
        상담 결과에 자주 나오는 금융 용어를 미리 찾아볼 수 있어요.
      </p>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="용어 검색 (예: 비과세, ISA)"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">검색 결과가 없어요.</p>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {entries.map(([term, desc]) => (
            <div key={term} className="px-5 py-4">
              <div className="font-semibold text-sm text-slate-900 mb-1">{term}</div>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
