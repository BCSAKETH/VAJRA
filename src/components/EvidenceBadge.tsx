import React from "react";
import { ShieldCheck, Search, Scale, Sparkles } from "lucide-react";
import { useApp } from "../AppContext";

export type EvidenceTier =
  | "verified_record"
  | "investigative_lead"
  | "legal_reference"
  | "ai_summary";

interface EvidenceBadgeProps {
  tier: EvidenceTier;
  className?: string;
  showTooltip?: boolean;
}

const TIER_CONFIG: Record<
  EvidenceTier,
  {
    icon: React.FC<{ className?: string }>;
    emoji: string;
    labelEn: string;
    labelKn: string;
    descEn: string;
    descKn: string;
    classes: string;
  }
> = {
  verified_record: {
    icon: ShieldCheck,
    emoji: "🛡️",
    labelEn: "Verified Record",
    labelKn: "ದೃಢೀಕೃತ ದಾಖಲೆ",
    descEn: "Established provenance directly from official CCTNS dockets, arrest memos, or chargesheets.",
    descKn: "ಅಧಿಕೃತ CCTNS ದಾಖಲೆಗಳು ಅಥವಾ ಆರೋಪಪಟ್ಟಿಗಳಿಂದ ನೇರವಾಗಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ.",
    classes: "bg-emerald-500/15 border border-emerald-500/35 text-emerald-300",
  },
  investigative_lead: {
    icon: Search,
    emoji: "🔍",
    labelEn: "Investigative Lead",
    labelKn: "ತನಿಖಾ ಸುಳಿವು",
    descEn: "Algorithmically surfaced pattern or relational link requiring field verification.",
    descKn: "ಅಲ್ಗಾರಿದಮಿಕ್ ಮಾದರಿ ಅಥವಾ ಸುಳಿವು; ತನಿಖಾಧಿಕಾರಿಗಳಿಂದ ಸ್ಥಳ ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ.",
    classes: "bg-amber-500/15 border border-amber-500/35 text-amber-300",
  },
  legal_reference: {
    icon: Scale,
    emoji: "⚖️",
    labelEn: "Legal Reference",
    labelKn: "ಕಾನೂನು ಉಲ್ಲೇಖ",
    descEn: "Explicit statutory provision or procedural rule supported by BNS/BNSS/BSA 2023.",
    descKn: "BNS, BNSS, ಅಥವಾ BSA 2023 ನಿಬಂಧನೆಗಳಿಂದ ಬೆಂಬಲಿತವಾದ ಶಾಸನಬದ್ಧ ನಿಯಮ.",
    classes: "bg-purple-500/15 border border-purple-500/35 text-purple-300",
  },
  ai_summary: {
    icon: Sparkles,
    emoji: "🤖",
    labelEn: "AI-Generated Summary",
    labelKn: "AI ರಚಿತ ಸಾರಾಂಶ",
    descEn: "Automated synthesis generated from records. Does not inherit verified status.",
    descKn: "ದಾಖಲೆಗಳಿಂದ ರಚಿಸಲಾದ ಸ್ವಯಂಚಾಲಿತ ಸಾರಾಂಶ; ಇದು ಮೂಲ ದೃಢೀಕರಣವನ್ನು ಪಡೆಯುವುದಿಲ್ಲ.",
    classes: "bg-sky-500/15 border border-sky-500/35 text-sky-300",
  },
};

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  tier,
  className = "",
  showTooltip = true,
}) => {
  const { lang } = useApp();
  const config = TIER_CONFIG[tier] || TIER_CONFIG.investigative_lead;
  const Icon = config.icon;
  const label = lang === "en" ? config.labelEn : config.labelKn;
  const desc = lang === "en" ? config.descEn : config.descKn;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider select-none ${config.classes} ${className}`}
      title={showTooltip ? desc : undefined}
    >
      <span className="text-xs" aria-hidden="true">
        {config.emoji}
      </span>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

export default EvidenceBadge;
