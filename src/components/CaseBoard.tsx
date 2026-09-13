import React, { useMemo } from "react";
import type { ChatMessage } from "../AppContext";

interface CaseBoardProps {
  messages: ChatMessage[];
  onJumpToMessage: (msgId: string) => void;
}

// §9.4 Loophole L4 (found during the cross-check pass that produced this
// blueprint): `detect_financial_ring` and the co-accused `query_graph_
// network` path both set responseType="network" (confirmed in agent_loop.py
// -- both branches emit the same string), so a board built by matching on
// responseType ALONE cannot tell a financial-ring graph apart from a
// co-accused graph -- one would silently collapse into (or overwrite) the
// other. The one field that genuinely differs is `financial_transactions`,
// present only on the financial-ring payload -- `match` below is a
// predicate per category (not a bare type-equality check) so this
// disambiguation is possible; every other category matches on responseType
// alone since it doesn't share this collision.
const BOARD_TYPES: {
  key: string;
  icon: string;
  label: string;
  match: (m: ChatMessage) => boolean;
}[] = [
  { key: "risk", icon: "\u{1F464}", label: "Suspect Risk", match: (m) => m.responseType === "risk" },
  { key: "network", icon: "\u{1F578}️", label: "Network", match: (m) => m.responseType === "network" && !(m as any).data?.financial_transactions },
  { key: "financial", icon: "\u{1F4B0}", label: "Financial Trail", match: (m) => m.responseType === "network" && !!(m as any).data?.financial_transactions },
  { key: "map", icon: "\u{1F4CD}", label: "Hotspots", match: (m) => m.responseType === "map" },
  { key: "trend", icon: "⚖️", label: "Trend / Sections", match: (m) => m.responseType === "trend" || m.responseType === "forecast" },
];

export const CaseBoard: React.FC<CaseBoardProps> = ({ messages, onJumpToMessage }) => {
  // Most-recent message of each board-worthy category, scanned client-side
  // from already-loaded data (Loophole L3: never a separate persisted board
  // state that can drift out of sync with the real chat history) -- capped
  // to ONE entry per category (Loophole L2: showing the latest only, not
  // every prior check, keeps this a quick-recall board, not clutter).
  const entries = useMemo(() => {
    return BOARD_TYPES.map((bt) => {
      const match = [...messages].reverse().find((m) => bt.match(m) && m.msgId);
      return match ? { ...bt, message: match } : null;
    }).filter(Boolean) as { key: string; icon: string; label: string; message: ChatMessage }[];
  }, [messages]);

  if (entries.length === 0) return null;

  return (
    <div className="border border-stone-850 rounded-xl p-3 mb-1 bg-stone-950/40 space-y-1.5">
      <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">Case Board</div>
      {entries.map((e) => (
        <button
          key={e.key}
          onClick={() => onJumpToMessage(e.message.msgId!)}
          className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-stone-900 text-stone-300 transition-colors cursor-pointer"
        >
          <span className="truncate">{e.icon} {e.label}</span>
          <span className="text-stone-600 shrink-0">&rarr;</span>
        </button>
      ))}
    </div>
  );
};
