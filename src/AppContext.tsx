import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Language, Translations, translations } from "./i18n";
import { API_BASE } from "./config";

// The backend persists timestamps via Python's datetime.utcnow().isoformat(),
// which has NO trailing "Z"/offset. A date-time string with no timezone
// designator parses as LOCAL time in every browser, so `new Date(ts)` silently
// mis-read every server timestamp as if already in the officer's timezone
// (off by UTC+5:30 for IST) -- the same bug already fixed in AIChatScreen.tsx's
// parseServerTimestamp, duplicated here since toasts/notifications are raised
// from this context, not that screen.
const parseServerTimestamp = (ts: string): Date => {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(ts);
  return new Date(hasTz ? ts : `${ts}Z`);
};

export type ScreenId =
  | "login"
  | "ai_chat"
  | "supervisor"
  | "audit"
  | "settings"
  | "district_dashboard"
  | "investigations"
  | "all_chats";

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
  responseType?: "text" | "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend" | "case_distribution" | "priority_concerns" | "case_list" | "dossier" | "news" | string;
  data?: any;
  isSimulated?: boolean;
  simulatedReason?: string;
  citations?: { type: string; id: string; details: string }[];
  // The officer's own text that led to this assistant message, kept only on
  // failed/unavailable turns so ChatBubble can offer a one-click retry
  // (Claude-style) instead of making them retype the whole query.
  retryText?: string;
  attachments?: { file_name: string; type: string; page_count: number; stratus_id?: string; data_uri?: string; page_stratus_ids?: string[]; sha256?: string }[];
  attachmentAnalysis?: string;
  // Cowork sender attribution -- who actually typed this in a shared session.
  senderName?: string;
  senderEmployeeId?: number | string | null;
  // Conversation branching (edit a past question / retry an answer): this
  // message's own stable id, plus the shared group id and 1-based version
  // number if it's one of several alternate versions of the same turn.
  // Absent on messages predating this feature -- they simply have no
  // variant controls, same as any single-version turn.
  msgId?: string;
  variantGroup?: string;
  versionIndex?: number;
  // WhatsApp-style pin on a single message (distinct from the existing
  // session-level pin in the sidebar). Persisted server-side inside this
  // message's own data_json blob, same convention msgId already uses.
  isPinned?: boolean;
  // SOTIE (Section 10): Session ID and initiating query binding for telemetry
  sessionId?: string;
  forQuery?: string;
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
  // Back/Forward screen navigation -- browser-back-button-style, scoped to
  // in-app screen switches only (not sub-state like which District is
  // selected within a screen).
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  badgeNumber: string | null;
  setBadgeNumber: (badge: string | null) => void;
  officerName: string | null;
  setOfficerName: (name: string | null) => void;
  roleTier: "officer" | "supervisor" | null;
  setRoleTier: (tier: "officer" | "supervisor" | null) => void;
  mustChangePassword: boolean;
  setMustChangePassword: (mustChange: boolean) => void;
  isDbConnected: boolean;
  setIsDbConnected: (connected: boolean) => void;
  llmServiceAvailable: boolean; // C.16: was fetched from /api/health and discarded
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
  voicePersona: string;
  setVoicePersona: (persona: string) => void;
  selectedFirNo: string | null;
  setSelectedFirNo: (firNo: string | null) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isGlobalLoading: boolean;
  globalLoadingMessage: string;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  // §9.1 Unified Sidebar bridge: the sidebar now lives in MainLayout (a
  // sibling of AIChatScreen, never remounted on screen change), while the
  // actual send/poll/branching pipeline stays owned by AIChatScreen itself
  // (touching that directly would be far riskier than this thin bridge).
  // activeChatSessionId mirrors AIChatScreen's own local activeSessionId so
  // the sidebar can highlight the right row from anywhere; the two request
  // fields let the sidebar ask AIChatScreen to switch/create a session
  // without owning that logic itself.
  activeChatSessionId: string | null;
  setActiveChatSessionId: (id: string | null) => void;
  chatSessionSelectRequest: { sessionId: string; nonce: number } | null;
  requestChatSessionSelect: (sessionId: string) => void;
  newChatRequestNonce: number;
  requestNewChat: () => void;
  chatSessionsRefreshNonce: number;
  bumpChatSessionsRefresh: () => void;
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

  const [mustChangePassword, setMustChangePasswordState] = useState<boolean>(() => {
    return localStorage.getItem("vajra_must_change_pwd") === "true";
  });
  const setMustChangePassword = (mustChange: boolean) => {
    setMustChangePasswordState(mustChange);
    if (mustChange) {
      localStorage.setItem("vajra_must_change_pwd", "true");
    } else {
      localStorage.removeItem("vajra_must_change_pwd");
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
  // C.16: llm_service_available was already returned by /api/health but
  // discarded here -- no banner ever surfaced a degraded AI state. Requires
  // 2 CONSECUTIVE bad reads (60s of real degradation, Loophole L1) before
  // flipping to false, and clears on the very next clean read -- asymmetric
  // on purpose, biased toward not crying wolf over one transient poll blip.
  const [llmDegradedStrikes, setLlmDegradedStrikes] = useState(0);
  const [llmServiceAvailable, setLlmServiceAvailable] = useState(true);

  useEffect(() => {
    const checkHealth = () => {
      fetch(`${API_BASE}/api/health`)
        .then((res) => res.json())
        .then((data) => {
          setIsDbConnected(Boolean(data.database_connected));
          const available = Boolean(data.llm_service_available);
          setLlmDegradedStrikes((prev) => {
            const next = available ? 0 : prev + 1;
            setLlmServiceAvailable(next < 2);
            return next;
          });
        })
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

  // Voice persona: officer's preferred TTS delivery preset (pitch/speed/
  // emotion on the same per-language speaker -- see catalyst_speech.py's
  // VOICE_PERSONAS). Defaults to "standard", same params TTS always used
  // before this existed, so nobody who never opens the picker notices a
  // change. Validated against the live /api/voice/personas list on load so
  // a stale saved id from a removed preset can't silently break playback.
  const [voicePersona, setVoicePersonaState] = useState<string>(() => {
    return localStorage.getItem("vajra_voice_persona") || "standard";
  });

  const [selectedFirNo, setSelectedFirNoState] = useState<string | null>(() => {
    return localStorage.getItem("vajra_selected_fir_no") || null;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("");

  // §9.1 Unified Sidebar bridge -- see the interface comment above for why
  // this exists instead of lifting AIChatScreen's whole send/poll pipeline.
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [chatSessionSelectRequest, setChatSessionSelectRequest] = useState<{ sessionId: string; nonce: number } | null>(null);
  const requestChatSessionSelect = useCallback((sessionId: string) => {
    setChatSessionSelectRequest({ sessionId, nonce: Date.now() + Math.random() });
  }, []);
  const [newChatRequestNonce, setNewChatRequestNonce] = useState(0);
  const requestNewChat = useCallback(() => setNewChatRequestNonce((n) => n + 1), []);
  const [chatSessionsRefreshNonce, setChatSessionsRefreshNonce] = useState(0);
  const bumpChatSessionsRefresh = useCallback(() => setChatSessionsRefreshNonce((n) => n + 1), []);

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
        ? parseServerTimestamp(realTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
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
        ? parseServerTimestamp(realTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
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

  useEffect(() => {
    localStorage.setItem("vajra_voice_persona", voicePersona);
  }, [voicePersona]);

  const setVoicePersona = (persona: string) => {
    setVoicePersonaState(persona);
  };

  const setLang = (newLang: Language) => {
    setLangState(newLang);
  };

  // Back/Forward screen navigation -- a small in-memory history stack
  // (browser-back-button-style), scoped to in-app screen switches only.
  // isHistoryNavRef suppresses re-pushing history while goBack/goForward
  // themselves are driving setCurrentScreenState.
  const [screenHistory, setScreenHistory] = useState<ScreenId[]>([]);
  const [screenForward, setScreenForward] = useState<ScreenId[]>([]);
  const isHistoryNavRef = useRef(false);

  const setCurrentScreen = (screen: ScreenId) => {
    if (!isAuthenticated && screen !== "login") {
      setCurrentScreenState("login");
      return;
    }
    if (isAuthenticated && screen === "login") {
      setCurrentScreenState("ai_chat");
      return;
    }
    if (screen === currentScreen) return;
    if (!isHistoryNavRef.current) {
      setScreenHistory((prev) => [...prev, currentScreen].slice(-50));
      setScreenForward([]);
    }
    setCurrentScreenState(screen);
  };

  const goBack = () => {
    if (screenHistory.length === 0) return;
    const target = screenHistory[screenHistory.length - 1];
    setScreenHistory((prev) => prev.slice(0, -1));
    setScreenForward((prev) => [currentScreen, ...prev].slice(0, 50));
    isHistoryNavRef.current = true;
    setCurrentScreenState(target);
    isHistoryNavRef.current = false;
  };

  const goForward = () => {
    if (screenForward.length === 0) return;
    const target = screenForward[0];
    setScreenForward((prev) => prev.slice(1));
    setScreenHistory((prev) => [...prev, currentScreen].slice(-50));
    isHistoryNavRef.current = true;
    setCurrentScreenState(target);
    isHistoryNavRef.current = false;
  };

  const setIsAuthenticated = (auth: boolean) => {
    setIsAuthenticatedState(auth);
    if (auth) {
      setCurrentScreenState("ai_chat");
    } else {
      setBadgeNumberState(null);
      setRoleTierState(null);
      // C.18a: real server-side revocation, not just a client-side clear.
      // Before this, "Sign Out" only removed the token from THIS browser --
      // the JWT itself stayed fully valid server-side for the rest of its
      // natural life, so a copy left in a second tab (or captured in
      // transit) kept working after the officer thought they'd signed out.
      // Fire-and-forget: the token is being discarded regardless of
      // whether this call succeeds, and this path also runs on an
      // already-expired/401'd token (nothing meaningful to revoke there
      // either way) -- never blocks the actual sign-out on a network
      // round trip.
      const outgoingToken = localStorage.getItem("vajra_token");
      if (outgoingToken) {
        fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${outgoingToken}` },
        }).catch(() => {
          /* best-effort -- the token is being discarded client-side either way */
        });
      }
      localStorage.removeItem("vajra_token");
      localStorage.removeItem("vajra_role_tier");
      localStorage.removeItem("vajra_must_change_pwd");
      setMustChangePasswordState(false);
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
        if (url.includes("/api/") && !url.includes("/api/auth/login")) {
          localStorage.removeItem("vajra_token");
          localStorage.removeItem("vajra_auth");
          setIsAuthenticated(false);
        }
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // E.4: cross-tab logout sync -- logging out (via SessionTimeoutGuard, a
  // 401, or an explicit sign-out) in one tab previously left every other
  // open tab still showing an authenticated screen with a dead token until
  // its own next API call happened to 401. The "storage" event fires in
  // every OTHER tab the instant vajra_auth changes in this one, so all of
  // them switch to Login within milliseconds instead of staying stale.
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === "vajra_auth") {
        const isAuth = e.newValue === "true";
        setIsAuthenticatedState(isAuth);
        if (!isAuth) {
          setCurrentScreenState("login");
          setBadgeNumberState(null);
          setRoleTierState(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageSync);
    return () => window.removeEventListener("storage", handleStorageSync);
  }, []);

  const setBadgeNumber = (badge: string | null) => {
    setBadgeNumberState(badge);
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
        goBack,
        goForward,
        canGoBack: screenHistory.length > 0,
        canGoForward: screenForward.length > 0,
        isAuthenticated,
        setIsAuthenticated,
        badgeNumber,
        setBadgeNumber,
        officerName,
        setOfficerName,
        roleTier: roleTierState,
        setRoleTier,
        mustChangePassword,
        setMustChangePassword,
        isDbConnected,
        setIsDbConnected,
        llmServiceAvailable,
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
        voicePersona,
        setVoicePersona,
        selectedFirNo,
        setSelectedFirNo,
        chatMessages,
        setChatMessages,
        isGlobalLoading,
        globalLoadingMessage,
        setGlobalLoading,
        activeChatSessionId,
        setActiveChatSessionId,
        chatSessionSelectRequest,
        requestChatSessionSelect,
        newChatRequestNonce,
        requestNewChat,
        chatSessionsRefreshNonce,
        bumpChatSessionsRefresh,
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
