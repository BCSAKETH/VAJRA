import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import {
  MessageSquare, Folder, Users, Loader2, MoreVertical, Trash2,
  ChevronDown, ChevronRight as ChevronRightIcon, Filter, Pin, PinOff,
  Circle, Archive, ArchiveRestore, Copy, FolderInput, FileStack, Pencil, Plus,
  Check, CheckSquare, Square,
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
  // Investigations redesign: "sidebar" (default) keeps today's compact
  // button-row unchanged for every existing caller; "page" renders a bigger
  // card (title, case_no badge, last-active, role badge) for the new
  // full-page InvestigationsScreen. All state/handlers/filtering/sorting/
  // mutation logic below is 100% shared regardless of variant -- only
  // renderRow's outer JSX branches on it.
  variant?: "sidebar" | "page";
  // Sidebar spatial-rhythm fix (confirmed live gap): the sidebar used to
  // stack a standalone "Chats" label directly above this component's own
  // header row (which held only the Filter button, right-aligned, with
  // nothing on the left) -- two rows of near-empty space for what reads as
  // one logical header. Passing the label in here merges them into a single
  // row: label on the left, Filter button on the right, same as the "Select"
  // controls already occupy that slot on the All Chats page.
  headerLabel?: string;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

// Relative timestamps ("2 days ago") for `variant="page"` rows -- both here
// and on the Investigations page, for the same "feels like a real product"
// consistency the reference (Claude's own Chats page) has.
function formatRelativeTime(iso: string, lang: "en" | "kn"): string {
  if (!iso) return "";
  const t = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return lang === "en" ? "just now" : "ಈಗಷ್ಟೇ";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return lang === "en" ? `${mins}m ago` : `${mins} ನಿ ಹಿಂದೆ`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === "en" ? `${hours}h ago` : `${hours} ಗಂ ಹಿಂದೆ`;
  const days = Math.round(hours / 24);
  if (days < 7) return lang === "en" ? `${days}d ago` : `${days} ದಿನ ಹಿಂದೆ`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return lang === "en" ? `${weeks}w ago` : `${weeks} ವಾರ ಹಿಂದೆ`;
  const months = Math.round(days / 30);
  if (months < 12) return lang === "en" ? `${months}mo ago` : `${months} ತಿಂಗಳ ಹಿಂದೆ`;
  const years = Math.round(days / 365);
  return lang === "en" ? `${years}y ago` : `${years} ವರ್ಷ ಹಿಂದೆ`;
}

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
  isExpanded, onMutated, investigationsForPicker, variant = "sidebar", headerLabel,
}) => {
  const { lang, addToast, requestNewChat } = useApp();
  const [filter, setFilter] = useState<FilterSortState>(() => loadFilterState(kind));
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddToInvestigationFor, setShowAddToInvestigationFor] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // Section 17: Sidebar Pinned Workspace & Drag-and-Drop Pinning Architecture
  const [isDragOverPinned, setIsDragOverPinned] = useState(false);
  const [isDragOverUngrouped, setIsDragOverUngrouped] = useState(false);
  const [isDraggingSession, setIsDraggingSession] = useState(false);

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData("text/vajra-session-id", sessionId);
    e.dataTransfer.effectAllowed = "move";
    setIsDraggingSession(true);
  };

  const handleDragEnd = () => {
    setIsDraggingSession(false);
    setIsDragOverPinned(false);
    setIsDragOverUngrouped(false);
  };

  const handleDragOverPinned = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOverPinned) setIsDragOverPinned(true);
  };

  const handleDragLeavePinned = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOverPinned(false);
  };

  const handleDropToPin = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPinned(false);
    setIsDraggingSession(false);
    const sessionId = e.dataTransfer.getData("text/vajra-session-id");
    if (!sessionId) return;
    if (meta[sessionId]?.is_pinned) return;
    await patchSession(sessionId, { is_pinned: true });
  };

  const handleDragOverUngrouped = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOverUngrouped) setIsDragOverUngrouped(true);
  };

  const handleDragLeaveUngrouped = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOverUngrouped(false);
  };

  const handleDropToUnpin = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUngrouped(false);
    setIsDraggingSession(false);
    const sessionId = e.dataTransfer.getData("text/vajra-session-id");
    if (!sessionId) return;
    if (!meta[sessionId]?.is_pinned) return;
    await patchSession(sessionId, { is_pinned: false });
  };

  // "View all conversations" page only: select-mode + bulk delete, and the
  // "Archived only" filter toggle -- both genuinely new capabilities, gated
  // to this one page so every other GroupedSessionList caller (sidebar,
  // Investigations page) renders exactly as before.
  const isAllChatsPage = variant === "page" && kind === "chats";
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const toggleSelected = (sessionId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });

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
      // Archived items never show in the live list -- EXCEPT on the "View
      // all conversations" page with "Archived only" switched on, the one
      // real place an officer can ever see them again.
      if (filter.showArchived) {
        if (!m?.is_archived) return false;
      } else if (m?.is_archived) {
        return false;
      }
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

  // Split filtered items into dedicated pinned workspace and unpinned standard list (Section 17)
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    const pinned: (SessionSummary | Investigation)[] = [];
    const unpinned: (SessionSummary | Investigation)[] = [];
    for (const it of filtered) {
      if (meta[it.session_id]?.is_pinned) {
        pinned.push(it);
      } else {
        unpinned.push(it);
      }
    }
    return { pinnedItems: pinned, unpinnedItems: unpinned };
  }, [filtered, meta]);

  const sortedPinned = useMemo(() => {
    const arr = [...pinnedItems];
    arr.sort((a, b) => (b.last_active_at || "").localeCompare(a.last_active_at || ""));
    return arr;
  }, [pinnedItems]);

  const sortedUnpinned = useMemo(() => {
    const arr = [...unpinnedItems];
    arr.sort((a, b) => {
      if (filter.sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      return (b.last_active_at || "").localeCompare(a.last_active_at || "");
    });
    return arr;
  }, [unpinnedItems, filter.sortBy]);

  // Full visible list (pinned + unpinned combined) -- used by "Select all" on
  // the "View all conversations" page, which doesn't care about the pinned/
  // unpinned split, just every row currently on screen.
  const sorted = useMemo(() => [...sortedPinned, ...sortedUnpinned], [sortedPinned, sortedUnpinned]);

  // ---- grouping ----
  const groupsById = useMemo(() => new Map(groups.map((g) => [String(g.group_id), g])), [groups]);
  const grouped = useMemo(() => {
    const buckets = new Map<string, (SessionSummary | Investigation)[]>();
    const ungrouped: (SessionSummary | Investigation)[] = [];
    if (filter.groupBy === "none") {
      return { buckets, ungrouped: sortedUnpinned };
    }
    for (const it of sortedUnpinned) {
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
  }, [sortedUnpinned, meta, groupsById, filter.groupBy]);

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

  // "View all conversations" bulk delete -- confirms once (same pattern
  // every other destructive action here uses), then calls the EXISTING
  // per-session DELETE once per selected id. These are officer-scoped, small
  // lists -- not worth a new bulk endpoint for.
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      lang === "en"
        ? `Delete ${ids.length} conversation${ids.length > 1 ? "s" : ""}? This cannot be undone.`
        : `${ids.length} ಸಂಭಾಷಣೆ(ಗಳನ್ನು) ಅಳಿಸುವುದೇ? ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ.`
    );
    if (!confirmed) return;
    setIsBulkDeleting(true);
    let failCount = 0;
    for (const sessionId of ids) {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: "DELETE", headers: authHeaders() });
        if (!res.ok) failCount += 1;
        else if (sessionId === activeSessionId) requestNewChat();
      } catch {
        failCount += 1;
      }
    }
    setIsBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectMode(false);
    onMutated();
    if (failCount > 0) {
      addToast(
        lang === "en" ? "Some Deletions Failed" : "ಕೆಲವು ಅಳಿಸುವಿಕೆಗಳು ವಿಫಲವಾಗಿವೆ",
        lang === "en" ? `${failCount} of ${ids.length} could not be deleted.` : `${ids.length} ರಲ್ಲಿ ${failCount} ಅಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.`,
        "Warning"
      );
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

  // Investigations redesign: "Move to group" now offers "New group..."
  // inline (matching the reference screenshot) instead of requiring the
  // officer to separately use a header-level "+ group" button first (that
  // button is being removed from UnifiedSidebar entirely). Creates the
  // group, then immediately assigns THIS session to it using the id the
  // create call now returns -- one flow, no second round trip or refetch.
  const handleCreateGroup = async (sessionId: string) => {
    setOpenMenuId(null);
    const name = window.prompt(lang === "en" ? "New group name" : "ಹೊಸ ಗುಂಪಿನ ಹೆಸರು", "");
    if (!name || !name.trim()) return;
    setBusyId(sessionId);
    try {
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not create group.");
      if (!data.group_id) throw new Error("Group created, but its id wasn't returned -- try moving this chat to it from the list once it appears.");
      const assignRes = await fetch(`${API_BASE}/api/sessions/${sessionId}/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ group_id: data.group_id }),
      });
      if (!assignRes.ok) throw new Error("Group created, but couldn't move this chat into it.");
      onMutated();
    } catch (err: any) {
      addToast(lang === "en" ? "Action Failed" : "ಕ್ರಿಯೆ ವಿಫಲವಾಗಿದೆ", err.message || "Could not create group.", "Critical");
    } finally {
      setBusyId(null);
    }
  };

  // Section 17: Dedicated Pinned Pill Item Renderer
  const renderPinnedRow = (item: SessionSummary | Investigation) => {
    const m = meta[item.session_id];
    const isActive = item.session_id === activeSessionId;
    const isLoadingThis = loadingSessionId === item.session_id;
    const isBusy = busyId === item.session_id;

    return (
      <div
        key={item.session_id}
        draggable={!selectMode}
        onDragStart={(e) => handleDragStart(e, item.session_id)}
        onDragEnd={handleDragEnd}
        className="relative group"
      >
        <div
          onClick={() => (selectMode ? toggleSelected(item.session_id) : onSelectSession(item.session_id))}
          className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
            isActive
              ? "bg-stone-800 text-stone-100 font-bold shadow-sm border border-stone-700/60"
              : "bg-stone-900/60 hover:bg-stone-850 text-stone-300 hover:text-stone-100 border border-stone-850/60"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isLoadingThis || isBusy ? (
              <Loader2 className="w-3 h-3 shrink-0 animate-spin text-[#C79A4E]" />
            ) : (
              // CONFIRMED LIVE GAP: this row lives exclusively inside the
              // "Pinned" section, but its leading icon was a generic hollow
              // Circle -- unrelated to "pinned" and easy to mistake for the
              // unread-dot indicator used elsewhere in this same file. Pin
              // is the icon this row's own context menu (below) already uses
              // for the pin/unpin action, so it now matches.
              <Pin className="w-2.5 h-2.5 text-[#C79A4E] shrink-0" />
            )}
            <span className="truncate">{item.title || (lang === "en" ? "New Conversation" : "ಹೊಸ ಸಂಭಾಷಣೆ")}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === item.session_id ? null : item.session_id);
            }}
            className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-200 p-1 rounded transition-opacity cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {openMenuId === item.session_id && (
          <div
            className="absolute right-1 top-7 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-44"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleCopyId(item.session_id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
            >
              <Copy className="w-3 h-3" /> {lang === "en" ? "Copy session ID" : "ಸೆಷನ್ ID ನಕಲಿಸಿ"}
            </button>
            <button
              onClick={() => handleTogglePin(item.session_id, true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
            >
              <PinOff className="w-3 h-3" /> {lang === "en" ? "Unpin" : "ಪಿನ್ ತೆಗೆ"}
            </button>
            <button
              onClick={() => handleToggleUnread(item.session_id, !!m?.is_unread)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
            >
              <Circle className="w-3 h-3" />{" "}
              {m?.is_unread
                ? lang === "en"
                  ? "Mark as read"
                  : "ಓದಿದಂತೆ ಗುರುತಿಸಿ"
                : lang === "en"
                ? "Mark as unread"
                : "ಓದದಂತೆ ಗುರುತಿಸಿ"}
            </button>
            <button
              onClick={() => handleRename(item.session_id, item.title)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> {lang === "en" ? "Rename" : "ಮರುಹೆಸರಿಸಿ"}
            </button>
            <div className="border-t border-stone-800 my-1" />
            <button
              onClick={() => handleToggleArchive(item.session_id, !!m?.is_archived)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer"
            >
              {m?.is_archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}{" "}
              {m?.is_archived
                ? lang === "en"
                  ? "Unarchive"
                  : "ಆರ್ಕೈವ್ ರದ್ದು"
                : lang === "en"
                ? "Archive"
                : "ಆರ್ಕೈವ್ ಮಾಡಿ"}
            </button>
            <button
              onClick={() => handleDelete(item.session_id, item.title)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> {lang === "en" ? "Delete" : "ಅಳಿಸಿ"}
            </button>
          </div>
        )}
      </div>
    );
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

    const isPage = variant === "page";
    const isSelected = selectedIds.has(item.session_id);

    return (
      <div
        key={item.session_id}
        draggable={!selectMode}
        onDragStart={(e) => handleDragStart(e, item.session_id)}
        onDragEnd={handleDragEnd}
        className="relative group"
      >
        <button
          onClick={() => (selectMode ? toggleSelected(item.session_id) : onSelectSession(item.session_id))}
          disabled={!selectMode && (!!loadingSessionId || isBusy)}
          aria-busy={isLoadingThis}
          className={
            isPage
              ? `w-full text-left flex items-start gap-3 p-4 pr-9 rounded-xl border transition-all cursor-pointer disabled:cursor-wait ${
                  (loadingSessionId && !isLoadingThis) || isBusy ? "opacity-50" : ""
                } ${isSelected ? "bg-[#C79A4E]/10 border-[#C79A4E]/40 text-stone-100" : isActive ? activeCls : "border-stone-850 bg-stone-900/30 hover:bg-stone-900/60 hover:border-stone-800 text-stone-300"}`
              : `w-full text-left flex items-start gap-2 px-2.5 py-2 pr-7 rounded-lg text-xs transition-all cursor-pointer disabled:cursor-wait ${
                  (loadingSessionId && !isLoadingThis) || isBusy ? "opacity-50" : ""
                } ${isActive ? activeCls : "border border-transparent hover:bg-stone-900/60 text-stone-400 hover:text-stone-200"}`
          }
        >
          {selectMode ? (
            <span
              className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? "bg-[#C79A4E] border-[#C79A4E]" : "border-stone-600"}`}
            >
              {isSelected && <Check className="w-3 h-3 text-stone-950" />}
            </span>
          ) : isLoadingThis || isBusy ? (
            <Loader2 className={`${isPage ? "w-5 h-5" : "w-3.5 h-3.5"} shrink-0 mt-0.5 animate-spin ${spinnerCls}`} />
          ) : isInvestigation ? (
            <Folder className={`${isPage ? "w-5 h-5" : "w-3.5 h-3.5"} shrink-0 mt-0.5 ${folderCls}`} />
          ) : (
            <MessageSquare className={`${isPage ? "w-5 h-5" : "w-3.5 h-3.5"} shrink-0 mt-0.5 text-stone-500`} />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate leading-tight flex items-center gap-1.5 ${isPage ? "text-sm font-bold" : ""} ${m?.is_unread ? "font-bold text-stone-100" : ""}`}>
              {m?.is_unread && <Circle className="w-1.5 h-1.5 fill-[#C79A4E] text-[#C79A4E] shrink-0" />}
              {item.title || (lang === "en" ? "New Conversation" : "ಹೊಸ ಸಂಭಾಷಣೆ")}
              {m?.is_pinned && <Pin className="w-2.5 h-2.5 text-stone-500 shrink-0" />}
            </div>
            {isInvestigation && isPage && inv.description && (
              <div className="text-[11px] text-stone-500 truncate mt-0.5">{inv.description}</div>
            )}
            {isInvestigation && inv.case_no && (
              <div className="text-[9px] text-stone-550 font-mono truncate mt-0.5">{inv.case_no}</div>
            )}
            {isPage && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-stone-800 text-stone-500">
                  {isInvestigation ? inv.role : (lang === "en" ? "Chat" : "ಚಾಟ್")}
                </span>
                <span className="text-[9.5px] text-stone-600 font-mono">{formatRelativeTime(item.last_active_at, lang)}</span>
              </div>
            )}
          </div>
          {item.is_cowork && <Users className={`${isPage ? "w-4 h-4" : "w-3 h-3"} shrink-0 text-[#5DCAA5] mt-0.5`} />}
        </button>

        {!selectMode && (isPage || isExpanded) && canManage && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.session_id ? null : item.session_id); }}
            className={`absolute right-1 ${isPage ? "top-4" : "top-1/2 -translate-y-1/2"} p-1 rounded text-stone-600 hover:text-stone-200 hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer`}
            aria-label="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {openMenuId === item.session_id && (
          <div className={`absolute right-1 ${isPage ? "top-10" : "top-7"} z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-44`} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleCopyId(item.session_id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Copy className="w-3 h-3" /> {lang === "en" ? "Copy session ID" : "ಸೆಷನ್ ID ನಕಲಿಸಿ"}
            </button>
            <button onClick={() => handleTogglePin(item.session_id, !!m?.is_pinned)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              {m?.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />} {m?.is_pinned ? (lang === "en" ? "Unpin" : "ಪಿನ್ ತೆಗೆ") : (lang === "en" ? "Pin" : "ಪಿನ್ ಮಾಡಿ")}
            </button>
            <button onClick={() => handleToggleUnread(item.session_id, !!m?.is_unread)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Circle className="w-3 h-3" /> {m?.is_unread ? (lang === "en" ? "Mark as read" : "ಓದಿದಂತೆ ಗುರುತಿಸಿ") : (lang === "en" ? "Mark as unread" : "ಓದದಂತೆ ಗುರುತಿಸಿ")}
            </button>
            <button onClick={() => handleRename(item.session_id, item.title)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 cursor-pointer">
              <Pencil className="w-3 h-3" /> {lang === "en" ? "Rename" : "ಮರುಹೆಸರಿಸಿ"}
            </button>
            {/* "Move to group" is chats-only -- an investigation is its own
                category, not a kind of group (confirmed with user). "New
                group..." is always offered inline here now, not gated on
                groups.length, matching the reference screenshot -- no
                separate header-level "+ group" button exists anymore. */}
            {!isInvestigation && (
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
                <button onClick={() => handleCreateGroup(item.session_id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#C79A4E] hover:bg-stone-800 cursor-pointer">
                  <Plus className="w-3 h-3" /> {lang === "en" ? "New group..." : "ಹೊಸ ಗುಂಪು..."}
                </button>
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
      {isExpanded && (items.length > 0 || !!headerLabel) && (
        <div className="relative flex items-center justify-between gap-2 px-1 mb-1">
          {isAllChatsPage ? (
            selectMode ? (
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setSelectedIds(selectedIds.size === sorted.length ? new Set() : new Set(sorted.map((it) => it.session_id)))}
                  className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  {selectedIds.size === sorted.length && sorted.length > 0 ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {lang === "en" ? "Select all" : "ಎಲ್ಲಾ ಆಯ್ಕೆಮಾಡಿ"}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || isBulkDeleting}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/40 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  {lang === "en" ? `Delete (${selectedIds.size})` : `ಅಳಿಸಿ (${selectedIds.size})`}
                </button>
                <button
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                  className="text-[11px] text-stone-500 hover:text-stone-300 cursor-pointer ml-auto"
                >
                  {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 text-[11px] text-stone-500 hover:text-stone-300 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {lang === "en" ? "Select" : "ಆಯ್ಕೆಮಾಡಿ"}
              </button>
            )
          ) : headerLabel ? (
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              {headerLabel}
            </span>
          ) : (
            <span />
          )}
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
              mode={kind === "investigations" ? "investigations" : "chats"}
              lang={lang}
              allowArchivedFilter={isAllChatsPage}
            />
          )}
        </div>
      )}

      {sortedPinned.length === 0 && sortedUnpinned.length === 0 && !isDraggingSession ? (
        <div className="text-[10px] text-stone-600 text-center py-4 font-mono px-2">{emptyLabel}</div>
      ) : (
        <>
          {/* Section 17: Pinned Workspace -- strictly invisible if 0 pinned items and not dragging */}
          {(sortedPinned.length > 0 || isDragOverPinned || isDraggingSession) && (
            <div
              onDragOver={handleDragOverPinned}
              onDragLeave={handleDragLeavePinned}
              onDrop={handleDropToPin}
              className={`mb-3 pb-2 transition-all rounded-xl p-1.5 ${
                isDragOverPinned
                  ? "bg-blue-500/15 border-blue-500/60 border-dashed border shadow-lg shadow-blue-500/10"
                  : isDraggingSession && sortedPinned.length === 0
                  ? "bg-blue-500/5 border-blue-500/30 border-dashed border"
                  : "border-b border-stone-850/60"
              }`}
            >
              {/* Section Header with Relative Container for Callout */}
              <div className="relative flex items-center justify-between px-1 py-1 mb-1.5">
                <span className="text-[10.5px] font-bold text-stone-400 uppercase tracking-wider font-mono">
                  {lang === "en" ? "Pinned" : "ಪಿನ್ ಮಾಡಲಾದ"}
                </span>
              </div>

              {/* Empty drop guide when dragging over an empty pinned section */}
              {sortedPinned.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-blue-400 font-medium">
                  <Pin className="w-3.5 h-3.5 animate-bounce" />
                  <span>{lang === "en" ? "Drop here to pin" : "ಪಿನ್ ಮಾಡಲು ಇಲ್ಲಿ ಬಿಡಿ"}</span>
                </div>
              )}

              {/* Pinned Pill Items */}
              <div className="space-y-1">
                {sortedPinned.map(renderPinnedRow)}
              </div>
            </div>
          )}

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
              <div
                onDragOver={handleDragOverUngrouped}
                onDragLeave={handleDragLeaveUngrouped}
                onDrop={handleDropToUnpin}
                className={`space-y-1 pl-1 transition-all rounded-lg ${
                  isDragOverUngrouped ? "bg-stone-800/40 border border-dashed border-stone-600/50 p-1" : ""
                }`}
              >
                {grouped.ungrouped.map(renderRow)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const GroupedSessionList = React.memo(GroupedSessionListComponent);
