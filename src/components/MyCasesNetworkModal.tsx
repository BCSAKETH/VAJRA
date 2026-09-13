import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { X, Network, Loader2, FolderOpen } from "lucide-react";
import { NetworkGraph } from "./NetworkGraph";

interface CaseNetworkSummary {
  investigation_title: string;
  session_id: string;
  case_no: string | null;
  network_preview: any;
}

interface MyCasesNetworkModalProps {
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

// F.28: "My Cases" combined network view -- ONE summary card per
// Investigation the officer owns/participates in, each rendering its own
// small, separate network graph. Loophole L1: these stay deliberately
// SEPARATE per-Investigation summaries, never merged into a single graph --
// merging networks across unrelated cases would fabricate connections that
// don't really exist between separate investigations.
export const MyCasesNetworkModal: React.FC<MyCasesNetworkModalProps> = ({ onClose, onSelectSession }) => {
  const { lang } = useApp();
  const [summaries, setSummaries] = useState<CaseNetworkSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/investigations/my-networks`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setSummaries(Array.isArray(j?.case_networks) ? j.case_networks : []);
      } catch {
        if (!cancelled) setError(lang === "en" ? "Could not reach the server." : "ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.");
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] glass-panel border border-[#C79A4E]/30 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Network className="w-4 h-4 text-[#C79A4E]" />
            {lang === "en" ? "My Cases — Combined Network View" : "ನನ್ನ ಪ್ರಕರಣಗಳು — ಸಂಯೋಜಿತ ಜಾಲ ನೋಟ"}
          </h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-stone-450 shrink-0">
          {lang === "en"
            ? "Every network already generated across your own open Investigations, one card per case -- never merged into a single graph."
            : "ನಿಮ್ಮ ಸ್ವಂತ ತೆರೆದ ತನಿಖೆಗಳಾದ್ಯಂತ ಈಗಾಗಲೇ ರಚಿಸಲಾದ ಪ್ರತಿ ಜಾಲ, ಪ್ರತಿ ಪ್ರಕರಣಕ್ಕೆ ಒಂದು ಕಾರ್ಡ್ -- ಎಂದಿಗೂ ಒಂದೇ ಗ್ರಾಫ್‌ಗೆ ವಿಲೀನಗೊಂಡಿಲ್ಲ."}
        </p>

        <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-lg text-[11px]">{error}</div>
          )}
          {!summaries && !error && (
            <div className="flex items-center justify-center py-16 text-stone-500 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> {lang === "en" ? "Loading your cases…" : "ನಿಮ್ಮ ಪ್ರಕರಣಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…"}
            </div>
          )}
          {summaries && summaries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-stone-550 gap-2 text-xs">
              <FolderOpen className="w-6 h-6" />
              {lang === "en"
                ? "No networks generated yet in any of your Investigations -- ask a network question inside one to get started."
                : "ನಿಮ್ಮ ಯಾವುದೇ ತನಿಖೆಗಳಲ್ಲಿ ಇನ್ನೂ ಯಾವುದೇ ಜಾಲ ರಚಿಸಲಾಗಿಲ್ಲ."}
            </div>
          )}
          {summaries && summaries.map((s) => {
            const net = s.network_preview?.nodes ? s.network_preview : s.network_preview?.network;
            return (
              <button
                key={s.session_id}
                onClick={() => { onSelectSession(s.session_id); onClose(); }}
                className="w-full text-left bg-stone-900/60 border border-stone-850 hover:border-[#C79A4E]/30 rounded-xl p-3.5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-black text-stone-200 truncate">{s.investigation_title}</span>
                  {s.case_no && <span className="text-[10px] font-mono text-stone-500 shrink-0">{s.case_no}</span>}
                </div>
                <div className="h-[160px] bg-stone-950/70 border border-stone-850 rounded-lg pointer-events-none">
                  <NetworkGraph nodes={net?.nodes || []} edges={net?.edges || []} height={160} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
