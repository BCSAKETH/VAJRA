import React from "react";
import { useApp } from "../AppContext";

export const WatermarkOverlay: React.FC = () => {
  const { badgeNumber, isAuthenticated } = useApp();

  if (!isAuthenticated) return null;

  const watermarkText = `${badgeNumber || "KSP-4003385"} OFFICIAL SECURITY COPY • SECURE CCTNS DIALOUT`;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden opacity-[0.035] select-none flex flex-col justify-around">
      {/* Create repeating rows of diagonal watermark text */}
      {Array.from({ length: 12 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="whitespace-nowrap flex justify-around text-xs font-mono font-black tracking-widest text-[#00C6AD]"
          style={{
            transform: rowIndex % 2 === 0 ? "rotate(-18deg) translateX(-5%)" : "rotate(-18deg) translateX(5%)",
          }}
        >
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <span key={colIndex} className="mx-8 uppercase">
              {watermarkText}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
