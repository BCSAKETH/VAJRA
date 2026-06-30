import React, { useState, useEffect, useRef } from "react";
import { useApp, ScreenId } from "../AppContext";
import { mockFIRs, mockLiveAlerts, mockAccused } from "../mockData";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  LayoutDashboard,
  MessageSquare,
  Map,
  Network,
  FolderOpen,
  UserCheck,
  Search,
  Bell,
  BarChart3,
  ListOrdered,
  Settings,
  LogOut,
  Languages,
  Database,
  Radio,
  Cpu,
  Workflow,
  AlertTriangle,
  FileText,
  Keyboard,
  Command,
  HelpCircle,
  X,
  CheckCircle,
  AlertOctagon,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

// Private sub-component for managing individual self-dismissing toast alerts
const ToastCard: React.FC<{ toast: any; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 6500); // auto-dismis after 6.5 seconds
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const isCritical = toast.severity === "Critical";
  const isWarning = toast.severity === "Warning";
  const isSuccess = toast.severity === "Success";

  let bgClass = "bg-white border-slate-200 text-slate-800 shadow-slate-200/50";
  let badgeClass = "bg-blue-50 text-blue-800 border-blue-100";
  let iconColor = "text-[#1D4ED8]";

  if (isCritical) {
    bgClass = "bg-red-50 border-red-200 text-red-900 shadow-red-200/50";
    badgeClass = "bg-red-100 text-red-800 border-red-200";
    iconColor = "text-red-600";
  } else if (isWarning) {
    bgClass = "bg-amber-50 border-amber-200 text-amber-900 shadow-amber-200/50";
    badgeClass = "bg-amber-100 text-amber-850 border-amber-200";
    iconColor = "text-amber-600";
  } else if (isSuccess) {
    bgClass =
      "bg-emerald-50 border-emerald-200 text-emerald-950 shadow-emerald-200/50";
    badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    iconColor = "text-emerald-700";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, x: 50, filter: "blur(4px)" }}
      transition={{ type: "spring", damping: 20, stiffness: 220 }}
      className={`pointer-events-auto border rounded-xl shadow-lg p-4 flex gap-3 relative max-w-sm w-full leading-relaxed ${bgClass}`}
    >
      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
        {isCritical && <AlertOctagon className="w-5 h-5 text-rose-600" />}
        {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
        {isSuccess && <CheckCircle className="w-5 h-5 text-emerald-600" />}
        {!isCritical && !isWarning && !isSuccess && (
          <Bell className="w-5 h-5 text-[#1D4ED8]" />
        )}
      </div>

      <div className="flex-1 space-y-1 min-w-0 pr-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[12.5px] leading-tight text-slate-900 font-display">
            {toast.title}
          </span>
          <span
            className={`text-[8.5px] font-bold font-mono px-1.5 py-0.2 rounded uppercase border ${badgeClass}`}
          >
            {toast.severity}
          </span>
        </div>
        <p className="text-[11.5px] text-slate-650 leading-relaxed font-medium">
          {toast.message}
        </p>
        <div className="text-[8.5px] font-mono text-slate-400">
          LOGGED BULLETIN TIME: {toast.timestamp}
        </div>
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Dismiss Alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const {
    lang,
    setLang,
    t,
    currentScreen,
    setCurrentScreen,
    isAuthenticated,
    setIsAuthenticated,
    badgeNumber,
    isDbConnected,
    isNeo4jConnected,
    toasts,
    addToast,
    removeToast,
    selectedFirNo,
    setSelectedFirNo,
    isGlobalLoading,
    globalLoadingMessage,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showShortcutGuide, setShowShortcutGuide] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(() => {
    return localStorage.getItem("vajra_focus_mode") === "true";
  });
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("vajra_focus_mode", String(isFocusMode));
  }, [isFocusMode]);

  // Keyboard Shortcuts hook implementation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true");

      if (e.key === "?") {
        if (!isInput) {
          e.preventDefault();
          setShowShortcutGuide((prev) => !prev);
        }
      }

      if (e.key === "Escape") {
        setShowShortcutGuide(false);
        setShowSearchResults(false);
        if (isInput) {
          (activeEl as HTMLElement).blur();
        }
      }

      const isMeta = e.ctrlKey || e.metaKey;
      if (isMeta) {
        let mappedScreen: ScreenId | null = null;
        switch (e.key.toLowerCase()) {
          case "k":
            mappedScreen = "command_center";
            break;
          case "n":
            // Ctrl+N maps to FIR Search (new record searches / filings entry)
            mappedScreen = "fir_search";
            break;
          case "g":
            mappedScreen = "ai_chat";
            break;
          case "h":
            mappedScreen = "spatial";
            break;
          case "w":
            mappedScreen = "case_workspace";
            break;
          case "p":
            mappedScreen = "accused_profile";
            break;
          case "a":
            mappedScreen = "alerts_feed";
            break;
          case "f":
            e.preventDefault();
            searchInputRef.current?.focus();
            return;
        }

        if (mappedScreen) {
          e.preventDefault();
          setCurrentScreen(mappedScreen);
          setShowSearchResults(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setCurrentScreen]);

  // Click outside search container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getSearchMatches = () => {
    if (!searchQuery.trim()) return { firs: [], profiles: [], alerts: [] };
    const query = searchQuery.toLowerCase();

    const matchedFirs = mockFIRs
      .filter(
        (fir) =>
          fir.firNo.toLowerCase().includes(query) ||
          fir.accusedName.toLowerCase().includes(query) ||
          fir.crimeType.toLowerCase().includes(query) ||
          fir.station.toLowerCase().includes(query),
      )
      .slice(0, 4);

    const matchedProfiles = mockAccused
      .filter(
        (acc) =>
          acc.name.toLowerCase().includes(query) ||
          acc.alias.toLowerCase().includes(query) ||
          acc.id.toLowerCase().includes(query) ||
          acc.phone.toLowerCase().includes(query) ||
          acc.vehicle.toLowerCase().includes(query),
      )
      .slice(0, 4);

    const matchedAlerts = mockLiveAlerts
      .filter(
        (alt) =>
          alt.type.toLowerCase().includes(query) ||
          alt.details.toLowerCase().includes(query) ||
          alt.station.toLowerCase().includes(query) ||
          alt.severity.toLowerCase().includes(query),
      )
      .slice(0, 4);

    return {
      firs: matchedFirs,
      profiles: matchedProfiles,
      alerts: matchedAlerts,
    };
  };

  const {
    firs: searchFirs,
    profiles: searchProfiles,
    alerts: searchAlerts,
  } = getSearchMatches();
  const hasResults =
    searchFirs.length > 0 ||
    searchProfiles.length > 0 ||
    searchAlerts.length > 0;

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Global Sidebar Navigation
  const globalSidebarItems: {
    id: ScreenId;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "command_center",
      label: t.navDashboard,
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "ai_chat",
      label: lang === "en" ? "VAJRA AI" : "ವಜ್ರ ಎಐ",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: "spatial",
      label: lang === "en" ? "Crime Maps" : "ಅಪರಾಧ ನಕ್ಷೆಗಳು",
      icon: <Map className="w-4 h-4" />,
    },
    {
      id: "fir_search",
      label: lang === "en" ? "FIR Repository" : "ಎಫ್ಐಆರ್ ಭಂಡಾರ",
      icon: <FolderOpen className="w-4 h-4" />,
    },
    {
      id: "alerts_feed",
      label: t.navAlerts,
      icon: <Bell className="w-4 h-4" />,
    },
    {
      id: "audit_trail",
      label: t.navAudit,
      icon: <ListOrdered className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: t.navSettings,
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  // Case Deep Dive Sidebar Navigation
  const caseSidebarItems: {
    id: ScreenId | "back_to_global";
    label: string;
    icon: React.ReactNode;
    isHighlight?: boolean;
  }[] = [
    {
      id: "back_to_global",
      label: lang === "en" ? "← Back to Global" : "← ಹಿಂದಕ್ಕೆ",
      icon: <LayoutDashboard className="w-4 h-4 text-slate-400" />,
    },
    {
      id: "case_workspace",
      label: lang === "en" ? `Case Overview` : `ಪ್ರಕರಣದ ಅವಲೋಕನ`,
      icon: <FolderOpen className="w-4 h-4 text-amber-500" />,
      isHighlight: true,
    },
    {
      id: "ai_chat",
      label: lang === "en" ? "Case VAJRA AI" : "ಪ್ರಕರಣ ವಜ್ರ ಎಐ",
      icon: <MessageSquare className="w-4 h-4 text-[#1D4ED8]" />,
    },
    {
      id: "accused_profile",
      label: lang === "en" ? "Primary Suspects" : "ಪ್ರಮುಖ ಆರೋಪಿಗಳು",
      icon: <UserCheck className="w-4 h-4 text-rose-600" />,
    },
    {
      id: "spatial",
      label: lang === "en" ? "Case Crime Map" : "ಪ್ರಕರಣ ಅಪರಾಧ ನಕ್ಷೆ",
      icon: <Map className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: "network",
      label: lang === "en" ? "Relational Network" : "ಸಂಬಂಧಿತ ನೆಟ್‌ವರ್ಕ್",
      icon: <Network className="w-4 h-4 text-indigo-600" />,
    },
  ];

  const sidebarItems = selectedFirNo ? caseSidebarItems : globalSidebarItems;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative font-sans">
      {/* STRICT DESIGN RULE 1: NIC Flag Strip */}
      <div className="h-[4px] absolute top-0 left-0 right-0 w-full flex z-50 select-none">
        <div className="flex-1 bg-[#FF9933]"></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      {/* Main Command Header */}
      <header className="h-14 bg-white border-b border-slate-200 mt-[4px] flex items-center justify-between px-6 shadow-sm z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#1D4ED8] flex items-center justify-center text-white font-bold border border-blue-600">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-extrabold text-[15px] text-slate-900 tracking-wider">
                VAJRA
              </span>
              <span className="text-[10px] bg-blue-50 text-[#1D4ED8] border border-blue-100 px-1.5 py-0.2 rounded font-mono font-bold">
                KSP SCRB
              </span>
            </div>
            <div className="text-[10px] text-slate-500 leading-none">
              {lang === "en"
                ? "Core Intelligence Console"
                : "ಮುಖ್ಯ ಇಂಟೆಲಿಜೆನ್ಸ್ ಕನ್ಸೋಲ್"}
            </div>
          </div>
        </div>

        {/* Global Persistent Search bar */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-xs xl:max-w-md mx-4 hidden lg:block"
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                lang === "en"
                  ? "Search records, alerts, accused... (Ctrl+F)"
                  : "ದಾಖಲೆಗಳು, ಅಲರ್ಟ್‌ಗಳು ಮತ್ತು ಆರೋಪಿಗಳು..."
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-12 py-1 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8] focus:bg-white transition-all text-slate-800"
            />
            <div className="absolute right-2 top-1.5 flex items-center space-x-1 pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] text-slate-400 font-mono font-bold border border-slate-200">
                ctrl F
              </kbd>
            </div>
          </div>

          {/* Floating Search Results Dropdown Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-250 rounded-lg shadow-xl max-h-[380px] overflow-y-auto z-50 p-2.5 space-y-3 font-sans">
              {/* No Results Fallback */}
              {!hasResults && (
                <div className="text-center text-slate-400 py-3 text-xs font-semibold kn-text">
                  {lang === "en"
                    ? "No matching records in digital databases."
                    : "ಯಾವುದೇ ಅನ್ವೇಷಣೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                </div>
              )}

              {/* Accused Section */}
              {searchProfiles.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8.5px] uppercase tracking-wider font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-mono">
                    Accused Dossiers
                  </div>
                  {searchProfiles.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        localStorage.setItem(
                          "vajra_selected_accused_id",
                          acc.id,
                        );
                        setCurrentScreen("accused_profile");
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded bg-transparent transition-colors text-xs flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-800 flex items-center space-x-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{acc.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Alias: {acc.alias} • {acc.age} Y/M • {acc.phone}
                        </div>
                      </div>
                      <span className="text-[8.5px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded font-bold">
                        {acc.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* FIR Records Section */}
              {searchFirs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8.5px] uppercase tracking-wider font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono">
                    FIR Case Chronicles
                  </div>
                  {searchFirs.map((fir) => (
                    <button
                      key={fir.firNo}
                      onClick={() => {
                        localStorage.setItem(
                          "vajra_initial_workspace_case",
                          fir.firNo,
                        );
                        setSelectedFirNo(fir.firNo);
                        setCurrentScreen("case_workspace");
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded bg-transparent transition-colors text-xs flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-800 flex items-center space-x-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{fir.firNo}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                          {fir.crimeType}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {fir.station} • Suspect: {fir.accusedName}
                        </div>
                      </div>
                      <span className="text-[8.5px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono px-1.5 py-0.5 rounded font-bold">
                        {fir.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Alerts Section */}
              {searchAlerts.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8.5px] uppercase tracking-wider font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-mono">
                    Command Alerts
                  </div>
                  {searchAlerts.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => {
                        setCurrentScreen("alerts_feed");
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded bg-transparent transition-colors text-xs flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-800 flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{alt.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {alt.details}
                        </p>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {alt.station} • {alt.timestamp.split(" ")[1]}
                        </div>
                      </div>
                      <span className="text-[8.5px] bg-rose-100 text-rose-800 font-mono px-1.5 py-0.5 rounded font-bold">
                        {alt.severity}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live system link status telemetry (Anti-Color-Only Rule) */}
        <div className="hidden md:flex items-center space-x-6 text-[11px] font-mono">
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#334155] uppercase">CCTNS:</span>
            {isDbConnected ? (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>ONLINE</span>
              </span>
            ) : (
              <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>OFFLINE</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <Workflow className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#334155] uppercase">Neo4j:</span>
            {isNeo4jConnected ? (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>CONNECTED</span>
              </span>
            ) : (
              <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>DISCONNECTED</span>
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200"></div>

          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span className="text-slate-500">
              {lang === "en" ? "BADGE ID:" : "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ:"}
            </span>
            <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {badgeNumber || "AUTH"}
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-3">
          {/* Keyboard Shortcut Help */}
          <button
            onClick={() => setShowShortcutGuide(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="System Hotkeys (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <kbd className="hidden md:inline bg-slate-150 font-mono text-[9px] px-1 rounded border border-slate-200">
              ?
            </kbd>
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => {
              const nextFocus = !isFocusMode;
              setIsFocusMode(nextFocus);
              addToast(
                nextFocus ? "Focus Mode Active" : "Standard View Mode",
                nextFocus
                  ? "Navigation sidebar minimized. Central workspace maximized for distraction-free analysis."
                  : "Navigation sidebar restored to operational views.",
                "Info",
              );
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              isFocusMode
                ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
            title={
              isFocusMode ? "Restore Navigation Menu" : "Activate Focus Mode"
            }
          >
            {isFocusMode ? (
              <Minimize2 className="w-3.5 h-3.5 text-blue-700 animate-pulse" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden md:inline text-[11px] font-semibold">
              {isFocusMode
                ? lang === "en"
                  ? "Unfocus"
                  : "ಸಾಮಾನ್ಯ ನೋಟ"
                : lang === "en"
                  ? "Focus Mode"
                  : "ಏಕಾಗ್ರತೆ ನೋಟ"}
            </span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "kn" : "en")}
            className="flex items-center space-x-1 px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Languages className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span className="kn-text leading-[1.8]">
              {lang === "en" ? "ಕನ್ನಡ" : "English"}
            </span>
          </button>

          {/* Secure Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
            title="Log Out Console"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="kn-text leading-[1.8]">
              {lang === "en" ? "Logout" : "ನಿಷ್ಕ್ರಮಣ"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Structural Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Menu */}
        <aside
          className={`${isFocusMode ? "w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none" : "w-64"} bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out`}
        >
          <div className="p-4 border-b border-slate-100">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
              {lang === "en" ? "Navigation Ledger" : "ಸಂಚಾರ ಕಡತ"}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {sidebarItems.map((item: any) => {
              const isActive = currentScreen === item.id;
              const isHighlight = item.isHighlight;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "back_to_global") {
                      setSelectedFirNo("");
                      setCurrentScreen("command_center");
                      return;
                    }
                    if (item.id === "case_workspace" && selectedFirNo) {
                      localStorage.setItem(
                        "vajra_initial_workspace_case",
                        selectedFirNo,
                      );
                    }
                    setCurrentScreen(item.id as ScreenId);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all duration-250 cursor-pointer ${
                    isHighlight
                      ? isActive
                        ? "bg-amber-600 text-white shadow-md shadow-amber-500/20 font-bold border border-amber-500"
                        : "bg-amber-50 border border-amber-200/60 text-amber-900 hover:bg-amber-100 font-bold"
                      : isActive
                        ? "bg-[#1D4ED8] text-white"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={
                      isActive
                        ? "text-white"
                        : isHighlight
                          ? "text-amber-600 animate-pulse"
                          : "text-slate-500"
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="kn-text leading-[1.8] text-left truncate flex-grow">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Footer warning block */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-1.5">
            <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-bold uppercase font-mono">
              <Cpu className="w-3.5 h-3.5" />
              <span>CLASSIFIED STATE UNIT</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {lang === "en"
                ? "All queries are cryptographically logged with digital audit footprints trail."
                : "ಎಲ್ಲ ಅಪರಾಧ ವಿಚಾರಣೆಗಳನ್ನು ಡಿಜಿಟಲ್ ಆಡಿಟ್ ಪೆನ್ ಶೀಟ್ ಮೂಲಕ ದಾಖಲಿಸಲಾಗುತ್ತದೆ."}
            </p>
          </div>
        </aside>

        {/* Central Activity View Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] relative">
          {children}
        </main>
      </div>

      {/* Short-cut modal overlay */}
      {showShortcutGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in font-sans p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 max-w-md w-full relative space-y-4 text-left">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 text-[#1D4ED8] font-bold text-[14px] uppercase tracking-wider font-mono">
                  <Command className="w-4 h-4" />
                  <span>Vajra System Hotkeys Ledger</span>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Ctrl or Cmd combined keystrokes for secure workflow navigation
                </p>
              </div>
              <button
                onClick={() => setShowShortcutGuide(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto font-mono text-[11px]">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium">
                  Command Center Dashboard
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-800">
                  Ctrl + K
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium font-semibold text-[#1D4ED8]">
                  CCTNS FIR Search / New Entry
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-[#1D4ED8]">
                  Ctrl + N
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium">
                  Secure AI Assistant Chat
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-800">
                  Ctrl + G
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium font-semibold text-[#FF9933]">
                  Case Inquest Workspace
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-800">
                  Ctrl + W
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium text-amber-600">
                  Accused Dossier Detail
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-850">
                  Ctrl + P
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium text-rose-600">
                  Live Alert Monitor Desk
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-850">
                  Ctrl + A
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-medium text-blue-600">
                  Spatial Hotspots Analytics Map
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-850">
                  Ctrl + H
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-600 font-sans font-semibold text-emerald-600">
                  Focus Global Search Input
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-850">
                  Ctrl + F
                </kbd>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100/50">
                <span className="text-slate-400 font-sans font-medium">
                  Show Shortcut Manual Guide
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-slate-400">
                  ?
                </kbd>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 leading-tight">
              NOTE: Some system shortcuts may overlap with standard browser
              utilities. For maximum precision, operate inside the standalone
              application window view.
            </div>
          </div>
        </div>
      )}

      {/* Real-time Dynamic Toast Toaster Container HUD Overlays */}
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isGlobalLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 flex flex-col items-center max-w-sm text-center"
            >
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100"></div>
                <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-800 font-display tracking-wide uppercase mb-1">
                VAJRA AI Core
              </h3>
              <p className="text-xs font-medium text-slate-500 max-w-[200px] leading-relaxed">
                {globalLoadingMessage || "Processing contextual intelligence models..."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
