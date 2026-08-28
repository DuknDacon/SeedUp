"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로"
      className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-30 w-10 h-10 grid place-items-center rounded-full bg-white border border-slate-200 text-slate-600 shadow-md hover:bg-slate-50 transition"
    >
      <ArrowUp size={16} />
    </button>
  );
}
