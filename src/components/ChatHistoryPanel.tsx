import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MessageSquarePlus, MessageSquare, FolderPlus, Folder, Users, Loader2 } from "lucide-react";
import { NewInvestigationModal } from "./NewInvestigationModal";

interface SessionSummary {
  session_id: string;
  title: string;
  last_active_at: string;
}

interface Investigation {
  session_id: string;
  title: string;
  description: string;
  case_no: string | null;
  last_active_at: string;
  role: string;
}

interface ChatHistoryPanelProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshKey: number;
  // Session id currently being fetched (see AIChatScreen.handleSelectSession).
  // Drives an immediate per-row spinner so a click never reads as "did nothing".
  loadingSessionId?: string | null;
}

const ChatHistoryPanelComponent: React.FC<ChatHistoryPanelProps> = ({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshKey,
  loadingSessionId = null,
}) => {
  const { t } = useApp();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewInvestigation, setShowNewInvestigation] = useState(false);
  const [investigationsRefresh, setInvestigationsRefresh] = useState(0);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sessions`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (response.ok) {
          setSessions(await response.json());
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

  return (
    <div className="w-60 shrink-0 border-r border-stone-850 bg-stone-950/30 flex flex-col h-full overflow-y-auto">
      {/* Investigations -- pinned above regular chat history, same pattern
          as Claude/ChatGPT's Projects sitting above Recents in one rail. */}
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
              return (
                <button
                  key={inv.session_id}
                  onClick={() => onSelectSession(inv.session_id)}
                  disabled={!!loadingSessionId}
                  aria-busy={isLoadingThis}
                  className={`w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
                    loadingSessionId && !isLoadingThis ? "opacity-50" : ""
                  } ${
                    inv.session_id === activeSessionId
                      ? "bg-amber-500/10 border border-amber-500/25 text-stone-100"
                      : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {isLoadingThis ? (
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
                  {inv.role !== "owner" && <Users className="w-3 h-3 shrink-0 text-stone-500 mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-b border-stone-850">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#C79A4E]/30 bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 text-[#C79A4E] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          {t.newChat}
        </button>
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
            return (
              <button
                key={s.session_id}
                onClick={() => onSelectSession(s.session_id)}
                disabled={!!loadingSessionId}
                aria-busy={isLoadingThis}
                className={`w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
                  loadingSessionId && !isLoadingThis ? "opacity-50" : ""
                } ${
                  s.session_id === activeSessionId
                    ? "bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-stone-100"
                    : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"
                }`}
              >
                {isLoadingThis ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C79A4E] animate-spin" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-500" />
                )}
                <span className="truncate leading-tight">{s.title || t.newConversationFallback}</span>
              </button>
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

