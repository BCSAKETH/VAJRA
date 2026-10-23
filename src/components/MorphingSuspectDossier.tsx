import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldAlert, 
  X, 
  Fingerprint, 
  AlertTriangle, 
  Crosshair, 
  Zap, 
  ChevronRight, 
  FileText,
  Lock,
  Unlock,
  Radio
} from "lucide-react";

export interface MorphingSuspectDossierProps {
  id: string;
  name: string;
  riskTier?: string;
  psotiScore?: number;
  alias?: string;
  modusOperandi?: string;
  weaponPreference?: string;
  syndicate?: string;
  biometricToken?: string;
  lastKnownLocation?: string;
  onSelectRefinement?: (query: string) => void;
  lang?: "en" | "kn";
}

/**
 * MorphingSuspectDossier (VAJRA 3.0 Fluid Animations & layoutId Morphing)
 * Uses Framer Motion / Motion layoutId to seamlessly morph an inline chat chip
 * into a high-fidelity Obsidian Tactical Dossier Card without layout jumps
 * or scroll disruption.
 */
export const MorphingSuspectDossier: React.FC<MorphingSuspectDossierProps> = ({
  id,
  name,
  riskTier = "TIER 1 SEVERE",
  psotiScore = 94,
  alias,
  modusOperandi,
  weaponPreference,
  syndicate,
  biometricToken,
  lastKnownLocation,
  onSelectRefinement,
  lang = "en",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [breakGlassWarrant, setBreakGlassWarrant] = useState(false);

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Fallback defaults matching tactical Master Plan specs if omitted
  const safeId = id || name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const displayToken = biometricToken || `#BIO-${safeId.slice(0, 4).toUpperCase()}-KA`;
  const displayAlias = alias || (name.includes(" ") ? `Blade ${name.split(" ")[0]}` : "Shadow");
  const displayMO = modusOperandi || (lang === "en" ? "Night shutter-breaking & CCTV blinding" : "ರಾತ್ರಿ ಶಟರ್ ಮುರಿಯುವುದು ಮತ್ತು ಸಿಟಿಟಿವಿ ದುರ್ಬಳಕೆ");
  const displayWeapon = weaponPreference || (lang === "en" ? "Curved iron cleaver / Lock breaker" : "ಕಬ್ಬಿಣದ ಸಲಾಕೆ / ಲಾಕ್ ಬ್ರೇಕರ್");
  const displaySyndicate = syndicate || (lang === "en" ? "Inter-District Break-in Gang" : "ಅಂತರ್ ಜಿಲ್ಲಾ ಕನ್ನಗಳ್ಳತನ ಗ್ಯಾಂಗ್");
  const displayLocation = lastKnownLocation || (lang === "en" ? "Kalaburagi Outskirts / NH-50 Sector" : "ಕಲಬುರಗಿ ಹೊರವಲಯ / ಎನ್​ಎಚ್-50");

  const normalizedScore = Math.min(100, Math.max(0, psotiScore));
  const isSevere = normalizedScore >= 80;

  return (
    <>
      {/* 1. Compact Inline Chip in Chat Message */}
      <motion.button
        layoutId={`suspect-${safeId}`}
        onClick={() => setIsOpen(true)}
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono hover:bg-amber-900/60 transition-colors shadow-sm cursor-pointer group select-none"
        title={lang === "en" ? `Click to inspect dossier for ${name}` : `${name} ಅವರ ವಿವರವಾದ ಡಾಸಿಯರ್ ವೀಕ್ಷಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse group-hover:bg-amber-300 shrink-0" />
        <span className="font-semibold text-stone-200">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
          {riskTier}
        </span>
        <span className="text-[10px] text-rose-400 font-bold ml-0.5">
          {normalizedScore}%
        </span>
      </motion.button>

      {/* 2. Expanded Card Morphing from same layoutId (Portaled to body to avoid container overflow clipping) */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop smooth opacity fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Expanded Tactical Card */}
            <motion.div
              layoutId={`suspect-${safeId}`}
              className="w-full max-w-xl bg-[#0C0A09] border border-[#C79A4E]/60 rounded-xl p-6 shadow-2xl relative overflow-hidden z-10 text-stone-200"
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Tactical Top Decorative Beacon Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C79A4E] to-transparent opacity-80" />
              
              {/* Header Bar */}
              <div className="flex justify-between items-start mb-4 border-b border-stone-800 pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shrink-0">
                    <ShieldAlert className="w-5 h-5 text-[#C79A4E]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#C79A4E] font-bold">
                        {lang === "en" ? "KSP CCTNS Verified Suspect Dossier" : "ಕೆಎಸ್​ಪಿ ಸಿಸಿಟಿಎನ್‌ಎಸ್ ಅಧಿಕೃತ ಆರೋಪಿ ಡಾಸಿಯರ್"}
                      </span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    </div>
                    <h3 className="text-xl font-bold text-stone-100 flex items-center gap-2 mt-0.5">
                      {name}
                      <span className="text-xs font-mono font-normal text-stone-400">
                        ({displayAlias})
                      </span>
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-400 hover:text-stone-100 hover:border-[#C79A4E]/50 font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Close (ESC)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>[ESC]</span>
                </button>
              </div>

              {/* Identity & Forensic Identifiers */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 text-xs font-mono">
                <div className="p-2.5 bg-stone-950/80 rounded-lg border border-stone-800">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    <Fingerprint className="w-3 h-3 text-[#C79A4E]" />
                    {lang === "en" ? "Biometric Token" : "ಬಯೋಮೆಟ್ರಿಕ್ ಟೋಕನ್"}
                  </div>
                  <div className="text-stone-200 font-bold mt-1 text-[11px] truncate">
                    {displayToken}
                  </div>
                </div>

                <div className="p-2.5 bg-stone-950/80 rounded-lg border border-stone-800">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-amber-400" />
                    {lang === "en" ? "Known Syndicate" : "ಸಂಬಂಧಿತ ಗ್ಯಾಂಗ್"}
                  </div>
                  <div className="text-stone-200 font-bold mt-1 text-[11px] truncate" title={displaySyndicate}>
                    {displaySyndicate}
                  </div>
                </div>

                <div className="p-2.5 bg-stone-950/80 rounded-lg border border-stone-800 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wider flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    {lang === "en" ? "Last Location" : "ಕೊನೆಯ ಸ್ಥಳ"}
                  </div>
                  <div className="text-stone-200 font-bold mt-1 text-[11px] truncate" title={displayLocation}>
                    {displayLocation}
                  </div>
                </div>
              </div>

              {/* Modus Operandi & Weapon */}
              <div className="bg-stone-950/90 rounded-lg border border-stone-800 p-3 mb-4 space-y-2 text-xs font-mono">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-stone-400 text-[10.5px] uppercase tracking-wider shrink-0">
                    {lang === "en" ? "Modus Operandi:" : "ಕಾರ್ಯ ವಿಧಾನ (MO):"}
                  </span>
                  <span className="text-stone-200 text-right font-medium">
                    {displayMO}
                  </span>
                </div>
                <div className="h-px bg-stone-850" />
                <div className="flex items-start justify-between gap-4">
                  <span className="text-stone-400 text-[10.5px] uppercase tracking-wider shrink-0">
                    {lang === "en" ? "Weapon Preference:" : "ಆಯುಧದ ಬಳಕೆ:"}
                  </span>
                  <span className="text-rose-300 text-right font-medium">
                    {displayWeapon}
                  </span>
                </div>
              </div>

              {/* PSOTI Score & Classification Badges */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
                <div className="p-3 bg-stone-950/90 rounded-lg border border-stone-800/90 flex flex-col justify-between">
                  <div className="text-stone-400 text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>{lang === "en" ? "PSOTI Recidivism Score" : "ಮರು-ಅಪರಾಧ ಸ್ಕೋರ್"}</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400 mt-1">
                    {normalizedScore}<span className="text-xs font-normal text-stone-500">/100</span>
                  </div>
                  <div className="text-[10px] text-rose-400/80 mt-0.5">
                    {isSevere ? (lang === "en" ? "Critical Flight & Violence Risk" : "ಅತ್ಯಂತ ಅಪಾಯಕಾರಿ ಹಂತ") : (lang === "en" ? "Monitored Offender" : "ನಿಗಾದಲ್ಲಿರುವ ಆರೋಪಿ")}
                  </div>
                </div>

                <div className="p-3 bg-stone-950/90 rounded-lg border border-stone-800/90 flex flex-col justify-between">
                  <div className="text-stone-400 text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>{lang === "en" ? "Classification Tier" : "ವರ್ಗೀಕರಣ ಶ್ರೇಣಿ"}</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-lg font-black text-amber-400 mt-1 tracking-wide">
                    {riskTier}
                  </div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    {lang === "en" ? "Immediate Interception Mandated" : "ತಕ್ಷಣದ ಕಾರ್ಯಾಚರಣೆ ಅಗತ್ಯ"}
                  </div>
                </div>
              </div>

              {/* Tactical Controls: Armored Break-Glass Warrant Protocol & Danger Barometer */}
              <div className="p-3 bg-stone-950 rounded-lg border border-stone-800 mb-4 space-y-3">
                <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#C79A4E]" />
                  {lang === "en" ? "Tactical Galaxy Controls" : "ಕಾರ್ಯಾಚರಣಾ ನಿಯಂತ್ರಣಗಳು"}
                </div>

                {/* Armored Toggle Switch */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div>
                    <div className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                      {breakGlassWarrant ? <Unlock className="w-3.5 h-3.5 text-rose-400" /> : <Lock className="w-3.5 h-3.5 text-stone-400" />}
                      <span>{lang === "en" ? "Break-Glass Warrant Protocol" : "ತುರ್ತು ವಾರೆಂಟ್ ಪ್ರೋಟೋಕಾಲ್"}</span>
                    </div>
                    <div className="text-[10px] text-stone-400">
                      {lang === "en" ? "Overrides standard magistrate queue for active pursuit" : "ನ್ಯಾಯಾಲಯದ ವಾರೆಂಟ್‌ಗೆ ಮುಂಚಿತ ಆದ್ಯತೆ"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBreakGlassWarrant(!breakGlassWarrant)}
                    className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none ${
                      breakGlassWarrant
                        ? "bg-rose-950/60 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                        : "bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500"
                    }`}
                  >
                    <span className="text-[11px] font-mono">
                      {breakGlassWarrant ? "(O===) ON" : "(===O) OFF"}
                    </span>
                  </button>
                </div>

                {/* Danger Level Progress Barometer */}
                <div className="pt-2 border-t border-stone-850">
                  <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 mb-1">
                    <span>{lang === "en" ? "DANGER LEVEL BAROMETER" : "ಅಪಾಯ ಮಟ್ಟದ ಮಾಪಕ"}</span>
                    <span className="text-rose-400 font-bold">{normalizedScore}% CRITICAL</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${normalizedScore}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {onSelectRefinement && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSelectRefinement(`Detailed case history and associates of suspect ${name} (${displayAlias})`);
                    }}
                    className="w-full sm:flex-1 py-2.5 px-3 bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-[#C79A4E]/60 text-stone-200 hover:text-stone-100 font-mono text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />
                    <span>{lang === "en" ? "Investigate Criminal History" : "ಕ್ರಿಮಿನಲ್ ಇತಿಹಾಸ ಪರಿಶೀಲಿಸಿ"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-[#C79A4E] to-amber-600 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold rounded-lg text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{lang === "en" ? "Return to Chat Stream" : "ಚಾಟ್‌ಗೆ ಹಿಂತಿರುಗಿ"}</span>
                  <ChevronRight className="w-4 h-4 text-stone-950" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
  </>
  );
};
