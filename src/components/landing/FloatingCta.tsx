"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

/** 히어로를 스크롤로 지나치면 나타나는 하단 고정 CTA — 랜딩 어디서든 상담 시작 가능하게. */
export function FloatingCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30"
        >
          <Link
            href="/chat"
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-600 text-white text-sm font-semibold shadow-lg shadow-brand-600/30 hover:bg-brand-700 transition"
          >
            <MessageCircle size={16} />
            AI 상담 시작하기
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
