import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { Clock, ShieldAlert } from "lucide-react";

export const SessionTimeoutGuard: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, addToast, lang } = useApp();
  
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const INACTIVITY_LIMIT = 14 * 60 * 1000; // Show warning after 14 minutes of inactivity (840,000ms)
  const WARNING_DURATION = 60; // 60 seconds warning countdown

  const handleLogout = () => {
    // Clear storage keys
    localStorage.removeItem("vajra_auth");
    localStorage.removeItem("vajra_token");
    localStorage.removeItem("vajra_badge");
    
    setIsAuthenticated(false);
    setIsWarningVisible(false);
    
    addToast(
      lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
      lang === "en" 
        ? "You have been logged out due to 15 minutes of inactivity for security compliance."
        : "ಭದ್ರತಾ ಅನುಸರಣೆಗಾಗಿ ೧೫ ನಿಮಿಷಗಳ ನಿಷ್ಕ್ರಿಯತೆಯಿಂದಾಗಿ ನಿಮ್ಮನ್ನು ಲಾಗ್ ಔಟ್ ಮಾಡಲಾಗಿದೆ.",
      "Warning"
    );
  };

  const resetActivityTimer = () => {
    if (!isAuthenticated) return;
    
    // Clear existing timers
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setIsWarningVisible(false);
    setSecondsRemaining(WARNING_DURATION);
    
    // Set 14-minute timer to show warning
    activityTimerRef.current = setTimeout(() => {
      showWarningPopup();
    }, INACTIVITY_LIMIT);
  };

  const showWarningPopup = () => {
    setIsWarningVisible(true);
    setSecondsRemaining(WARNING_DURATION);
    
    // Countdown ticks every second
    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleKeepActive = () => {
    resetActivityTimer();
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Track user inputs to refresh active status
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    const handleActivity = () => resetActivityTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));
    
    // Initial trigger
    resetActivityTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || !isWarningVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm glass-panel border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
        <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-full flex items-center justify-center animate-bounce">
          <ShieldAlert className="w-6 h-6" />
        </div>
        
        <div className="space-y-1.5">
          <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider font-mono">
            {lang === "en" ? "Security Timeout Advisory" : "ಭದ್ರತಾ ಅವಧಿ ಮುಕ್ತಾಯದ ಎಚ್ಚರಿಕೆ"}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === "en"
              ? "Your session has been idle. You will be automatically logged out in:"
              : "ನಿಮ್ಮ ಅಧಿವೇಶನವು ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ. ನೀವು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಲಾಗ್ ಔಟ್ ಆಗುತ್ತೀರಿ:"}
          </p>
        </div>

        {/* Countdown Timer Display */}
        <div className="flex items-center justify-center gap-2 text-xl font-black font-mono text-amber-500 bg-slate-950/40 py-2.5 rounded-xl border border-slate-900">
          <Clock className="w-5 h-5 animate-pulse" />
          <span>00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}</span>
        </div>

        {/* Action Button */}
        <button
          onClick={handleKeepActive}
          className="w-full bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 border border-[#00C6AD]/30 text-[#00C6AD] hover:text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
        >
          {lang === "en" ? "Keep Session Active" : "ಅಧಿವೇಶನ ಮುಂದುವರಿಸಿ"}
        </button>
      </div>
    </div>
  );
};
export default SessionTimeoutGuard;
