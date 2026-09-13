import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../AppContext";
import { Clock, ShieldAlert } from "lucide-react";

// E.4 (was Finals.md Part VI): fixes 4 real bug classes in the previous
// version of this guard --
//   1. Background-tab timer throttling: a plain setTimeout/setInterval
//      freezes or drifts once the tab is backgrounded, so a relative timer
//      alone silently stops counting real idle time. Fixed with an
//      epoch-based wall-clock delta (Date.now() - last_active_ts).
//   2. mousemove refocus race: returning to a backgrounded tab fires
//      mousemove before a throttled timer can catch up, silently erasing
//      real idle time. Fixed with a guarded activity handler that refuses
//      to reset the timestamp if the idle limit has already been crossed.
//   3. React 18 pure-updater side effect: the previous version called
//      handleLogout() directly inside setSecondsRemaining's updater
//      function -- React 18 can drop/replay pure updaters, which left the
//      token deleted but the UI never switching back to Login. Fixed by
//      decoupling: the countdown updater ONLY sets a number, and a
//      separate useEffect watches for it hitting 0 to fire the logout.
//   4. No cross-tab sync: logging out in one tab left another tab still
//      authenticated. Fixed via a "storage" event listener.
const STORAGE_LAST_ACTIVE_KEY = "vajra_last_active_ts";
const DEFAULT_INACTIVITY_LIMIT_MS = 14 * 60 * 1000;
const DEFAULT_WARNING_DURATION_SEC = 60;

