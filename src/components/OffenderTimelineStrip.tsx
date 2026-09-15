import React from "react";

interface OffenderCaseEvent {
  case_no: string | null;
  case_id: number;
  fir_date: string | null;
  arrest_date: string | null;
}

// H.3.2: repeat-offender timeline -- one PERSON's FIR->Arrest pairs across
// ALL their linked cases, laid out horizontally. Reuses the same vertical-
// dotted-line visual language get_case_timeline's own ExpandedOverlay
// render already established, just horizontal (per the plan's own mockup).
export const OffenderTimelineStrip: React.FC<{
  suspectName: string;
  cases: OffenderCaseEvent[];
  lang: "en" | "kn";
}> = ({ suspectName, cases, lang }) => {
  const fmt = (d: string | null) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString(lang === "kn" ? "kn-IN" : "en-US", { month: "short", year: "numeric" });
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="bg-stone-900/25 border border-stone-850 p-4 rounded-xl">
        <h4 className="font-black text-stone-100 text-lg">
          {lang === "en" ? `Offender Timeline — ${suspectName}` : `ಅಪರಾಧಿ ಕಾಲಾನುಕ್ರಮ — ${suspectName}`}
        </h4>
        <p className="text-xs text-stone-450 mt-1">
          {lang === "en"
            ? `${cases.length} linked case(s), FIR-to-arrest dates across this suspect's full record.`
            : `${cases.length} ಸಂಬಂಧಿತ ಪ್ರಕರಣಗಳು.`}
        </p>
      </div>
      <div className="flex-1 overflow-x-auto pb-2">
        <div className="flex items-start gap-8 min-w-max px-2 py-4">
          {cases.map((c, idx) => (
            <div key={idx} className="flex flex-col items-start gap-1 shrink-0 min-w-[140px]">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#C79A4E] shrink-0" />
                <span className="text-stone-300 font-bold">FIR</span>
                {c.arrest_date && (
                  <>
                    <span className="w-8 h-px bg-stone-700" />
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                    <span className="text-stone-300 font-bold">{lang === "en" ? "Arrest" : "ಬಂಧನ"}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-stone-500 pl-0.5">
                <span className="w-2 text-center">{fmt(c.fir_date) || "—"}</span>
                {c.arrest_date && <span className="ml-8">{fmt(c.arrest_date)}</span>}
              </div>
              <span className="font-mono text-[10.5px] text-[#C79A4E] font-bold pl-0.5">{c.case_no || `#${c.case_id}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
