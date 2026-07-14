import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { MessageSquarePlus, MessageSquare } from "lucide-react";

interface SessionSummary {
  session_id: string;
  title: string;
  last_active_at: string;
}

interface ChatHistoryPanelProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshKey: number;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshKey,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="w-56 shrink-0 border-r border-slate-850 bg-slate-950/30 flex flex-col h-full">
      <div className="p-3 border-b border-slate-850">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#00C6AD]/30 bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 text-[#00C6AD] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="text-[10px] text-slate-600 text-center py-4 font-mono">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-[10px] text-slate-600 text-center py-4 font-mono px-2">
            No past conversations yet.
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => onSelectSession(s.session_id)}
              className={`w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                s.session_id === activeSessionId
                  ? "bg-[#00C6AD]/10 border border-[#00C6AD]/25 text-slate-100"
                  : "border border-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
              <span className="truncate leading-tight">{s.title || "New Conversation"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
