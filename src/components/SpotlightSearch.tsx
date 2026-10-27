import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, UserX, FileText, Scale, Terminal, Database, ArrowRight, CornerDownLeft, Shield } from "lucide-react";
import { useApp } from "../AppContext";

export type SpotlightCategory = "ALL" | "SUSPECT" | "CRIME NO" | "STATUTE" | "AGENT LOG" | "MEMORY";

export interface SpotlightItem {
  id: string;
  category: "SUSPECT" | "CRIME NO" | "STATUTE" | "AGENT LOG" | "MEMORY";
  title: string;
  subtitle: string;
  badge: string;
  details: string;
  targetScreen?: string;
  actionPayload?: any;
}

const DEFAULT_INDEX: SpotlightItem[] = [
  {
    id: "s-1",
    category: "SUSPECT",
    title: "Suresh 'Blade' Naik",
    subtitle: "KGID-44102 | Belagavi North | PSOTI: 94",
    badge: "High Risk",
    details: "Belagavi North PS • Active Shutter Syndicate • Non-Bailable Warrant Pending",
    targetScreen: "investigations",
  },
  {
    id: "s-2",
    category: "SUSPECT",
    title: "Vijay Patil",
    subtitle: "Inter-State Courier | Hubballi-Belagavi Border | Active",
    badge: "Syndicate Lead",
    details: "Linked to CR 89/2026 • Cell tower active near Nippani border",
    targetScreen: "investigations",
  },
  {
    id: "c-1",
    category: "CRIME NO",
    title: "CR 89/2026",
    subtitle: "Hubballi Town PS | Sec 303(2) BNS | Remand Day 48",
    badge: "Remand Alert",
    details: "Remand Day 48/60. Chargesheet draft pending FSL ballistics report.",
    targetScreen: "investigations",
  },
  {
    id: "c-2",
    category: "CRIME NO",
    title: "CR 104/2026",
    subtitle: "Khade Bazar PS | Sec 111 BNS | Organized Crime",
    badge: "Active Inquest",
    details: "Syndicate bank mule accounts frozen under BSA Section 63.",
    targetScreen: "investigations",
  },
  {
    id: "l-1",
    category: "AGENT LOG",
    title: "#DOT-1930-CYBER",
    subtitle: "Flagged 2 mule accounts related to Suresh",
    badge: "Automated OSINT",
    details: "SBI Belagavi IFSC branch frozen • Transaction velocity ₹4.8 Lakhs in 18 mins",
    targetScreen: "agent_workspace",
  },
  {
    id: "l-2",
    category: "AGENT LOG",
    title: "#KSP-PORTAL-SCRAPE-882",
    subtitle: "e-Courts Karnataka Case Diary Synced",
    badge: "Court Stream",
    details: "Bail hearing listed before District & Sessions Court, Dharwad on 28th.",
    targetScreen: "agent_workspace",
  },
  {
    id: "st-1",
    category: "STATUTE",
    title: "Section 187 BNSS",
    subtitle: "Custody and Default Bail 60/90 Day Directives",
    badge: "Procedural Rule",
    details: "Mandatory 60-day police/judicial custody statutory limit before compulsory default bail.",
    targetScreen: "ai_chat",
  },
  {
    id: "st-2",
    category: "STATUTE",
    title: "Section 303(2) BNS",
    subtitle: "Theft with Previous Conviction Enhancement",
    badge: "Penal Code",
    details: "Rigorous imprisonment up to 5 years with mandatory recidivism registry endorsement.",
    targetScreen: "ai_chat",
  },
  {
    id: "st-3",
    category: "STATUTE",
    title: "Section 63 BSA 2023",
    subtitle: "Admissibility of Electronic Records & Cryptographic Hash",
    badge: "Evidence Standard",
    details: "Mandatory SHA-256 digital certificate signed by investigating officer.",
    targetScreen: "ai_chat",
  },
  {
    id: "m-1",
    category: "MEMORY",
    title: "Session \"Hubballi Shutter Gang\"",
    subtitle: "Vijay Patil courier identified near Belagavi border",
    badge: "Vault Ledger",
    details: "Continuous rolling ledger synthesized from active interrogation turns.",
    targetScreen: "ai_chat",
  },
];

