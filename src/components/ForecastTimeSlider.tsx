import React from "react";
import { Calendar, Info } from "lucide-react";

/**
 * Finals-part 3.md §21, "Component B: 24-Hour Forensic Forecast Scrubber."
 * Deliberately NOT built as specified -- see spatiotemporal_forecast.py's
 * module docstring for the full grounding: CCTNS records in this dataset
 * carry no clock-time component, so an hour-of-day (0-23) scrubber would
 * be fabricated precision. This is the same real signal the doc wanted
 * (a temporal dimension the officer can scrub through to see risk
 * change), built on the granularity the real data actually supports --
 * day of week -- with the substitution stated plainly in the UI itself so
 * it's never mistaken for finer-grained than it is.
 */
interface ForecastTimeSliderProps {
  selectedDay: number | null; // 0=Monday..6=Sunday, null = "All days" (weekly average)
  onChangeDay: (day: number | null) => void;
  lang?: "en" | "kn";
}

const DAY_LABELS: { value: number; en: string; kn: string }[] = [
  { value: 0, en: "Mon", kn: "ಸೋಮ" },
  { value: 1, en: "Tue", kn: "ಮಂಗಳ" },
  { value: 2, en: "Wed", kn: "ಬುಧ" },
  { value: 3, en: "Thu", kn: "ಗುರು" },
  { value: 4, en: "Fri", kn: "ಶುಕ್ರ" },
  { value: 5, en: "Sat", kn: "ಶನಿ" },
  { value: 6, en: "Sun", kn: "ಭಾನು" },
];

export const ForecastTimeSlider: React.FC<ForecastTimeSliderProps> = ({ selectedDay, onChangeDay, lang = "en" }) => {
  return (
    <div className="w-full bg-stone-900/90 border border-stone-800 rounded-xl p-3.5 shadow-xl backdrop-blur-md flex flex-col gap-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#C79A4E]" />
          <span className="text-xs font-mono font-bold tracking-wider text-stone-400 uppercase">
            {lang === "en" ? "Day-of-Week Pattern" : "ವಾರದ ದಿನದ ಮಾದರಿ"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9.5px] text-stone-500" title={lang === "en"
          ? "CCTNS records in this system carry no clock-time -- day-of-week is the real granularity the data supports."
          : "ಈ ವ್ಯವಸ್ಥೆಯಲ್ಲಿ CCTNS ದಾಖಲೆಗಳು ಗಡಿಯಾರ ಸಮಯವನ್ನು ಹೊಂದಿಲ್ಲ."}>
          <Info className="w-3 h-3" />
          <span>{lang === "en" ? "Day-of-week, not hour-of-day" : "ಗಂಟೆಯಲ್ಲ, ದಿನ"}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onChangeDay(null)}
          className={`px-2.5 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase transition-colors cursor-pointer border ${
            selectedDay === null
              ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E]"
              : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300"
          }`}
        >
          {lang === "en" ? "All Days (avg)" : "ಎಲ್ಲಾ ದಿನಗಳು"}
        </button>
        {DAY_LABELS.map((d) => (
          <button
            key={d.value}
            onClick={() => onChangeDay(d.value)}
            className={`px-2.5 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase transition-colors cursor-pointer border ${
              selectedDay === d.value
                ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E]"
                : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300"
            }`}
          >
            {lang === "en" ? d.en : d.kn}
          </button>
        ))}
      </div>
    </div>
  );
};
