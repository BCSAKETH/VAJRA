import React, { useEffect, useRef, useState } from "react";
import { useApp, ScreenId } from "../AppContext";
import { API_BASE } from "../config";
import {
  MessageSquarePlus, FolderKanban, Map, UserCheck, Loader2,
  ChevronLeft, ChevronRight, Shield, IdCard, Building2, X, LogOut,
  Settings as SettingsIcon, Search, LayoutList,
} from "lucide-react";
import { VajraLogo } from "./VajraLogo";
import { GroupedSessionList, SessionSummary, Investigation, SessionMetaEntry, GroupInfo } from "./GroupedSessionList";

// §9.1 Unified Sidebar: merges MainLayout's icon-only nav rail and
// ChatHistoryPanel's chat-only history list into ONE panel that lives in
// MainLayout (a sibling of every screen, never remounted on screen switch --
// Loophole L1) and is always present regardless of which screen is active.
// Scope decision (user, 2026-09-12): desktop docked mode only for this pass;
// mobile overlay behavior is explicitly deferred.
//
// Architecture note: the blueprint's own illustrative code passed
// activeSessionId/onSelectSession down from MainLayout as props, requiring
// AIChatScreen's whole session-select/send/poll pipeline to be lifted into
// MainLayout. That pipeline (activeSessionIdRef, pendingSessionIds,
// sessionMessagesCacheRef, the cowork WebSocket wiring, ...) is large and
// deeply stateful; lifting all of it verbatim would be a much riskier change
// than the sidebar merge itself. Instead this component talks to
// AIChatScreen through a small, explicit bridge already added to
// AppContext.tsx (activeChatSessionId/requestChatSessionSelect/
// requestNewChat/chatSessionsRefreshNonce) -- AIChatScreen still owns its
// pipeline entirely; this component only ever reads the mirrored active id
// and posts a request, exactly like NotificationBellPanel already
// self-fetches via useApp() rather than being prop-drilled from its parent.

interface OfficerProfile {
  kgid: string;
  first_name: string | null;
  station: string | null;
  rank: string | null;
  designation: string | null;
  role_tier: string | null;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

interface UnifiedSidebarProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const UnifiedSidebarComponent: React.FC<UnifiedSidebarProps> = ({ isExpanded, onToggleExpand }) => {
  const {
    t, lang, currentScreen, setCurrentScreen, roleTier, badgeNumber, setIsAuthenticated,
    activeChatSessionId, requestChatSessionSelect, requestNewChat, chatSessionsRefreshNonce,
  } = useApp();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [meta, setMeta] = useState<Record<string, SessionMetaEntry>>({});
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  // §9.9 cross-investigation search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ session_id: string; title: string; snippet: string }[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sRes, iRes, gRes, mRes] = await Promise.all([
        fetch(`${API_BASE}/api/sessions`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => null),
        fetch(`${API_BASE}/api/investigations`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => null),
        fetch(`${API_BASE}/api/groups`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => null),
        fetch(`${API_BASE}/api/sessions/meta`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      // A transient fetch failure leaves prior state alone rather than
      // blanking the sidebar (each promise resolves null, not [], on error).
      if (sRes !== null) setSessions(sRes);
      if (iRes !== null) setInvestigations(iRes);
      if (gRes !== null) setGroups(gRes);
      if (mRes !== null) setMeta(mRes);
      setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshKey, chatSessionsRefreshNonce]);

