import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 임시 브랜드 팔레트 — 나중에 디자인 확정되면 바꾸면 됨
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // "성장(새싹)" 모티프의 보조 포인트 컬러 — 랜딩페이지에서 brand(파랑)와 함께 사용.
        sprout: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
        },
      },
    },
  },
  plugins: [],
};

export default config;
