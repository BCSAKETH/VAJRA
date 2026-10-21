import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { FolderKanban, FolderPlus, Search } from "lucide-react";
import { NewInvestigationModal } from "../components/NewInvestigationModal";
import { GroupedSessionList, Investigation, SessionMetaEntry } from "../components/GroupedSessionList";
import { NumberTicker } from "../components/ui/number-ticker";
import { RippleButton } from "../components/ui/ripple-button";
import { DotPattern } from "../components/ui/dot-pattern";
import { BlurFade } from "../components/ui/blur-fade";

// Investigations never carry a group_id through this app's own UI (see
// GroupedSessionList's "Move to group" gating, chats-only) -- an empty,
// static groups list is correct here, not a placeholder for a future fetch.
const NO_GROUPS: never[] = [];

// Investigations redesign: a dedicated full-page screen, wired exactly like
// District Analytics/Supervisor Dashboard (a plain nav destination via
// setCurrentScreen), replacing the old sidebar-embedded flat investigation
// list. Renders as one flat list (Claude Projects-style) -- investigations
// deliberately do NOT use the "group" mechanism at all (that's chats-only,
// see UnifiedSidebar/GroupedSessionList), so this reuses GroupedSessionList's
// existing filter/sort/menu logic in its "page" variant with no group UI.
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

export const InvestigationsScreen: React.FC = () => {
  const { t, lang, activeChatSessionId, requestChatSessionSelect, setCurrentScreen, chatSessionsRefreshNonce } = useApp();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [meta, setMeta] = useState<Record<string, SessionMetaEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewInvestigation, setShowNewInvestigation] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [invRes, metaRes] = await Promise.all([
        fetch(`${API_BASE}/api/investigations`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/api/sessions/meta`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      if (invRes !== null) setInvestigations(invRes);
      if (metaRes !== null) setMeta(metaRes);
      setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshKey, chatSessionsRefreshNonce]);

  const handleSelectSession = (sessionId: string) => {
    requestChatSessionSelect(sessionId);
    setCurrentScreen("ai_chat");
  };

  // Real client-side substring filter -- the list is already this officer's
  // own bounded set (owned + Cowork participant, same scope §9.9's search
  // reuses), never large enough to need a server round trip for this.
  const filteredInvestigations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return investigations;
    return investigations.filter(
      (inv) =>
        inv.title.toLowerCase().includes(term) ||
        (inv.case_no || "").toLowerCase().includes(term) ||
        (inv.description || "").toLowerCase().includes(term)
    );
  }, [investigations, searchTerm]);

  // Section 65 (Claude "Projects" parity): same centering fix as
  // AllChatsScreen.tsx -- CONFIRMED LIVE GAP against the user's own
  // reference screenshot of Claude's Projects hub, which is a centered
  // document (max-w-5xl), not an edge-to-edge stretched one.
  return (
    <div className="h-full overflow-y-auto bg-stone-950/20 relative">
      <DotPattern
        width={24}
        height={24}
        cx={1}
        cy={1}
        cr={1}
        className="opacity-15 [mask-image:radial-gradient(500px_circle_at_center,white,transparent)] pointer-events-none"
      />
      <BlurFade duration={0.35} className="max-w-5xl mx-auto flex flex-col p-6 space-y-5 relative z-10">
        <div className="flex items-start justify-between gap-4 border-b border-stone-850 pb-4 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-stone-100">{t.investigationsScreenTitle}</h1>
                {!isLoading && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[#C79A4E] text-[10.5px] font-mono font-bold">
                    <NumberTicker value={investigations.length} /> {lang === "en" ? "CASES" : "ಪ್ರಕರಣಗಳು"}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">{t.investigationsScreenDesc}</p>
            </div>
          </div>
          <RippleButton
            onClick={() => setShowNewInvestigation(true)}
            rippleColor="#C79A4E"
            className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t.newInvestigation}</span>
          </RippleButton>
        </div>

        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.investigationsSearchPlaceholder}
            className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E]/60 rounded-lg py-2 pl-9 pr-12 text-xs text-stone-200 focus:outline-none transition-all placeholder:text-stone-600 font-sans"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 rounded px-1.5 py-0.5 pointer-events-none">
            ⌘F
          </kbd>
        </div>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="text-xs text-stone-600 text-center py-10 font-mono">{t.loadingLabel}</div>
          ) : filteredInvestigations.length === 0 ? (
            <div className="text-center py-16 text-stone-550 text-sm">
              {searchTerm.trim()
                ? (lang === "en" ? "No investigations match your search." : "ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ತನಿಖೆಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.")
                : t.investigationsEmptyState}
            </div>
          ) : (
            <GroupedSessionList
              kind="investigations"
              items={filteredInvestigations}
              meta={meta}
              groups={NO_GROUPS}
              activeSessionId={activeChatSessionId}
              onSelectSession={handleSelectSession}
              isExpanded={true}
              onMutated={bumpRefresh}
              variant="page"
            />
          )}
        </div>

        {showNewInvestigation && (
          <NewInvestigationModal
            onClose={() => setShowNewInvestigation(false)}
            onCreated={(sessionId) => {
              setShowNewInvestigation(false);
              bumpRefresh();
              handleSelectSession(sessionId);
            }}
          />
        )}
      </BlurFade>
    </div>
  );
};
