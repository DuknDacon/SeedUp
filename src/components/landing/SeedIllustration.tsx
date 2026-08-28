/**
 * 히어로용 인라인 SVG 일러스트 — "동전에서 자라나는 새싹"(시드머니 성장 모티프).
 * 외부 이미지 자산 없이 브랜드 컬러(파랑)+포인트 컬러(그린) 조합으로 직접 그림.
 */
"use client";

import { motion } from "framer-motion";

export function SeedIllustration({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 320 320"
      className={className}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <defs>
        <linearGradient id="coinGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="leafGradient" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {/* 배경 블러 blob */}
      <circle cx="160" cy="170" r="130" fill="#dbeafe" opacity="0.5" />
      <circle cx="230" cy="90" r="46" fill="#d1fae5" opacity="0.6" />

      {/* 줄기 */}
      <motion.path
        d="M160 210 C160 170 160 150 160 130"
        stroke="url(#leafGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
      />

      {/* 새싹 잎 2장 */}
      <motion.path
        d="M160 150 C130 145 112 122 118 96 C146 100 162 122 160 150 Z"
        fill="url(#leafGradient)"
        initial={{ opacity: 0, scale: 0.4, x: 8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        style={{ transformOrigin: "160px 150px" }}
        transition={{ duration: 0.5, delay: 1.0, ease: "easeOut" }}
      />
      <motion.path
        d="M160 138 C190 130 210 105 202 80 C172 87 158 111 160 138 Z"
        fill="url(#leafGradient)"
        initial={{ opacity: 0, scale: 0.4, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        style={{ transformOrigin: "160px 138px" }}
        transition={{ duration: 0.5, delay: 1.2, ease: "easeOut" }}
      />

      {/* 동전(시드머니) */}
      <motion.g
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      >
        <ellipse cx="160" cy="222" rx="88" ry="22" fill="#1e3a8a" opacity="0.12" />
        <circle cx="160" cy="212" r="62" fill="url(#coinGradient)" />
        <circle
          cx="160"
          cy="212"
          r="46"
          fill="none"
          stroke="#eff6ff"
          strokeOpacity="0.55"
          strokeWidth="3"
        />
        <text
          x="160"
          y="224"
          textAnchor="middle"
          fontSize="34"
          fontWeight="700"
          fill="#eff6ff"
        >
          ₩
        </text>
      </motion.g>

      {/* 떠 있는 작은 동전들 — "자산이 불어남" 표현 */}
      <motion.circle
        cx="76"
        cy="150"
        r="12"
        fill="#3b82f6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.85, y: [10, -4, 10] }}
        transition={{ duration: 3.4, delay: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="252"
        cy="188"
        r="9"
        fill="#10b981"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.85, y: [10, -6, 10] }}
        transition={{ duration: 2.8, delay: 1.7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="242"
        cy="260"
        r="7"
        fill="#3b82f6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.7, y: [10, -3, 10] }}
        transition={{ duration: 3.1, delay: 2.0, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.svg>
  );
}
