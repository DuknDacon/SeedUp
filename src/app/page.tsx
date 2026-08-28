"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Landmark,
  MessageCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { MoneyTreeIllustration } from "@/components/landing/MoneyTreeIllustration";
import { FaqAccordion, type FaqItem } from "@/components/landing/FaqAccordion";
import { FloatingCta } from "@/components/landing/FloatingCta";

const PAIN_POINTS = [
  {
    title: "정보는 많은데, 내 조건에 맞는 건 못 찾겠다",
    desc: "청년도약계좌·청년미래적금 같은 정책 금융상품은 소득·나이·지역 조건이 복잡해서, 정작 내가 받을 수 있는 혜택을 놓치기 쉽습니다.",
  },
  {
    title: "저축과 투자, 뭐부터 시작해야 할지 모르겠다",
    desc: "시드머니를 모으기도 전에 무리한 투자를 하거나, 반대로 뭘 어떻게 배분해야 할지 몰라 그냥 미루게 됩니다.",
  },
];

const STEPS = [
  {
    icon: ScanSearch,
    title: "조건 몇 가지만 입력",
    desc: "나이·소득·지역·목표 저축액 같은 기본 조건만 한 번 알려주세요.",
  },
  {
    icon: Sparkles,
    title: "AI가 알아서 담당 판단",
    desc: "정책 매칭이 필요한 질문인지, 자산관리 로드맵이 필요한 질문인지 AI가 자동으로 구분해 답합니다.",
  },
  {
    icon: Landmark,
    title: "근거와 함께 결과 확인",
    desc: "공식 정책·금융 데이터에 기반한 추천과 출처를 함께 보여드려요.",
  },
];

