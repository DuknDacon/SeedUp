/**
 * "씨앗 → 새싹 → 어린나무 → 무성한 나무 → 코인이 열리는 돈나무"로 이어지는
 * 성장 스토리 일러스트. 랜딩페이지 섹션마다 다른 `stage`를 넘겨 스크롤을
 * 따라 나무가 자라나는 것처럼 보이게 한다. 외부 이미지 자산 없이 SVG로 직접 그림.
 */
"use client";

import { motion } from "framer-motion";

export type TreeStage = 0 | 1 | 2 | 3 | 4;

// 단계별: 줄기 높이, 잎 클러스터 목록(cx, cy, r), 코인 목록(cx, cy, r)
const TRUNK_TOP: Record<TreeStage, number> = {
  0: 232,
  1: 200,
  2: 168,
  3: 140,
  4: 116,
};

const LEAVES: Record<TreeStage, { cx: number; cy: number; r: number }[]> = {
  0: [
    { cx: 172, cy: 228, r: 11 },
    { cx: 148, cy: 234, r: 8 },
  ],
  1: [
    { cx: 160, cy: 196, r: 20 },
    { cx: 138, cy: 208, r: 14 },
    { cx: 182, cy: 208, r: 14 },
  ],
  2: [
    { cx: 160, cy: 164, r: 30 },
    { cx: 124, cy: 182, r: 22 },
    { cx: 196, cy: 182, r: 22 },
    { cx: 160, cy: 132, r: 20 },
  ],
  3: [
    { cx: 160, cy: 136, r: 38 },
    { cx: 112, cy: 160, r: 28 },
    { cx: 208, cy: 160, r: 28 },
    { cx: 160, cy: 96, r: 26 },
    { cx: 130, cy: 108, r: 20 },
    { cx: 190, cy: 108, r: 20 },
  ],
  4: [
    { cx: 160, cy: 112, r: 44 },
    { cx: 100, cy: 140, r: 32 },
    { cx: 220, cy: 140, r: 32 },
    { cx: 160, cy: 66, r: 30 },
    { cx: 118, cy: 84, r: 24 },
    { cx: 202, cy: 84, r: 24 },
    { cx: 160, cy: 168, r: 26 },
  ],
};

const COINS: Record<TreeStage, { cx: number; cy: number; r: number }[]> = {
  0: [],
  1: [],
  2: [{ cx: 160, cy: 164, r: 10 }],
  3: [
    { cx: 122, cy: 156, r: 11 },
    { cx: 198, cy: 148, r: 11 },
    { cx: 160, cy: 108, r: 10 },
  ],
  4: [
    { cx: 108, cy: 132, r: 13 },
    { cx: 212, cy: 128, r: 13 },
    { cx: 160, cy: 60, r: 12 },
    { cx: 130, cy: 76, r: 11 },
    { cx: 196, cy: 168, r: 11 },
    { cx: 160, cy: 158, r: 11 },
  ],
};

export function MoneyTreeIllustration({
  stage,
  className,
}: {
  stage: TreeStage;
  className?: string;
}) {
  const trunkTop = TRUNK_TOP[stage];
  const leaves = LEAVES[stage];
  const coins = COINS[stage];

  return (
    <motion.svg
      viewBox="0 0 320 320"
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "200px 0px 200px 0px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <defs>
        <linearGradient id={`leafGradient-${stage}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id={`coinGradient-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* 배경 블러 blob */}
      <circle cx="160" cy="180" r="130" fill="#d1fae5" opacity="0.45" />
      <circle cx="235" cy="100" r="40" fill="#dbeafe" opacity="0.4" />

      {/* 흙/화분 */}
      <ellipse cx="160" cy="256" rx="70" ry="14" fill="#78350f" opacity="0.18" />
      <ellipse cx="160" cy="250" rx="46" ry="9" fill="#92400e" opacity="0.35" />

      {/* 줄기 */}
      <motion.path
        d={`M160 250 C160 ${trunkTop + 40} 160 ${trunkTop + 20} 160 ${trunkTop}`}
        stroke="#92400e"
        strokeWidth={stage <= 1 ? 5 : 9}
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "200px 0px 200px 0px" }}
        transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
      />

      {/* 잎 클러스터 — 단계가 오를수록 하나씩 늘어남 */}
      {leaves.map((leaf, i) => (
        <motion.circle
          key={`leaf-${i}`}
          cx={leaf.cx}
          cy={leaf.cy}
          r={leaf.r}
          fill={`url(#leafGradient-${stage})`}
          initial={{ opacity: 0, scale: 0.3 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "200px 0px 200px 0px" }}
          style={{ transformOrigin: `${leaf.cx}px ${leaf.cy}px` }}
          transition={{ duration: 0.45, delay: 0.4 + i * 0.08, ease: "easeOut" }}
        />
      ))}

      {/* 코인(열매) — 신뢰·최종 단계에서 등장 */}
      {coins.map((coin, i) => (
        <motion.g
          key={`coin-${i}`}
          initial={{ opacity: 0, y: -8, scale: 0.5 }}
          whileInView={{ opacity: 1, y: [-8, 0, -3, 0], scale: 1 }}
          viewport={{ once: true, margin: "200px 0px 200px 0px" }}
          transition={{
            opacity: { duration: 0.4, delay: 0.9 + i * 0.1 },
            scale: { duration: 0.4, delay: 0.9 + i * 0.1 },
            y: {
              duration: 2.6,
              delay: 1.2 + i * 0.15,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <circle cx={coin.cx} cy={coin.cy} r={coin.r} fill={`url(#coinGradient-${stage})`} />
          <text
            x={coin.cx}
            y={coin.cy + coin.r * 0.35}
            textAnchor="middle"
            fontSize={coin.r * 1.1}
            fontWeight="700"
            fill="#fffbeb"
          >
            ₩
          </text>
        </motion.g>
      ))}
    </motion.svg>
  );
}
