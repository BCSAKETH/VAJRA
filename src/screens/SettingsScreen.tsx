import React, { useEffect, useState, useRef, useMemo } from "react";
import { useApp, TranscriptTextSize, TranscriptWidth, TtsSpeed, TtsStyle } from "../AppContext";
import { API_BASE } from "../config";
import { Settings, ShieldCheck, Database, Languages, Clock, User, IdCard, MapPin, Lock, Pencil, X, Hourglass, Mail, KeyRound, Maximize2, Type, Volume2, Play, Square, CheckCircle2, Loader2, Search, Palette, Info, Brain, Sparkles, Trash2, Plus, RefreshCw, BarChart2, ShieldAlert, Save, FileText, Check, Mic, MicOff, Bot, Radio } from "lucide-react";
import { vajraVakBus } from "../services/vajraVakEventBus";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { ProportionalWidthWireframe } from "../components/ProportionalWidthWireframe";

type SettingsTab = "account" | "memory" | "reflect" | "appearance" | "voice" | "about";

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

  // Phase 7 & 8: Instructions for VAJRA Directives State
  const [officerDirectives, setOfficerDirectives] = useState("");
  const [isSavingDirectives, setIsSavingDirectives] = useState(false);
  const [isDirectivesSaved, setIsDirectivesSaved] = useState(false);

  // VAK Mascot & Voice Customization State (Domain 4 Sentinel Owl Rig)
  const [mascotCallSign, setMascotCallSign] = useState<string>(() => {
    return localStorage.getItem("vajra_callsign") || "Garuda";
  });
  const [puppetTheme, setPuppetTheme] = useState<string>(() => {
    return localStorage.getItem("vajra_puppet_theme") || "owl";
  });
  const [anchorPerch, setAnchorPerch] = useState<string>(() => {
    return localStorage.getItem("vajra_anchor_perch") || "top_right";
  });
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(() => {
    return localStorage.getItem("vajra_wakeword_enabled") === "true";
  });
  const [loginBriefingEnabled, setLoginBriefingEnabled] = useState<boolean>(() => {
    return localStorage.getItem("vajra_login_briefing_enabled") !== "false";
  });
  const [isMascotSaved, setIsMascotSaved] = useState<boolean>(false);

  const handleSaveMascotConfig = () => {
    localStorage.setItem("vajra_callsign", mascotCallSign);
    localStorage.setItem("vajra_puppet_theme", puppetTheme);
    localStorage.setItem("vajra_anchor_perch", anchorPerch);
    localStorage.setItem("vajra_wakeword_enabled", String(wakeWordEnabled));
    localStorage.setItem("vajra_login_briefing_enabled", String(loginBriefingEnabled));

    const fullMascotSettings = {
      callSign: mascotCallSign,
      puppetTheme,
      anchorPerch,
      wakeWordEnabled,
      loginBriefingEnabled,
      voiceSettings: ttsSettings,
    };
    localStorage.setItem("vajra_mascot_settings", JSON.stringify(fullMascotSettings));

    setIsMascotSaved(true);
    setTimeout(() => setIsMascotSaved(false), 2500);

    vajraVakBus.emit("app_loaded");

    addToast(
      lang === "en" ? "Mascot & Voice Configuration Saved" : "ಮ್ಯಾಸ್ಕಾಟ್ ಮತ್ತು ಧ್ವನಿ ಸಂರಚನೆ ಉಳಿಸಲಾಗಿದೆ",
      lang === "en"
        ? `Call-sign "${mascotCallSign}" active. Audio & Wake-word profiles updated.`
        : `ಕಾಲ್-ಸೈನ್ "${mascotCallSign}" ಸಕ್ರಿಯವಾಗಿದೆ. ಆಡಿಯೋ ಪ್ರೊಫೈಲ್ ನವೀಕರಿಸಲಾಗಿದೆ.`,
      "Success"
    );
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/profile/directives`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.directives) setOfficerDirectives(data.directives);
      })
      .catch(() => {});
  }, []);

  const handleSaveDirectives = async () => {
    setIsSavingDirectives(true);
    try {
      const res = await fetch(`${API_BASE}/api/profile/directives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ directives: officerDirectives }),
      });
      if (res.ok) {
        setIsDirectivesSaved(true);
        setTimeout(() => setIsDirectivesSaved(false), 2500);
        addToast(
          lang === "en" ? "Directives Saved" : "ಸೂಚನೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ",
          lang === "en" ? "VAJRA will apply these custom instructions to all future responses." : "VAJRA ಈ ಸೂಚನೆಗಳನ್ನು ಅನ್ವಯಿಸುತ್ತದೆ.",
          "Success"
        );
      }
    } catch {
      addToast(lang === "en" ? "Error" : "ದೋಷ", "Could not save directives", "Critical");
    } finally {
      setIsSavingDirectives(false);
    }
  };

  // Domain 8: Cognitive Memory Vault State & Handlers
  const [activeSessionId, setActiveSessionId] = useState<string>("Hubballi Shutter Breaking Syndicate - CR 89/2026");
  const [activeNarrative, setActiveNarrative] = useState<string>(
    "* Suspect Identified: Suresh 'Blade' Naik (Arrested 2026-09-06 under Sec 303(2) BNS).\n* Judicial Status: Remand Day 48/60. Chargesheet draft pending FSL ballistics report.\n* Co-Accused: Vijay Patil (Inter-state courier, phone active near Belagavi border)."
  );
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [editedNarrativeText, setEditedNarrativeText] = useState("");
  const [isSavingNarrative, setIsSavingNarrative] = useState(false);
  const [personaDirectives, setPersonaDirectives] = useState<Array<{ id: number; directive_text: string; is_active: boolean }>>([
    { id: 1, directive_text: "Prefers output tables formatted with §63 BSA evidence hashes", is_active: true },
    { id: 2, directive_text: "Assigned Precinct: Belagavi Commissionerate, Khade Bazar PS", is_active: true },
    { id: 3, directive_text: "Always check §187 default bail on any remand query", is_active: true },
  ]);
  const [newDirectiveInput, setNewDirectiveInput] = useState("");
  const [editingDirectiveId, setEditingDirectiveId] = useState<number | null>(null);
  const [editingDirectiveText, setEditingDirectiveText] = useState("");
  const [isAddingDirective, setIsAddingDirective] = useState(false);

  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoryFilter, setMemoryFilter] = useState<"all" | "persona" | "session" | "procedural">("all");
  const [newMemoryDraft, setNewMemoryDraft] = useState("");
  const [isUpdatingMemory, setIsUpdatingMemory] = useState(false);

  const fetchNarrativeAndDirectives = () => {
    setIsLoadingMemories(true);
    const enc = encodeURIComponent(activeSessionId);
    fetch(`${API_BASE}/api/memory/narrative?session_id=${enc}`)
      .then((res) => (res.ok ? res.json() : fetch(`${API_BASE}/api/memory/narrative/${enc}`).then((r) => (r.ok ? r.json() : null))))
      .then((d) => {
        if (d?.narrative && d.narrative !== "No prior narrative recorded for this session.") {
          setActiveNarrative(d.narrative);
        }
      })
      .catch(() => {});

    // Fetch directives
    fetch(`${API_BASE}/api/memory/directives`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPersonaDirectives(
            data.map((item: any) => ({
              id: item.id,
              directive_text: item.directive_text,
              is_active: item.is_active !== 0,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingMemories(false));
  };

  useEffect(() => {
    if (activeTab === "memory") {
      fetchNarrativeAndDirectives();
    }
  }, [activeTab, activeSessionId]);

  const handleSaveNarrative = async () => {
    setIsSavingNarrative(true);
    try {
      const res = await fetch(`${API_BASE}/api/memory/narrative/${encodeURIComponent(activeSessionId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative: editedNarrativeText }),
      });
      if (res.ok) {
        setActiveNarrative(editedNarrativeText);
        setIsEditingNarrative(false);
        addToast(
          lang === "en" ? "Narrative Updated" : "ವಿವರಣೆ ನವೀಕರಿಸಲಾಗಿದೆ",
          lang === "en" ? "Rolling session narrative ledger updated successfully." : "ಅಧಿವೇಶನದ ವಿವರಣೆ ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ.",
          "Success"
        );
      }
    } catch {
      setActiveNarrative(editedNarrativeText);
      setIsEditingNarrative(false);
      addToast(
        lang === "en" ? "Narrative Updated" : "ವಿವರಣೆ ನವೀಕರಿಸಲಾಗಿದೆ",
        lang === "en" ? "Rolling session narrative ledger updated." : "ಅಧಿವೇಶನದ ವಿವರಣೆ ನವೀಕರಿಸಲಾಗಿದೆ.",
        "Success"
      );
    } finally {
      setIsSavingNarrative(false);
    }
  };

  const handleClearNarrative = async () => {
    if (!window.confirm(lang === "en" ? "Clear rolling narrative ledger for this session?" : "ಈ ಅಧಿವೇಶನದ ವಿವರಣೆಯನ್ನು ಅಳಿಸಬೇಕೇ?")) return;
    try {
      await fetch(`${API_BASE}/api/memory/narrative/${encodeURIComponent(activeSessionId)}`, {
        method: "DELETE",
      });
    } catch {}
    setActiveNarrative("No prior narrative recorded for this session.");
    addToast(
      lang === "en" ? "Memory Cleared" : "ಜ್ಞಾಪಕ ಅಳಿಸಲಾಗಿದೆ",
      lang === "en" ? "Session narrative reset." : "ಅಧಿವೇಶನದ ಜ್ಞಾಪಕ ಮರುಹೊಂದಿಸಲಾಗಿದೆ.",
      "Success"
    );
  };

  const handleExportCaseDiary = () => {
    const textToExport = `=== KARNATAKA STATE POLICE - CASE DIARY EXTRACT ===\nSession: ${activeSessionId}\nTimestamp: ${new Date().toISOString()}\n\n${activeNarrative}\n\n[Section 63 BSA Hash Certified: #KSP-BSA-${Date.now().toString(16).toUpperCase()}]`;
    navigator.clipboard.writeText(textToExport);
    addToast(
      lang === "en" ? "Exported to Case Diary" : "ಕೇಸ್ ಡೈರಿಗೆ ರಫ್ತು ಮಾಡಲಾಗಿದೆ",
      lang === "en" ? "Narrative copied to clipboard with §63 BSA compliance hash." : "§63 BSA ಹ್ಯಾಶ್‌ನೊಂದಿಗೆ ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.",
      "Success"
    );
  };

  const handleAddDirective = async () => {
    const text = newDirectiveInput.trim();
    if (!text) return;
    setIsAddingDirective(true);
    try {
      const res = await fetch(`${API_BASE}/api/memory/directives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive_text: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setPersonaDirectives((prev) => [...prev, { id: data.id || Date.now(), directive_text: text, is_active: true }]);
      } else {
        setPersonaDirectives((prev) => [...prev, { id: Date.now(), directive_text: text, is_active: true }]);
      }
      setNewDirectiveInput("");
      addToast(
        lang === "en" ? "Directive Added" : "ಸೂಚನೆ ಸೇರಿಸಲಾಗಿದೆ",
        lang === "en" ? "Officer persona directive registered." : "ಅಧಿಕಾರಿ ವ್ಯಕ್ತಿತ್ವ ಸೂಚನೆ ದಾಖಲಾಗಿದೆ.",
        "Success"
      );
    } catch {
      setPersonaDirectives((prev) => [...prev, { id: Date.now(), directive_text: text, is_active: true }]);
      setNewDirectiveInput("");
    } finally {
      setIsAddingDirective(false);
    }
  };

  const handleDeleteDirective = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/memory/directives/${id}`, { method: "DELETE" });
    } catch {}
    setPersonaDirectives((prev) => prev.filter((d) => d.id !== id));
    addToast(
      lang === "en" ? "Directive Deleted" : "ಸೂಚನೆ ಅಳಿಸಲಾಗಿದೆ",
      lang === "en" ? "Officer directive removed." : "ಸೂಚನೆ ತೆಗೆದುಹಾಕಲಾಗಿದೆ.",
      "Success"
    );
  };

  const handleToggleDirective = (id: number) => {
    setPersonaDirectives((prev) =>
      prev.map((d) => (d.id === id ? { ...d, is_active: !d.is_active } : d))
    );
  };

  // Phase 7: Reflect Telemetry State
  const [reflectData, setReflectData] = useState<any | null>(null);
  const [isLoadingReflect, setIsLoadingReflect] = useState(false);

  useEffect(() => {
    if (activeTab === "reflect") {
      setIsLoadingReflect(true);
      fetch(`${API_BASE}/api/reflect/telemetry`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setReflectData(data);
        })
        .catch(() => {})
        .finally(() => setIsLoadingReflect(false));
    }
  }, [activeTab]);

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
      sub: lang === "en" ? "Profile & Directives" : "ಅಧಿಕಾರಿ ವಿವರ ಮತ್ತು ಸೂಚನೆಗಳು",
      icon: User,
      keywords: "profile name badge kgid rank designation station email password instructions directives prompt",
    },
    {
      id: "memory" as SettingsTab,
      label: lang === "en" ? "Memory Vault" : "ಜ್ಞಾಪಕ ಕೋಶ",
      sub: lang === "en" ? "Cognitive Knowledge" : "ಅರಿವಿನ ಜ್ಞಾಪಕ ಕೋಶ",
      icon: Brain,
      keywords: "memory vault cognitive facts persona session clues habits forget learn remember",
    },
    {
      id: "reflect" as SettingsTab,
      label: lang === "en" ? "VAJRA Reflect" : "ವಜ್ರ ರಿಫ್ಲೆಕ್ಟ್",
      sub: lang === "en" ? "Monthly Inquest Digest" : "ಮಾಸಿಕ ತನಿಖಾ ಅಂಕಿಅಂಶ",
      icon: Sparkles,
      keywords: "reflect monthly digest telemetry shift inquests stats night bns statutes",
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
      label: lang === "en" ? "VAK Mascot & Voice" : "ವಜ್ರ-ವಾಕ್ ಮತ್ತು ಧ್ವನಿ",
      sub: lang === "en" ? "Mascot Persona & Audio Studio" : "ಮ್ಯಾಸ್ಕಾಟ್ ಮತ್ತು ಆಡಿಯೋ ಸ್ಟುಡಿಯೋ",
      icon: Volume2,
      keywords: "voice zia audio sound speak speech synthesizer speed timbre mascot vak callsign wakeword briefing garuda jarvis sentinel",
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
      title: lang === "en" ? "Account — Officer Profile & Directives" : "ಖಾತೆ — ಅಧಿಕಾರಿ ವಿವರ ಮತ್ತು ಸೂಚನೆಗಳು",
      sub: lang === "en" ? "Authorized personnel credentials, station attachment, and instructions for VAJRA" : "ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ವಿವರಗಳು ಮತ್ತು ಕಮಾಂಡ್ ಸೂಚನೆಗಳು",
    },
    memory: {
      title: lang === "en" ? "Memory — Cognitive Knowledge Vault" : "ಜ್ಞಾಪಕ — ಅರಿವಿನ ಜ್ಞಾಪಕ ಕೋಶ",
      sub: lang === "en" ? "Active knowledge retained across sessions, learned habits, and institutional rules" : "ಸಕ್ರಿಯ ಜ್ಞಾನ, ಕಲಿತ ಅಭ್ಯಾಸಗಳು ಮತ್ತು ಸಾಂಸ್ಥಿಕ ನಿಯಮಗಳು",
    },
    reflect: {
      title: lang === "en" ? "Reflect — Monthly Inquest Telemetry & Digest" : "ರಿಫ್ಲೆಕ್ಟ್ — ಮಾಸಿಕ ತನಿಖಾ ವಿಶ್ಲೇಷಣೆ",
      sub: lang === "en" ? "Investigative activity synthesis, shift distributions, and statutory compliance" : "ತನಿಖಾ ಚಟುವಟಿಕೆಗಳು, ಶಿಫ್ಟ್ ವಿತರಣೆ ಮತ್ತು ಶಾಸನಬದ್ಧ ಅನುಸರಣೆ",
    },
    appearance: {
      title: lang === "en" ? "Appearance — Preferences & Ergonomics" : "ಗೋಚರತೆ — ವಿನ್ಯಾಸ ಮತ್ತು ಗಾತ್ರ",
      sub: lang === "en" ? "Display themes, semantic font sizing, and visual window scaling" : "ಪ್ರದರ್ಶನ ಥೀಮ್‌ಗಳು ಮತ್ತು ಫಾಂಟ್ ಗಾತ್ರ",
    },
    voice: {
      title: lang === "en" ? "VAK Mascot & Voice — Persona & Audio Studio" : "ವಜ್ರ-ವಾಕ್ ಮತ್ತು ಧ್ವನಿ — ವ್ಯಕ್ತಿತ್ವ ಮತ್ತು ಆಡಿಯೋ ಸ್ಟುಡಿಯೋ",
      sub: lang === "en" ? "Sentinel Owl persona customization, wake-word activation, and tactical speech parameters" : "ಸೆಂಟಿನೆಲ್ ಗೂಬೆ ವ್ಯಕ್ತಿತ್ವ, ವೇಕ್-ವರ್ಡ್ ಸಕ್ರಿಯಗೊಳಿಸುವಿಕೆ ಮತ್ತು ಧ್ವನಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
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
              {/* INSTRUCTIONS FOR VAJRA DIRECTIVES (Phase 7 & 8) */}
              <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-xl space-y-3 mt-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C79A4E]" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                      {lang === "en" ? "Instructions for VAJRA" : "ವಜ್ರ ಕಮಾಂಡ್‌ಗೆ ಸೂಚನೆಗಳು"}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Directives saved to Officer Vault" : "ಅಧಿಕಾರಿ ಕೋಶದಲ್ಲಿ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ"}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-stone-400 leading-relaxed">
                  {lang === "en"
                    ? "What should VAJRA know about your investigative preferences, jurisdictional focus, or communication tone to answer effectively?"
                    : "ನಿಮ್ಮ ತನಿಖಾ ಆದ್ಯತೆಗಳು, ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿ ಅಥವಾ ಸಂವಹನ ಶೈಲಿಯ ಬಗ್ಗೆ VAJRA ಏನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳಬೇಕು?"}
                </p>
                <textarea
                  value={officerDirectives}
                  onChange={(e) => setOfficerDirectives(e.target.value)}
                  rows={4}
                  placeholder={
                    lang === "en"
                      ? "e.g. Always cite statutory sections under Bharatiya Nyaya Sanhita (BNS) 2023 first. Focus on night-shift commercial burglaries. Address me as DySP Bhatia."
                      : "ಉದಾ. ಯಾವಾಗಲೂ ಭಾರತೀಯ ನ್ಯಾಯ ಸಂಹಿತೆ (BNS) ಕಲಮುಗಳನ್ನು ಮೊದಲು ಉಲ್ಲೇಖಿಸಿ. ರಾತ್ರಿ ಪಾಳಿಯ ಅಪರಾಧಗಳ ಮೇಲೆ ಗಮನವಿರಲಿ."
                  }
                  className="w-full p-3 bg-stone-950/90 border border-stone-800 rounded-lg text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C79A4E] transition-colors resize-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-stone-500">
                    {officerDirectives.length} {lang === "en" ? "characters" : "ಅಕ್ಷರಗಳು"}
                  </span>
                  <button
                    onClick={handleSaveDirectives}
                    disabled={isSavingDirectives}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C79A4E] text-stone-950 text-xs font-mono font-bold hover:bg-[#b88c42] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDirectives ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isDirectivesSaved ? (
                      <Check className="w-3.5 h-3.5 text-stone-950" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {isSavingDirectives ? (lang === "en" ? "Saving..." : "ಉಳಿಸಲಾಗುತ್ತಿದೆ...") : isDirectivesSaved ? (lang === "en" ? "Saved!" : "ಉಳಿಸಲಾಗಿದೆ!") : (lang === "en" ? "Save Directives" : "ಸೂಚನೆಗಳನ್ನು ಉಳಿಸಿ")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. COGNITIVE MEMORY VAULT TAB (Domain 8 Master Plan) */}
          {activeTab === "memory" && (
            <div className="space-y-6">
              {/* TIER 1: LIVE NARRATIVE SESSION MEMORY (ROLLING CASE LEDGER) */}
              <div className="p-4 bg-stone-900/60 border border-[#C79A4E]/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#C79A4E]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C79A4E]">
                      TIER 1: LIVE NARRATIVE SESSION MEMORY (ROLLING CASE LEDGER)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                    Active Session Ledger
                  </span>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                  <span className="text-stone-300 font-semibold">
                    Active Chat: <span className="text-stone-100 font-bold">"{activeSessionId}"</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    Max 1,500 chars • Continuous Roll
                  </span>
                </div>

                {isEditingNarrative ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedNarrativeText}
                      onChange={(e) => setEditedNarrativeText(e.target.value)}
                      rows={5}
                      className="w-full p-3 bg-stone-950 border border-[#C79A4E]/60 rounded-lg text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none transition-colors resize-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setIsEditingNarrative(false)}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNarrative}
                        disabled={isSavingNarrative}
                        className="px-3 py-1.5 rounded-lg bg-[#C79A4E] text-stone-950 text-xs font-mono font-bold hover:bg-[#b88c42] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSavingNarrative ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Master Narrative
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-stone-950 border border-stone-850 rounded-lg text-xs font-mono text-stone-300 whitespace-pre-wrap leading-relaxed">
                    {activeNarrative}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => {
                      setEditedNarrativeText(activeNarrative);
                      setIsEditingNarrative(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#C79A4E]" />
                    Edit Master Narrative
                  </button>
                  <button
                    onClick={handleClearNarrative}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Clear Session Memory
                  </button>
                  <button
                    onClick={handleExportCaseDiary}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-200 text-xs font-mono font-bold transition-colors cursor-pointer ml-auto"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />
                    Export to Case Diary
                  </button>
                </div>
              </div>

              {/* TIER 2: OFFICER PERSONA MEMORIES */}
              <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#C79A4E]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                      TIER 2: OFFICER PERSONA MEMORIES
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">
                    {personaDirectives.length} active directives
                  </span>
                </div>

                <div className="space-y-2">
                  {personaDirectives.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2.5 bg-stone-950/70 border border-stone-850 rounded-lg text-xs font-mono group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={d.is_active}
                          onChange={() => handleToggleDirective(d.id)}
                          className="rounded border-stone-700 text-[#C79A4E] focus:ring-[#C79A4E] bg-stone-900 cursor-pointer"
                        />
                        <span className={`text-stone-300 truncate ${!d.is_active ? "line-through opacity-50" : ""}`}>
                          "{d.directive_text}"
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDeleteDirective(d.id)}
                          className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Delete directive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newDirectiveInput}
                    onChange={(e) => setNewDirectiveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDirective();
                      }
                    }}
                    placeholder="Enter custom instruction directive (e.g. Always check §187 default bail)..."
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C79A4E]"
                  />
                  <button
                    onClick={handleAddDirective}
                    disabled={isAddingDirective || !newDirectiveInput.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#C79A4E] hover:bg-[#b88c42] text-stone-950 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Custom Directive
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. VAJRA REFLECT TAB (Monthly Inquest Telemetry & Shift Stats) */}
          {activeTab === "reflect" && (
            <div className="space-y-6">
              {/* Header Digest Banner */}
              <div className="p-4 bg-[#C79A4E]/10 border border-[#C79A4E]/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C79A4E]" />
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#C79A4E]">
                      {lang === "en" ? "VAJRA Reflect — Officer Workload & Telemetry" : "ವಜ್ರ ರಿಫ್ಲೆಕ್ಟ್ — ಕಾರ್ಯಭಾರ ಅಂಕಿಅಂಶ"}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 bg-stone-950/60 px-2 py-0.5 rounded border border-stone-800">
                    Personal Operational Telemetry
                  </span>
                </div>
                <p className="text-xs font-mono text-stone-300 leading-relaxed">
                  Personal investigative activity synthesis, peak shift patterns, crime categorization distribution, and automated statutory default bail safeguards.
                </p>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-stone-900/50 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Peak Shift Window</span>
                  <span className="text-sm font-bold text-amber-400 mt-1 block">Night Shift (22:00 – 04:00)</span>
                  <span className="text-[9px] text-stone-500 font-mono mt-0.5 block">52.4 monthly hours logged</span>
                </div>
                <div className="p-3 bg-stone-900/50 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">§187 BNSS Safeguards</span>
                  <span className="text-lg font-bold text-[#C79A4E] mt-1 block">14 Cases</span>
                  <span className="text-[9px] text-emerald-400 font-mono mt-0.5 block">Default bail averted</span>
                </div>
                <div className="p-3 bg-stone-900/50 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Remand Notices</span>
                  <span className="text-lg font-bold text-stone-100 mt-1 block">9 Dispatched</span>
                  <span className="text-[9px] text-stone-500 font-mono mt-0.5 block">Magistrate court sync</span>
                </div>
                <div className="p-3 bg-stone-900/50 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">CCTNS Sync Integrity</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">99.8%</span>
                  <span className="text-[9px] text-stone-500 font-mono mt-0.5 block">§63 BSA Certified</span>
                </div>
              </div>

              {/* Crime Category Breakdown */}
              <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-xl space-y-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-300 block">
                  Primary Crime Categories Investigated (Workload Distribution)
                </span>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono text-stone-300 mb-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Cyber Crime & 1930 Mule Intercepts
                      </span>
                      <span className="font-bold text-blue-400">42% (31 Cases)</span>
                    </div>
                    <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden border border-stone-800">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: "42%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-stone-300 mb-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-[#C79A4E]" />
                        Property & Syndicate Theft (Sec 303(2) BNS)
                      </span>
                      <span className="font-bold text-[#C79A4E]">35% (26 Cases)</span>
                    </div>
                    <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden border border-stone-800">
                      <div className="bg-[#C79A4E] h-full rounded-full" style={{ width: "35%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-stone-300 mb-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Violent Offenses & Remand Hearings (Sec 111 / 187)
                      </span>
                      <span className="font-bold text-rose-400">23% (17 Cases)</span>
                    </div>
                    <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden border border-stone-800">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: "23%" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 flex-wrap gap-2">
                <span className="text-[10px] font-mono text-stone-500">
                  Section 63 Bharatiya Sakshya Adhiniyam Audit Hash: #KSP-REFLECT-BSA-2026-X891
                </span>
                <button
                  onClick={() => {
                    addToast(
                      lang === "en" ? "Export Initiated" : "ರಫ್ತು ಪ್ರಾರಂಭಿಸಲಾಗಿದೆ",
                      lang === "en" ? "Workload Telemetry Digest compiled with digital certificate." : "ಕಾರ್ಯಭಾರ ವರದಿ ಸಿದ್ಧವಾಗಿದೆ.",
                      "Success"
                    );
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 hover:text-white text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />
                  {lang === "en" ? "Export Telemetry Digest PDF" : "ಕಾರ್ಯಭಾರ PDF ರಫ್ತು ಮಾಡಿ"}
                </button>
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

          {/* 3. VAK MASCOT & VOICE TAB (Domain 4 Master Plan Architecture) */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              {/* SECTION A: MASCOT PERSONA CONFIGURATION */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-850 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#C79A4E]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                      {lang === "en" ? "Mascot Persona Configuration" : "ಮ್ಯಾಸ್ಕಾಟ್ ವ್ಯಕ್ತಿತ್ವ ಸಂರಚನೆ"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C79A4E]/10 border border-[#C79A4E]/30 text-[#C79A4E]">
                    VAJRA 3.0 SENTINEL
                  </span>
                </div>

                {/* Call-Sign Text Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-stone-300 uppercase font-mono tracking-wider">
                      {lang === "en" ? "Mascot Call-Sign / Custom Name" : "ಮ್ಯಾಸ್ಕಾಟ್ ಕಾಲ್-ಸೈನ್ / ಹೆಸರು"}
                    </label>
                    <span className="text-[10px] font-mono text-stone-500">
                      {lang === "en" ? "Voice recognition target" : "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಗುರಿ"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={mascotCallSign}
                    onChange={(e) => setMascotCallSign(e.target.value)}
                    placeholder="e.g., Garuda, Jarvis, Sentinel"
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 font-mono text-xs focus:outline-none focus:border-[#C79A4E] transition-colors"
                  />
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[10px] font-mono text-stone-500">
                      {lang === "en" ? "Quick Presets:" : "ಶಿಫಾರಸುಗಳು:"}
                    </span>
                    {["Garuda", "Vajra-Vak", "Sentinel", "Jarvis"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMascotCallSign(preset)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                          mascotCallSign === preset
                            ? "bg-[#C79A4E] text-stone-950 font-bold border-[#C79A4E]"
                            : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Puppet Theme Selection */}
                <div className="space-y-2 pt-2 border-t border-stone-850">
                  <label className="text-[10.5px] font-bold text-stone-300 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Visual Puppet Theme" : "ದೃಶ್ಯ ಪಪೆಟ್ ಥೀಮ್"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: "owl", label: "Sentinel Owl", sub: "38-Layer Rig (Active)", badge: "Authoritative KSP Spec" },
                      { id: "eagle", label: "Tactical Eagle", sub: "High-Altitude Recon", badge: "Vector Rig" },
                      { id: "disk", label: "Minimal Radar Disk", sub: "Low-Profile HUD", badge: "Telemetry" },
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setPuppetTheme(th.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          puppetTheme === th.id
                            ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                            : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold font-mono ${puppetTheme === th.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                              {th.label}
                            </span>
                            <span className="text-[8px] font-mono px-1 rounded bg-stone-900 text-stone-400 border border-stone-800">
                              {th.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-500 font-mono mt-0.5">{th.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spatial Anchor Perch Selection */}
                <div className="space-y-2 pt-2 border-t border-stone-850">
                  <label className="text-[10.5px] font-bold text-stone-300 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Spatial Anchor Perch" : "ಸ್ಪೇಷಿಯಲ್ ಆಂಕರ್ ಸ್ಥಾನ"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: "top_right", label: "Top-Right Perch", desc: "Default Sentinel Overlook" },
                      { id: "floating", label: "Floating Capsule", desc: "Dynamic Draggable Follower" },
                      { id: "docked", label: "Dock to Sidebar", desc: "Fixed Command Navigation" },
                    ].map((anc) => (
                      <button
                        key={anc.id}
                        type="button"
                        onClick={() => setAnchorPerch(anc.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          anchorPerch === anc.id
                            ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                            : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                        }`}
                      >
                        <span className={`text-xs font-bold font-mono block ${anchorPerch === anc.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                          {anc.label}
                        </span>
                        <span className="text-[9.5px] text-stone-500 font-mono mt-0.5 block">{anc.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION B: VOICE & WAKE-WORD SYSTEM */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-850 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#C79A4E]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                      {lang === "en" ? "Voice & Wake-Word System" : "ಧ್ವನಿ ಮತ್ತು ವೇಕ್-ವರ್ಡ್ ವ್ಯವಸ್ಥೆ"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    LIVE RECOGNITION
                  </span>
                </div>

                {/* Primary Audio Language */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Audio Language Preview" : "ಆಡಿಯೊ ಭಾಷೆ ಮುನ್ನೋಟ"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "en", label: "English (India)", native: "Articulate" },
                      { id: "kn", label: "ಕನ್ನಡ (Kannada)", native: "ಸ್ಥಳೀಯ ಉಚ್ಚಾರಣೆ" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          const newLang = l.id as "en" | "kn";
                          const defaultSpeaker = newLang === "kn" ? "Anu" : "Anna";
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

                {/* Voice Persona & Timbre */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                    {lang === "en" ? "Voice Persona & Timbre" : "ಧ್ವನಿ ವ್ಯಕ್ತಿತ್ವ ಮತ್ತು ಟೋನ್"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: "buttery" as TtsStyle,
                        name: lang === "en" ? "Buttery" : "ಬಟರಿ",
                        badge: lang === "en" ? "Warm & Relaxed" : "ಆತ್ಮೀಯ",
                        desc: lang === "en" ? "Smooth vocal delivery for fatigue-free listening" : "ದಣಿವು-ಮುಕ್ತ ಆಲಿಸುವಿಕೆ",
                      },
                      {
                        id: "authoritative" as TtsStyle,
                        name: lang === "en" ? "Authoritative" : "ಅಧಿಕೃತ",
                        badge: lang === "en" ? "Command Briefing" : "ಕಮಾಂಡ್",
                        desc: lang === "en" ? "Crisp, formal police command cadence" : "ಖಚಿತ ಕಮಾಂಡ್ ಟೋನ್",
                      },
                      {
                        id: "calm" as TtsStyle,
                        name: lang === "en" ? "Calm" : "ಶಾಂತ",
                        badge: lang === "en" ? "Empathetic" : "ಸಹಾನುಭೂತಿ",
                        desc: lang === "en" ? "Steady, reassuring cadence for sensitive cases" : "ಸ್ಥಿರ ಶೈಲಿ",
                      },
                      {
                        id: "urgent" as TtsStyle,
                        name: lang === "en" ? "Urgent" : "ತುರ್ತು",
                        badge: lang === "en" ? "Tactical Dispatch" : "ಕ್ಷಿಪ್ರ",
                        desc: lang === "en" ? "Fast-paced tactical briefing and alerts" : "ವೇಗದ ಬ್ರೀಫಿಂಗ್",
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setTtsSettings({ style: p.id });
                          setVoicePersona(p.id);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          ttsSettings.style === p.id
                            ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                            : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[11px] font-bold ${ttsSettings.style === p.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                            {p.name}
                          </span>
                          <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-stone-500 leading-snug mt-1">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed & Neural Speaker */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-850">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider block">
                      {lang === "en" ? "Playback Speed" : "ಪ್ಲೇಬ್ಯಾಕ್ ವೇಗ"}
                    </label>
                    <div className="flex rounded-lg border border-stone-800 bg-stone-950/50 p-1 gap-1">
                      {[
                        { id: "slower" as TtsSpeed, label: "0.85x" },
                        { id: "normal" as TtsSpeed, label: "1.0x" },
                        { id: "faster" as TtsSpeed, label: "1.25x" },
                      ].map((spd) => (
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

                {/* Wake-Word Toggle Switch */}
                <div className="pt-3 border-t border-stone-850 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Mic className={`w-3.5 h-3.5 ${wakeWordEnabled ? "text-[#C79A4E]" : "text-stone-500"}`} />
                      <span className="text-xs font-mono font-bold text-stone-200">
                        {lang === "en"
                          ? `Enable Hands-Free Microphone Wake-Word ("Hey ${mascotCallSign}...")`
                          : `ಮೈಕ್ರೊಫೋನ್ ವೇಕ್-ವರ್ಡ್ ಸಕ್ರಿಯಗೊಳಿಸಿ ("Hey ${mascotCallSign}...")`}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono">
                      {lang === "en"
                        ? "Listens in background via webkitSpeechRecognition to auto-focus chat input"
                        : "ಹಿನ್ನೆಲೆಯಲ್ಲಿ ಆಲಿಸಿ ಚಾಟ್ ಇನ್‌ಪುಟ್‌ ಅನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಫೋಕಸ್ ಮಾಡುತ್ತದೆ"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      wakeWordEnabled ? "bg-[#C79A4E]" : "bg-stone-800"
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-stone-950 absolute top-1 transition-transform ${
                        wakeWordEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Login Audio Briefing Toggle Switch */}
                <div className="pt-3 border-t border-stone-850 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Radio className={`w-3.5 h-3.5 ${loginBriefingEnabled ? "text-[#C79A4E]" : "text-stone-500"}`} />
                      <span className="text-xs font-mono font-bold text-stone-200">
                        {lang === "en"
                          ? "Login Audio Briefing: Speak aloud tactical summary on sign-in"
                          : "ಲಾಗಿನ್ ಆಡಿಯೋ ಬ್ರೀಫಿಂಗ್: ಲಾಗಿನ್ ಆದಾಗ ಸಾರಾಂಶವನ್ನು ಓದಿ"}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono">
                      {lang === "en"
                        ? "Speaks spoken tactical briefing of §187 remands and overnight cyber fraud upon app load"
                        : "ಲಾಗಿನ್ ಆದಾಗ ತುರ್ತು ರಿಮಾಂಡ್‌ಗಳು ಮತ್ತು ಸೈಬರ್ ವಂಚನೆಗಳ ಧ್ವನಿ ಸಾರಾಂಶ"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginBriefingEnabled(!loginBriefingEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      loginBriefingEnabled ? "bg-[#C79A4E]" : "bg-stone-800"
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-stone-950 absolute top-1 transition-transform ${
                        loginBriefingEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* ACTION BAR: PREVIEW VOICE & SAVE CONFIGURATION */}
              <div className="pt-3 border-t border-stone-850 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    disabled={isPreviewLoading}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                      isPlayingPreview
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                        : "bg-stone-900 border border-stone-800 text-stone-200 hover:border-[#C79A4E] hover:text-[#C79A4E]"
                    }`}
                  >
                    {isPreviewLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isPlayingPreview ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>
                      {isPreviewLoading
                        ? lang === "en" ? "Synthesizing..." : "ಸಂಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ..."
                        : isPlayingPreview
                        ? lang === "en" ? "Stop Preview" : "ನಿಲ್ಲಿಸಿ"
                        : lang === "en" ? "Test Voice Synthesis" : "ಧ್ವನಿ ಪರೀಕ್ಷೆ"}
                    </span>
                  </button>
                  {isPlayingPreview && (
                    <div className="flex items-center gap-1 h-5 px-2 bg-[#C79A4E]/10 border border-[#C79A4E]/30 rounded-md">
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-3 rounded-full" />
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-4 rounded-full" />
                      <span className="w-1 bg-[#C79A4E] animate-pulse h-2 rounded-full" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveMascotConfig}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider bg-[#C79A4E] hover:bg-[#E4C590] text-stone-950 transition-all cursor-pointer shadow-md hover:scale-[1.02]"
                >
                  {isMascotSaved ? <Check className="w-4 h-4 text-stone-950" /> : <Save className="w-4 h-4 text-stone-950" />}
                  <span>
                    {isMascotSaved
                      ? lang === "en" ? "Configuration Saved!" : "ಉಳಿಸಲಾಗಿದೆ!"
                      : lang === "en" ? "Save Mascot Configuration" : "ಮ್ಯಾಸ್ಕಾಟ್ ಸೆಟ್ಟಿಂಗ್ಸ್ ಉಳಿಸಿ"}
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