export const SpotlightSearch: React.FC = () => {
  const { setCurrentScreen } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SpotlightCategory>("ALL");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicItems, setDynamicItems] = useState<SpotlightItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K listener and custom event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleOpenCustomEvent = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-spotlight-search", handleOpenCustomEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-spotlight-search", handleOpenCustomEvent);
    };
  }, [isOpen]);

  // Focus input on open and reset state
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Fetch dynamic memory records from backend
      fetch("/api/memory/narratives")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: any[]) => {
          if (Array.isArray(data) && data.length > 0) {
            const memoryItems: SpotlightItem[] = data.map((d, idx) => ({
              id: `mem-live-${idx}`,
              category: "MEMORY",
              title: `Session: ${d.session_id}`,
              subtitle: (d.narrative_text || "").split("\n")[0]?.slice(0, 75) || "Active Case Memory",
              badge: "Live Ledger",
              details: d.narrative_text || "",
              targetScreen: "ai_chat",
            }));
            setDynamicItems(memoryItems);
          }
        })
        .catch(() => {});
    } else {
      setQuery("");
      setCategory("ALL");
    }
  }, [isOpen]);

  // Combine static index + fetched dynamic memory items
  const allItems = useMemo(() => {
    return [...DEFAULT_INDEX, ...dynamicItems];
  }, [dynamicItems]);

  // Sub-10ms UI Filtering
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      if (category !== "ALL" && item.category !== category) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q)
      );
    });
  }, [allItems, query, category]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredResults.length) {
      setSelectedIndex(Math.max(0, filteredResults.length - 1));
    }
  }, [filteredResults, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: SpotlightItem) => {
    setIsOpen(false);
    if (item.targetScreen) {
      setCurrentScreen(item.targetScreen);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  const categories: SpotlightCategory[] = ["ALL", "SUSPECT", "CRIME NO", "STATUTE", "AGENT LOG", "MEMORY"];

  const getCategoryIcon = (cat: SpotlightCategory) => {
    switch (cat) {
      case "SUSPECT":
        return <UserX className="w-3.5 h-3.5 text-rose-400" />;
      case "CRIME NO":
        return <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />;
      case "STATUTE":
        return <Scale className="w-3.5 h-3.5 text-amber-400" />;
      case "AGENT LOG":
        return <Terminal className="w-3.5 h-3.5 text-cyan-400" />;
      case "MEMORY":
        return <Database className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-[#C79A4E]" />;
    }
  };

  const getCategoryBadgeClass = (cat: SpotlightCategory) => {
    switch (cat) {
      case "SUSPECT":
        return "bg-rose-950/50 text-rose-300 border-rose-800/60";
      case "CRIME NO":
        return "bg-amber-950/50 text-amber-300 border-amber-800/60";
      case "STATUTE":
        return "bg-yellow-950/50 text-yellow-300 border-yellow-800/60";
      case "AGENT LOG":
        return "bg-cyan-950/50 text-cyan-300 border-cyan-800/60";
      case "MEMORY":
        return "bg-emerald-950/50 text-emerald-300 border-emerald-800/60";
      default:
        return "bg-stone-800 text-stone-300 border-stone-700";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-3xl bg-stone-900 glass-panel border border-[#C79A4E]/40 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-stone-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-800/80 bg-stone-950/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C79A4E] animate-pulse" />
            <span className="text-[11px] font-mono font-semibold tracking-wider text-[#C79A4E] uppercase">
              Universal Spotlight Search • VAJRA 3.0
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-stone-900 border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors"
          >
            ESC TO CLOSE
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3 border-b border-stone-800 bg-stone-950/60">
          <Search className="w-5 h-5 text-[#C79A4E] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search suspects, crime numbers, statutory sections, or agent tickets..."
            className="w-full bg-transparent text-sm text-stone-100 placeholder-stone-500 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-stone-500 hover:text-stone-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Category Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-stone-800/60 bg-stone-950/40 overflow-x-auto scrollbar-none">
          {categories.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-mono tracking-wider transition-colors flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/50 font-semibold shadow-sm"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-900 border border-transparent"
                }`}
              >
                {getCategoryIcon(cat)}
                [{cat}]
              </button>
            );
          })}
        </div>

        {/* Matching Records List */}
        <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-stone-500 bg-stone-950/20 border-b border-stone-800/40">
          Matching records across memory, chats & OSINT ({filteredResults.length}):
        </div>

        <div ref={listRef} className="max-h-[360px] overflow-y-auto divide-y divide-stone-800/50 p-1">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#C79A4E]" />
              <p className="text-xs font-mono">No matching records found for "{query}"</p>
              <p className="text-[11px] text-stone-600 mt-1">
                Try searching by suspect name, statute (e.g. §187 BNSS), or ticket ID (#DOT-1930)
              </p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-start justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-stone-900/90 border border-[#C79A4E]/40 shadow-[0_2px_12px_rgba(199,154,78,0.12)]"
                      : "hover:bg-stone-900/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-4">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border shrink-0 mt-0.5 ${getCategoryBadgeClass(
                        item.category
                      )}`}
                    >
                      {getCategoryIcon(item.category)}
                      [{item.category}]
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-100 font-sans tracking-wide">
                          {item.title}
                        </span>
                        <span className="text-stone-500 text-[11px]">•</span>
                        <span className="text-[11px] text-stone-400 font-mono truncate">
                          {item.subtitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400/90 mt-0.5 line-clamp-1">
                        {item.details}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-400">
                      {item.badge}
                    </span>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[#C79A4E] bg-[#C79A4E]/10 px-2 py-0.5 rounded border border-[#C79A4E]/30 animate-in fade-in duration-100">
                        Enter: Open
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-stone-600 opacity-60" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Instructions */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-stone-800/80 bg-stone-950/80 text-[11px] font-mono text-stone-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-stone-900 border border-stone-700 rounded text-[10px] text-stone-300 mr-1">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-stone-900 border border-stone-700 rounded text-[10px] text-stone-300 mr-1">
                ↓
              </kbd>
              Select
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-stone-900 border border-stone-700 rounded text-[10px] text-stone-300 mr-1">
                ↵
              </kbd>
              Navigate
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-stone-900 border border-stone-700 rounded text-[10px] text-stone-300 mr-1">
                ESC
              </kbd>
              Dismiss
            </span>
          </div>
          <div className="text-[10px] text-stone-500">
            Press <span className="text-[#C79A4E]">Ctrl+K</span> anywhere to toggle
          </div>
        </div>
      </div>
    </div>
  );
};
