import React, { useEffect, useState, useRef, useMemo } from "react";
import { useApp, TranscriptTextSize, TranscriptWidth, TtsSpeed, TtsStyle } from "../AppContext";
import { API_BASE } from "../config";
import { Settings, ShieldCheck, Database, Languages, Clock, User, IdCard, MapPin, Lock, Pencil, X, Hourglass, Mail, KeyRound, Maximize2, Type, Volume2, Play, Square, CheckCircle2, Loader2, Search, Palette, Info } from "lucide-react";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { ProportionalWidthWireframe } from "../components/ProportionalWidthWireframe";

type SettingsTab = "account" | "appearance" | "voice" | "about";

interface SettingsScreenProps {
  // Finals-part 3.md §32: optional so SettingsScreen still works if ever
  // rendered outside SettingsModal (defensive, not currently done anywhere
  // else) -- when provided, the new per-tab header renders a real close
  // button matching the doc's exact layout instead of SettingsModal owning
  // a separate floating one.
  onClose?: () => void;
}

interface OfficerProfile {
  kgid: string;
  first_name: string | null;
  email: string | null;
  station: string | null;
  rank: string | null;
  designation: string | null;
  role_tier: string | null;
  rank_id: number | string | null;
  designation_id: number | string | null;
  unit_id: number | string | null;
}

