import React, { useEffect, useState } from "react";
import { X, ShieldAlert, FileText, MapPin, Clock, Check, Ban } from "lucide-react";
import { useApp } from "../AppContext";
import { ChatBubble } from "./ChatBubble";
import { API_BASE } from "../config";

// E.1 (was Finals.md Part I): high-fidelity click-to-inspect review, replacing
// a blind approve/reject card. Renders the officer's real conversation
// (already redacted where required -- Loophole L3) and their written
// justification (D.8) instead of asking a supervisor to decide blind.
interface SupervisorApprovalReviewModalProps {
  isOpen: boolean;
  item: any | null;
  type: "export" | "pocso" | "district";
  onClose: () => void;
  onDecision: (rowid: string, approve: boolean) => Promise<void>;
  isDeciding: boolean;
}

export const SupervisorApprovalReviewModal: React.FC<SupervisorApprovalReviewModalProps> = ({
  isOpen,
  item,
  type,
  onClose,
  onDecision,
  isDeciding,
}) => {
  const { lang } = useApp();
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || type !== "export" || !item?.request_id) {
      setMessages([]);
      return;
    }
    // E.1/D.9/D.14: transcript is fetched by reference (transcript_stratus_id
    // on the server side), never expected inline in the alert payload.
    fetch(`${API_BASE}/api/exports/${item.request_id}/transcript`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [isOpen, type, item?.request_id]);

  if (!isOpen || !item) return null;

  const reason =
    item.reason ||
    item.requester_reason ||
    (lang === "en" ? "No written reason provided by officer." : "ಅಧಿಕಾರಿಯಿಂದ ಯಾವುದೇ ಲಿಖಿತ ಕಾರಣ ನೀಡಿಲ್ಲ.");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-stone-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl h-[88vh] flex flex-col glass-panel border border-[#C79A4E]/30 rounded-2xl shadow-2xl bg-[#121110]/95 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                type === "export"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : type === "pocso"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-sky-500/10 border-sky-500/30 text-sky-400"
              }`}
            >
              {type === "export" ? (
                <FileText className="w-4 h-4" />
              ) : type === "pocso" ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-stone-100 uppercase tracking-wider font-mono">
                  {type === "export"
                    ? lang === "en"
                      ? "Export Dossier Review"
                      : "ರಫ್ತು ದೋಶಿಯರ್ ಪರಿಶೀಲನೆ"
                    : type === "pocso"
                    ? lang === "en"
                      ? "POCSO Identity Unmasking Review"
                      : "POCSO ಗುರುತು ಬಹಿರಂಗ ಪರಿಶೀಲನೆ"
                    : lang === "en"
                    ? "Cross-District Access Review"
                    : "ಜಿಲ್ಲಾ ಪ್ರವೇಶ ಪರಿಶೀಲನೆ"}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-bold uppercase">
                  {lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"} {item.requester_badge}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                {type === "pocso"
                  ? `${lang === "en" ? "Target Case:" : "ಗುರಿ ಪ್ರಕರಣ:"} ${item.case_no}`
                  : type === "district"
                  ? `${lang === "en" ? "Target District:" : "ಗುರಿ ಜಿಲ್ಲೆ:"} ${item.target_district_name || item.target_district_id}`
                  : `${lang === "en" ? "Flagged:" : "ಗುರುತಿಸಲಾಗಿದೆ:"} ${(item.reasons || []).join(", ")}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-[#C79A4E]/[0.06] border-b border-[#C79A4E]/20 shrink-0">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#C79A4E] shrink-0 mt-0.5">
              {lang === "en" ? "Officer Justification:" : "ಅಧಿಕಾರಿಯ ಸಮರ್ಥನೆ:"}
            </span>
            <p className="text-xs text-stone-200 font-mono italic leading-relaxed">"{reason}"</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-950/40">
          {type === "export" &&
            (messages.length > 0 ? (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((m: any, idx: number) => (
                  <ChatBubble
                    key={`rev-msg-${idx}`}
                    lang={lang}
                    onExpandWidget={() => {}}
                    isReviewMode
                    message={{
                      id: `rev-${idx}`,
                      sender: (m.role || m.sender || "user") as "user" | "assistant",
                      text: m.content || m.text || "",
                      textEn: m.text_en || m.content || m.text || "",
                      textKn: m.text_kn || m.content || m.text || "",
                      timestamp: m.timestamp || "",
                      responseType: m.response_type || m.responseType,
                      data: m.data || {},
                      citations: m.citations || [],
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-500 font-mono text-xs">
                <FileText className="w-8 h-8 mb-2 opacity-30 text-[#C79A4E]" />
                {lang === "en" ? "Transcript preview:" : "ಸಂಭಾಷಣೆಯ ಪೂರ್ವವೀಕ್ಷಣೆ:"}
                <div className="mt-2 p-3 rounded-lg bg-stone-900/60 border border-stone-800 text-stone-300 max-w-lg">
                  {item.summary ||
                    (lang === "en" ? "Complete case file export requested." : "ಸಂಪೂರ್ಣ ಪ್ರಕರಣ ರಫ್ತು ವಿನಂತಿಸಲಾಗಿದೆ.")}
                </div>
              </div>
            ))}

          {type === "pocso" && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-mono text-stone-400 border-b border-stone-850 pb-2">
                <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
                <span>{lang === "en" ? "Request Context" : "ವಿನಂತಿಯ ಸಂದರ್ಭ"}</span>
              </div>
              <ChatBubble
                lang={lang}
                onExpandWidget={() => {}}
                isReviewMode
                message={{
                  id: "pocso-rev-user",
                  sender: "user",
                  text:
                    reason && reason !== (lang === "en" ? "No written reason provided by officer." : "ಅಧಿಕಾರಿಯಿಂದ ಯಾವುದೇ ಲಿಖಿತ ಕಾರಣ ನೀಡಿಲ್ಲ.")
                      ? reason
                      : lang === "en"
                      ? `Requesting unmasked identity access for case ${item.case_no}.`
                      : `ಪ್ರಕರಣ ${item.case_no} ಗಾಗಿ ಗುರುತು ಬಹಿರಂಗ ಪ್ರವೇಶ ವಿನಂತಿ.`,
                  timestamp: "",
                }}
              />
              <ChatBubble
                lang={lang}
                onExpandWidget={() => {}}
                isReviewMode
                message={{
                  id: "pocso-rev-asst",
                  sender: "assistant",
                  text: lang === "en" ? "Redacted Case Dossier" : "ಮರೆಮಾಡಲಾದ ಪ್ರಕರಣದ ದಾಖಲೆ",
                  data: { pocso_redacted: true, case_no: item.case_no },
                  citations: [{ type: "CCTNS Master Register", id: item.case_no, details: "Protected Record" }],
                }}
              />
            </div>
          )}

          {type === "district" && (
            <div className="max-w-2xl mx-auto space-y-4 py-4">
              <div className="glass-card p-5 border border-sky-500/30 bg-sky-500/[0.04] rounded-xl space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <span className="text-xs text-stone-400">{lang === "en" ? "Target Jurisdiction:" : "ಗುರಿ ವ್ಯಾಪ್ತಿ:"}</span>
                  <span className="text-sm font-bold text-sky-400">{item.target_district_name || item.target_district_id}</span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <span className="text-xs text-stone-400">{lang === "en" ? "Requesting Officer:" : "ವಿನಂತಿಸಿದ ಅಧಿಕಾರಿ:"}</span>
                  <span className="text-xs font-bold text-stone-200">
                    {item.requester_name} (KGID: {item.requester_badge})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-400">{lang === "en" ? "Access Classification:" : "ಪ್ರವೇಶ ವರ್ಗೀಕರಣ:"}</span>
                  <span className="text-xs text-amber-400 font-bold">
                    {item.emergency ? "Section 185 BNSS Emergency Break-Glass" : "Standard Cross-District ABAC"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-mono text-stone-500">
            {lang === "en"
              ? "Dual-control audit log entry will be generated on decision."
              : "ನಿರ್ಧಾರದ ಮೇಲೆ ದ್ವಿ-ವ್ಯಕ್ತಿ ಆಡಿಟ್ ಲಾಗ್ ದಾಖಲಾಗುತ್ತದೆ."}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onDecision(String(item.rowid), false)}
              disabled={isDeciding}
              className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Reject Request" : "ತಿರಸ್ಕರಿಸಿ"}</span>
            </button>
            <button
              onClick={() => onDecision(String(item.rowid), true)}
              disabled={isDeciding}
              className="px-5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Approve Access" : "ಅನುಮೋದಿಸಿ"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorApprovalReviewModal;
