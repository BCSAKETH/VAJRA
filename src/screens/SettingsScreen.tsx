import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Settings, ShieldCheck, Database, Languages, Clock, User, IdCard, MapPin, Lock, Pencil, X, Hourglass, Mic2, Mail } from "lucide-react";

interface OfficerProfile {
  kgid: string;
  first_name: string | null;
  email: string | null;
  station: string | null;
  rank: string | null;
  designation: string | null;
  role_tier: string | null;
}

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
    addToast,
  } = useApp();

  // Voice persona options -- fetched from the live /api/voice/personas list
  // (each preset already verified against real Zia synthesis; see
  // catalyst_speech.py VOICE_PERSONAS) rather than hardcoded here, so a
  // future persona added server-side shows up without a frontend redeploy.
  const [personaOptions, setPersonaOptions] = useState<{ id: string; label: { en: string; kn: string } }[]>([
    { id: "standard", label: { en: "Standard", kn: "ಸ್ಟ್ಯಾಂಡರ್ಡ್" } },
  ]);
  useEffect(() => {
    fetch(`${API_BASE}/api/voice/personas`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.personas?.length) setPersonaOptions(data.personas);
      })
      .catch(() => {});
  }, []);

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
  // FirstName and Email are offered as structured, auto-applying-on-approval
  // requests (safe self-corrections); station/rank/designation are real HR
  // actions (transfer, promotion) that go through official orders, so those
  // stay visible-only even though the backend's approval pattern could
  // technically carry them too. `requestField` makes the one modal below
  // handle either target field.
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestField, setRequestField] = useState<"FirstName" | "Email">("FirstName");
  const [fieldDraft, setFieldDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [myRequest, setMyRequest] = useState<any | null>(null);

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

  const openRequestModal = (field: "FirstName" | "Email") => {
    setRequestField(field);
    setFieldDraft(field === "FirstName" ? (profile?.first_name || "") : (profile?.email || ""));
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
    const trimmed = fieldDraft.trim();
    const currentValue = requestField === "FirstName" ? profile?.first_name : profile?.email;
    if (!trimmed || trimmed === currentValue) {
      addToast(
        lang === "en" ? "No change to submit" : "ಸಲ್ಲಿಸಲು ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲ",
        lang === "en" ? "Enter a different value than what's on record." : "ದಾಖಲೆಯಲ್ಲಿರುವುದಕ್ಕಿಂತ ಬೇರೆ ಮೌಲ್ಯವನ್ನು ನಮೂದಿಸಿ.",
        "Warning"
      );
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const r = await fetch(`${API_BASE}/api/profile/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ requested_changes: { [requestField]: trimmed }, reason: reasonDraft }),
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
              {!myRequest || myRequest.status !== "pending" ? (
                <button
                  onClick={() => openRequestModal("FirstName")}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#C79A4E] hover:text-[#E4C590] border border-[#C79A4E]/30 hover:border-[#C79A4E]/60 rounded-md px-2 py-1 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {lang === "en" ? "Request change" : "ಬದಲಾವಣೆ ಕೋರಿ"}
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-400 border border-amber-500/30 rounded-md px-2 py-1">
                  <Hourglass className="w-3 h-3" />
                  {lang === "en" ? "Pending review" : "ಪರಿಶೀಲನೆ ಬಾಕಿ"}
                </span>
              )}
            </div>
            {myRequest && myRequest.status === "pending" && (
              <div className="bg-amber-500/[0.06] border border-amber-500/25 rounded-lg px-3 py-2 text-[10.5px] text-amber-300/90 font-mono">
                {lang === "en" ? "Requested: " : "ಕೋರಿದ್ದು: "}
                {Object.entries(myRequest.requested_changes || {}).map(([k, v]) => `${k} → ${v}`).join(", ")}
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
                  {profile?.email && (!myRequest || myRequest.status !== "pending") && (
                    <button
                      onClick={() => openRequestModal("Email")}
                      className="text-[9px] font-bold uppercase text-[#C79A4E] hover:text-[#E4C590] cursor-pointer"
                    >
                      {lang === "en" ? "Change" : "ಬದಲಾಯಿಸಿ"}
                    </button>
                  )}
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

              {/* Voice Persona Selector -- delivery preset for the AI's
                  spoken-answer TTS (pitch/speed/emotion), same voice/speaker
                  per language either way. */}
              <div className="flex justify-between items-center bg-stone-950/40 p-3 rounded-lg border border-stone-900">
                <span className="font-semibold text-stone-400 flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-[#C79A4E]" />
                  {lang === "en" ? "Voice Persona" : "ಧ್ವನಿ ವ್ಯಕ್ತಿತ್ವ"}
                </span>
                <select
                  value={voicePersona}
                  onChange={(e) => setVoicePersona(e.target.value)}
                  className="bg-stone-900 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1 text-stone-200 font-bold text-xs"
                >
                  {personaOptions.map((p) => (
                    <option key={p.id} value={p.id}>{lang === "en" ? p.label.en : p.label.kn}</option>
                  ))}
                </select>
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

        {/* Right Side: Security Policies */}
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
                    <>Automatically invalidates session tokens and redirects to Login Screen after <strong>15 minutes</strong> of operator inactivity.</>
                  ) : (
                    <>ಆಪರೇಟರ್ ನಿಷ್ಕ್ರಿಯತೆಯ <strong>೧೫ ನಿಮಿಷಗಳ</strong> ನಂತರ ಅಧಿವೇಶನ ಟೋಕನ್‌ಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಮಾನ್ಯಗೊಳಿಸಿ ಲಾಗಿನ್ ಪರದೆಗೆ ಮರುನಿರ್ದೇಶಿಸುತ್ತದೆ.</>
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

      {/* Profile Change Request modal -- Name or Email correction (see
          comment above the handler); submits to supervisor approval, never
          applies directly. */}
      {isRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm border border-stone-800 p-5 space-y-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#C79A4E]" />
                {lang === "en" ? "Request Profile Modification" : "ಪ್ರೊಫೈಲ್ ಬದಲಾವಣೆ ಕೋರಿ"}
              </h3>
              <button onClick={() => setIsRequestOpen(false)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10.5px] text-stone-550 leading-relaxed">
              {lang === "en"
                ? "This request is held for supervisor sign-off before anything changes -- a station/rank/designation change is a separate personnel action handled through your chain of command."
                : "ಈ ವಿನಂತಿಯನ್ನು ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಹಿಡಿದಿಡಲಾಗುತ್ತದೆ -- ಠಾಣೆ/ಶ್ರೇಣಿ/ಪದನಾಮ ಬದಲಾವಣೆ ನಿಮ್ಮ ಆಜ್ಞಾ ಸರಪಳಿಯ ಮೂಲಕ ಪ್ರತ್ಯೇಕವಾಗಿ ನಿರ್ವಹಿಸಲಾಗುತ್ತದೆ."}
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-stone-500 tracking-wide">
                {requestField === "FirstName"
                  ? (lang === "en" ? "Current name" : "ಪ್ರಸ್ತುತ ಹೆಸರು")
                  : (lang === "en" ? "Current email" : "ಪ್ರಸ್ತುತ ಇಮೇಲ್")}
              </label>
              <div className="text-xs text-stone-500 font-mono px-1">
                {(requestField === "FirstName" ? profile?.first_name : profile?.email) || "—"}
              </div>
              <label className="text-[10px] uppercase font-bold text-stone-500 tracking-wide">
                {requestField === "FirstName"
                  ? (lang === "en" ? "Correct name" : "ಸರಿಯಾದ ಹೆಸರು")
                  : (lang === "en" ? "New email" : "ಹೊಸ ಇಮೇಲ್")}
              </label>
              <input
                value={fieldDraft}
                onChange={(e) => setFieldDraft(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-200 font-bold text-xs"
              />
              <label className="text-[10px] uppercase font-bold text-stone-500 tracking-wide pt-1 block">
                {lang === "en" ? "Reason (optional)" : "ಕಾರಣ (ಐಚ್ಛಿಕ)"}
              </label>
              <textarea
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                rows={2}
                className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-300 text-xs resize-none"
                placeholder={lang === "en" ? "e.g. misspelled at enrollment" : "ಉದಾ. ನೋಂದಣಿಯಲ್ಲಿ ತಪ್ಪಾಗಿ ಬರೆಯಲಾಗಿದೆ"}
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
                {isSubmittingRequest ? (lang === "en" ? "Submitting…" : "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Submit" : "ಸಲ್ಲಿಸಿ")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
