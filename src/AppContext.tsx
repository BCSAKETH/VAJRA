import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { Language, Translations, translations } from "./i18n";
import { API_BASE } from "./config";

export type ScreenId =
  | "login"
  | "ai_chat"
  | "spatial"
  | "fir_search"
  | "reports"
  | "supervisor"
  | "audit"
  | "settings"
  | "district_dashboard";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  // Both language versions of an assistant answer, stored together so
  // toggling the language switch can instantly re-render this message in
  // the other language -- no new LLM call needed. Only assistant messages
  // carry these; `text` remains the source of truth for user messages
  // (literally what the officer typed) and as a fallback for any assistant
  // message that predates this feature (older persisted history has
  // neither field).
  textEn?: string;
  textKn?: string;
  timestamp: string;
  responseType?: "text" | "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend" | "case_distribution";
  data?: any;
  isSimulated?: boolean;
  simulatedReason?: string;
  citations?: { type: string; id: string; details: string }[];
  // The officer's own text that led to this assistant message, kept only on
  // failed/unavailable turns so ChatBubble can offer a one-click retry
  // (Claude-style) instead of making them retype the whole query.
  retryText?: string;
  attachments?: { file_name: string; type: string; page_count: number; stratus_id?: string; data_uri?: string }[];
  // Cowork sender attribution -- who actually typed this in a shared session.
  senderName?: string;
  senderEmployeeId?: number | string | null;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  severity: "Critical" | "Warning" | "Info" | "Success";
  timestamp: string;
  read?: boolean;
}

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  currentScreen: ScreenId;
  setCurrentScreen: (screen: ScreenId) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  badgeNumber: string | null;
  setBadgeNumber: (badge: string | null) => void;
  officerName: string | null;
  setOfficerName: (name: string | null) => void;
  roleTier: "officer" | "supervisor" | null;
  setRoleTier: (tier: "officer" | "supervisor" | null) => void;
  isDbConnected: boolean;
  setIsDbConnected: (connected: boolean) => void;
  toasts: ToastMessage[];
  addToast: (
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
    realTimestamp?: string,
  ) => void;
  removeToast: (id: string) => void;
  addNotification: (
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
    realTimestamp?: string,
  ) => void;
  notifications: ToastMessage[];
  clearNotifications: () => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  theme: "light" | "high-contrast-dark";
  setTheme: (theme: "light" | "high-contrast-dark") => void;
  selectedFirNo: string | null;
  setSelectedFirNo: (firNo: string | null) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isGlobalLoading: boolean;
  globalLoadingMessage: string;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  writeAuditLog: (
    actionType: string,
    targetEntity: string,
    queryText: string,
    responseSummary: string,
  ) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("vajra_lang");
    return saved === "en" || saved === "kn" ? saved : "en";
  });

  const [currentScreen, setCurrentScreenState] = useState<ScreenId>(() => {
    const saved = localStorage.getItem("vajra_screen");
    return (saved as ScreenId) || "login";
  });

  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => {
    return localStorage.getItem("vajra_auth") === "true";
  });

  const [badgeNumber, setBadgeNumberState] = useState<string | null>(() => {
    return localStorage.getItem("vajra_badge");
  });

  // The officer's own first name, resolved once via /api/auth/me right
  // after login (see LoginScreen.tsx) and cached so every screen -- chat
  // attribution, the sidebar profile card -- can show a real name instead
  // of the generic "INVESTIGATOR" placeholder without a fetch of its own.
  const [officerName, setOfficerNameState] = useState<string | null>(() => {
    return localStorage.getItem("vajra_officer_name");
  });
  const setOfficerName = (name: string | null) => {
    setOfficerNameState(name);
    if (name) {
      localStorage.setItem("vajra_officer_name", name);
    } else {
      localStorage.removeItem("vajra_officer_name");
    }
  };

  // role_tier comes directly from the /api/auth/login response (set by
  // LoginScreen.tsx) rather than a separate /api/auth/me fetch -- that
  // endpoint is called separately (see officerName above) only for the
  // officer's display name, since role_tier is already resolved
  // server-side from the authenticating badge's own RankID at login time.
  const [roleTierState, setRoleTierState] = useState<"officer" | "supervisor" | null>(() => {
    const saved = localStorage.getItem("vajra_role_tier");
    return saved === "officer" || saved === "supervisor" ? saved : null;
  });
  const setRoleTier = (tier: "officer" | "supervisor" | null) => {
    setRoleTierState(tier);
    if (tier) {
      localStorage.setItem("vajra_role_tier", tier);
    } else {
      localStorage.removeItem("vajra_role_tier");
    }
  };

  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const [notifications, setNotifications] = useState<ToastMessage[]>(() => {
    const saved = localStorage.getItem("vajra_notifications");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("vajra_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Poll the real /health endpoint instead of hardcoding "connected" forever —
  // this used to never reflect reality. Also drops isNeo4jConnected entirely:
  // Neo4j was dead code (unreachable bolt://localhost:7687 in any real deployment)
  // and has been removed from the backend; the ZCQL relational path is the only
  // graph-tracing path that ever ran.
  useEffect(() => {
    const checkHealth = () => {
      fetch(`${API_BASE}/api/health`)
        .then((res) => res.json())
        .then((data) => setIsDbConnected(Boolean(data.database_connected)))
        .catch(() => setIsDbConnected(false));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const [theme, setThemeState] = useState<"light" | "high-contrast-dark">(( ) => {
    const saved = localStorage.getItem("vajra_theme");
    return saved === "light" || saved === "high-contrast-dark" ? saved : "high-contrast-dark";
  });

  const [selectedFirNo, setSelectedFirNoState] = useState<string | null>(() => {
    return localStorage.getItem("vajra_selected_fir_no") || null;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("");

  const setGlobalLoading = (isLoading: boolean, message: string = "") => {
    setIsGlobalLoading(isLoading);
    setGlobalLoadingMessage(message);
  };

  useEffect(() => {
    if (selectedFirNo) {
      localStorage.setItem("vajra_selected_fir_no", selectedFirNo);
    } else {
      localStorage.removeItem("vajra_selected_fir_no");
    }
  }, [selectedFirNo]);

  const setSelectedFirNo = (firNo: string | null) => {
    setSelectedFirNoState(firNo);
  };

  // useCallback with an empty dependency array so this function's identity
  // is stable across renders -- confirmed live this was the root cause of a
  // runaway toast loop: AIChatScreen's alert-polling useEffect depends on
  // [addToast], and every unmemoized addToast() call triggered setToasts(),
  // which re-rendered AppProvider, which created a NEW addToast reference,
  // which re-ran that useEffect (tearing down and recreating its
  // now-empty seenAlerts Set), which immediately re-polled and re-toasted
  // every alert as if it were new -- thousands of duplicate toasts and a
  // wildly over-frequent /api/alerts poll rate, confirmed live via a
  // screenshot showing "+2826 more notifications". Both setters here only
  // use the functional updater form, so neither needs anything in its
  // dependency array to stay correct.
  const addToast = useCallback((
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
    realTimestamp?: string,
  ) => {
    setNotifications((prev) => {
      // Deduplicate to prevent spam on remount / rapid polling
      const isDuplicate = prev.some((n) => n.title === title && n.message === message);
      if (isDuplicate) return prev;

      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const timestamp = realTimestamp
        ? new Date(realTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const newToast: ToastMessage = { id, title, message, severity, timestamp, read: false };
      setToasts((t) => [...t, newToast]);
      return [newToast, ...prev];
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Bell-only variant of addToast -- same dedupe, same persisted
  // notifications list, but never pushes onto the ephemeral on-screen toast
  // stack. Proactive alerts (repeat-offender / spatial-spike) can arrive
  // dozens deep on first login; popping a toast for every backlogged one
  // buried real screen controls under "+N more notifications". They still
  // land in the bell icon's unread count exactly like before.
  const addNotification = useCallback((
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
    realTimestamp?: string,
  ) => {
    setNotifications((prev) => {
      const isDuplicate = prev.some((n) => n.title === title && n.message === message);
      if (isDuplicate) return prev;
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const timestamp = realTimestamp
        ? new Date(realTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return [{ id, title, message, severity, timestamp, read: false }, ...prev];
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    localStorage.setItem("vajra_lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("vajra_screen", currentScreen);
  }, [currentScreen]);

  useEffect(() => {
    localStorage.setItem("vajra_auth", String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    if (badgeNumber) {
      localStorage.setItem("vajra_badge", badgeNumber);
    } else {
      localStorage.removeItem("vajra_badge");
    }
  }, [badgeNumber]);

  useEffect(() => {
    localStorage.setItem("vajra_theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  const setTheme = (newTheme: "light" | "high-contrast-dark") => {
    setThemeState(newTheme);
  };

  const setLang = (newLang: Language) => {
    setLangState(newLang);
  };

  const setCurrentScreen = (screen: ScreenId) => {
    if (!isAuthenticated && screen !== "login") {
      setCurrentScreenState("login");
    } else if (isAuthenticated && screen === "login") {
      setCurrentScreenState("ai_chat");
    } else {
      setCurrentScreenState(screen);
    }
  };

  const setIsAuthenticated = (auth: boolean) => {
    setIsAuthenticatedState(auth);
    if (auth) {
      setCurrentScreenState("ai_chat");
    } else {
      setBadgeNumberState(null);
      setRoleTierState(null);
      localStorage.removeItem("vajra_token");
      localStorage.removeItem("vajra_role_tier");
      setCurrentScreenState("login");
    }
  };

  // Global 401 handling. Session tokens expire after 1 hour; only the chat
  // send path ever checked for a 401 and forced re-login -- every other
  // fetch (alerts polling, chat history, investigations, district summary,
  // cowork invitations, ...) just logged the failure to console and kept
  // silently retrying forever. Confirmed live: leave a tab open past token
  // expiry and the whole app goes quietly dark -- every panel shows stale
  // or empty data with no visible explanation, only console 401s. A single
  // fetch() wrapper here catches every API 401 in one place instead of
  // retrofitting every existing call site (and covers future ones too).
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        if (url.startsWith(API_BASE)) {
          setIsAuthenticated(false);
        }
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBadgeNumber = (badge: string | null) => {
    setBadgeNumberState(badge);
  };

  const writeAuditLog = async (
    actionType: string,
    targetEntity: string,
    queryText: string,
    responseSummary: string,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/audit-logs/write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          action_type: actionType,
          target_entity: targetEntity,
          query_text: queryText,
          response_summary: responseSummary,
        }),
      });
      return response.ok;
    } catch (e) {
      console.error("Failed to write audit log:", e);
      return false;
    }
  };

  const t = translations[lang];

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        t,
        currentScreen,
        setCurrentScreen,
        isAuthenticated,
        setIsAuthenticated,
        badgeNumber,
        setBadgeNumber,
        officerName,
        setOfficerName,
        roleTier: roleTierState,
        setRoleTier,
        isDbConnected,
        setIsDbConnected,
        toasts,
        addToast,
        removeToast,
        addNotification,
        notifications,
        clearNotifications,
        markAllAsRead,
        removeNotification,
        theme,
        setTheme,
        selectedFirNo,
        setSelectedFirNo,
        chatMessages,
        setChatMessages,
        isGlobalLoading,
        globalLoadingMessage,
        setGlobalLoading,
        writeAuditLog,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
