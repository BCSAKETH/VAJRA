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
  const { badgeNumber, officerName, roleTier, isAuthenticated } = useApp();
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

  // Section 13: Enhanced Anti-Tamper Protection (L111)
  // If an adversary attempts to delete the node or alter style (display: none / opacity: 0)
  // via DevTools before screenshotting, immediately restore it.
  useEffect(() => {
    if (!isAuthenticated) return;
    const target = containerRef.current;
    if (!target) return;

    const observer = new MutationObserver((mutations) => {
      if (containerRef.current && !containerRef.current.isConnected) {
        setRemountKey((k) => k + 1);
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          if (target.style.display === "none" || target.style.visibility === "hidden" || target.style.opacity === "0") {
            target.style.display = "flex";
            target.style.visibility = "visible";
            target.style.opacity = "0.045";
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(target, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, [isAuthenticated, remountKey]);

  if (!isAuthenticated) return null;

  const displayName = officerName ? officerName.toUpperCase() : "OFFICER";
  const badgeDisplay = badgeNumber ? `KSP-${badgeNumber}` : "KSP-AUTHORIZED";
  const rankPrefix = roleTier === "supervisor" ? "SUPERVISORY " : "";
  const watermarkString = `${rankPrefix}${displayName} (${badgeDisplay}) • OFFICIAL SECURITY COPY • SECURE CCTNS DIALOUT • ${currentUtc} UTC`;

  return (
    <div
      key={remountKey}
      ref={containerRef}
      id={`vajra-watermark-${uid}`}
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden select-none flex flex-col justify-around print:opacity-[0.08]"
      style={{
        display: "flex",
        visibility: "visible",
        opacity: 0.045,
        mixBlendMode: "difference",
      }}
      aria-hidden="true"
    >
      {Array.from({ length: 14 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="whitespace-nowrap flex justify-around text-xs font-mono font-black tracking-widest text-[#C79A4E]"
          style={{
            transform: rowIndex % 2 === 0 ? "rotate(-18deg) translateX(-8%)" : "rotate(-18deg) translateX(8%)",
            textShadow: "0 0 1px rgba(0, 0, 0, 0.6)",
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