interface RefOption { id: number | string; name: string }

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const {
    t,
    lang,
    setLang,
    badgeNumber,
    roleTier,
    isDbConnected,
    theme,
    setTheme,
    voicePersona,
    setVoicePersona,
    transcriptTextSize,
    setTranscriptTextSize,
    transcriptWidth,
    setTranscriptWidth,
    ttsSettings,
    setTtsSettings,
    addToast,
  } = useApp();

  // Section 15: Zia Audio Studio Live Preview Player
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = "";
      } catch {}
      previewAudioRef.current = null;
    }
    setIsPlayingPreview(false);
    setIsPreviewLoading(false);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  const handleTestVoice = async () => {
    if (isPlayingPreview || isPreviewLoading) {
      stopPreview();
      return;
    }

    const testPhrases: Record<string, string> = {
      en: "VAJRA Tactical Intelligence System online. All units standing by for deployment.",
      kn: "ವಜ್ರ ಸುರಕ್ಷತಾ ತನಿಖಾ ವ್ಯವಸ್ಥೆ ಸಿದ್ಧವಾಗಿದೆ. ಎಲ್ಲಾ ಕಮಾಂಡ್ ಸಿಬ್ಬಂದಿ ಕಾರ್ಯಪ್ರವೃತ್ತರಾಗಿದ್ದಾರೆ.",
      hi: "वज್ರ सुरक्षा खुफिया प्रणाली सक्रिय है। सभी इकाइयाँ तैयार हैं।",
    };

    const targetLang = ttsSettings.language || "en";
    const phrase = testPhrases[targetLang] || testPhrases.en;

    setIsPreviewLoading(true);
    try {
      const token = localStorage.getItem("vajra_token") || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/voice/tts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: phrase,
          lang: targetLang,
          persona: ttsSettings.style,
          style: ttsSettings.style,
          speed: ttsSettings.speed,
          speaker: ttsSettings.voice,
          voice: ttsSettings.voice,
        }),
      });

      if (!res.ok) {
        throw new Error("TTS endpoint returned " + res.status);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setIsPlayingPreview(false);
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingPreview(false);
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
      };

      setIsPreviewLoading(false);
      setIsPlayingPreview(true);
      await audio.play();
    } catch (e) {
      console.warn("Audio Studio preview error:", e);
      setIsPreviewLoading(false);
      setIsPlayingPreview(false);
      addToast(
        lang === "en" ? "Preview Unavailable" : "ಧ್ವನಿ ಪರೀಕ್ಷೆ ಲಭ್ಯವಿಲ್ಲ",
        lang === "en" ? "Zia speech engine could not synthesize test sample." : "ಝಿಯಾ ಧ್ವನಿ ಎಂಜಿನ್ ಮಾದರಿ ಉತ್ಪಾದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Warning"
      );
    }
  };

  const speakersByLang: Record<string, { id: string; name: string; gender: string }[]> = {
    en: [
      { id: "Anna", name: "Anna", gender: lang === "en" ? "Female (Articulate)" : "ಮಹಿಳೆ (ಸ್ಪಷ್ಟ)" },
      { id: "James", name: "James", gender: lang === "en" ? "Male (Command)" : "ಪುರುಷ (ಕಮಾಂಡ್)" },
    ],
    kn: [
      { id: "Anu", name: "Anu", gender: lang === "en" ? "Female (Native Kannada)" : "ಮಹಿಳೆ (ಸ್ಥಳೀಯ ಕನ್ನಡ)" },
      { id: "Manoj", name: "Manoj", gender: lang === "en" ? "Male (Formal Kannada)" : "ಪುರುಷ (ಔಪಚಾರಿಕ ಕನ್ನಡ)" },
    ],
    hi: [
      { id: "Divya", name: "Divya", gender: lang === "en" ? "Female (Natural Hindi)" : "ಮಹಿಳೆ (ನೈಸರ್ಗಿಕ ಹಿಂದಿ)" },
      { id: "Manoj", name: "Manoj", gender: lang === "en" ? "Male (Clear Hindi)" : "ಪುರುಷ (ಸ್ಪಷ್ಟ ಹಿಂದಿ)" },
    ],
  };


  // §32: left-nav + single-category-at-a-time layout (matching the source
  // document exactly, not the prior always-show-everything 2-column page).
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [searchQuery, setSearchQuery] = useState("");

  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setProfile(data); })
      .catch(() => {});
  }, []);

  // PROFILE IMMUTABILITY: identity fields above are read-only display. A
  // change goes through supervisor approval (ProactiveAlerts/PROFILE_CHANGE,
  // same pattern as the export-approval workflow) -- never applied directly.
  // One modal covers every editable field at once, side-by-side (current vs
  // proposed), with a MANDATORY statutory justification -- matching the
  // real KSP transfer-order/promotion-order workflow this stands in for,
  // not a casual self-edit box.
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [myRequest, setMyRequest] = useState<any | null>(null);
  const [refData, setRefData] = useState<{ ranks: RefOption[]; designations: RefOption[]; units: RefOption[] }>({
    ranks: [], designations: [], units: [],
  });
  // Draft values as strings (controlled <select>/<input> need strings; IDs
  // get Number()'d back before submitting). Empty string = "no change".
  const [draft, setDraft] = useState({ FirstName: "", RankID: "", DesignationID: "", UnitID: "", Email: "" });

  const fetchMyRequest = () => {
    fetch(`${API_BASE}/api/profile/my-requests`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const latest = (data?.requests || [])[0];
        setMyRequest(latest || null);
      })
      .catch(() => {});
  };
  useEffect(() => { fetchMyRequest(); }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/profile/reference-data`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setRefData(data); })
      .catch(() => {});
  }, []);

  // Blank by default (LH-style partial-fill: only fill what needs to
  // change) -- current values shown alongside for reference, not
  // pre-filled into the proposed side, so a no-op field can't accidentally
  // get resubmitted as its own current value.
  const openRequestModal = () => {
    setDraft({ FirstName: "", RankID: "", DesignationID: "", UnitID: "", Email: "" });
    setReasonDraft("");
    setIsRequestOpen(true);
  };

  // First-time-only email registration -- no approval needed since there's
  // nothing on record yet to protect (see set-email-once's own docstring).
  // Once saved, this field locks and any further change goes through the
  // same request-and-approve modal as the name field.
  const [emailDraft, setEmailDraft] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const submitEmailOnce = async () => {
    const trimmed = emailDraft.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      addToast(
        lang === "en" ? "Invalid email" : "ಅಮಾನ್ಯ ಇಮೇಲ್",
        lang === "en" ? "Enter a valid email address." : "ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.",
        "Warning"
      );
      return;
    }
    setIsSavingEmail(true);
    try {
      const r = await fetch(`${API_BASE}/api/profile/set-email-once`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ email: trimmed }),
      });
      if (r.ok) {
        setProfile((p) => (p ? { ...p, email: trimmed } : p));
        addToast(
          lang === "en" ? "Email registered" : "ಇಮೇಲ್ ನೋಂದಾಯಿಸಲಾಗಿದೆ",
          lang === "en"
            ? "VAJRA will send anything you ask it to email here from now on."
            : "ಇನ್ನು ಮುಂದೆ ನೀವು ಕೇಳುವ ಎಲ್ಲವನ್ನೂ VAJRA ಇಲ್ಲಿಗೆ ಇಮೇಲ್ ಮಾಡುತ್ತದೆ.",
          "Success"
        );
      } else {
        const err = await r.json().catch(() => ({}));
        addToast(
          lang === "en" ? "Could not save" : "ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ",
          err.detail || (lang === "en" ? "Please try again." : "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."),
          "Critical"
        );
      }
    } catch {
      addToast(
        lang === "en" ? "Network error" : "ನೆಟ್‌ವರ್ಕ್ ದೋಷ",
        lang === "en" ? "Could not reach the server." : "ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsSavingEmail(false);
    }
  };

  const submitProfileChange = async () => {
    const trimmedReason = reasonDraft.trim();
    if (!trimmedReason) {
      addToast(
        lang === "en" ? "Justification required" : "ಸಮರ್ಥನೆ ಅಗತ್ಯವಿದೆ",
        lang === "en"
          ? "State the transfer/promotion order reference or reason for this change."
          : "ಈ ಬದಲಾವಣೆಗೆ ವರ್ಗಾವಣೆ/ಬಡ್ತಿ ಆದೇಶ ಉಲ್ಲೇಖ ಅಥವಾ ಕಾರಣವನ್ನು ನಮೂದಿಸಿ.",
        "Warning"
      );
      return;
    }
    const changes: Record<string, string> = {};
    if (draft.FirstName.trim() && draft.FirstName.trim() !== profile?.first_name) {
      changes.FirstName = draft.FirstName.trim();
    }
    if (draft.Email.trim() && draft.Email.trim() !== profile?.email) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.Email.trim())) {
        addToast(lang === "en" ? "Invalid email" : "ಅಮಾನ್ಯ ಇಮೇಲ್",
          lang === "en" ? "Enter a valid email address." : "ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.", "Warning");
        return;
      }
      changes.Email = draft.Email.trim();
    }
    if (draft.RankID && String(draft.RankID) !== String(profile?.rank_id ?? "")) changes.RankID = draft.RankID;
    if (draft.DesignationID && String(draft.DesignationID) !== String(profile?.designation_id ?? "")) changes.DesignationID = draft.DesignationID;
    if (draft.UnitID && String(draft.UnitID) !== String(profile?.unit_id ?? "")) changes.UnitID = draft.UnitID;

    if (Object.keys(changes).length === 0) {
      addToast(
        lang === "en" ? "No change to submit" : "ಸಲ್ಲಿಸಲು ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲ",
        lang === "en" ? "Fill in at least one field that differs from your current record." : "ನಿಮ್ಮ ಪ್ರಸ್ತುತ ದಾಖಲೆಗಿಂತ ಭಿನ್ನವಾಗಿರುವ ಕನಿಷ್ಠ ಒಂದು ಕ್ಷೇತ್ರವನ್ನು ಭರ್ತಿ ಮಾಡಿ.",
        "Warning"
      );
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const r = await fetch(`${API_BASE}/api/profile/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ requested_changes: changes, reason: trimmedReason }),
      });
      if (r.ok) {
        addToast(
          lang === "en" ? "Request submitted" : "ವಿನಂತಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
          lang === "en" ? "Awaiting supervisor approval." : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.",
          "Success"
        );
        setIsRequestOpen(false);
        fetchMyRequest();
      } else {
        const err = await r.json().catch(() => ({}));
        addToast(
          lang === "en" ? "Could not submit" : "ಸಲ್ಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ",
          err.detail || (lang === "en" ? "Please try again." : "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."),
          "Critical"
        );
      }
    } catch {
      addToast(
        lang === "en" ? "Network error" : "ನೆಟ್‌ವರ್ಕ್ ದೋಷ",
        lang === "en" ? "Could not reach the server." : "ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // §32: left-nav items with search filter -- matches the doc's exact
  // 4-category structure (Account/Appearance/Voice/About), each with a
  // real icon + label + one-line sub-description.
  const navItems = useMemo(() => [
    {
      id: "account" as SettingsTab,
      label: lang === "en" ? "Account" : "ಖಾತೆ",
      sub: lang === "en" ? "Officer Profile" : "ಅಧಿಕಾರಿ ವಿವರ",
      icon: User,
      keywords: "profile name badge kgid rank designation station email password",
    },
    {
      id: "appearance" as SettingsTab,
      label: lang === "en" ? "Appearance" : "ಗೋಚರತೆ",
      sub: lang === "en" ? "Theme & Ergonomics" : "ವಿನ್ಯಾಸ ಮತ್ತು ಗಾತ್ರ",
      icon: Palette,
      keywords: "theme language dark contrast font text size scaling width transcript",
    },
    {
      id: "voice" as SettingsTab,
      label: lang === "en" ? "Voice" : "ಧ್ವನಿ",
      sub: lang === "en" ? "Zia Audio Studio" : "ಜಿಯಾ ಆಡಿಯೋ ಸ್ಟುಡಿಯೋ",
      icon: Volume2,
      keywords: "voice zia audio sound speak speech synthesizer speed timbre",
    },
    {
      id: "about" as SettingsTab,
      label: lang === "en" ? "About" : "ಕುರಿತು",
      sub: lang === "en" ? "Security & Diagnostics" : "ಭದ್ರತೆ ಮತ್ತು ಡೇಟಾಬೇಸ್",
      icon: Info,
      keywords: "security database diagnostics policies bnss timeout session status",
    },
  ], [lang]);

  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q) || item.keywords.includes(q));
  }, [navItems, searchQuery]);

  // L256: if the search filters out the currently-active tab, jump to the
  // first remaining match instead of showing an empty right pane.
  useEffect(() => {
    if (filteredNav.length && !filteredNav.some((i) => i.id === activeTab)) {
      setActiveTab(filteredNav[0].id);
    }
  }, [filteredNav, activeTab]);

  const tabTitles: Record<SettingsTab, { title: string; sub: string }> = {
    account: {
      title: lang === "en" ? "Account — Officer Profile" : "ಖಾತೆ — ಅಧಿಕಾರಿ ವಿವರ",
      sub: lang === "en" ? "Authorized personnel credentials and operational station attachment" : "ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ವಿವರಗಳು",
    },
    appearance: {
      title: lang === "en" ? "Appearance — Preferences & Ergonomics" : "ಗೋಚರತೆ — ವಿನ್ಯಾಸ ಮತ್ತು ಗಾತ್ರ",
      sub: lang === "en" ? "Display themes, semantic font sizing, and visual window scaling" : "ಪ್ರದರ್ಶನ ಥೀಮ್‌ಗಳು ಮತ್ತು ಫಾಂಟ್ ಗಾತ್ರ",
    },
    voice: {
      title: lang === "en" ? "Voice — Zia Multi-Voice Studio" : "ಧ್ವನಿ — ಜಿಯಾ ಆಡಿಯೋ ಸ್ಟುಡಿಯೋ",
      sub: lang === "en" ? "Neural speech synthesis parameters for field audio briefs" : "ಕ್ಷೇತ್ರ ಆಡಿಯೋ ಬ್ರೀಫ್‌ಗಳಿಗಾಗಿ ಧ್ವನಿ ಸಂಶ್ಲೇಷಣೆ",
    },
    about: {
      title: lang === "en" ? "About — Security Policies & Diagnostics" : "ಕುರಿತು — ಭದ್ರತೆ ಮತ್ತು ಡೇಟಾಬೇಸ್",
      sub: lang === "en" ? "System health telemetry, ZCQL database connectivity, and BNSS compliance" : "ಸಿಸ್ಟಮ್ ಆರೋಗ್ಯ ಮತ್ತು ದತ್ತಸಂಚಯ ಸಂಪರ್ಕ",
    },
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-[#181614] text-stone-200">
      {/* LEFT NAVIGATION COLUMN */}
      <div className="w-full md:w-64 bg-[#141210] border-b md:border-b-0 md:border-r border-stone-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-stone-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "en" ? "Search settings..." : "ಹುಡುಕಿ..."}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-900/90 border border-stone-800 rounded-md text-xs font-mono text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#C79A4E]/60 transition-colors"
            />
          </div>
        </div>

        <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-2 gap-1 flex-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#C79A4E]/15 text-[#C79A4E] border border-[#C79A4E]/40 font-medium shadow-sm"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-900/60 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#C79A4E]" : "text-stone-500"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold leading-none">{item.label}</p>
                  <p className="text-[10px] text-stone-500 truncate mt-1">{item.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2 p-3 border-t border-stone-800/80 bg-stone-950/40 text-[10px] font-mono text-stone-500">
          <span className={`w-2 h-2 rounded-full ${isDbConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span>KSP POLICE NET • 2026</span>
        </div>
      </div>

      {/* RIGHT CONTENT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#181614] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800/80 bg-stone-900/20 shrink-0">
          <div>
            <h2 className="text-sm font-mono font-bold text-stone-100 uppercase tracking-wider">{tabTitles[activeTab].title}</h2>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">{tabTitles[activeTab].sub}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. ACCOUNT TAB */}
          {activeTab === "account" && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-stone-900/60 border border-stone-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-stone-800 border-2 border-[#C79A4E] flex items-center justify-center text-sm font-mono font-bold text-[#C79A4E] shrink-0">
                  {(profile?.first_name || badgeNumber || "KG").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-mono font-bold text-stone-100 truncate">{profile?.first_name || "—"}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/30">
                      {(roleTier || "officer").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-stone-400 mt-0.5">
                    KGID: {profile?.kgid || badgeNumber || "—"} • {profile?.designation || (lang === "en" ? "Designation not on file" : "ಪದನಾಮ ಇಲ್ಲ")}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-bold text-stone-550 normal-case tracking-normal bg-stone-950/50 border border-stone-900 rounded-full px-2 py-0.5 shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  {lang === "en" ? "Read-only" : "ಓದಲು-ಮಾತ್ರ"}
                </span>
              </div>

              {myRequest && myRequest.status === "pending" && (
                <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-lg px-3 py-2 text-[10.5px] text-amber-300/90 font-mono">
                  {lang === "en" ? "Requested: " : "ಕೋರಿದ್ದು: "}
                  {Object.entries(myRequest.requested_changes || {}).map(([k, v]) => {
                    const lookup: Record<string, RefOption[]> = { RankID: refData.ranks, DesignationID: refData.designations, UnitID: refData.units };
                    const fieldLabel: Record<string, string> = { FirstName: lang === "en" ? "Name" : "ಹೆಸರು", RankID: lang === "en" ? "Rank" : "ಶ್ರೇಣಿ", DesignationID: lang === "en" ? "Designation" : "ಪದನಾಮ", UnitID: lang === "en" ? "Station" : "ಠಾಣೆ", Email: "Email" };
                    const resolved = lookup[k]?.find((o) => String(o.id) === String(v))?.name || v;
                    return `${fieldLabel[k] || k} → ${resolved}`;
                  }).join(", ")}
                  {" — "}
                  {lang === "en" ? "awaiting supervisor sign-off." : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ."}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-stone-900/40 border border-stone-800/80 rounded-lg">
                  <span className="text-[10px] text-stone-500 uppercase block">{lang === "en" ? "Rank / Grade" : "ಶ್ರೇಣಿ"}</span>
                  <span className="text-stone-200 font-bold mt-1 block">{profile?.rank || "—"}</span>
                </div>
                <div className="p-3 bg-stone-900/40 border border-stone-800/80 rounded-lg">
                  <span className="text-[10px] text-stone-500 uppercase block">{lang === "en" ? "Designation" : "ಪದನಾಮ"}</span>
                  <span className="text-stone-200 font-bold mt-1 block">{profile?.designation || "—"}</span>
                </div>
                <div className="p-3 bg-stone-900/40 border border-stone-800/80 rounded-lg">
                  <span className="text-[10px] text-stone-500 uppercase block">{lang === "en" ? "Home Police Station" : "ಠಾಣೆ"}</span>
                  <span className="text-stone-200 font-bold mt-1 block">{profile?.station || "—"}</span>
                </div>
                <div className="p-3 bg-stone-900/40 border border-stone-800/80 rounded-lg space-y-1.5">
                  <span className="text-[10px] text-stone-500 uppercase flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {lang === "en" ? "Official Email" : "ಇಮೇಲ್"}
                  </span>
                  {profile?.email ? (
                    <span className="text-stone-200 font-bold truncate block">{profile.email}</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        placeholder="you@ksp.gov.in"
                        className="flex-1 bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2 py-1 text-stone-200 font-bold text-[11px] min-w-0"
                      />
                      <button
                        onClick={submitEmailOnce}
                        disabled={isSavingEmail}
                        className="px-2.5 py-1 rounded-lg bg-[#C79A4E] text-stone-950 text-[10px] font-black uppercase cursor-pointer hover:bg-[#E4C590] disabled:opacity-50 shrink-0"
                      >
                        {isSavingEmail ? "…" : (lang === "en" ? "Save" : "ಉಳಿಸಿ")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#C79A4E]" />
                  {lang === "en" ? "Change Password" : "ರಹಸ್ಯಪದ ಬದಲಿಸಿ"}
                </button>
                {!myRequest || myRequest.status !== "pending" ? (
                  <button
                    onClick={openRequestModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[#C79A4E] hover:text-[#E4C590] rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {lang === "en" ? "Request Profile Modification" : "ಪ್ರೊಫೈಲ್ ಬದಲಾವಣೆ ಕೋರಿ"}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold uppercase text-amber-400 border border-amber-500/30 rounded-lg">
                    <Hourglass className="w-3.5 h-3.5" />
                    {lang === "en" ? "Pending review" : "ಪರಿಶೀಲನೆ ಬಾಕಿ"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. APPEARANCE TAB */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-stone-400 font-bold block">{t.settingsAppLanguage}</label>
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as any)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#C79A4E] cursor-pointer"
                  >
                    <option value="en">{t.settingsLangOptEn}</option>
                    <option value="kn">{t.settingsLangOptKn}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-stone-400 font-bold block">{t.settingsDisplayTheme}</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-[#C79A4E] cursor-pointer"
                  >
                    <option value="high-contrast-dark">{t.settingsThemeDark}</option>
                    <option value="light">{t.settingsThemeLight}</option>
                  </select>
                </div>
              </div>

              {/* Semantic Text Sizing -- zero pixel mentions, per the source
                  document's own explicit complaint about raw px labels. */}
              <div className="space-y-3 pt-3 border-t border-stone-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-200 block">
                      {lang === "en" ? "Typography & Information Density" : "ಪಠ್ಯದ ಗಾತ್ರ"}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      {lang === "en" ? "Semantic text hierarchy tailored for operational scanning" : "ಕಾರ್ಯಾಚರಣಾ ಸ್ಕ್ಯಾನಿಂಗ್‌ಗಾಗಿ ಪಠ್ಯ ಶ್ರೇಣಿ"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#C79A4E] uppercase tracking-wider">
                    {transcriptTextSize === "small" && (lang === "en" ? "Compact" : "ಸಾಂದ್ರ")}
                    {transcriptTextSize === "medium" && (lang === "en" ? "Standard" : "ಸ್ಟ್ಯಾಂಡರ್ಡ್")}
                    {transcriptTextSize === "large" && (lang === "en" ? "Expanded" : "ವಿಸ್ತೃತ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "small" as TranscriptTextSize, label: lang === "en" ? "Compact" : "ಸಾಂದ್ರ", sub: lang === "en" ? "Dense / High-Yield Intel" : "ದಟ್ಟ ವಿವರ", sample: "text-xs" },
                    { key: "medium" as TranscriptTextSize, label: lang === "en" ? "Standard" : "ಸ್ಟ್ಯಾಂಡರ್ಡ್", sub: lang === "en" ? "Balanced CCTNS Dialogue" : "ಸಮತೋಲಿತ", sample: "text-sm" },
                    { key: "large" as TranscriptTextSize, label: lang === "en" ? "Expanded" : "ವಿಸ್ತೃತ", sub: lang === "en" ? "Command Presentation" : "ಕಮಾಂಡ್ ಪ್ರಸ್ತುತಿ", sample: "text-base" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTranscriptTextSize(opt.key)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        transcriptTextSize === opt.key
                          ? "bg-[#C79A4E]/15 border-[#C79A4E] text-[#C79A4E] shadow-sm"
                          : "bg-stone-900/50 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                      }`}
                    >
                      <p className="text-xs font-mono font-bold">{opt.label}</p>
                      <p className="text-[10px] font-mono text-stone-500 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {/* Live Typography Preview Card -- real statutory-style
                    sample text, not lorem ipsum. */}
                <div className="p-3.5 bg-stone-950/70 border border-stone-800/90 rounded-lg">
                  <span className="text-[9px] font-mono text-stone-500 uppercase block mb-1">
                    {lang === "en" ? "Live Optical Preview" : "ಲೈವ್ ಪೂರ್ವವೀಕ್ಷಣೆ"}
                  </span>
                  <p className={`font-mono text-stone-300 leading-relaxed ${
                    transcriptTextSize === "small" ? "text-xs" : transcriptTextSize === "large" ? "text-base" : "text-sm"
                  }`}>
                    "FIR No. 2026/0420 registered at Rajajinagar PS under Section 318(4) BNS. Predictive risk score calibrated at 78.4%."
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-stone-800/80">
                <div>
                  <span className="text-xs font-mono font-bold text-stone-200 block">
                    {lang === "en" ? "Workspace Scaling & Proportion" : "ಕಾರ್ಯಕ್ಷೇತ್ರ ಅಳತೆ"}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Visual window proportion scaling modeled after Linux display ergonomics" : "Linux ಪ್ರದರ್ಶನ ದಕ್ಷತೆಯ ಮಾದರಿಯಲ್ಲಿ"}
                  </span>
                </div>
                <ProportionalWidthWireframe activeWidth={transcriptWidth} onSelectWidth={setTranscriptWidth} lang={lang} />
              </div>
            </div>
          )}

          {/* 3. VOICE TAB */}
          {activeTab === "voice" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                  {lang === "en" ? "Primary Audio Language" : "ಪ್ರಾಥಮಿಕ ಆಡಿಯೊ ಭಾಷೆ"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "en", label: "English (India)", native: "Articulate" },
                    { id: "kn", label: "ಕನ್ನಡ (Kannada)", native: "ಸ್ಥಳೀಯ ಉಚ್ಚಾರಣೆ" },
                    { id: "hi", label: "हिन्दी (Hindi)", native: "प्राकृतिक" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        const newLang = l.id as "en" | "kn" | "hi";
                        const defaultSpeaker = newLang === "kn" ? "Anu" : (newLang === "hi" ? "Divya" : "Anna");
                        setTtsSettings({ language: newLang, voice: defaultSpeaker });
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        ttsSettings.language === l.id
                          ? "border-[#C79A4E] bg-[#C79A4E]/10 text-stone-100 font-bold"
                          : "border-stone-800 bg-stone-950/40 text-stone-400 hover:border-stone-700"
                      }`}
                    >
                      <p className="text-xs font-mono font-bold">{l.label}</p>
                      <p className="text-[10px] font-mono text-stone-500">{l.native}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                  {lang === "en" ? "Voice Persona & Timbre" : "ಧ್ವನಿ ವ್ಯಕ್ತಿತ್ವ ಮತ್ತು ಟೋನ್"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "buttery" as TtsStyle, name: lang === "en" ? "Buttery" : "ಬಟರಿ", badge: lang === "en" ? "Warm & Relaxed" : "ಆತ್ಮೀಯ", desc: lang === "en" ? "Smooth vocal delivery for fatigue-free listening" : "ದಣಿವು-ಮುಕ್ತ ಆಲಿಸುವಿಕೆ" },
                    { id: "authoritative" as TtsStyle, name: lang === "en" ? "Authoritative" : "ಅಧಿಕೃತ", badge: lang === "en" ? "Command Briefing" : "ಕಮಾಂಡ್", desc: lang === "en" ? "Crisp, formal police command cadence" : "ಖಚಿತ ಕಮಾಂಡ್ ಟೋನ್" },
                    { id: "calm" as TtsStyle, name: lang === "en" ? "Calm" : "ಶಾಂತ", badge: lang === "en" ? "Empathetic" : "ಸಹಾನುಭೂತಿ", desc: lang === "en" ? "Steady, reassuring cadence for sensitive cases" : "ಸ್ಥಿರ ಶೈಲಿ" },
                    { id: "urgent" as TtsStyle, name: lang === "en" ? "Urgent" : "ತುರ್ತು", badge: lang === "en" ? "Tactical Dispatch" : "ಕ್ಷಿಪ್ರ", desc: lang === "en" ? "Fast-paced tactical briefing and alerts" : "ವೇಗದ ಬ್ರೀಫಿಂಗ್" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setTtsSettings({ style: p.id }); setVoicePersona(p.id); }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        ttsSettings.style === p.id
                          ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                          : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-bold ${ttsSettings.style === p.id ? "text-[#C79A4E]" : "text-stone-200"}`}>{p.name}</span>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">{p.badge}</span>
                      </div>
                      <p className="text-[9.5px] text-stone-500 leading-snug mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-850">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Playback Speed" : "ಪ್ಲೇಬ್ಯಾಕ್ ವೇಗ"}
                  </label>
                  <div className="flex rounded-lg border border-stone-800 bg-stone-950/50 p-1 gap-1">
                    {[{ id: "slower" as TtsSpeed, label: "0.85x" }, { id: "normal" as TtsSpeed, label: "1.0x" }, { id: "faster" as TtsSpeed, label: "1.25x" }].map((spd) => (
                      <button
                        key={spd.id}
                        type="button"
                        onClick={() => setTtsSettings({ speed: spd.id })}
                        className={`flex-1 py-1 text-center text-[10.5px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                          ttsSettings.speed === spd.id ? "bg-[#C79A4E] text-stone-950" : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                        }`}
                      >
                        {spd.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Neural Speaker" : "ನ್ಯೂರಲ್ ಸ್ಪೀಕರ್"}
                  </label>
                  <div className="flex rounded-lg border border-stone-800 bg-stone-950/50 p-1 gap-1">
                    {(speakersByLang[ttsSettings.language] || speakersByLang.en).map((spk) => (
                      <button
                        key={spk.id}
                        type="button"
                        onClick={() => setTtsSettings({ voice: spk.id })}
                        className={`flex-1 py-1 text-center text-[10.5px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                          ttsSettings.voice === spk.id ? "bg-[#C79A4E] text-stone-950" : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                        }`}
                        title={spk.gender}
                      >
                        {spk.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-850 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isPlayingPreview ? (
                    <div className="flex items-center gap-1 h-5 px-2 bg-[#C79A4E]/10 border border-[#C79A4E]/30 rounded-md">
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-3 rounded-full" />
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-4 rounded-full" />
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-2 rounded-full" />
                      <span className="text-[10px] text-[#C79A4E] font-mono font-bold ml-1.5">
                        {lang === "en" ? "Streaming Preview..." : "ಪ್ಲೇ ಆಗುತ್ತಿದೆ..."}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-stone-500">
                      {lang === "en" ? "Sample voice test sentence" : "ಮಾದರಿ ಧ್ವನಿ ಪರೀಕ್ಷೆ ವಾಕ್ಯ"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isPreviewLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                    isPlayingPreview ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30" : "bg-[#C79A4E] text-stone-950 hover:bg-[#E4C590]"
                  }`}
                >
                  {isPreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isPlayingPreview ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>
                    {isPreviewLoading ? (lang === "en" ? "Synthesizing..." : "ಸಂಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...") : isPlayingPreview ? (lang === "en" ? "Stop" : "ನಿಲ್ಲಿಸಿ") : (lang === "en" ? "Preview Voice" : "ಧ್ವನಿ ಪೂರ್ವವೀಕ್ಷಣೆ")}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 4. ABOUT TAB */}
          {activeTab === "about" && (
            <div className="space-y-5 text-xs font-mono">
              <div className="space-y-3">
                <span className="text-xs font-bold text-stone-200 block uppercase tracking-wider">
                  {t.settingsSecurityPoliciesTitle}
                </span>
                <div className="space-y-3">
                  <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                    <MapPin className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <span className="font-bold text-stone-200 block text-[12px] uppercase tracking-wide">
                        {lang === "en" ? "Access Scope" : "ಪ್ರವೇಶ ವ್ಯಾಪ್ತಿ"}
                      </span>
                      <p className="text-[11px] leading-relaxed text-stone-500">
                        {lang === "en"
                          ? "Every query is row-level scoped to your own station -- you only ever see cases, suspects, and analytics for your assigned unit, enforced server-side on every request, not just hidden in the UI."
                          : "ಪ್ರತಿ ಪ್ರಶ್ನೆಯು ನಿಮ್ಮ ಸ್ವಂತ ಠಾಣೆಗೆ ಸೀಮಿತವಾಗಿದೆ."}
                      </p>
                      <div className="text-[10px] text-[#C79A4E] font-bold uppercase tracking-wider">
                        {lang === "en" ? "Tier: " : "ಸ್ತರ: "}{roleTier === "supervisor" ? (lang === "en" ? "Supervisor (PI and above)" : "ಮೇಲ್ವಿಚಾರಕ") : (lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ")}
                      </div>
                    </div>
                  </div>
                  <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                    <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-stone-200 block text-[12px] uppercase tracking-wide">{t.settingsSessionTimeoutTitle}</span>
                      <p className="text-[11px] leading-relaxed text-stone-500">
                        {lang === "en" ? (
                          <>Logs you out of this device and clears your local session after <strong>15 minutes</strong> of operator inactivity.</>
                        ) : (
                          <>ಆಪರೇಟರ್ ನಿಷ್ಕ್ರಿಯತೆಯ <strong>೧೫ ನಿಮಿಷಗಳ</strong> ನಂತರ ಲಾಗ್ ಔಟ್ ಮಾಡುತ್ತದೆ.</>
                        )}
                      </p>
                      <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">{t.settingsPolicyEnforced}</div>
                    </div>
                  </div>
                  <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                    <ShieldCheck className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-stone-200 block text-[12px] uppercase tracking-wide">{t.settingsTwoPersonTitle}</span>
                      <p className="text-[11px] leading-relaxed text-stone-500">{t.settingsTwoPersonDesc}</p>
                      <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{t.settingsControlEngaged}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-stone-200 block uppercase tracking-wider">{t.settingsDbDiagTitle}</span>
                <div className="p-3 bg-stone-900/50 border border-stone-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-stone-400" />
                    <span className="text-stone-300">{t.settingsZcqlLabel}</span>
                  </div>
                  <span className={`flex items-center gap-1.5 font-bold px-2 py-0.5 rounded border ${
                    isDbConnected ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-rose-400 bg-rose-500/10 border-rose-500/30"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isDbConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                    {isDbConnected ? t.settingsOnline : t.settingsOffline}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Change Request modal -- two-pane split (current official
          record vs proposed modifications), every editable field at once,
          MANDATORY statutory justification. Submits to supervisor approval,
          never applies directly (see comment above the handler). */}
      {isRequestOpen && (
        // z-[120]: see ChangePasswordModal.tsx's own comment on the same fix
        // -- this can now open from inside SettingsModal (z-[105] dialog).
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl border border-stone-800 p-5 space-y-4 rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-850 pb-3">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#C79A4E]" />
                {lang === "en" ? "Request Officer Profile Modification" : "ಅಧಿಕಾರಿ ಪ್ರೊಫೈಲ್ ತಿದ್ದುಪಡಿ ವಿನಂತಿ"}
              </h3>
              <button onClick={() => setIsRequestOpen(false)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10.5px] text-stone-550 leading-relaxed">
              {lang === "en"
                ? "Under KSP service regulations, profile updates require supervisor sanction. Leave any field blank to keep it unchanged."
                : "KSP ಸೇವಾ ನಿಯಮಗಳ ಅಡಿಯಲ್ಲಿ, ಪ್ರೊಫೈಲ್ ನವೀಕರಣಗಳಿಗೆ ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆ ಅಗತ್ಯವಿದೆ. ಬದಲಾಗದಂತೆ ಇರಿಸಲು ಯಾವುದೇ ಕ್ಷೇತ್ರವನ್ನು ಖಾಲಿ ಬಿಡಿ."}
            </p>

            {/* Two-pane grid: header row, then one row per field. */}
            <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-3 text-xs">
              <div className="text-[9px] font-bold uppercase text-stone-500 tracking-wide flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> {lang === "en" ? "Current Official Record" : "ಪ್ರಸ್ತುತ ದಾಖಲೆ"}
              </div>
              <div className="text-[9px] font-bold uppercase text-[#C79A4E] tracking-wide flex items-center gap-1">
                <Pencil className="w-2.5 h-2.5" /> {lang === "en" ? "Proposed Modification" : "ಪ್ರಸ್ತಾವಿತ ಬದಲಾವಣೆ"}
              </div>

              {/* Name */}
              <div className="bg-stone-950/40 border border-stone-900 rounded-lg px-3 py-2 text-stone-400 font-mono truncate self-center">
                {profile?.first_name || "—"}
              </div>
              <input
                value={draft.FirstName}
                onChange={(e) => setDraft((d) => ({ ...d, FirstName: e.target.value }))}
                placeholder={lang === "en" ? "New full name" : "ಹೊಸ ಪೂರ್ಣ ಹೆಸರು"}
                className="bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold"
              />

              {/* Rank */}
              <div className="bg-stone-950/40 border border-stone-900 rounded-lg px-3 py-2 text-stone-400 font-mono truncate self-center">
                {profile?.rank || "—"}
              </div>
              <select
                value={draft.RankID}
                onChange={(e) => setDraft((d) => ({ ...d, RankID: e.target.value }))}
                className="bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold"
              >
                <option value="">{lang === "en" ? "— No change —" : "— ಬದಲಾವಣೆ ಇಲ್ಲ —"}</option>
                {refData.ranks.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>

              {/* Designation */}
              <div className="bg-stone-950/40 border border-stone-900 rounded-lg px-3 py-2 text-stone-400 font-mono truncate self-center">
                {profile?.designation || "—"}
              </div>
              <select
                value={draft.DesignationID}
                onChange={(e) => setDraft((d) => ({ ...d, DesignationID: e.target.value }))}
                className="bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold"
              >
                <option value="">{lang === "en" ? "— No change —" : "— ಬದಲಾವಣೆ ಇಲ್ಲ —"}</option>
                {refData.designations.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>

              {/* Station / Unit */}
              <div className="bg-stone-950/40 border border-stone-900 rounded-lg px-3 py-2 text-stone-400 font-mono truncate self-center">
                {profile?.station || "—"}
              </div>
              <select
                value={draft.UnitID}
                onChange={(e) => setDraft((d) => ({ ...d, UnitID: e.target.value }))}
                className="bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold"
              >
                <option value="">{lang === "en" ? "— No change —" : "— ಬದಲಾವಣೆ ಇಲ್ಲ —"}</option>
                {refData.units.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>

              {/* Email */}
              <div className="bg-stone-950/40 border border-stone-900 rounded-lg px-3 py-2 text-stone-400 font-mono truncate self-center">
                {profile?.email || "—"}
              </div>
              <input
                value={draft.Email}
                onChange={(e) => setDraft((d) => ({ ...d, Email: e.target.value }))}
                placeholder={lang === "en" ? "New email" : "ಹೊಸ ಇಮೇಲ್"}
                className="bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold"
              />
            </div>

            {/* Mandatory statutory justification -- matches the plan's
                "Transfer Order No. / Reason: *" requirement; this is the
                one field that's never optional, unlike the individual
                profile fields above (any subset of which may be blank). */}
            <div className="space-y-1.5 border-t border-stone-850 pt-3">
              <label className="text-[10px] uppercase font-bold text-amber-400 tracking-wide">
                {lang === "en" ? "Justification / Transfer Order Reference *" : "ಸಮರ್ಥನೆ / ವರ್ಗಾವಣೆ ಆದೇಶ ಉಲ್ಲೇಖ *"}
              </label>
              <textarea
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                rows={2}
                required
                className="w-full bg-stone-950 border border-amber-500/30 focus:border-amber-500/60 rounded-lg px-3 py-2 text-stone-300 text-xs resize-none"
                placeholder={lang === "en" ? "e.g. KSP/DGO/TR-2026/894 — Promotion order dated 01-09-2026" : "ಉದಾ. KSP/DGO/TR-2026/894 — ಬಡ್ತಿ ಆದೇಶ"}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsRequestOpen(false)}
                className="flex-1 py-2 rounded-lg border border-stone-800 text-stone-400 text-xs font-bold uppercase cursor-pointer hover:border-stone-700"
              >
                {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
              </button>
              <button
                onClick={submitProfileChange}
                disabled={isSubmittingRequest}
                className="flex-1 py-2 rounded-lg bg-[#C79A4E] text-stone-950 text-xs font-black uppercase cursor-pointer hover:bg-[#E4C590] disabled:opacity-50"
              >
                {isSubmittingRequest ? (lang === "en" ? "Submitting…" : "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Submit Request to Supervisor" : "ಸಲ್ಲಿಸಿ")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Password Reset Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};
