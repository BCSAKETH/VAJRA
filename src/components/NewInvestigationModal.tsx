import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { FolderPlus, X, Search } from "lucide-react";

interface CaseSearchResult {
  case_no: string;
  brief_facts: string;
}

interface NewInvestigationModalProps {
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

export const NewInvestigationModal: React.FC<NewInvestigationModalProps> = ({ onClose, onCreated }) => {
  const { t } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [caseResults, setCaseResults] = useState<CaseSearchResult[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Case linking is optional and searchable, not a forced one-time picker --
  // real investigative work often starts before a case number is confirmed.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (caseQuery.length < 2 || selectedCase) {
      setCaseResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/investigations/search-cases?q=${encodeURIComponent(caseQuery)}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (res.ok) setCaseResults(await res.json());
      } catch (err) {
        console.error("Case search failed:", err);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [caseQuery, selectedCase]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError(t.newInvestigationTitleRequired);
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/investigations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ title, description, case_no: selectedCase }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || t.couldNotCreateInvestigation);
        return;
      }
      onCreated(data.session_id);
    } catch (err) {
      console.error("Failed to create investigation:", err);
      setError(t.couldNotReachServer);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel border border-[#00C6AD]/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#00C6AD]" /> {t.newInvestigation}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-lg text-[11px]">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">{t.titleLabel}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.investigationTitlePlaceholder}
            className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">{t.descOptionalLabel}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.investigationDescPlaceholder}
            rows={2}
            className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none transition-all resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">{t.linkCaseOptionalLabel}</label>
          {selectedCase ? (
            <div className="flex items-center justify-between bg-[#00C6AD]/10 border border-[#00C6AD]/30 rounded-xl py-2 px-3">
              <span className="text-xs font-bold text-[#00C6AD]">{selectedCase}</span>
              <button onClick={() => { setSelectedCase(null); setCaseQuery(""); }} className="text-slate-500 hover:text-rose-500 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-3" />
                <input
                  type="text"
                  value={caseQuery}
                  onChange={(e) => setCaseQuery(e.target.value)}
                  placeholder={t.caseSearchPlaceholder}
                  className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none transition-all"
                />
              </div>
              {caseResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-10 max-h-40 overflow-y-auto">
                  {caseResults.map((c) => (
                    <button
                      key={c.case_no}
                      onClick={() => { setSelectedCase(c.case_no); setCaseResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-850 last:border-0 cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-[#00C6AD]">{c.case_no}</div>
                      <div className="text-[10px] text-slate-500 truncate">{c.brief_facts}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full py-2.5 rounded-xl bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 border border-[#00C6AD]/30 text-[#00C6AD] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          {isCreating ? t.creating : t.createInvestigation}
        </button>
      </div>
    </div>
  );
};
