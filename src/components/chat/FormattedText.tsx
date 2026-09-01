/**
 * 채팅 텍스트 응답을 좀 더 훑어보기 쉽게 렌더링.
 * AI 답변이 길어지면 "1. ~~~ 2. ~~~" 나열식 문장이 되기 쉬운데, 그걸 그냥
 * 한 덩어리 문단으로 보여주는 대신 번호/불릿 목록과 **강조** 표시를 실제
 * 리스트/볼드로 인식해서 구조를 살려 보여준다. 서버 응답 포맷을 바꾸지 않고
 * 프론트에서만 가볍게 파싱 — 새 마크다운 라이브러리 없이 정규식 기반.
 *
 * "- 상품명" + 두 칸 들여쓴 "  - 항목: 값" 형태로 오는 응답은 들여쓰기 depth를
 * 살려 부모(상품명)/자식(상세 항목) 중첩 리스트로 그려서, 전부 같은 레벨의
 * 불릿으로 뭉쳐 보이는 걸 방지한다. 상세 항목 값이 URL 그대로인 라인(예:
 * "상세링크: https://...")은 텍스트에 노출하지 않고 걸러낸다.
 */
import type { ReactNode } from "react";

const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET_RE = /^([ \t]*)[-•·]\s+(.*)$/;
// 라벨 없이 URL만, 또는 "라벨: https://..." 형태로 값이 URL 그대로인 라인.
const URL_ONLY_RE = /^(?:[^:：]*[:：]\s*)?(https?:\/\/\S+)\s*$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={`${keyPrefix}-${i}`}>{m[1]}</strong>;
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

type BulletItem = { text: string; children: string[] };

type Block =
  | { kind: "numbered"; items: string[] }
  | { kind: "bulleted"; items: BulletItem[] }
  | { kind: "paragraph"; lines: string[] };

function groupLines(rawLines: string[]): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (line === "") continue;
    const numbered = line.match(NUMBERED_RE);
    const bulleted = rawLine.match(BULLET_RE);
    const last = blocks[blocks.length - 1];
    if (numbered) {
      if (last?.kind === "numbered") last.items.push(numbered[2]);
      else blocks.push({ kind: "numbered", items: [numbered[2]] });
    } else if (bulleted) {
      const indent = bulleted[1].length;
      const content = bulleted[2];
      const bulletedBlock = last?.kind === "bulleted" ? last : undefined;
      // 들여쓰기가 있고 앞서 부모 항목이 있으면 자식 상세 항목으로 붙인다.
      if (indent > 0 && bulletedBlock && bulletedBlock.items.length > 0) {
        if (!URL_ONLY_RE.test(content)) {
          bulletedBlock.items[bulletedBlock.items.length - 1].children.push(content);
        }
        continue;
      }
      if (bulletedBlock) bulletedBlock.items.push({ text: content, children: [] });
      else blocks.push({ kind: "bulleted", items: [{ text: content, children: [] }] });
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
            <ul key={bi} className="list-disc list-inside space-y-2 marker:text-brand-600">
              {block.items.map((item, i) => (
                <li key={i}>
                  {renderInline(item.text, `${bi}-${i}`)}
                  {item.children.length > 0 && (
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-slate-600 marker:text-slate-400">
                      {item.children.map((child, ci) => (
                        <li key={ci}>{renderInline(child, `${bi}-${i}-${ci}`)}</li>
                      ))}
                    </ul>
                  )}
                </li>
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
