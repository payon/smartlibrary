/**
 * 관리자 공용 히어로 배너 (텍스트-프리 그래픽)
 *
 * [배경]
 * - 기존 AI 생성 배너 PNG에 가짜 한자가 포함되어 있어 전부 제거
 * - 실제 한글 텍스트는 HTML로 렌더 (이미지 속 문자 없음)
 *
 * [기능]
 * - 섹션별 액센트 컬러 그라디언트 + 대형 반투명 아이콘 장식
 */

import type { LucideIcon } from 'lucide-react';

type HeroAccent = 'sky' | 'violet' | 'emerald' | 'teal' | 'amber' | 'rose' | 'slate';

const ACCENT_STYLES: Record<HeroAccent, { gradient: string; glow: string; icon: string }> = {
  sky: {
    gradient: 'linear-gradient(120deg, #0c1a2e 0%, #12325b 55%, #0e7490 100%)',
    glow: 'rgba(56, 189, 248, 0.25)',
    icon: 'text-sky-400/20',
  },
  violet: {
    gradient: 'linear-gradient(120deg, #150f2e 0%, #2e1a5e 55%, #5b21b6 100%)',
    glow: 'rgba(167, 139, 250, 0.25)',
    icon: 'text-violet-400/20',
  },
  emerald: {
    gradient: 'linear-gradient(120deg, #06231c 0%, #0b3d2e 55%, #047857 100%)',
    glow: 'rgba(52, 211, 153, 0.25)',
    icon: 'text-emerald-400/20',
  },
  teal: {
    gradient: 'linear-gradient(120deg, #04252b 0%, #0b3f47 55%, #0f766e 100%)',
    glow: 'rgba(45, 212, 191, 0.25)',
    icon: 'text-teal-400/20',
  },
  amber: {
    gradient: 'linear-gradient(120deg, #241304 0%, #4a2c0a 55%, #b45309 100%)',
    glow: 'rgba(251, 191, 36, 0.25)',
    icon: 'text-amber-400/20',
  },
  rose: {
    gradient: 'linear-gradient(120deg, #25060f 0%, #4c0f22 55%, #be123c 100%)',
    glow: 'rgba(251, 113, 133, 0.25)',
    icon: 'text-rose-400/20',
  },
  slate: {
    gradient: 'linear-gradient(120deg, #0b1120 0%, #1e293b 55%, #334155 100%)',
    glow: 'rgba(148, 163, 184, 0.25)',
    icon: 'text-slate-400/20',
  },
};

interface AdminHeroProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent?: HeroAccent;
}

export default function AdminHero({ icon: Icon, title, subtitle, accent = 'sky' }: AdminHeroProps) {
  const style = ACCENT_STYLES[accent];
  return (
    <div
      className="relative w-full h-[100px] rounded-xl overflow-hidden border border-slate-700 mb-2"
      style={{ background: style.gradient }}
    >
      {/* 장식 글로우 */}
      <div
        className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: style.glow }}
        aria-hidden="true"
      />
      {/* 대형 배경 아이콘 (장식) */}
      <Icon
        className={`absolute -right-2 -bottom-6 w-32 h-32 pointer-events-none ${style.icon}`}
        strokeWidth={1}
        aria-hidden="true"
      />
      {/* 실제 텍스트 (HTML 렌더 — 이미지 속 문자 없음) */}
      <div className="absolute inset-0 flex items-center px-6">
        <div>
          <p className="text-lg font-bold text-white">{title}</p>
          <p className="text-sm text-slate-300">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
