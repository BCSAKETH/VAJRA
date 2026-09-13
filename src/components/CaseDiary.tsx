import React, { useEffect, useState } from "react";
import { X, FileClock } from "lucide-react";
import { API_BASE } from "../config";

// §9.6 Case Diary -- a read-only, dated, investigation-actions-only log
// (query run, task completed, member joined, case linked, export
// generated). Never derived from chat history on the fly (Loophole L2 --
// see the backend's _log_diary_entry docstring); this component is a
// simple read view of what was already written at the moment each event
// happened.

interface DiaryEntry {
  event_type: string;
  summary: string;
  employee_id: number;
  logged_at: string;
}

interface CaseDiaryProps {
  sessionId: string;
  lang: "en" | "kn";
  onClose: () => void;
}

const EVENT_LABELS: Record<string, { en: string; kn: string; icon: string }> = {
  tool_call: { en: "Query Run", kn: "ಪ್ರಶ್ನೆ ನಡೆಸಲಾಗಿದೆ", icon: "\u{1F50D}" },
  task_completed: { en: "Task Completed", kn: "ಕಾರ್ಯ ಪೂರ್ಣಗೊಂಡಿದೆ", icon: "✅" },
  member_added: { en: "Member Joined", kn: "ಸದಸ್ಯರು ಸೇರಿದ್ದಾರೆ", icon: "\u{1F465}" },
  case_linked: { en: "Case Linked", kn: "ಪ್ರಕರಣ ಜೋಡಿಸಲಾಗಿದೆ", icon: "\u{1F517}" },
  export_generated: { en: "Export Generated", kn: "ರಫ್ತು ರಚಿಸಲಾಗಿದೆ", icon: "\u{1F4C4}" },
};

const parseServerTimestamp = (ts: string): Date => {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(ts);
  return new Date(hasTz ? ts : `${ts}Z`);
};

export const CaseDiary: React.FC<CaseDiaryProps> = ({ sessionId, lang, onClose }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/investigations/${sessionId}/diary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DiaryEntry[]) => setEntries(data))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
      <div className="w-full max-w-lg glass-panel border border-stone-800 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <FileClock className="w-4 h-4 text-[#C79A4E]" />
            {lang === "en" ? "Case Diary" : "ಪ್ರಕರಣ ದಿನಚರಿ"}
          </h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-[10px] text-stone-600 text-center py-4 font-mono">
            {lang === "en" ? "Loading..." : "ಲೋಡ್ ಆಗುತ್ತಿದೆ..."}
          </div>
        ) : loadError || entries.length === 0 ? (
          <div className="text-[11px] text-stone-500 text-center py-6">
            {loadError
              ? (lang === "en"
                  ? "The Case Diary is not yet configured on the server (console table pending)."
                  : "ಪ್ರಕರಣ ದಿನಚರಿ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ.")
              : (lang === "en" ? "No diary entries yet." : "ಇನ್ನೂ ದಿನಚರಿ ನಮೂದುಗಳಿಲ್ಲ.")}
          </div>
        ) : (
          <div className="space-y-2 border-l-2 border-stone-850 pl-4">
            {entries.map((e, idx) => {
              const label = EVENT_LABELS[e.event_type] || { en: e.event_type, kn: e.event_type, icon: "\u{1F4CC}" };
              return (
                <div key={idx} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#C79A4E]" />
                  <div className="text-[10px] text-stone-500 font-mono">
                    {parseServerTimestamp(e.logged_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="text-xs text-stone-200 font-semibold">
                    {label.icon} {lang === "en" ? label.en : label.kn}
                  </div>
                  <div className="text-[11px] text-stone-400">{e.summary}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
