import React, { useMemo } from "react";
import type { ChatMessage } from "../AppContext";

interface CaseChipStripProps {
  messages: ChatMessage[];
  onJumpToMessage: (msgId: string) => void;
}

// Same financial-vs-network disambiguation as CaseBoard.tsx (§9.4 Loophole
// L4) -- a financial-ring message and a co-accused network message both
// carry responseType="network", so the chip label is derived from
// `financial_transactions` presence, not printed straight from responseType
// (which would show "network" for both).
const chipLabel = (m: ChatMessage): string => {
  if (m.responseType === "network") {
    return (m as any).data?.financial_transactions ? "financial" : "network";
  }
  return m.responseType || "";
};

const CHIP_ICONS: Record<string, string> = {
  risk: "\u{1F464}",
  network: "\u{1F578}️",
  financial: "\u{1F4B0}",
  map: "\u{1F4CD}",
  trend: "⚖️",
  forecast: "⚖️",
};

export const CaseChipStrip: React.FC<CaseChipStripProps> = ({ messages, onJumpToMessage }) => {
  const chips = useMemo(
    () =>
      messages
        .filter((m) => m.msgId && ["risk", "network", "map", "trend", "forecast"].includes(m.responseType || ""))
        .slice(-4),
    [messages]
  );
  if (chips.length === 0) return null;
  return (
    <div className="flex gap-1.5 mb-1 overflow-x-auto">
      {chips.map((c) => {
        const label = chipLabel(c);
        return (
          <button
            key={c.msgId}
            onClick={() => onJumpToMessage(c.msgId!)}
            className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          >
            {CHIP_ICONS[label] || ""} {label}
          </button>
        );
      })}
    </div>
  );
};