  // Debounced §9.9 search -- fires ~350ms after the officer stops typing,
  // never on every keystroke.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/search?q=${encodeURIComponent(term)}`, { headers: authHeaders() });
        setSearchResults(res.ok ? await res.json() : []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchTerm]);

  const handleSelectSession = (sessionId: string) => {
    requestChatSessionSelect(sessionId);
    if (currentScreen !== "ai_chat") setCurrentScreen("ai_chat");
  };

  const handleNewChat = () => {
    requestNewChat();
    if (currentScreen !== "ai_chat") setCurrentScreen("ai_chat");
  };

  const navItems: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    // Investigations redesign: a plain nav destination, like Claude's own
    // "Projects" sidebar link -- opens the dedicated full-page
    // InvestigationsScreen. No expansion/group rows live in the sidebar
    // itself anymore; that entire list moved to the page this opens.
    { id: "investigations" as ScreenId, label: t.navInvestigations, icon: FolderKanban },
    { id: "district_dashboard", label: t.navDistrictDashboard, icon: Map },
    ...(roleTier === "supervisor" ? [{ id: "supervisor" as ScreenId, label: t.navSupervisor, icon: UserCheck }] : []),
  ];

  // ---- profile popover (moved verbatim from MainLayout.tsx) ----
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProfileOpen || profile || profileLoading) return;
    setProfileLoading(true);
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Profile unavailable"))))
      .then((data: OfficerProfile) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [isProfileOpen, profile, profileLoading]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isProfileOpen]);

  return (
    <aside
      className={`glass-panel border-r border-stone-800 flex flex-col shrink-0 transition-all duration-300 h-full ${
        isExpanded ? "w-64" : "w-16"
      }`}
    >
      <div className="p-3 flex items-center justify-between border-b border-stone-850">
        {isExpanded ? (
          <div className="flex items-center gap-2">
            <VajraLogo size={22} />
            <span className="font-black text-xs tracking-widest text-[#C79A4E]">VAJRA</span>
          </div>
        ) : (
          <VajraLogo size={22} className="mx-auto" />
        )}
        <button
          onClick={onToggleExpand}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          className="p-1 rounded-md border border-stone-800 hover:border-stone-700 bg-stone-900/50 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
        >
          {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Fixed top nav */}
      <div className="p-3 space-y-1 border-b border-stone-850">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/30 text-[#C79A4E] text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
          {isExpanded && t.newChat}
        </button>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActiveNav = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                isActiveNav
                  ? "bg-stone-800 text-stone-100 font-semibold"
                  : "text-stone-400 hover:bg-stone-800/40 hover:text-stone-200"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {isExpanded && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* §9.9 search -- now covers every chat AND investigation the officer
          can see (bug fixed: this used to search investigations only, even
          though this sidebar shows chats only -- a query could never match
          anything visible here). */}
      {isExpanded && (
        <div className="p-2.5 border-b border-stone-850 relative">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === "en" ? "Search chats..." : "ಚಾಟ್‌ಗಳನ್ನು ಹುಡುಕಿ..."}
              className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E]/50 rounded-lg py-1.5 pl-8 pr-7 text-[11px] text-stone-200 focus:outline-none transition-all"
            />
            {isSearching && <Loader2 className="w-3 h-3 animate-spin text-stone-600 absolute right-2.5 top-1/2 -translate-y-1/2" />}
          </div>
          {searchResults !== null && (
            <div className="absolute left-2.5 right-2.5 top-full mt-1 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-stone-600">{lang === "en" ? "No matches." : "ಹೊಂದಿಕೆಗಳಿಲ್ಲ."}</div>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.session_id}
                    onClick={() => { handleSelectSession(r.session_id); setSearchTerm(""); setSearchResults(null); }}
                    className="w-full text-left px-3 py-2 border-b border-stone-850 last:border-0 hover:bg-stone-800 cursor-pointer"
                  >
                    <div className="text-[11px] font-semibold text-stone-200 truncate">{r.title}</div>
                    <div className="text-[10px] text-stone-500 truncate">{r.snippet}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Scrollable chat history -- Investigations no longer list here at
          all (moved to the dedicated page, see the nav item above); only
          Groups + "Ungrouped" chat history shows in the sidebar now,
          matching Claude's own left rail. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {isLoading ? (
          <div className="text-[10px] text-stone-600 text-center py-4 font-mono">{t.loadingLabel}</div>
        ) : (
          <div>
            {isExpanded && (
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider px-1 mb-1">
                {lang === "en" ? "Chats" : "ಚಾಟ್‌ಗಳು"}
              </div>
            )}
            <GroupedSessionList
              kind="chats"
              items={sessions}
              meta={meta}
              groups={groups}
              activeSessionId={activeChatSessionId}
              onSelectSession={handleSelectSession}
              isExpanded={isExpanded}
              onMutated={bumpRefresh}
              investigationsForPicker={investigations}
            />
            {sessions.length > 0 && (
              <button
                onClick={() => setCurrentScreen("all_chats")}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 rounded-lg text-[11px] text-stone-500 hover:bg-stone-800/40 hover:text-stone-300 transition-colors cursor-pointer"
              >
                <LayoutList className="w-3.5 h-3.5 shrink-0" />
                {isExpanded && <span className="truncate">{lang === "en" ? "View all conversations" : "ಎಲ್ಲಾ ಸಂಭಾಷಣೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ"}</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom: officer profile + Settings + Sign out -- moved
          verbatim from MainLayout.tsx's own footer card (unchanged JSX,
          just relocated so it lives in the single merged panel now). */}
      <div className="p-3 border-t border-stone-800 flex flex-col gap-3 bg-stone-950/20 relative" ref={profileRef}>
        {isProfileOpen && (
          <div className="absolute bottom-full left-3 right-3 sm:left-3 sm:right-auto sm:w-64 mb-2 glass-panel border border-stone-800 rounded-xl shadow-2xl p-4 animate-slide-up z-20">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#C79A4E]/15 border border-[#C79A4E]/30 flex items-center justify-center font-black text-xs text-[#C79A4E] shrink-0">
                  {(profile?.first_name || "KG").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-100 truncate">
                    {profileLoading ? "..." : profile?.first_name || t.profileLabel}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono truncate">{badgeNumber || `KGID: ${profile?.kgid || "—"}`}</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="p-1 rounded-md text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2 border-t border-stone-850 pt-3">
              <div className="flex items-center gap-2 text-[11px]">
                <Shield className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                <span className="text-stone-500">{lang === "en" ? "Rank" : "ಶ್ರೇಣಿ"}</span>
                <span className="ml-auto text-stone-200 font-semibold truncate">{profileLoading ? "…" : profile?.rank || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <IdCard className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                <span className="text-stone-500">{lang === "en" ? "Designation" : "ಪದನಾಮ"}</span>
                <span className="ml-auto text-stone-200 font-semibold truncate">{profileLoading ? "…" : profile?.designation || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <Building2 className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                <span className="text-stone-500">{lang === "en" ? "Station" : "ಠಾಣೆ"}</span>
                <span className="ml-auto text-stone-200 font-semibold truncate">{profileLoading ? "…" : profile?.station || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <UserCheck className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                <span className="text-stone-500">{lang === "en" ? "Access Tier" : "ಪ್ರವೇಶ ಸ್ತರ"}</span>
                <span className="ml-auto text-[#C79A4E] font-bold uppercase text-[10px] font-mono">{profileLoading ? "…" : profile?.role_tier || roleTier || "—"}</span>
              </div>
            </div>
          </div>
        )}

        <div className={isExpanded ? "flex items-center gap-1.5 w-full" : "flex flex-col items-center gap-2.5"}>
          <button
            onClick={() => setIsProfileOpen((v) => !v)}
            className={`flex items-center gap-3 rounded-lg transition-colors cursor-pointer ${isExpanded ? "p-1.5 -m-1.5 hover:bg-stone-800/50 flex-1 min-w-0" : ""}`}
            aria-label={t.profileLabel}
          >
            <div className={`w-8 h-8 rounded-full bg-stone-800 border flex items-center justify-center font-bold text-xs text-[#C79A4E] shrink-0 transition-colors ${isProfileOpen ? "border-[#C79A4E]" : "border-stone-750"}`}>
              KG
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-stone-300 truncate">{t.profileLabel}</p>
                <p className="text-[10px] text-stone-500 truncate">{badgeNumber || "KGID: 4003385"}</p>
              </div>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentScreen("settings"); setIsProfileOpen(false); }}
            title={t.navSettings}
            aria-label={t.navSettings}
            className={`shrink-0 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${isExpanded ? "p-1.5" : "w-8 h-8"} ${
              currentScreen === "settings"
                ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E] shadow-[0_0_10px_rgba(199,154,78,0.2)]"
                : "border-stone-800/70 hover:border-stone-700 bg-stone-900/40 hover:bg-stone-800/70 text-stone-400 hover:text-[#C79A4E]"
            }`}
          >
            <SettingsIcon className={`w-4 h-4 transition-transform duration-300 ${currentScreen === "settings" ? "rotate-45 text-[#C79A4E]" : "hover:rotate-45"}`} />
          </button>
        </div>

        <button
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center gap-3 py-2 px-3 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-left cursor-pointer"
        >
          <LogOut className="w-5 h-5 shrink-0 text-stone-400 hover:text-rose-400" />
          {isExpanded && <span className="text-sm">{t.signOut}</span>}
        </button>
      </div>

    </aside>
  );
};

export const UnifiedSidebar = React.memo(UnifiedSidebarComponent);
