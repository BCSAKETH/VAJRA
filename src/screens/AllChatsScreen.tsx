import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MessageSquare, Search } from "lucide-react";
import { GroupedSessionList, SessionSummary, SessionMetaEntry, GroupInfo, Investigation } from "../components/GroupedSessionList";

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

// "View all conversations" -- a dedicated full-page chat list, reference:
// Claude's own "Chats and tasks" page. Reached only via the sidebar's
// bottom-of-list link, same setCurrentScreen wiring InvestigationsScreen
// already uses. Reuses GroupedSessionList's "page" variant (same card look,
// same filter/sort/menu/group logic) plus this page's own 3 new pieces:
// the "Archived only" filter, select-mode + bulk delete, and relative
// timestamps -- all built inside GroupedSessionList itself, gated to
// kind="chats" + variant="page" so no other caller is affected.
export const AllChatsScreen: React.FC = () => {
  const { t, lang, activeChatSessionId, requestChatSessionSelect, setCurrentScreen, chatSessionsRefreshNonce } = useApp();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [meta, setMeta] = useState<Record<string, SessionMetaEntry>>({});
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sessRes, metaRes, groupsRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/api/sessions`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/api/sessions/meta`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/api/groups`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/api/investigations`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      if (sessRes !== null) setSessions(sessRes);
      if (metaRes !== null) setMeta(metaRes);
      if (groupsRes !== null) setGroups(groupsRes);
      if (invRes !== null) setInvestigations(invRes);
      setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshKey, chatSessionsRefreshNonce]);

  const handleSelectSession = (sessionId: string) => {
    requestChatSessionSelect(sessionId);
    setCurrentScreen("ai_chat");
  };

  // Real client-side substring filter, same bounded-list reasoning as
  // InvestigationsScreen's own search (this officer's own already-fetched
  // sessions, never large enough to need a server round trip).
  const filteredSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(term));
  }, [sessions, searchTerm]);

  return (
    <div className="h-full flex flex-col p-6 space-y-5 bg-stone-950/20 overflow-y-auto">
      <div className="flex items-start justify-between gap-4 border-b border-stone-850 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C79A4E]/10 border border-[#C79A4E]/25 flex items-center justify-center text-[#C79A4E] shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-stone-100">
              {lang === "en" ? "All Conversations" : "ಎಲ್ಲಾ ಸಂಭಾಷಣೆಗಳು"}
            </h1>
            <p className="text-xs text-stone-500">
              {lang === "en" ? "Every chat, searchable and filterable in one place." : "ಪ್ರತಿ ಚಾಟ್, ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ ಹುಡುಕಬಹುದಾದ ಮತ್ತು ಫಿಲ್ಟರ್ ಮಾಡಬಹುದಾದ."}
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md shrink-0">
        <Search className="w-3.5 h-3.5 text-stone-600 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={lang === "en" ? "Search conversations..." : "ಸಂಭಾಷಣೆಗಳನ್ನು ಹುಡುಕಿ..."}
          className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E]/50 rounded-lg py-2 pl-9 pr-3 text-xs text-stone-200 focus:outline-none transition-all"
        />
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="text-xs text-stone-600 text-center py-10 font-mono">{t.loadingLabel}</div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16 text-stone-550 text-sm">
            {searchTerm.trim()
              ? (lang === "en" ? "No conversations match your search." : "ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.")
              : (lang === "en" ? "No conversations yet." : "ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ.")}
          </div>
        ) : (
          <GroupedSessionList
            kind="chats"
            items={filteredSessions}
            meta={meta}
            groups={groups}
            activeSessionId={activeChatSessionId}
            onSelectSession={handleSelectSession}
            isExpanded={true}
            onMutated={bumpRefresh}
            investigationsForPicker={investigations}
            variant="page"
          />
        )}
      </div>
    </div>
  );
};
