import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
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
  timestamp: string;
  responseType?: "text" | "map" | "network" | "risk" | "forecast";
  data?: any;
  isSimulated?: boolean;
  simulatedReason?: string;
  citations?: { type: string; id: string; details: string }[];
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
  isDbConnected: boolean;
  setIsDbConnected: (connected: boolean) => void;
  isNeo4jConnected: boolean;
  setIsNeo4jConnected: (connected: boolean) => void;
  toasts: ToastMessage[];
  addToast: (
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
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

  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);
  const [isNeo4jConnected, setIsNeo4jConnected] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  const addToast = (
    title: string,
    message: string,
    severity: "Critical" | "Warning" | "Info" | "Success",
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const newToast: ToastMessage = { id, title, message, severity, timestamp };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
      localStorage.removeItem("vajra_token");
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
        isDbConnected,
        setIsDbConnected,
        isNeo4jConnected,
        setIsNeo4jConnected,
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
