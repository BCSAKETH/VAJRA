import React from "react";
import { ChevronRight } from "lucide-react";

// §9.2 Grouping System: one shared dropdown UI, options passed in by the
// caller -- this is how "Status" appears in the Investigations instance and
// is genuinely absent from the regular-chats instance (confirmed with the
// user: never rendered there, not just hidden via CSS), per the
// Verification Checklist. GroupedSessionList.tsx is the only caller and
// owns/persists the actual FilterSortState; this component is purely
// presentational plus its own onChange plumbing.
export interface FilterSortState {
  type: "all" | "solo" | "cowork";
  lastActivity: "all" | "today" | "week" | "month";
  groupBy: "custom" | "none";
  sortBy: "last_active" | "title";
  showEmptyGroups: boolean;
  status: "all" | "active" | "closed"; // only ever read/shown for Investigations
}

export const DEFAULT_FILTER_SORT_STATE: FilterSortState = {
  type: "all",
  lastActivity: "all",
  groupBy: "custom",
  sortBy: "last_active",
  showEmptyGroups: false,
  status: "all",
};

interface FilterSortPanelProps {
  value: FilterSortState;
  onChange: (next: FilterSortState) => void;
  onReset: () => void;
  showStatus: boolean;
  lang: "en" | "kn";
}

const selectCls =
  "bg-stone-950/60 border border-stone-800 rounded-md text-[10px] text-stone-300 px-1.5 py-1 focus:outline-none focus:border-[#C79A4E]/50 cursor-pointer";

export const FilterSortPanel: React.FC<FilterSortPanelProps> = ({ value, onChange, onReset, showStatus, lang }) => {
  const row = (label: string, control: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-[10.5px] text-stone-400">{label}</span>
      {control}
    </div>
  );

  return (
    <div
      className="absolute right-0 top-8 z-50 w-56 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* §9.2 Loophole audit: "Status" ONLY ever renders for the
          Investigations instance -- never for regular chats, confirmed by
          this hard `showStatus` gate rather than a CSS-only hide. */}
      {showStatus &&
        row(
          lang === "en" ? "Status" : "ಸ್ಥಿತಿ",
          <select
            className={selectCls}
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value as FilterSortState["status"] })}
          >
            <option value="all">{lang === "en" ? "All" : "ಎಲ್ಲಾ"}</option>
            <option value="active">{lang === "en" ? "Active" : "ಸಕ್ರಿಯ"}</option>
            <option value="closed">{lang === "en" ? "Closed" : "ಮುಚ್ಚಲಾಗಿದೆ"}</option>
          </select>
        )}
      {row(
        lang === "en" ? "Type" : "ಪ್ರಕಾರ",
        <select
          className={selectCls}
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as FilterSortState["type"] })}
        >
          <option value="all">{lang === "en" ? "All" : "ಎಲ್ಲಾ"}</option>
          <option value="solo">{lang === "en" ? "Solo" : "ಒಂಟಿ"}</option>
          <option value="cowork">{lang === "en" ? "Cowork" : "ಸಹಯೋಗ"}</option>
        </select>
      )}
      {row(
        lang === "en" ? "Last activity" : "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ",
        <select
          className={selectCls}
          value={value.lastActivity}
          onChange={(e) => onChange({ ...value, lastActivity: e.target.value as FilterSortState["lastActivity"] })}
        >
          <option value="all">{lang === "en" ? "All" : "ಎಲ್ಲಾ"}</option>
          <option value="today">{lang === "en" ? "Today" : "ಇಂದು"}</option>
          <option value="week">{lang === "en" ? "This week" : "ಈ ವಾರ"}</option>
          <option value="month">{lang === "en" ? "This month" : "ಈ ತಿಂಗಳು"}</option>
        </select>
      )}
      {row(
        lang === "en" ? "Group by" : "ಗುಂಪು ಮಾಡಿ",
        <select
          className={selectCls}
          value={value.groupBy}
          onChange={(e) => onChange({ ...value, groupBy: e.target.value as FilterSortState["groupBy"] })}
        >
          <option value="custom">{lang === "en" ? "Custom groups" : "ಕಸ್ಟಮ್ ಗುಂಪುಗಳು"}</option>
          <option value="none">{lang === "en" ? "None" : "ಯಾವುದೂ ಇಲ್ಲ"}</option>
        </select>
      )}
      {row(
        lang === "en" ? "Sort by" : "ವಿಂಗಡಿಸಿ",
        <select
          className={selectCls}
          value={value.sortBy}
          onChange={(e) => onChange({ ...value, sortBy: e.target.value as FilterSortState["sortBy"] })}
        >
          <option value="last_active">{lang === "en" ? "Last activity" : "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ"}</option>
          <option value="title">{lang === "en" ? "Title" : "ಶೀರ್ಷಿಕೆ"}</option>
        </select>
      )}
      {row(
        lang === "en" ? "Show empty groups" : "ಖಾಲಿ ಗುಂಪುಗಳನ್ನು ತೋರಿಸಿ",
        <button
          type="button"
          onClick={() => onChange({ ...value, showEmptyGroups: !value.showEmptyGroups })}
          className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
            value.showEmptyGroups ? "bg-[#C79A4E]/70" : "bg-stone-700"
          }`}
          aria-pressed={value.showEmptyGroups}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-stone-100 transition-all ${
              value.showEmptyGroups ? "left-4" : "left-0.5"
            }`}
          />
        </button>
      )}
      <div className="border-t border-stone-800 mt-1 pt-1">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer"
        >
          <span>{lang === "en" ? "Reset to defaults" : "ಡೀಫಾಲ್ಟ್‌ಗೆ ಮರುಹೊಂದಿಸಿ"}</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