const TRUST_ITEMS = [
  "상품 판매가 아닌, 정부 지원 정책 100% 활용에 초점을 맞춘 중립적 조력자",
  "공식 데이터·문서에 근거한 답변 — 출처를 함께 확인할 수 있습니다",
  "숫자(적금 만기액, 정책 혜택 등)는 계산 함수가 결정 — AI가 임의로 지어내지 않습니다",
  "특정 종목·펀드 매수를 추천하지 않는 참고용 정보 (투자자문 아님)",
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "로그인이 필요한가요?",
    a: "아니요. 로그인·회원가입 없이 바로 이용할 수 있습니다. 입력한 조건은 이 브라우저에만 임시로 저장돼요.",
  },
  {
    q: "제 정보는 저장되나요?",
    a: "대화 상태는 활동이 없으면 일정 시간 뒤 서버에서 자동으로 삭제됩니다. 언제든 채팅 화면의 '새 대화' 버튼으로 저장된 조건과 대화 내용을 즉시 초기화할 수도 있습니다.",
  },
  {
    q: "투자 조언을 해주나요?",
    a: "아니요. 자산군 비중을 참고용으로 제시할 뿐, 특정 종목·펀드 매수를 추천하지 않습니다. 실제 가입·투자 전에는 반드시 최신 약관과 공식 출처를 확인해 주세요.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-brand-100 to-sprout-100 blur-3xl opacity-70"
        />
        <div className="max-w-5xl mx-auto px-4 pt-16 pb-24 grid md:grid-cols-2 gap-10 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sprout-50 text-sprout-600 text-xs font-semibold mb-5">
              <Sparkles size={13} />
              사회초년생 맞춤 AI 비서
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900 mb-5 break-keep">
              사회초년생의 첫 시드머니, <span className="text-brand-600">AI</span>와
              함께 만드세요
            </h1>
            <p className="text-slate-600 text-base leading-relaxed mb-8 break-keep">
              나이·소득·지역·목표만 알려주면 정책 금융 매칭과 자산관리
              로드맵을 한 번에 챙겨주는 사회초년생 전용 AI 비서, SeedUp.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition"
              >
                <MessageCircle size={17} />
                AI 상담 시작하기
              </Link>
            </div>
          </Reveal>
          <Reveal direction="left" delay={0.15}>
            <MoneyTreeIllustration stage={0} className="w-full max-w-sm mx-auto" />
          </Reveal>
        </div>
        <motion.div
          className="flex justify-center pb-10 text-slate-400"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown size={22} />
        </motion.div>
      </section>

      {/* 문제 제기 */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="flex items-center justify-between gap-6 mb-10">
          <Reveal className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 break-keep">
              이런 고민, 있지 않으셨나요?
            </h2>
            <p className="text-slate-500 break-keep">
              사회초년생이 자산 형성을 시작할 때 가장 많이 부딪히는 문제입니다.
            </p>
          </Reveal>
          <Reveal direction="left" className="hidden sm:block flex-shrink-0">
            <MoneyTreeIllustration stage={1} className="w-28" />
          </Reveal>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {PAIN_POINTS.map((p, i) => (
            <Reveal key={p.title} direction={i === 0 ? "left" : "right"} delay={0.1}>
              <div className="h-full p-6 rounded-xl border border-slate-200 bg-white">
                <h3 className="font-semibold text-slate-900 mb-2 break-keep">
                  {p.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed break-keep">
                  {p.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 해결 방식 */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between gap-6 mb-10">
            <Reveal className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2 break-keep">
                SeedUp이 해결하는 방법
              </h2>
              <p className="text-slate-500 break-keep">
                통합 AI 상담 하나로 정책 매칭부터 자산관리 로드맵까지.
              </p>
            </Reveal>
            <Reveal direction="left" className="hidden sm:block flex-shrink-0">
              <MoneyTreeIllustration stage={2} className="w-32" />
            </Reveal>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.12}>
                <div className="p-6 rounded-xl bg-white border border-slate-200 h-full">
                  <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 grid place-items-center mb-4">
                    <s.icon size={20} />
                  </div>
                  <div className="text-xs font-semibold text-brand-600 mb-1">
                    STEP {i + 1}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 break-keep">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed break-keep">
                    {s.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 신뢰 요소 */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="flex items-center justify-between gap-6 mb-10">
          <Reveal className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2 break-keep">
              <ShieldCheck size={22} className="text-sprout-600 flex-shrink-0" />
              믿을 수 있는 이유
            </h2>
            <p className="text-slate-500 break-keep">
              상품 판매가 아니라, 사회초년생의 자산 형성을 돕는 중립적 조력자를 지향합니다.
            </p>
          </Reveal>
          <Reveal direction="left" className="hidden sm:block flex-shrink-0">
            <MoneyTreeIllustration stage={3} className="w-36" />
          </Reveal>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {TRUST_ITEMS.map((item, i) => (
            <Reveal key={item} delay={i * 0.08}>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-sprout-50/60 border border-sprout-100">
                <ShieldCheck
                  size={16}
                  className="text-sprout-600 mt-0.5 flex-shrink-0"
                />
                <p className="text-sm text-slate-700 leading-relaxed break-keep">
                  {item}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-4">
          <Reveal>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 break-keep">
              자주 묻는 질문
            </h2>
            <p className="text-slate-500 mb-10 break-keep">
              시작하기 전에 궁금할 만한 것들을 미리 정리했습니다.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <FaqAccordion items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Reveal className="flex justify-center">
          <MoneyTreeIllustration stage={4} className="w-44 mb-2" />
        </Reveal>
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 break-keep">
            지금 바로, 나만의 시드머니 로드맵을 만들어보세요
          </h2>
          <p className="text-slate-500 mb-8 break-keep">
            몇 가지 질문에 답하는 것만으로 시작할 수 있어요.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 transition"
          >
            <MessageCircle size={18} />
            AI 상담 진행하기
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10">
        <div className="max-w-5xl mx-auto px-4 text-xs text-slate-400 space-y-2 break-keep">
          <p>
            🌱 SeedUp은 참고용 정보를 제공하며, 투자자문업에 해당하는 서비스가
            아닙니다. 실제 가입·투자 전 최신 약관과 공식 출처를 반드시
            확인하세요.
          </p>
          <p>© SeedUp</p>
        </div>
      </footer>

      <FloatingCta />
    </>
  );
}
