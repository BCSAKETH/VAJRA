import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import {
  MessageSquare, Folder, Users, Loader2, MoreVertical, Trash2,
  ChevronDown, ChevronRight as ChevronRightIcon, Filter, Pin, PinOff,
  Circle, Archive, ArchiveRestore, Copy, FolderInput, FileStack, Pencil,
} from "lucide-react";
import { FilterSortPanel, FilterSortState, DEFAULT_FILTER_SORT_STATE } from "./FilterSortPanel";

export interface SessionSummary {
  session_id: string;
  title: string;
  last_active_at: string;
  is_cowork?: boolean;
}

export interface Investigation {
  session_id: string;
  title: string;
  description: string;
  case_no: string | null;
  last_active_at: string;
  role: string;
  is_cowork?: boolean;
}

export interface SessionMetaEntry {
  group_id: string | number | null;
  is_pinned: boolean;
  is_unread: boolean;
  is_archived: boolean;
  status: "active" | "closed" | string;
}

export interface GroupInfo {
  group_id: number;
  name: string;
}

type ListItem = (SessionSummary | Investigation) & { _isInvestigation: boolean };

interface GroupedSessionListProps {
  kind: "chats" | "investigations";
  items: (SessionSummary | Investigation)[];
  meta: Record<string, SessionMetaEntry>;
  groups: GroupInfo[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  loadingSessionId?: string | null;
  isExpanded: boolean;
  // Called after ANY mutating action (rename/pin/archive/group/delete/...)
  // so the parent re-fetches sessions + investigations + meta + groups in
  // one place, instead of every row managing its own partial refresh.
  onMutated: () => void;
  // Only meaningful for kind === "chats": the real Investigations list, used
  // by the "Add to Investigation" submenu picker (§9.3).
  investigationsForPicker?: Investigation[];
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

const FILTER_STORAGE_KEY = (kind: string) => `vajra_filtersort_${kind}`;

function loadFilterState(kind: string): FilterSortState {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY(kind));
    if (saved) return { ...DEFAULT_FILTER_SORT_STATE, ...JSON.parse(saved) };
  } catch {
    /* corrupt localStorage value -- fall back to defaults, never crash the sidebar */
  }
  return DEFAULT_FILTER_SORT_STATE;
}

