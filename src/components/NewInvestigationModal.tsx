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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md bg-stone-900/95 border border-[#C79A4E]/35 rounded-2xl p-6 space-y-4.5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-1 border-b border-stone-800">
          <h3 className="text-sm font-bold text-stone-100 tracking-wide flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#C79A4E]/15 border border-[#C79A4E]/30 flex items-center justify-center text-[#C79A4E] shrink-0">
              <FolderPlus className="w-4 h-4" />
            </span>
            <span>{t.newInvestigation}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-350 rounded-xl text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-300">{t.titleLabel}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.investigationTitlePlaceholder}
            autoFocus
            className="w-full bg-stone-950/80 border border-stone-700/80 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none transition-all shadow-inner"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-300">{t.descOptionalLabel}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.investigationDescPlaceholder}
            rows={2}
            className="w-full bg-stone-950/80 border border-stone-700/80 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none transition-all resize-none shadow-inner"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-stone-300">{t.linkCaseOptionalLabel}</label>
          {selectedCase ? (
            <div className="flex items-center justify-between bg-[#C79A4E]/10 border border-[#C79A4E]/30 rounded-xl py-2 px-3">
              <span className="text-xs font-bold text-[#C79A4E]">{selectedCase}</span>
              <button onClick={() => { setSelectedCase(null); setCaseQuery(""); }} className="p-1 rounded text-stone-400 hover:text-rose-400 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={caseQuery}
                  onChange={(e) => setCaseQuery(e.target.value)}
                  placeholder={t.caseSearchPlaceholder}
                  className="w-full bg-stone-950/80 border border-stone-700/80 focus:border-[#C79A4E] rounded-xl py-2.5 pl-8 pr-3 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none transition-all shadow-inner"
                />
              </div>
              {caseResults.length > 0 && (
                <div className="absolute top-full mt-1.5 w-full bg-stone-900 border border-stone-750 rounded-xl shadow-2xl z-20 max-h-44 overflow-y-auto divide-y divide-stone-800">
                  {caseResults.map((c) => (
                    <button
                      key={c.case_no}
                      onClick={() => { setSelectedCase(c.case_no); setCaseResults([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-stone-800/80 transition-colors cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-[#C79A4E]">{c.case_no}</div>
                      <div className="text-[10px] text-stone-400 truncate">{c.brief_facts}</div>
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
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C79A4E] to-amber-600 hover:from-[#d5a759] hover:to-amber-500 text-stone-950 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-[#C79A4E]/20"
        >
          {isCreating ? t.creating : t.createInvestigation}
        </button>
      </div>
    </div>
  );
};
