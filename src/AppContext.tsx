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
  | "settings";

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
  responseType?: "text" | "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend";
  data?: any;
  isSimulated?: boolean;
  simulatedReason?: string;
  citations?: { type: string; id: string; details: string }[];
  attachments?: { file_name: string; type: string; page_count: number }[];
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

  // role_tier comes directly from the /api/auth/login response (set by
  // LoginScreen.tsx) rather than a separate /api/auth/me fetch. /api/auth/me
  // depends on Catalyst resolving the Bearer token to a specific end-user
  // session, which requires Third-party Authentication -- not wired yet, so
  // that endpoint currently 401s for every request. The login response
  // already resolves role_tier server-side from the authenticating badge's
  // own RankID, so we use that directly instead of a call that can't work yet.
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

  // Poll the real /health endpoint instead of hardcoding "connected" forever —
  // this used to never reflect reality. Also drops isNeo4jConnected entirely:
  // Neo4j was dead code (unreachable bolt://localhost:7687 in any real deployment)
  // and has been removed from the backend; the ZCQL relational path is the only
  // graph-tracing path that ever ran.
  useEffect(() => {
    const checkHealth = () => {
      fetch(`${API_BASE}/health`)
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
    return saved === "light" || saved === "high-contrast-dark" ? saved : "light";
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
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    // realTimestamp is when the underlying event actually happened (e.g. a
    // proactive alert's real TriggerTime from the database) -- confirmed
    // live that without this, every toast showed new Date() (when it
    // rendered), so a two-day-old alert re-surfaced on every page load
    // looked like it had just happened seconds ago. Falls back to render
    // time for toasts with no real backing event (login confirmations,
    // form-save errors, etc.), unchanged from before.
    const timestamp = realTimestamp
      ? new Date(realTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newToast: ToastMessage = { id, title, message, severity, timestamp };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
        roleTier: roleTierState,
        setRoleTier,
        isDbConnected,
        setIsDbConnected,
        toasts,
        addToast,
        removeToast,
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
