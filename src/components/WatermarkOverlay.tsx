import React, { useState, useEffect, useRef, useId } from "react";
import { useApp } from "../AppContext";

// E.7 (was Finals.md Part VII, honest half only -- see D.12): burns the
// logged-in officer's badge, name, and a live timestamp into the screen so
// that IF a leak happens, it's traceable back to who was logged in. This is
// the ONLY half of the original "Anti-Screenshot Shield" idea kept -- per
// D.12, a webpage genuinely cannot stop OS-level screen capture, so this is
// never described as "preventing" anything, only as making a leak
// attributable after the fact.
//
// Mounted per-screen (as it already was before this pass), not once
// globally -- more than one screen can be mounted at once (AIChatScreen
// stays mounted-but-hidden while another screen is visible, see App.tsx),
// so a single hardcoded DOM id would collide. Each instance gets its own
// id via useId() instead.
export const WatermarkOverlay: React.FC = () => {
  const { badgeNumber, officerName, isAuthenticated } = useApp();
  const uid = useId().replace(/:/g, "");
  const [currentUtc, setCurrentUtc] = useState<string>(() =>
    new Date().toISOString().substring(0, 19).replace("T", " ")
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(
      () => setCurrentUtc(new Date().toISOString().substring(0, 19).replace("T", " ")),
      15000
    );
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Tamper resistance: if this node is ever removed from the document
  // (e.g. a tech-savvy user deleting it via DevTools), force React to
  // recreate it rather than silently leaving the watermark gone. Watches
  // document.body with subtree:true since this overlay is mounted deep
  // inside a screen's own component tree, not as a direct body child.
  useEffect(() => {
    if (!isAuthenticated) return;
    const observer = new MutationObserver(() => {
      if (containerRef.current && !containerRef.current.isConnected) {
        setRemountKey((k) => k + 1);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, remountKey]);

  if (!isAuthenticated) return null;

  const officerBadge = badgeNumber || "KSP-UNKNOWN";
  const name = officerName || "OFFICER";
  const watermarkString = `${officerBadge} • ${name} • KSP CCTNS • ${currentUtc} UTC • CONFIDENTIAL`;

  return (
    <div
      key={remountKey}
      ref={containerRef}
      id={`vajra-watermark-${uid}`}
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden select-none flex flex-col justify-around"
      style={{ opacity: 0.045, mixBlendMode: "difference" }}
      aria-hidden="true"
    >
      {Array.from({ length: 12 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="whitespace-nowrap flex justify-around text-xs font-mono font-black tracking-widest text-[#C79A4E]"
          style={{
            transform: rowIndex % 2 === 0 ? "rotate(-18deg) translateX(-5%)" : "rotate(-18deg) translateX(5%)",
          }}
        >
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <span key={colIndex} className="mx-8 uppercase">
              {watermarkString}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WatermarkOverlay;