const GroupedSessionListComponent: React.FC<GroupedSessionListProps> = ({
  kind, items, meta, groups, activeSessionId, onSelectSession, loadingSessionId,
  isExpanded, onMutated, investigationsForPicker,
}) => {
  const { lang, addToast, requestNewChat } = useApp();
  const [filter, setFilter] = useState<FilterSortState>(() => loadFilterState(kind));
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddToInvestigationFor, setShowAddToInvestigationFor] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY(kind), JSON.stringify(filter));
  }, [filter, kind]);

  const setFilterAndPersist = (next: FilterSortState) => setFilter(next);
  const resetFilter = () => setFilter(DEFAULT_FILTER_SORT_STATE);

  // ---- filtering + sorting (client-side -- see §9.2 Loophole audit: bounded
  // to this officer's own already-fetched lists, no extra round trip) ----
  const now = Date.now();
  const withinActivity = (iso: string): boolean => {
    if (filter.lastActivity === "all") return true;
    const t = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`).getTime();
    if (Number.isNaN(t)) return true;
    const days = (now - t) / 86400000;
    if (filter.lastActivity === "today") return days <= 1;
    if (filter.lastActivity === "week") return days <= 7;
    if (filter.lastActivity === "month") return days <= 31;
    return true;
  };

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const m = meta[it.session_id];
      if (m?.is_archived) return false; // archived items never show in the live list
      if (filter.type === "solo" && it.is_cowork) return false;
      if (filter.type === "cowork" && !it.is_cowork) return false;
      if (kind === "investigations" && filter.status !== "all") {
        const st = m?.status || "active";
        if (filter.status !== st) return false;
      }
      if (!withinActivity(it.last_active_at)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, meta, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      // Pinned always float to the top regardless of sort mode.
      const pa = meta[a.session_id]?.is_pinned ? 1 : 0;
      const pb = meta[b.session_id]?.is_pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (filter.sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      return (b.last_active_at || "").localeCompare(a.last_active_at || "");
    });
    return arr;
  }, [filtered, meta, filter.sortBy]);

  // ---- grouping ----
  const groupsById = useMemo(() => new Map(groups.map((g) => [String(g.group_id), g])), [groups]);
  const grouped = useMemo(() => {
    const buckets = new Map<string, (SessionSummary | Investigation)[]>();
    const ungrouped: (SessionSummary | Investigation)[] = [];
    if (filter.groupBy === "none") {
      return { buckets, ungrouped: sorted };
    }
    for (const it of sorted) {
      const gid = meta[it.session_id]?.group_id;
      if (gid !== null && gid !== undefined && gid !== "" && groupsById.has(String(gid))) {
        const key = String(gid);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(it);
      } else {
        ungrouped.push(it);
      }
    }
    return { buckets, ungrouped };
  }, [sorted, meta, groupsById, filter.groupBy]);

  const visibleGroupIds = useMemo(() => {
    const ids = Array.from(groupsById.keys());
    return filter.showEmptyGroups ? ids : ids.filter((id) => (grouped.buckets.get(id) || []).length > 0);
  }, [groupsById, grouped, filter.showEmptyGroups]);

  const toggleGroupCollapse = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---- mutations ----
  const patchSession = async (sessionId: string, body: Record<string, unknown>) => {
    setBusyId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Update failed.");
      }
      onMutated();
    } catch (err: any) {
      addToast(
        lang === "en" ? "Action Failed" : "ಕ್ರಿಯೆ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not update this conversation." : "ಈ ಸಂಭಾಷಣೆಯನ್ನು ನವೀಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRename = (sessionId: string, currentTitle: string) => {
    setOpenMenuId(null);
    const next = window.prompt(lang === "en" ? "Rename conversation" : "ಸಂಭಾಷಣೆಯನ್ನು ಮರುಹೆಸರಿಸಿ", currentTitle || "");
    if (next === null) return;
    if (!next.trim()) {
      addToast(
        lang === "en" ? "Rename Failed" : "ಮರುಹೆಸರಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Title cannot be empty." : "ಶೀರ್ಷಿಕೆ ಖಾಲಿಯಾಗಿರಬಾರದು.",
        "Warning"
      );
      return;
    }
    patchSession(sessionId, { title: next.trim() });
  };

  const handleTogglePin = (sessionId: string, currentlyPinned: boolean) => {
    setOpenMenuId(null);
    patchSession(sessionId, { is_pinned: !currentlyPinned });
  };

  const handleToggleUnread = (sessionId: string, currentlyUnread: boolean) => {
    setOpenMenuId(null);
    patchSession(sessionId, { is_unread: !currentlyUnread });
  };

  const handleToggleArchive = (sessionId: string, currentlyArchived: boolean) => {
    setOpenMenuId(null);
    patchSession(sessionId, { is_archived: !currentlyArchived });
  };

  const handleCopyId = (sessionId: string) => {
    setOpenMenuId(null);
    navigator.clipboard?.writeText(sessionId).then(
      () =>
        addToast(
          lang === "en" ? "Copied" : "ನಕಲಿಸಲಾಗಿದೆ",
          lang === "en" ? "Session ID copied to clipboard." : "ಸೆಷನ್ ID ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.",
          "Info"
        ),
      () => {}
    );
  };

  const handleDuplicateAsInvestigation = async (sessionId: string) => {
    setOpenMenuId(null);
    setBusyId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/duplicate-as-investigation`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Could not duplicate as an Investigation.");
      }
      addToast(
        lang === "en" ? "Investigation Created" : "ತನಿಖೆ ರಚಿಸಲಾಗಿದೆ",
        lang === "en" ? "A new Investigation was created from this chat." : "ಈ ಚಾಟ್‌ನಿಂದ ಹೊಸ ತನಿಖೆ ರಚಿಸಲಾಗಿದೆ.",
        "Success"
      );
      onMutated();
    } catch (err: any) {
      addToast(
        lang === "en" ? "Action Failed" : "ಕ್ರಿಯೆ ವಿಫಲವಾಗಿದೆ",
        err.message,
        "Critical"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAddToInvestigation = async (sourceSessionId: string, targetInvestigationId: string) => {
    setShowAddToInvestigationFor(null);
    setOpenMenuId(null);
    setBusyId(sourceSessionId);
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${targetInvestigationId}/absorb-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ source_session_id: sourceSessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Could not add to that Investigation.");
      }
      addToast(
        lang === "en" ? "Added to Investigation" : "ತನಿಖೆಗೆ ಸೇರಿಸಲಾಗಿದೆ",
        lang === "en" ? "This conversation's messages were copied into the Investigation." : "ಈ ಸಂಭಾಷಣೆಯ ಸಂದೇಶಗಳನ್ನು ತನಿಖೆಗೆ ನಕಲಿಸಲಾಗಿದೆ.",
        "Success"
      );
      onMutated();
    } catch (err: any) {
      addToast(lang === "en" ? "Action Failed" : "ಕ್ರಿಯೆ ವಿಫಲವಾಗಿದೆ", err.message, "Critical");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (sessionId: string, title: string) => {
    setOpenMenuId(null);
    const confirmed = window.confirm(
      lang === "en"
        ? `Delete "${title || "this conversation"}"? This cannot be undone.`
        : `"${title || "ಈ ಸಂಭಾಷಣೆ"}" ಅನ್ನು ಅಳಿಸುವುದೇ? ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.`
    );
    if (!confirmed) return;
    setBusyId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Delete failed.");
      }
      // The active conversation was just deleted from underneath the
      // officer -- reset to a blank new chat rather than leaving a dangling
      // thread on screen referencing an id that no longer exists.
      if (sessionId === activeSessionId) requestNewChat();
      onMutated();
    } catch (err: any) {
      addToast(
        lang === "en" ? "Delete Failed" : "ಅಳಿಸುವಿಕೆ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not delete this conversation." : "ಈ ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignGroup = async (sessionId: string, groupId: number | null) => {
    setOpenMenuId(null);
    setBusyId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Could not move to that group.");
      }
      onMutated();
    } catch (err: any) {
      addToast(lang === "en" ? "Action Failed" : "ಕ್ರಿಯೆ ವಿಫಲವಾಗಿದೆ", err.message, "Critical");
    } finally {
      setBusyId(null);
    }
  };

  // ---- row rendering ----
  const renderRow = (item: SessionSummary | Investigation) => {
    const isInvestigation = kind === "investigations";
    const inv = item as Investigation;
    const m = meta[item.session_id];
    const isActive = item.session_id === activeSessionId;
    const isLoadingThis = loadingSessionId === item.session_id;
    const isBusy = busyId === item.session_id;
    const canManage = !isInvestigation || inv.role === "owner";
    // Literal class names (not string-interpolated) -- Tailwind's JIT scan
    // can't see a dynamic `bg-${accent}/10` and would silently drop the
    // class from the generated CSS, same reasoning ChatHistoryPanel's own
    // ternaries already followed.
    const activeCls = isInvestigation
      ? "bg-amber-500/10 border border-amber-500/25 text-stone-100"
      : "bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-stone-100";
    const spinnerCls = isInvestigation ? "text-amber-500" : "text-[#C79A4E]";
    const folderCls = isInvestigation ? "text-amber-500" : "text-[#C79A4E]";

    return (
      <div key={item.session_id} className="relative group">
        <button
          onClick={() => onSelectSession(item.session_id)}
          disabled={!!loadingSessionId || isBusy}
          aria-busy={isLoadingThis}
          className={`w-full text-left flex items-start gap-2 px-2.5 py-2 pr-7 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
            (loadingSessionId && !isLoadingThis) || isBusy ? "opacity-50" : ""
          } ${
            isActive ? activeCls : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"
          }`}
        >
          {isLoadingThis || isBusy ? (
            <Loader2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin ${spinnerCls}`} />
          ) : isInvestigation ? (
            <Folder className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${folderCls}`} />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-500" />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate leading-tight flex items-center gap-1 ${m?.is_unread ? "font-bold text-stone-100" : ""}`}>
              {m?.is_unread && <Circle className="w-1.5 h-1.5 fill-[#C79A4E] text-[#C79A4E] shrink-0" />}
              {item.title || (lang === "en" ? "New Conversation" : "ಹೊಸ ಸಂಭಾಷಣೆ")}
              {m?.is_pinned && <Pin className="w-2.5 h-2.5 text-stone-500 shrink-0" />}
            </div>
            {isInvestigation && inv.case_no && (
              <div className="text-[9px] text-stone-550 font-mono truncate">{inv.case_no}</div>
            )}
          </div>
          {item.is_cowork && <Users className="w-3 h-3 shrink-0 text-[#5DCAA5] mt-0.5" />}
        </button>

        {isExpanded && canManage && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.session_id ? null : item.session_id); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-stone-600 hover:text-stone-200 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {openMenuId === item.session_id && (
          <div className="absolute right-1 top-7 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-44" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleRename(item.session_id, item.title)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Pencil className="w-3 h-3" /> {lang === "en" ? "Rename" : "ಮರುಹೆಸರಿಸಿ"}
            </button>
            <button onClick={() => handleTogglePin(item.session_id, !!m?.is_pinned)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              {m?.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />} {m?.is_pinned ? (lang === "en" ? "Unpin" : "ಪಿನ್ ತೆಗೆ") : (lang === "en" ? "Pin" : "ಪಿನ್ ಮಾಡಿ")}
            </button>
            <button onClick={() => handleToggleUnread(item.session_id, !!m?.is_unread)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Circle className="w-3 h-3" /> {m?.is_unread ? (lang === "en" ? "Mark as read" : "ಓದಿದಂತೆ ಗುರುತಿಸಿ") : (lang === "en" ? "Mark as unread" : "ಓದದಂತೆ ಗುರುತಿಸಿ")}
            </button>
            {groups.length > 0 && (
              <div className="border-t border-stone-800 my-1 pt-1">
                <div className="px-3 py-1 text-[9px] text-stone-600 uppercase font-mono">{lang === "en" ? "Move to group" : "ಗುಂಪಿಗೆ ಸರಿಸಿ"}</div>
                {groups.map((g) => (
                  <button key={g.group_id} onClick={() => handleAssignGroup(item.session_id, g.group_id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
                    <FolderInput className="w-3 h-3" /> {g.name}
                  </button>
                ))}
                {m?.group_id != null && (
                  <button onClick={() => handleAssignGroup(item.session_id, null)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-500 hover:bg-stone-800 cursor-pointer">
                    {lang === "en" ? "Remove from group" : "ಗುಂಪಿನಿಂದ ತೆಗೆ"}
                  </button>
                )}
              </div>
            )}
            {!isInvestigation && (
              <>
                <div className="border-t border-stone-800 my-1" />
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAddToInvestigationFor(showAddToInvestigationFor === item.session_id ? null : item.session_id); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
                  >
                    <FolderInput className="w-3 h-3" /> {lang === "en" ? "Add to Investigation" : "ತನಿಖೆಗೆ ಸೇರಿಸಿ"}
                  </button>
                  {showAddToInvestigationFor === item.session_id && (
                    <div className="absolute left-full top-0 ml-1 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-48 max-h-52 overflow-y-auto">
                      {(investigationsForPicker || []).length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-stone-600">{lang === "en" ? "No Investigations yet." : "ಇನ್ನೂ ತನಿಖೆಗಳಿಲ್ಲ."}</div>
                      ) : (
                        (investigationsForPicker || []).map((inv2) => (
                          <button key={inv2.session_id} onClick={() => handleAddToInvestigation(item.session_id, inv2.session_id)} className="w-full text-left truncate px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
                            {inv2.title}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => handleDuplicateAsInvestigation(item.session_id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
                  <FileStack className="w-3 h-3" /> {lang === "en" ? "Duplicate as new Investigation" : "ಹೊಸ ತನಿಖೆಯಾಗಿ ನಕಲಿಸಿ"}
                </button>
              </>
            )}
            <div className="border-t border-stone-800 my-1" />
            <button onClick={() => handleToggleArchive(item.session_id, !!m?.is_archived)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              {m?.is_archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />} {m?.is_archived ? (lang === "en" ? "Unarchive" : "ಆರ್ಕೈವ್ ರದ್ದು") : (lang === "en" ? "Archive" : "ಆರ್ಕೈವ್ ಮಾಡಿ")}
            </button>
            <button onClick={() => handleCopyId(item.session_id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Copy className="w-3 h-3" /> {lang === "en" ? "Copy session ID" : "ಸೆಷನ್ ID ನಕಲಿಸಿ"}
            </button>
            <button onClick={() => handleDelete(item.session_id, item.title)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer">
              <Trash2 className="w-3 h-3" /> {lang === "en" ? "Delete" : "ಅಳಿಸಿ"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const emptyLabel =
    kind === "chats"
      ? lang === "en" ? "No past conversations yet." : "ಇನ್ನೂ ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ."
      : lang === "en" ? "No Investigations yet." : "ಇನ್ನೂ ತನಿಖೆಗಳಿಲ್ಲ.";

  return (
    <div className="space-y-1">
      {(openMenuId || showAddToInvestigationFor || showFilterPanel) && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpenMenuId(null); setShowAddToInvestigationFor(null); setShowFilterPanel(false); }} />
      )}
      {isExpanded && items.length > 0 && (
        <div className="relative flex justify-end px-1 mb-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFilterPanel((v) => !v); }}
            className="p-1 rounded-md text-stone-600 hover:text-stone-300 hover:bg-stone-800/60 cursor-pointer"
            aria-label="Filter and sort"
            title={lang === "en" ? "Filter & sort" : "ಫಿಲ್ಟರ್ ಮತ್ತು ವಿಂಗಡಣೆ"}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          {showFilterPanel && (
            <FilterSortPanel
              value={filter}
              onChange={setFilterAndPersist}
              onReset={resetFilter}
              showStatus={kind === "investigations"}
              lang={lang}
            />
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-[10px] text-stone-600 text-center py-4 font-mono px-2">{emptyLabel}</div>
      ) : (
        <>
          {filter.groupBy !== "none" &&
            visibleGroupIds.map((gid) => {
              const g = groupsById.get(gid)!;
              const members = grouped.buckets.get(gid) || [];
              const isCollapsed = collapsedGroups.has(gid);
              return (
                <div key={gid} className="mb-1">
                  <button
                    onClick={() => toggleGroupCollapse(gid)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:text-stone-300 cursor-pointer"
                  >
                    {isCollapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded && <span className="truncate">{g.name}</span>}
                    {isExpanded && <span className="text-stone-700">({members.length})</span>}
                  </button>
                  {!isCollapsed && <div className="space-y-1 pl-1">{members.map(renderRow)}</div>}
                </div>
              );
            })}

          <div>
            {filter.groupBy !== "none" && visibleGroupIds.length > 0 && (
              <button
                onClick={() => toggleGroupCollapse("__ungrouped__")}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:text-stone-300 cursor-pointer"
              >
                {collapsedGroups.has("__ungrouped__") ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {isExpanded && <span>{lang === "en" ? "Ungrouped" : "ಗುಂಪು ಮಾಡದ"}</span>}
                {isExpanded && <span className="text-stone-700">({grouped.ungrouped.length})</span>}
              </button>
            )}
            {!collapsedGroups.has("__ungrouped__") && (
              <div className="space-y-1 pl-1">{grouped.ungrouped.map(renderRow)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const GroupedSessionList = React.memo(GroupedSessionListComponent);
