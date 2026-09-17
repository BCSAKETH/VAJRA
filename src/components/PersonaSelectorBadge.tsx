import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// Mirrors vajra_backend/ksp_response_tailor.py's KSPResponseStyle enum +
// STYLE_LABELS verbatim -- these 5 values are what the backend actually
// accepts as ChatRequest.persona_override; adding a 6th here without a
// matching backend entry would just silently fall through to
// auto-classification (predict_style ignores an unrecognized override).
const PERSONAS: { value: string; en: string; kn: string }[] = [
  { value: "EXECUTIVE_DISPATCH", en: "Executive Dispatch", kn: "ಕಾರ್ಯನಿರ್ವಾಹಕ ಸಂದೇಶ" },
  { value: "CCTNS_FORENSIC_LEDGER", en: "CCTNS Forensic Ledger", kn: "CCTNS ವಿಚಾರಣಾ ದಾಖಲೆ" },
  { value: "BNSS_STATUTORY_AUDIT", en: "BNSS Statutory Audit", kn: "BNSS ಶಾಸನಾತ್ಮಕ ಪರಿಶೋಧನೆ" },
  { value: "TACTICAL_FIELD_SOP", en: "Tactical Field SOP", kn: "ಕಾರ್ಯಾಚರಣೆ SOP" },
  { value: "CRIME_SYNDICATE_DOSSIER", en: "Crime Syndicate Dossier", kn: "ಅಪರಾಧ ಜಾಲ ದೋಶಿಯರ್" },
];

interface PersonaSelectorBadgeProps {
  lang: "en" | "kn";
  value: string | null;
  onChange: (persona: string | null) => void;
  // Section 145: a real auto-detected emergency trigger on the most recent
  // turn -- lights this badge up red/pulsing instead of its normal muted
  // style. Never set for the officer's own manual selection.
  emergencyActive?: boolean;
}

// Section 113-116: lets an officer pin a specific KSP response persona for
// their whole session instead of the default per-query auto-classification
// (ksp_response_tailor.py's KSPResponseTailor). "Auto" (value=null) is the
// default and matches existing behavior exactly.
export const PersonaSelectorBadge: React.FC<PersonaSelectorBadgeProps> = ({ lang, value, onChange, emergencyActive }) => {
  const [open, setOpen] = useState(false);
  const active = PERSONAS.find((p) => p.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
          emergencyActive
            ? "border-rose-500/60 bg-rose-500/15 text-rose-300 animate-pulse"
            : active
            ? "border-[#C79A4E]/50 bg-[#C79A4E]/10 text-[#C79A4E]"
            : "border-stone-800 bg-stone-900/60 text-stone-400 hover:bg-stone-800"
        }`}
        title={lang === "en" ? "Pin a KSP response persona (default: auto)" : "KSP ಪ್ರತಿಕ್ರಿಯೆ ವ್ಯಕ್ತಿತ್ವ (ಡೀಫಾಲ್ಟ್: ಸ್ವಯಂ)"}
      >
        <span className="truncate max-w-[110px]">
          {emergencyActive
            ? (lang === "en" ? "⚠ Emergency SOP" : "⚠ ತುರ್ತು SOP")
            : active
            ? (lang === "en" ? active.en : active.kn)
            : (lang === "en" ? "Persona: Auto" : "ವ್ಯಕ್ತಿತ್ವ: ಸ್ವಯಂ")}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-50 w-60 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl py-1.5">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center gap-2 ${!value ? "bg-stone-850/60" : ""}`}
            >
              <span className={`w-3.5 ${!value ? "text-[#C79A4E]" : "text-transparent"}`}><Check className="w-3.5 h-3.5" /></span>
              <span className="text-[12px] font-bold text-stone-200">{lang === "en" ? "Auto (per-query)" : "ಸ್ವಯಂ (ಪ್ರತಿ ಪ್ರಶ್ನೆ)"}</span>
            </button>
            <div className="border-t border-stone-800 my-1" />
            {PERSONAS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-center gap-2 ${value === p.value ? "bg-stone-850/60" : ""}`}
              >
                <span className={`w-3.5 ${value === p.value ? "text-[#C79A4E]" : "text-transparent"}`}><Check className="w-3.5 h-3.5" /></span>
                <span className="text-[12px] font-bold text-stone-200">{lang === "en" ? p.en : p.kn}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