export const SessionTimeoutGuard: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, addToast, lang } = useApp();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(DEFAULT_WARNING_DURATION_SEC);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWriteTimeRef = useRef<number>(0);

  // Dev/test override: localStorage keys vajra_idle_limit_ms / vajra_warning_sec
  // make a 14-minute bug testable in 15 seconds without touching the
  // production defaults.
  const getLimits = useCallback(() => {
    const customIdleMs = parseInt(localStorage.getItem("vajra_idle_limit_ms") || "", 10);
    const customWarnSec = parseInt(localStorage.getItem("vajra_warning_sec") || "", 10);
    const idleMs = !isNaN(customIdleMs) && customIdleMs > 0 ? customIdleMs : DEFAULT_INACTIVITY_LIMIT_MS;
    const warnSec = !isNaN(customWarnSec) && customWarnSec > 0 ? customWarnSec : DEFAULT_WARNING_DURATION_SEC;
    return { idleMs, warnSec, totalMs: idleMs + warnSec * 1000 };
  }, []);

  const executeLogout = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    localStorage.removeItem("vajra_auth");
    localStorage.removeItem("vajra_token");
    localStorage.removeItem("vajra_badge");
    localStorage.removeItem(STORAGE_LAST_ACTIVE_KEY);
    setIsWarningVisible(false);
    setIsAuthenticated(false);
    addToast(
      lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
      lang === "en"
        ? "You have been logged out due to inactivity for security compliance."
        : "ಭದ್ರತಾ ಅನುಸರಣೆಗಾಗಿ ನಿಷ್ಕ್ರಿಯತೆಯಿಂದಾಗಿ ನಿಮ್ಮನ್ನು ಲಾಗ್ ಔಟ್ ಮಾಡಲಾಗಿದೆ.",
      "Warning"
    );
  }, [setIsAuthenticated, addToast, lang]);

  // Fix #2: refuses to bump the timestamp if the idle limit has already
  // been crossed -- otherwise a mousemove fired the instant a backgrounded
  // tab regains focus (before evaluateInactivity's own interval can catch
  // up) silently erases real idle time that already happened.
  const recordActivity = useCallback(() => {
    if (!isAuthenticated) return;
    const now = Date.now();
    const { idleMs } = getLimits();
    const lastActive = parseInt(localStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || "0", 10);
    if (lastActive > 0 && now - lastActive >= idleMs) return;
    if (now - lastWriteTimeRef.current > 2000) {
      lastWriteTimeRef.current = now;
      localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    }
  }, [isAuthenticated, getLimits]);

  // Fix #1: wall-clock delta against a stored epoch timestamp, never a bare
  // relative timer -- correct even if the tab was backgrounded and browser
  // timer throttling delayed every tick.
  const evaluateInactivity = useCallback(() => {
    if (!isAuthenticated) return;
    const now = Date.now();
    const { idleMs, totalMs } = getLimits();
    const storedLast = parseInt(localStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || "0", 10);
    const lastActive = storedLast > 0 ? storedLast : now;
    const elapsed = now - lastActive;

    if (elapsed >= totalMs) {
      executeLogout();
    } else if (elapsed >= idleMs) {
      const remainingSec = Math.max(1, Math.round((totalMs - elapsed) / 1000));
      setSecondsRemaining(remainingSec);
      setIsWarningVisible(true);
    } else if (isWarningVisible) {
      setIsWarningVisible(false);
    }
  }, [isAuthenticated, getLimits, executeLogout, isWarningVisible]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!localStorage.getItem(STORAGE_LAST_ACTIVE_KEY)) {
      localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(Date.now()));
    }
    const handleVisibilityOrFocus = () => evaluateInactivity();
    // Fix #4: cross-tab sync -- a logout (or the shared last-active
    // timestamp) written in one tab is picked up by every other open tab
    // instantly via the storage event, not just on that tab's own next poll.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "vajra_auth" && e.newValue === "false") executeLogout();
      else if (e.key === "vajra_token" && !e.newValue) executeLogout();
      else if (e.key === STORAGE_LAST_ACTIVE_KEY) evaluateInactivity();
    };
    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    const onUserActivity = () => recordActivity();
    activityEvents.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorageChange);
    checkIntervalRef.current = setInterval(evaluateInactivity, 1000);
    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, onUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageChange);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isAuthenticated, recordActivity, evaluateInactivity, executeLogout]);

  // Fix #3: the countdown's own interval ONLY sets a number -- no side
  // effect lives inside a React state updater. A separate effect below
  // watches for the countdown reaching 0 and fires the actual logout.
  useEffect(() => {
    if (!isWarningVisible) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }
    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
  }, [isWarningVisible]);

  useEffect(() => {
    if (isWarningVisible && secondsRemaining === 0) executeLogout();
  }, [isWarningVisible, secondsRemaining, executeLogout]);

  const handleKeepActive = () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    lastWriteTimeRef.current = now;
    setIsWarningVisible(false);
    const { warnSec } = getLimits();
    setSecondsRemaining(warnSec);
  };

  if (!isAuthenticated || !isWarningVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm glass-panel border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-center bg-[#141210]">
        <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center animate-bounce">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-black text-stone-100 uppercase tracking-wider font-mono">
            {lang === "en" ? "Security Timeout Advisory" : "ಭದ್ರತಾ ಅವಧಿ ಮುಕ್ತಾಯದ ಎಚ್ಚರಿಕೆ"}
          </h3>
          <p className="text-xs text-stone-400 leading-relaxed font-sans">
            {lang === "en"
              ? "Your session has been idle. You will be automatically logged out in:"
              : "ನಿಮ್ಮ ಅಧಿವೇಶನವು ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ. ನೀವು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಲಾಗ್ ಔಟ್ ಆಗುತ್ತೀರಿ:"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-2xl font-black font-mono text-amber-400 bg-stone-950/60 py-3 rounded-xl border border-stone-850">
          <Clock className="w-5 h-5 animate-pulse text-amber-500" />
          <span>00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}</span>
        </div>
        <button
          type="button"
          onClick={handleKeepActive}
          className="w-full bg-[#C79A4E] hover:bg-[#C79A4E]/90 text-stone-950 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#C79A4E]/20"
        >
          {lang === "en" ? "Keep Session Active" : "ಅಧಿವೇಶನ ಮುಂದುವರಿಸಿ"}
        </button>
      </div>
    </div>
  );
};

export default SessionTimeoutGuard;
