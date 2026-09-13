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
  // F.27: a financial-ring payload carrying at least one F.7-flagged
  // round-trip loop gets its own, more specific board entry -- checked
  // BEFORE the generic "financial" entry below (both share
  // responseType==="network" + financial_transactions, so order matters:
  // a loop-carrying message must win this slot, not just "Financial Trail").
  { key: "financial_loop", icon: "\u{1F501}", label: "Money Loop Flagged", match: (m) => m.responseType === "network" && !!(m as any).data?.financial_transactions && !!(m as any).data?.round_trip_loops?.length },
  { key: "financial", icon: "\u{1F4B0}", label: "Financial Trail", match: (m) => m.responseType === "network" && !!(m as any).data?.financial_transactions && !(m as any).data?.round_trip_loops?.length },
  { key: "map", icon: "\u{1F4CD}", label: "Hotspots", match: (m) => m.responseType === "map" },
  // F.27: responseType "crime_groups" is shared by TWO different tools
  // (agent_loop.py: `cluster_crime_patterns`'s MO-similarity clusters AND
  // `detect_crime_groups`'s Louvain syndicate detection both reuse the same
  // {groups:[{members,hub,shared_case_count,...}]} contract on purpose, per
  // that file's own comment) -- responseType alone can't tell them apart,
  // same collision class as the "network" one above. `threat_score` is only
  // ever attached by F.11 to a real cached Louvain run's groups, never to an
  // MO cluster or to detect_crime_groups' own un-scored 300-row fallback, so
  // it's the one field that safely means "an actual ranked syndicate
  // detection," not just "some group of co-accused."
  { key: "syndicate", icon: "\u{1F3F4}", label: "Syndicate Detected", match: (m) => m.responseType === "crime_groups" && (m as any).data?.groups?.[0]?.threat_score != null },
  // F.27: F.21's accuracy track record is a field nested inside the first
  // forecast entry, not its own responseType (agent_loop.py:
  // forecast_results[0].accuracy_track_record) -- checked before the
  // generic "trend"/"forecast" entry so a forecast WITH a track record wins
  // this more specific slot instead.
  { key: "forecast_accuracy", icon: "\u{1F4CA}", label: "Forecast Track Record", match: (m) => m.responseType === "forecast" && !!(m as any).data?.forecast?.[0]?.accuracy_track_record },
  { key: "trend", icon: "⚖️", label: "Trend / Sections", match: (m) => (m.responseType === "trend" || m.responseType === "forecast") && !(m as any).data?.forecast?.[0]?.accuracy_track_record },
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
