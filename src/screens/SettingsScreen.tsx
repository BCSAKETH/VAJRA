import React, { useEffect, useState, useRef } from "react";
import { useApp, TranscriptTextSize, TranscriptWidth, TtsSpeed, TtsStyle } from "../AppContext";
import { API_BASE } from "../config";
import { Settings, ShieldCheck, Database, Languages, Clock, User, IdCard, MapPin, Lock, Pencil, X, Hourglass, Mail, KeyRound, Maximize2, Type, Volume2, Play, Square, CheckCircle2, Loader2 } from "lucide-react";
import { ChangePasswordModal } from "../components/ChangePasswordModal";

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

export const SettingsScreen: React.FC = () => {
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

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#C79A4E]" />
            <span>{t.navSettings}</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {t.settingsDesc}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: General Prefs & System Health */}
        <div className="space-y-6">
          {/* Card 0: Officer Profile -- same /api/auth/me the sidebar
              popover uses, surfaced here too as the canonical "who am I,
              what can I see" reference point. */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <IdCard className="w-4 h-4 text-[#C79A4E]" />
                <span>{lang === "en" ? "Officer Profile" : "ಅಧಿಕಾರಿ ಪ್ರೊಫೈಲ್"}</span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-stone-550 normal-case tracking-normal bg-stone-950/50 border border-stone-900 rounded-full px-2 py-0.5 ml-1">
                  <Lock className="w-2.5 h-2.5" />
                  {lang === "en" ? "Read-only" : "ಓದಲು-ಮಾತ್ರ"}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-300 hover:text-white border border-stone-700 hover:border-stone-500 rounded-md px-2 py-1 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-3 h-3 text-[#C79A4E]" />
                  {lang === "en" ? "Change Password" : "ರಹಸ್ಯಪದ ಬದಲಿಸಿ"}
                </button>
                {!myRequest || myRequest.status !== "pending" ? (
                  <button
                    onClick={openRequestModal}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#C79A4E] hover:text-[#E4C590] border border-[#C79A4E]/30 hover:border-[#C79A4E]/60 rounded-md px-2 py-1 cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {lang === "en" ? "Request Profile Modification" : "ಪ್ರೊಫೈಲ್ ಬದಲಾವಣೆ ಕೋರಿ"}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-400 border border-amber-500/30 rounded-md px-2 py-1">
                    <Hourglass className="w-3 h-3" />
                    {lang === "en" ? "Pending review" : "ಪರಿಶೀಲನೆ ಬಾಕಿ"}
                  </span>
                )}
              </div>
            </div>
            {myRequest && myRequest.status === "pending" && (
              <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-lg px-3 py-2 text-[10.5px] text-amber-300/90 font-mono">
                {lang === "en" ? "Requested: " : "ಕೋರಿದ್ದು: "}
                {Object.entries(myRequest.requested_changes || {}).map(([k, v]) => {
                  // Resolve an ID-based field (RankID, DesignationID, UnitID)
                  // to its real name for a readable label, instead of the
                  // raw numeric ID -- falls back to the raw value if the
                  // reference list hasn't loaded or the ID isn't found.
                  const lookup: Record<string, RefOption[]> = { RankID: refData.ranks, DesignationID: refData.designations, UnitID: refData.units };
                  const fieldLabel: Record<string, string> = { FirstName: lang === "en" ? "Name" : "ಹೆಸರು", RankID: lang === "en" ? "Rank" : "ಶ್ರೇಣಿ", DesignationID: lang === "en" ? "Designation" : "ಪದನಾಮ", UnitID: lang === "en" ? "Station" : "ಠಾಣೆ", Email: "Email" };
                  const resolved = lookup[k]?.find((o) => String(o.id) === String(v))?.name || v;
                  return `${fieldLabel[k] || k} → ${resolved}`;
                }).join(", ")}
                {" — "}
                {lang === "en" ? "awaiting supervisor sign-off." : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ."}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono text-[11px]">
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Name" : "ಹೆಸರು"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.first_name || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">KGID</div>
                <div className="font-bold text-stone-200 truncate">{profile?.kgid || badgeNumber || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Rank" : "ಶ್ರೇಣಿ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.rank || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Designation" : "ಪದನಾಮ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.designation || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900 col-span-2">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Home Station" : "ಠಾಣೆ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.station || "—"}</div>
              </div>
              {/* Email: the ONLY address VAJRA's "email me X" chat feature
                  ever sends to. Genuinely empty for everyone at first, so
                  setting it once needs no approval; once set it locks like
                  every other field above and needs the same request-change
                  flow (see set-email-once's backend docstring). */}
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900 col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] text-stone-550 uppercase flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {lang === "en" ? "Email (for VAJRA's mail feature)" : "ಇಮೇಲ್ (VAJRA ಮೇಲ್ ವೈಶಿಷ್ಟ್ಯಕ್ಕಾಗಿ)"}
                  </div>
                </div>
                {profile?.email ? (
                  <div className="font-bold text-stone-200 truncate">{profile.email}</div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder={lang === "en" ? "you@ksp.gov.in" : "you@ksp.gov.in"}
                      className="flex-1 bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1.5 text-stone-200 font-bold text-[11px]"
                    />
                    <button
                      onClick={submitEmailOnce}
                      disabled={isSavingEmail}
                      className="px-3 py-1.5 rounded-lg bg-[#C79A4E] text-stone-950 text-[10px] font-black uppercase cursor-pointer hover:bg-[#E4C590] disabled:opacity-50 shrink-0"
                    >
                      {isSavingEmail ? "…" : (lang === "en" ? "Save" : "ಉಳಿಸಿ")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 1: Preferences */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.settingsLangThemeTitle}</span>
            </h3>

            <div className="space-y-3.5 pt-2 text-xs">
              {/* Language Selection */}
              <div className="flex justify-between items-center bg-stone-950/40 p-3 rounded-lg border border-stone-900">
                <span className="font-semibold text-stone-400">{t.settingsAppLanguage}</span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                  className="bg-stone-900 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1 text-stone-200 font-bold text-xs"
                >
                  <option value="en">{t.settingsLangOptEn}</option>
                  <option value="kn">{t.settingsLangOptKn}</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center bg-stone-950/40 p-3 rounded-lg border border-stone-900">
                <span className="font-semibold text-stone-400">{t.settingsDisplayTheme}</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-stone-900 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1 text-stone-200 font-bold text-xs"
                >
                  <option value="high-contrast-dark">{t.settingsThemeDark}</option>
                  <option value="light">{t.settingsThemeLight}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card: Transcript Ergonomics (Section 15) */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-[#C79A4E]" />
                <span>{lang === "en" ? "Transcript Ergonomics" : "ಸಂಭಾಷಣೆ ವಿನ್ಯಾಸ ಮತ್ತು ದಕ್ಷತೆ"}</span>
              </h3>
              <span className="text-[9px] font-mono text-[#C79A4E] bg-[#C79A4E]/10 border border-[#C79A4E]/25 px-2 py-0.5 rounded-full font-bold uppercase">
                {lang === "en" ? "Live Viewport" : "ಲೈವ್ ವ್ಯೂಪೋರ್ಟ್"}
              </span>
            </div>

            {/* Typography Sizing Tier */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[#C79A4E]" />
                  {lang === "en" ? "Text Sizing (Intelligence Bubbles & Prompts)" : "ಪಠ್ಯದ ಗಾತ್ರ (ಮಾಹಿತಿ ಗುಳ್ಳೆಗಳು ಮತ್ತು ಪ್ರಾಂಪ್ಟ್)"}
                </span>
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase">
                  {transcriptTextSize}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "small" as TranscriptTextSize, label: lang === "en" ? "Small (12px)" : "ಚಿಕ್ಕದು (12px)", sub: lang === "en" ? "Dense / CDR" : "ದಟ್ಟ ವಿವರ", sample: "text-xs" },
                  { id: "medium" as TranscriptTextSize, label: lang === "en" ? "Medium (14px)" : "ಮಧ್ಯಮ (14px)", sub: lang === "en" ? "Standard" : "ಸ್ಟ್ಯಾಂಡರ್ಡ್", sample: "text-sm" },
                  { id: "large" as TranscriptTextSize, label: lang === "en" ? "Large (16px)" : "ದೊಡ್ಡದು (16px)", sub: lang === "en" ? "Patrol / 4K" : "ಸ್ಪಷ್ಟ ಓದುವಿಕೆ", sample: "text-base" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setTranscriptTextSize(tier.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      transcriptTextSize === tier.id
                        ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                        : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] font-bold ${transcriptTextSize === tier.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                        {tier.label}
                      </span>
                      {transcriptTextSize === tier.id && (
                        <CheckCircle2 className="w-3 h-3 text-[#C79A4E]" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-stone-500 font-mono mt-0.5">{tier.sub}</span>
                    <div className={`mt-2 p-1.5 rounded bg-stone-950/60 border border-stone-850/60 text-stone-300 font-sans ${tier.sample} truncate`}>
                      § 420 IPC
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript Width Layout */}
            <div className="space-y-2 pt-2 border-t border-stone-850">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-[#C79A4E]" />
                  {lang === "en" ? "Transcript Width Constraint" : "ಸಂಭಾಷಣಾ ಕಾಲಮ್ ಅಗಲ"}
                </span>
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase">
                  {transcriptWidth}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "narrow" as TranscriptWidth,
                    label: lang === "en" ? "Narrow" : "ಕಿರಿದಾದ",
                    pixels: "~672px",
                    desc: lang === "en" ? "Reading Focus" : "ಓದುವ ಏಕಾಗ್ರತೆ",
                    barCls: "w-1/2",
                  },
                  {
                    id: "medium" as TranscriptWidth,
                    label: lang === "en" ? "Medium" : "ಮಧ್ಯಮ",
                    pixels: "~896px",
                    desc: lang === "en" ? "Balanced Ops" : "ಸಾಮಾನ್ಯ ಕಾರ್ಯಾಚರಣೆ",
                    barCls: "w-3/4",
                  },
                  {
                    id: "wide" as TranscriptWidth,
                    label: lang === "en" ? "Wide" : "ವಿಸ್ತಾರ",
                    pixels: "~1152px",
                    desc: lang === "en" ? "Full CCTNS Tables" : "ಪೂರ್ಣ ಕೋಷ್ಟಕಗಳು",
                    barCls: "w-full",
                  },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setTranscriptWidth(tier.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      transcriptWidth === tier.id
                        ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                        : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] font-bold ${transcriptWidth === tier.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                        {tier.label}
                      </span>
                      {transcriptWidth === tier.id && (
                        <CheckCircle2 className="w-3 h-3 text-[#C79A4E]" />
                      )}
                    </div>
                    <span className="text-[9px] text-[#C79A4E]/80 font-mono mt-0.5">{tier.pixels}</span>
                    <span className="text-[9.5px] text-stone-500 font-mono mt-0.5">{tier.desc}</span>
                    <div className="mt-2 h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden flex items-center p-0.5">
                      <div className={`h-full rounded-full ${tier.barCls} ${transcriptWidth === tier.id ? "bg-[#C79A4E]" : "bg-stone-600"}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Core Diagnostics */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.settingsDbDiagTitle}</span>
            </h3>

            <div className="space-y-2.5 pt-2 font-mono text-xs">
              {/* Zoho Catalyst Datastore Status */}
              <div className="flex justify-between items-center p-2.5 rounded bg-stone-950/40 border border-stone-900">
                <span className="text-stone-400">{t.settingsZcqlLabel}</span>
                <span className={`font-bold text-[11px] ${isDbConnected ? "text-[#C79A4E]" : "text-rose-500"}`}>
                  {isDbConnected ? t.settingsOnline : t.settingsOffline}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Zia Multi-Voice Audio Studio & Security Policies */}
        <div className="space-y-6">
          {/* Card: Zoho Zia Multi-Voice Audio Studio (Section 15) */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#C79A4E]" />
                <span>{lang === "en" ? "Zia Multi-Voice Audio Studio" : "ಝಿಯಾ ಮಲ್ಟಿ-ವಾಯ್ಸ್ ಆಡಿಯೊ ಸ್ಟುಡಿಯೋ"}</span>
              </h3>
              <span className="text-[9px] font-mono text-[#5DCAA5] bg-[#5DCAA5]/10 border border-[#5DCAA5]/30 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5DCAA5] animate-pulse" />
                Catalyst QuickML
              </span>
            </div>
            <p className="text-[11px] text-stone-450 leading-relaxed font-mono">
              {lang === "en"
                ? "Configure neural speech synthesis parameters for intelligence briefings and field audio dossiers."
                : "ಗುಪ್ತಚರ ಬ್ರೀಫಿಂಗ್‌ಗಳು ಮತ್ತು ಆಡಿಯೊ ದೋಶಿಯರ್‌ಗಳಿಗಾಗಿ ನರ ಭಾಷಣ ಸಂಶ್ಲೇಷಣೆಯ ನಿಯತಾಂಕಗಳನ್ನು ಹೊಂದಿಸಿ."}
            </p>

            {/* Language Selection Tabs */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider">
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
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      ttsSettings.language === l.id
                        ? "border-[#C79A4E] bg-[#C79A4E]/10 text-stone-100 font-bold"
                        : "border-stone-800 bg-stone-950/40 text-stone-400 hover:border-stone-700"
                    }`}
                  >
                    <div className="text-xs">{l.label}</div>
                    <div className="text-[9px] text-stone-500 font-mono mt-0.5">{l.native}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Persona / Style Cards */}
            <div className="space-y-1.5 pt-2 border-t border-stone-850">
              <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider">
                {lang === "en" ? "Voice Persona & Timbre" : "ಧ್ವನಿ ವ್ಯಕ್ತಿತ್ವ ಮತ್ತು ಟೋನ್"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "buttery" as TtsStyle,
                    name: lang === "en" ? "Buttery" : "ಬಟರಿ (ಮೃದು)",
                    badge: lang === "en" ? "Warm & Relaxed" : "ಆತ್ಮೀಯ",
                    desc: lang === "en" ? "Smooth, warm vocal delivery for fatigue-free listening" : "ದಣಿವು-ಮುಕ್ತ ದೀರ್ಘ ಆಲಿಸುವಿಕೆ",
                  },
                  {
                    id: "authoritative" as TtsStyle,
                    name: lang === "en" ? "Authoritative" : "ಅಧಿಕೃತ",
                    badge: lang === "en" ? "Command Briefing" : "ಕಮಾಂಡ್",
                    desc: lang === "en" ? "Crisp, formal police command cadence" : "ಖಚಿತ ಮತ್ತು ಅಧಿಕೃತ ಕಮಾಂಡ್ ಟೋನ್",
                  },
                  {
                    id: "calm" as TtsStyle,
                    name: lang === "en" ? "Calm" : "ಶಾಂತ",
                    badge: lang === "en" ? "Empathetic" : "ಸಹಾನುಭೂತಿ",
                    desc: lang === "en" ? "Steady, reassuring cadence for sensitive cases" : "ಸ್ಥಿರ ಮತ್ತು ಸಮಾಧಾನಕರ ಶೈಲಿ",
                  },
                  {
                    id: "urgent" as TtsStyle,
                    name: lang === "en" ? "Urgent" : "ತುರ್ತು",
                    badge: lang === "en" ? "Tactical Dispatch" : "ಕ್ಷಿಪ್ರ ರವಾನೆ",
                    desc: lang === "en" ? "Fast-paced tactical briefing and alerts" : "ವೇಗದ ಗತಿಯ ತಂತ್ರೋಪಾಯ ಬ್ರೀಫಿಂಗ್",
                  },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setTtsSettings({ style: s.id });
                      setVoicePersona(s.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      ttsSettings.style === s.id
                        ? "border-[#C79A4E] bg-[#C79A4E]/10 ring-1 ring-[#C79A4E]/40"
                        : "border-stone-800 bg-stone-950/40 hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[11px] font-bold ${ttsSettings.style === s.id ? "text-[#C79A4E]" : "text-stone-200"}`}>
                        {s.name}
                      </span>
                      <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                        {s.badge}
                      </span>
                    </div>
                    <p className="text-[9.5px] text-stone-500 leading-snug mt-1">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed & Speaker Selection */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-850">
              {/* Speed Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider">
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
                        ttsSettings.speed === spd.id
                          ? "bg-[#C79A4E] text-stone-950"
                          : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                      }`}
                    >
                      {spd.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speaker Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider">
                  {lang === "en" ? "Neural Speaker" : "ನ್ಯೂರಲ್ ಸ್ಪೀಕರ್"}
                </label>
                <div className="flex rounded-lg border border-stone-800 bg-stone-950/50 p-1 gap-1">
                  {(speakersByLang[ttsSettings.language] || speakersByLang.en).map((spk) => (
                    <button
                      key={spk.id}
                      type="button"
                      onClick={() => setTtsSettings({ voice: spk.id })}
                      className={`flex-1 py-1 text-center text-[10.5px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                        ttsSettings.voice === spk.id
                          ? "bg-[#C79A4E] text-stone-950"
                          : "text-stone-400 hover:text-stone-200 hover:bg-stone-900"
                      }`}
                      title={spk.gender}
                    >
                      {spk.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Audio Test Button ("Preview Voice") */}
            <div className="pt-2 border-t border-stone-850 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isPlayingPreview ? (
                  <div className="flex items-center gap-1 h-5 px-2 bg-[#C79A4E]/10 border border-[#C79A4E]/30 rounded-md">
                    <span className="w-1 bg-[#C79A4E] animate-pulse h-3 rounded-full" />
                    <span className="w-1 bg-[#C79A4E] animate-pulse h-4 rounded-full" />
                    <span className="w-1 bg-[#C79A4E] animate-pulse h-2 rounded-full" />
                    <span className="w-1 bg-[#C79A4E] animate-pulse h-4 rounded-full" />
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
                  isPlayingPreview
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
                    : "bg-[#C79A4E] text-stone-950 hover:bg-[#E4C590]"
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
                    ? (lang === "en" ? "Synthesizing..." : "ಸಂಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...")
                    : isPlayingPreview
                    ? (lang === "en" ? "Stop" : "ನಿಲ್ಲಿಸಿ")
                    : (lang === "en" ? "Preview Voice" : "ಧ್ವನಿ ಪೂರ್ವವೀಕ್ಷಣೆ")}
                </span>
              </button>
            </div>
          </div>

          {/* Card: Security Policies */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.settingsSecurityPoliciesTitle}</span>
            </h3>

            <div className="space-y-3.5 pt-2 text-xs">
              {/* Access Scope -- explains what this officer's own role_tier
                  actually gates, grounded in the real enforcement (station-
                  scoped RLS for everyone, Supervisor Dashboard + consistency-
                  flag review gated to role_tier == "supervisor" server-side). */}
              <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                <MapPin className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                    {lang === "en" ? "Access Scope" : "ಪ್ರವೇಶ ವ್ಯಾಪ್ತಿ"}
                  </span>
                  <p className="text-[11px] leading-relaxed text-stone-500">
                    {lang === "en"
                      ? "Every query is row-level scoped to your own station -- you only ever see cases, suspects, and analytics for your assigned unit, enforced server-side on every request, not just hidden in the UI."
                      : "ಪ್ರತಿ ಪ್ರಶ್ನೆಯು ನಿಮ್ಮ ಸ್ವಂತ ಠಾಣೆಗೆ ಸೀಮಿತವಾಗಿದೆ -- ಪ್ರತಿ ವಿನಂತಿಯಲ್ಲಿ ಸರ್ವರ್-ಸೈಡ್ ಜಾರಿಗೊಳಿಸಲಾಗಿದೆ, ಕೇವಲ UI ಯಲ್ಲಿ ಮರೆಮಾಡಿಲ್ಲ."}
                  </p>
                  <div className="text-[10px] font-mono text-[#C79A4E] font-bold uppercase tracking-wider">
                    {lang === "en" ? "Tier: " : "ಸ್ತರ: "}{roleTier === "supervisor" ? (lang === "en" ? "Supervisor (PI and above)" : "ಮೇಲ್ವಿಚಾರಕ") : (lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ")}
                  </div>
                  {roleTier === "supervisor" ? (
                    <p className="text-[10.5px] text-stone-600 leading-relaxed pt-0.5">
                      {lang === "en"
                        ? "Additionally unlocks the Supervisor Dashboard: consistency-flag review/dismissal and audit ledger verification."
                        : "ಹೆಚ್ಚುವರಿಯಾಗಿ ಮೇಲ್ವಿಚಾರಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅನ್ನು ಅನ್‌ಲಾಕ್ ಮಾಡುತ್ತದೆ: ಸ್ಥಿರತೆ-ಫ್ಲ್ಯಾಗ್ ಪರಿಶೀಲನೆ ಮತ್ತು ಆಡಿಟ್ ಲೆಡ್ಜರ್ ಪರಿಶೀಲನೆ."}
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-stone-600 leading-relaxed pt-0.5">
                      {lang === "en"
                        ? "The Supervisor Dashboard (consistency-flag review, ledger verification) requires PI rank or above -- gated server-side, not just hidden from the sidebar."
                        : "ಮೇಲ್ವಿಚಾರಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ PI ಶ್ರೇಣಿ ಅಥವಾ ಅದಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಅಗತ್ಯವಿದೆ -- ಸರ್ವರ್-ಸೈಡ್ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ."}
                    </p>
                  )}
                </div>
              </div>

              {/* Session Timeout */}
              <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                <Clock className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                    {t.settingsSessionTimeoutTitle}
                  </span>
                  <p className="text-[11px] leading-relaxed text-stone-500">
                    {lang === "en" ? (
                      <>Logs you out of this device and clears your local session after <strong>15 minutes</strong> of operator inactivity. (Note: does not remotely invalidate the underlying token -- real server-side revocation is a separate, tracked item.)</>
                    ) : (
                      <>ಆಪರೇಟರ್ ನಿಷ್ಕ್ರಿಯತೆಯ <strong>೧೫ ನಿಮಿಷಗಳ</strong> ನಂತರ ಈ ಸಾಧನದಿಂದ ಲಾಗ್ ಔಟ್ ಮಾಡಿ ನಿಮ್ಮ ಸ್ಥಳೀಯ ಅಧಿವೇಶನವನ್ನು ತೆರವುಗೊಳಿಸುತ್ತದೆ. (ಗಮನಿಸಿ: ಇದು ಮೂಲ ಟೋಕನ್ ಅನ್ನು ದೂರದಿಂದ ಅಮಾನ್ಯಗೊಳಿಸುವುದಿಲ್ಲ -- ನಿಜವಾದ ಸರ್ವರ್-ಸೈಡ್ ರದ್ದತಿ ಪ್ರತ್ಯೇಕ, ಟ್ರ್ಯಾಕ್ ಮಾಡಲಾದ ಐಟಂ ಆಗಿದೆ.)</>
                    )}
                  </p>
                  <div className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">
                    {t.settingsPolicyEnforced}
                  </div>
                </div>
              </div>

              {/* Two-Person Integrity */}
              <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
                <User className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                    {t.settingsTwoPersonTitle}
                  </span>
                  <p className="text-[11px] leading-relaxed text-stone-500">
                    {t.settingsTwoPersonDesc}
                  </p>
                  <div className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                    {t.settingsControlEngaged}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
