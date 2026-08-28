"use client";

import { useState } from "react";
import { splitByGlossaryTerms, GLOSSARY } from "@/lib/glossary";

/** 텍스트 안의 금융 용어를 점선 밑줄로 표시하고, 탭/클릭하면 짧은 설명을 보여준다. */
export function TextWithGlossary({ text }: { text: string }) {
  const parts = splitByGlossaryTerms(text);
  return (
    <>
      {parts.map((part, i) =>
        part.term ? (
          <TermSpan key={i} term={part.term} />
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function TermSpan({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="underline decoration-dotted decoration-brand-400 underline-offset-2 text-inherit"
      >
        {term}
      </button>
      {open && (
        <span className="absolute z-20 left-0 top-full mt-1 w-56 rounded-md bg-slate-800 text-white text-[11px] leading-relaxed px-2.5 py-2 shadow-lg">
          {GLOSSARY[term]}
        </span>
      )}
    </span>
  );
}
