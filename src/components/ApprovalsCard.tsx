import React from "react";
import { Clock, ChevronRight, ShieldCheck } from "lucide-react";

// Section 133's own occupancy invariant: this card is only ever mounted by
// the parent when isSupervisor && pendingCount > 0 (see AIChatScreen.tsx's
// Zone 3), so it never needs to render its own "0 pending" empty state.
// It deliberately shows only the REAL count from /api/officer/digest --
// not fabricated case numbers/officer names, since no item-level preview
// endpoint exists yet. "Open Approvals Desk" routes to the real Supervisor
// screen, where the actual per-item queue (SupervisorApprovalReviewModal)
// already lives.
interface ApprovalsCardProps {
  lang: "en" | "kn";
  pendingCount: number;
  onOpenApprovalsDesk: () => void;
}

export const ApprovalsCard: React.FC<ApprovalsCardProps> = ({ lang, pendingCount, onOpenApprovalsDesk }) => {
  return (
    <div className="glass-card border border-stone-850 rounded-2xl p-4 h-[250px] flex flex-col justify-between transition-all hover:border-stone-750">
      <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-200">
            {lang === "en" ? "Pending Approvals" : "ಬಾಕಿ ಅನುಮೋದನೆಗಳು"}
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
          {pendingCount} {lang === "en" ? "Pending" : "ಬಾಕಿ"}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenApprovalsDesk}
        className="flex-1 flex flex-col items-center justify-center text-center gap-2 cursor-pointer group"
      >
        <ShieldCheck className="w-7 h-7 text-amber-400/70 group-hover:text-amber-400 transition-colors" />
        <p className="text-xs text-stone-300">
          {lang === "en"
            ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting your sign-off`
            : `${pendingCount} ಮನವಿಗಳು ನಿಮ್ಮ ಸಹಿಗಾಗಿ ಬಾಕಿ`}
        </p>
        <span className="text-[11px] font-bold font-mono text-amber-400 flex items-center gap-1 group-hover:underline">
          {lang === "en" ? "Open Approvals Desk" : "ಅನುಮೋದನಾ ವಿಭಾಗ ತೆರೆಯಿರಿ"}
          <ChevronRight className="w-3 h-3" />
        </span>
      </button>

      <div className="pt-2 border-t border-stone-850/80 text-[9.5px] font-mono text-stone-500 text-center">
        {lang === "en" ? "Section 173 BNSS · POCSO Access · Inter-District Transfers" : "ಸೆಕ್ಷನ್ 173 BNSS ಪ್ರಕ್ರಿಯೆ"}
      </div>
    </div>
  );
};
