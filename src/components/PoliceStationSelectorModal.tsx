import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Building2, Check, ArrowDownAZ, ArrowDown10 } from "lucide-react";

interface StationRow {
  unit_id: number;
  unit_name: string;
  case_count: number;
}

interface PoliceStationSelectorModalProps {
  lang: "en" | "kn";
  districtName: string;
  stations: StationRow[];
  selectedStationId: number | null;
  isLoading?: boolean;
  onSelectStation: (unitId: number) => void;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Section 121: replaces the inline pill-cloud (unusable in dense
// commissionerates with 100+ stations -- it pushed every analytics card
// hundreds of pixels below the fold) with a searchable modal picker,
// following the app's own SettingsModal shell pattern -- including its
// Escape-to-close + focus-trap keydown handling (SettingsModal.tsx), which
// this modal is only ever mounted while "open" (the parent conditionally
// renders it), so the effect below runs once on mount, no isOpen gate.
export const PoliceStationSelectorModal: React.FC<PoliceStationSelectorModalProps> = ({
  lang,
  districtName,
  stations,
  selectedStationId,
  isLoading,
  onSelectStation,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"busiest" | "alpha">("busiest");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = (): HTMLElement[] => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      const nodeList: NodeListOf<HTMLElement> = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
      return Array.prototype.slice.call(nodeList).filter((el: HTMLElement) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    const raf = requestAnimationFrame(() => {
      const focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
      cancelAnimationFrame(raf);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? stations.filter((s) => s.unit_name.toLowerCase().includes(q)) : stations;
    const sorted = [...base];
    if (sortMode === "busiest") sorted.sort((a, b) => b.case_count - a.case_count);
    else sorted.sort((a, b) => a.unit_name.localeCompare(b.unit_name));
    return sorted;
  }, [stations, query, sortMode]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        className="relative z-[105] w-full max-w-3xl max-h-[85vh] bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#C79A4E]" />
            {districtName} — {lang === "en" ? "Select Police Station" : "ಪೊಲೀಸ್ ಠಾಣೆ ಆಯ್ಕೆಮಾಡಿ"}
            <span className="text-[10px] font-mono text-stone-500 normal-case">({stations.length})</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-200 hover:bg-stone-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "en" ? "Search stations…" : "ಠಾಣೆಗಳನ್ನು ಹುಡುಕಿ…"}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-stone-950/60 border border-stone-800 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C79A4E]/50"
            />
          </div>
          <div className="flex items-center bg-stone-950/60 border border-stone-800 rounded-lg p-0.5 text-[10px] font-mono shrink-0">
            <button
              onClick={() => setSortMode("busiest")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${sortMode === "busiest" ? "bg-[#C79A4E]/20 text-[#C79A4E] font-bold" : "text-stone-400 hover:text-stone-200"}`}
              title={lang === "en" ? "Busiest first" : "ಅತಿ ಜನನಿಬಿಡ ಮೊದಲು"}
            >
              <ArrowDown10 className="w-3 h-3" /> {lang === "en" ? "Busiest" : "ಜನನಿಬಿಡ"}
            </button>
            <button
              onClick={() => setSortMode("alpha")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${sortMode === "alpha" ? "bg-[#C79A4E]/20 text-[#C79A4E] font-bold" : "text-stone-400 hover:text-stone-200"}`}
              title={lang === "en" ? "A-Z" : "A-Z"}
            >
              <ArrowDownAZ className="w-3 h-3" /> A-Z
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="text-[11px] text-stone-500 font-mono py-6 text-center">{lang === "en" ? "Loading stations..." : "ಠಾಣೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ..."}</div>
          ) : filtered.length === 0 ? (
            <div className="text-[11px] text-stone-500 font-mono py-6 text-center">
              {lang === "en" ? "No stations match your search." : "ಯಾವುದೇ ಠಾಣೆ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((s) => {
                const isSelected = s.unit_id === selectedStationId;
                return (
                  <button
                    key={s.unit_id}
                    onClick={() => onSelectStation(s.unit_id)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "border-[#C79A4E]/60 bg-[#C79A4E]/10"
                        : "border-stone-800 bg-stone-950/40 hover:bg-stone-800 hover:border-[#C79A4E]/40"
                    }`}
                  >
                    <span className="text-[12px] font-semibold text-stone-200 truncate">{s.unit_name}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-800 text-[#E4C590]">{s.case_count}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#C79A4E]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
