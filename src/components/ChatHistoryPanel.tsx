import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MessageSquarePlus, MessageSquare, FolderPlus, Folder, Users, Loader2, MoreVertical, Trash2, CheckSquare, Square, Check } from "lucide-react";
import { NewInvestigationModal } from "./NewInvestigationModal";

interface SessionSummary {
  session_id: string;
  title: string;
  last_active_at: string;
  is_cowork?: boolean;
}

interface Investigation {
  session_id: string;
  title: string;
  description: string;
  case_no: string | null;
  last_active_at: string;
  role: string;
  is_cowork?: boolean;
}

interface ChatHistoryPanelProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshKey: number;
  loadingSessionId?: string | null;
  onSessionDeleted?: (sessionId: string) => void;
}

const ChatHistoryPanelComponent: React.FC<ChatHistoryPanelProps> = ({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshKey,
  loadingSessionId = null,
  onSessionDeleted,
}) => {
  const { t, lang, addToast } = useApp();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewInvestigation, setShowNewInvestigation] = useState(false);
  const [investigationsRefresh, setInvestigationsRefresh] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multi-select state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sessions`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (response.ok) {
          const list = await response.json();
          setSessions(list);
          if (list.length > 0 && !activeSessionId) {
            onSelectSession(list[0].session_id);
          }
        }
      } catch (err) {
        console.error("Failed to load chat sessions:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, [refreshKey]);

  useEffect(() => {
    const loadInvestigations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/investigations`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (response.ok) {
          setInvestigations(await response.json());
        }
      } catch (err) {
        console.error("Failed to load investigations:", err);
      }
    };
    loadInvestigations();
  }, [refreshKey, investigationsRefresh]);

  const handleDelete = async (sessionId: string, title: string) => {
    setOpenMenuId(null);
    const confirmed = window.confirm(
      lang === "en"
        ? `Delete "${title || "this conversation"}"? This cannot be undone.`
        : `"${title || "ಈ ಸಂಭಾಷಣೆ"}" ಅನ್ನು ಅಳಿಸುವುದೇ? ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.`
    );
    if (!confirmed) return;

    setDeletingId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Delete failed.");
      }
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      setInvestigations((prev) => prev.filter((i) => i.session_id !== sessionId));
      onSessionDeleted?.(sessionId);
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      addToast(
        lang === "en" ? "Delete Failed" : "ಅಳಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not delete this conversation." : "ಈ ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = [
      ...sessions.map((s) => s.session_id),
      ...investigations.map((i) => i.session_id),
    ];
    if (selectedSessionIds.size === allIds.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(allIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessionIds.size === 0) return;
    const count = selectedSessionIds.size;
    const confirmed = window.confirm(
      lang === "en"
        ? `Delete ${count} selected conversation${count > 1 ? "s" : ""}? This cannot be undone.`
        : `${count} ಆಯ್ಕೆಮಾಡಿದ ಸಂಭಾಷಣೆಗಳನ್ನು ಅಳಿಸುವುದೇ? ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.`
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    const idsArray = Array.from(selectedSessionIds);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/bulk-delete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_ids: idsArray }),
      });
      if (!res.ok) throw new Error("Bulk delete failed.");

      setSessions((prev) => prev.filter((s) => !selectedSessionIds.has(s.session_id)));
      setInvestigations((prev) => prev.filter((i) => !selectedSessionIds.has(i.session_id)));

      if (activeSessionId && selectedSessionIds.has(activeSessionId)) {
        onSessionDeleted?.(activeSessionId);
      }
      setSelectedSessionIds(new Set());
      setIsMultiSelect(false);
      addToast(
        lang === "en" ? "Deleted Successfully" : "ಸಫಲವಾಗಿ ಅಳಿಸಲಾಗಿದೆ",
        lang === "en" ? `Deleted ${count} conversation(s).` : `${count} ಸಂಭಾಷಣೆಗಳನ್ನು ಅಳಿಸಲಾಗಿದೆ.`,
        "Standard"
      );
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      addToast(
        lang === "en" ? "Bulk Delete Failed" : "ಅಳಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not delete selected conversations." : "ಆಯ್ಕೆಮಾಡಿದ ಸಂಭಾಷಣೆಗಳನ್ನು ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const totalCount = sessions.length + investigations.length;

  return (
    <div className="w-60 shrink-0 border-r border-stone-850 bg-stone-950/30 flex flex-col h-full overflow-hidden">
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Header controls: New Chat + Multi Select toggle */}
      <div className="p-3 border-b border-stone-850 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#C79A4E]/30 bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 text-[#C79A4E] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            {t.newChat}
          </button>
          {totalCount > 0 && (
            <button
              onClick={() => {
                setIsMultiSelect(!isMultiSelect);
                setSelectedSessionIds(new Set());
              }}
              className={`px-2.5 py-2 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                isMultiSelect
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200"
              }`}
              title={isMultiSelect ? "Cancel Select" : "Multi Select"}
            >
              {isMultiSelect ? (lang === "en" ? "Done" : "ಸಾಕು") : (lang === "en" ? "Select" : "ಆಯ್ಕೆ")}
            </button>
          )}
        </div>

        {/* Multi-select toolbar */}
        {isMultiSelect && (
          <div className="flex items-center justify-between pt-1 border-t border-stone-850">
            <button
              onClick={handleSelectAll}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-mono cursor-pointer"
            >
              {selectedSessionIds.size === totalCount
                ? (lang === "en" ? "Deselect All" : "ಎಲ್ಲವನ್ನೂ ರದ್ದುಮಾಡಿ")
                : (lang === "en" ? "Select All" : "ಎಲ್ಲವನ್ನೂ ಆಯ್ಕೆಮಾಡಿ")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedSessionIds.size === 0 || isBulkDeleting}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isBulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {lang === "en" ? `Delete (${selectedSessionIds.size})` : `ಅಳಿಸಿ (${selectedSessionIds.size})`}
            </button>
          </div>
        )}
      </div>

      {/* Investigations pinned */}
      <div className="p-3 border-b border-stone-850 space-y-2">
        <button
          onClick={() => setShowNewInvestigation(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          {t.newInvestigation}
        </button>
        {investigations.length > 0 && (
          <div className="space-y-1 pt-1">
            {investigations.map((inv) => {
              const isLoadingThis = loadingSessionId === inv.session_id;
              const isDeleting = deletingId === inv.session_id;
              const isSelected = selectedSessionIds.has(inv.session_id);
              return (
                <div key={inv.session_id} className="relative group">
                  <button
                    onClick={() => {
                      if (isMultiSelect) toggleSelect(inv.session_id);
                      else onSelectSession(inv.session_id);
                    }}
                    disabled={!!loadingSessionId || isDeleting}
                    aria-busy={isLoadingThis}
                    className={`w-full text-left flex items-start gap-2 px-2.5 py-2 pr-7 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
                      (loadingSessionId && !isLoadingThis) || isDeleting ? "opacity-50" : ""
                    } ${
                      isSelected
                        ? "bg-amber-500/20 border border-amber-500/40 text-stone-100"
                        : inv.session_id === activeSessionId
                        ? "bg-amber-500/10 border border-amber-500/25 text-stone-100"
                        : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {isMultiSelect ? (
                      isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-600" />
                      )
                    ) : isLoadingThis || isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500 animate-spin" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate leading-tight">{inv.title}</div>
                      {inv.case_no && (
                        <div className="text-[9px] text-stone-550 font-mono truncate">{inv.case_no}</div>
                      )}
                    </div>
                    {inv.is_cowork && (
                      <Users className="w-3 h-3 shrink-0 text-[#5DCAA5] mt-0.5" />
                    )}
                  </button>
                  {!isMultiSelect && inv.role === "owner" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === inv.session_id ? null : inv.session_id); }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-stone-600 hover:text-stone-200 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {openMenuId === inv.session_id && (
                    <div className="absolute right-1 top-7 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-32">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(inv.session_id, inv.title); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        {lang === "en" ? "Delete" : "ಅಳಿಸಿ"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="text-[10px] text-stone-600 text-center py-4 font-mono">{t.loadingLabel}</div>
        ) : sessions.length === 0 ? (
          <div className="text-[10px] text-stone-600 text-center py-4 font-mono px-2">
            {t.noPastConversations}
          </div>
        ) : (
          sessions.map((s) => {
            const isLoadingThis = loadingSessionId === s.session_id;
            const isDeleting = deletingId === s.session_id;
            const isSelected = selectedSessionIds.has(s.session_id);
            return (
              <div key={s.session_id} className="relative group">
                <button
                  onClick={() => {
                    if (isMultiSelect) toggleSelect(s.session_id);
                    else onSelectSession(s.session_id);
                  }}
                  disabled={!!loadingSessionId || isDeleting}
                  aria-busy={isLoadingThis}
                  className={`w-full text-left flex items-start gap-2 px-2.5 py-2 pr-7 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
                    (loadingSessionId && !isLoadingThis) || isDeleting ? "opacity-50" : ""
                  } ${
                    isSelected
                      ? "bg-[#C79A4E]/20 border border-[#C79A4E]/40 text-stone-100"
                      : s.session_id === activeSessionId
                      ? "bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-stone-100"
                      : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {isMultiSelect ? (
                    isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C79A4E]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-600" />
                    )
                  ) : isLoadingThis || isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C79A4E] animate-spin" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-500" />
                  )}
                  <span className="truncate leading-tight flex-1 min-w-0">{s.title || t.newConversationFallback}</span>
                  {s.is_cowork && (
                    <Users className="w-3 h-3 shrink-0 text-[#5DCAA5] mt-0.5" />
                  )}
                </button>
                {!isMultiSelect && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.session_id ? null : s.session_id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-stone-600 hover:text-stone-200 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}
                {openMenuId === s.session_id && (
                  <div className="absolute right-1 top-7 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-32">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.session_id, s.title); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      {lang === "en" ? "Delete" : "ಅಳಿಸಿ"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showNewInvestigation && (
        <NewInvestigationModal
          onClose={() => setShowNewInvestigation(false)}
          onCreated={(sessionId) => {
            setShowNewInvestigation(false);
            setInvestigationsRefresh((k) => k + 1);
            onSelectSession(sessionId);
          }}
        />
      )}
    </div>
  );
};

export const ChatHistoryPanel = React.memo(ChatHistoryPanelComponent);
