import React from "react";
import { TranscriptWidth } from "../AppContext";

/**
 * Finals-part 3.md §32, Blueprint B: replaces raw pixel labels ("~672px")
 * with a Linux-display-scaling-style miniature monitor wireframe per
 * width option -- the doc's own complaint about the pre-existing settings
 * screen ("Eliminates raw numbers... Replaces them with functional police
 * operational tiers"), now actually true. TranscriptWidth stays the real
 * "narrow" | "medium" | "wide" union already defined in AppContext.tsx --
 * only the LABELS and visual treatment are new, never the underlying value.
 */
interface ProportionalWidthWireframeProps {
  activeWidth: TranscriptWidth;
  onSelectWidth: (w: TranscriptWidth) => void;
  lang?: "en" | "kn";
}

export const ProportionalWidthWireframe: React.FC<ProportionalWidthWireframeProps> = ({
  activeWidth,
  onSelectWidth,
  lang = "en",
}) => {
  const options: {
    id: TranscriptWidth;
    title: string;
    titleKn: string;
    subtitle: string;
    columnWidthCls: string;
    description: string;
    descriptionKn: string;
  }[] = [
    {
      id: "narrow",
      title: "Focused Reading",
      titleKn: "ಏಕಾಗ್ರ ಓದುವಿಕೆ",
      subtitle: "~35% Screen Ratio",
      columnWidthCls: "w-[36%]",
      description: "Optimized for long investigative narratives and single-column focus.",
      descriptionKn: "ದೀರ್ಘ ತನಿಖಾ ನಿರೂಪಣೆಗಳಿಗೆ ಸೂಕ್ತ.",
    },
    {
      id: "medium",
      title: "Balanced Operations",
      titleKn: "ಸಮತೋಲಿತ ಕಾರ್ಯಾಚರಣೆ",
      subtitle: "~65% Screen Ratio",
      columnWidthCls: "w-[65%]",
      description: "Standard balanced layout accommodating dual-card tool responses.",
      descriptionKn: "ಪ್ರಮಾಣಿತ ಸಮತೋಲಿತ ವಿನ್ಯಾಸ.",
    },
    {
      id: "wide",
      title: "Full-Width Canvas",
      titleKn: "ಪೂರ್ಣ-ಅಗಲ ಕ್ಯಾನ್ವಾಸ್",
      subtitle: "~92% Screen Ratio",
      columnWidthCls: "w-[92%]",
      description: "Expansive layout for multi-column CCTNS crime grids and link diagrams.",
      descriptionKn: "ಬಹು-ಕಾಲಮ್ ಕೋಷ್ಟಕಗಳಿಗೆ ವಿಸ್ತಾರ ವಿನ್ಯಾಸ.",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map((opt) => {
        const isSelected = activeWidth === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectWidth(opt.id)}
            className={`flex flex-col p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              isSelected
                ? "bg-[#C79A4E]/15 border-[#C79A4E] shadow-sm"
                : "bg-stone-900/40 border-stone-800 hover:border-stone-700 hover:bg-stone-900/80"
            }`}
          >
            {/* Linux Desktop Window Scaling Schematic (16:10 aspect ratio) -- L257: locked aspect so resizing never distorts it. */}
            <div className="w-full aspect-[16/10] bg-stone-950 border border-stone-800 rounded flex flex-col overflow-hidden mb-2 p-1">
              <div className="flex items-center gap-1 mb-1 px-0.5 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 flex gap-1 items-stretch bg-stone-900/30 rounded border border-stone-900 overflow-hidden p-1">
                <div className="w-3 bg-stone-900 rounded-sm shrink-0 flex flex-col gap-0.5 p-0.5">
                  <div className="w-full h-1 bg-stone-700 rounded-xs" />
                  <div className="w-full h-1 bg-stone-800 rounded-xs" />
                  <div className="w-full h-1 bg-stone-800 rounded-xs" />
                </div>
                <div className="flex-1 flex items-center justify-center bg-stone-950/50 rounded-sm">
                  <div
                    className={`h-full transition-all duration-300 rounded-xs flex flex-col justify-center gap-0.5 p-0.5 ${opt.columnWidthCls} ${
                      isSelected ? "bg-[#C79A4E]/30 border border-[#C79A4E]" : "bg-stone-800 border border-stone-700"
                    }`}
                  >
                    <div className={`w-full h-1 rounded-xs ${isSelected ? "bg-[#C79A4E]" : "bg-stone-600"}`} />
                    <div className={`w-4/5 h-1 rounded-xs ${isSelected ? "bg-[#C79A4E]/70" : "bg-stone-700"}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono font-bold ${isSelected ? "text-[#C79A4E]" : "text-stone-200"}`}>
                  {lang === "en" ? opt.title : opt.titleKn}
                </span>
                <span className="text-[9px] font-mono text-stone-500">{opt.subtitle}</span>
              </div>
              <p className="text-[10px] font-mono text-stone-500 mt-1 leading-snug">
                {lang === "en" ? opt.description : opt.descriptionKn}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
