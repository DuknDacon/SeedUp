/**
 * 채팅 텍스트 응답을 좀 더 훑어보기 쉽게 렌더링.
 * AI 답변이 길어지면 "1. ~~~ 2. ~~~" 나열식 문장이 되기 쉬운데, 그걸 그냥
 * 한 덩어리 문단으로 보여주는 대신 번호/불릿 목록과 **강조** 표시를 실제
 * 리스트/볼드로 인식해서 구조를 살려 보여준다. 서버 응답 포맷을 바꾸지 않고
 * 프론트에서만 가볍게 파싱 — 새 마크다운 라이브러리 없이 정규식 기반.
 */
import type { ReactNode } from "react";

const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET_RE = /^\s*[-•·]\s+(.*)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={`${keyPrefix}-${i}`}>{m[1]}</strong>;
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

type Block =
  | { kind: "numbered"; items: string[] }
  | { kind: "bulleted"; items: string[] }
  | { kind: "paragraph"; lines: string[] };

function groupLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;
    const numbered = line.match(NUMBERED_RE);
    const bulleted = line.match(BULLET_RE);
    const last = blocks[blocks.length - 1];
    if (numbered) {
      if (last?.kind === "numbered") last.items.push(numbered[2]);
      else blocks.push({ kind: "numbered", items: [numbered[2]] });
    } else if (bulleted) {
      if (last?.kind === "bulleted") last.items.push(bulleted[1]);
      else blocks.push({ kind: "bulleted", items: [bulleted[1]] });
    } else {
      if (last?.kind === "paragraph") last.lines.push(line);
      else blocks.push({ kind: "paragraph", lines: [line] });
    }
  }
  return blocks;
}

export function FormattedText({ text }: { text: string }) {
  const blocks = groupLines(text.split("\n"));

  // 목록으로 나뉠 만한 구조가 전혀 없으면(짧은 문장 등) 굳이 손대지 않고 그대로.
  const hasStructure = blocks.some((b) => b.kind !== "paragraph") && blocks.length > 1;
  if (!hasStructure) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed text-sm">
        {renderInline(text, "plain")}
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed space-y-2">
      {blocks.map((block, bi) => {
        if (block.kind === "numbered") {
          return (
            <ol key={bi} className="list-decimal list-inside space-y-1 marker:text-brand-600 marker:font-semibold">
              {block.items.map((item, i) => (
                <li key={i}>{renderInline(item, `${bi}-${i}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.kind === "bulleted") {
          return (
            <ul key={bi} className="list-disc list-inside space-y-1 marker:text-brand-600">
              {block.items.map((item, i) => (
                <li key={i}>{renderInline(item, `${bi}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {block.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {renderInline(line, `${bi}-${i}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
