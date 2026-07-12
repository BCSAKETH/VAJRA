import React from "react";

interface VajraLogoProps {
  className?: string;
  animated?: boolean;
  size?: number;
}

export const VajraLogo: React.FC<VajraLogoProps> = ({
  className = "",
  animated = false,
  size = 24,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        animated ? "glow-teal rounded-full" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Symmetrical Geometric Vajra Icon */}
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full text-[#00C6AD] transition-transform duration-300"
      >
        {/* Center Faceted Diamond Core */}
        <path
          d="M24 15 L32 24 L24 33 L16 24 Z"
          fill="currentColor"
          fillOpacity="0.15"
          className="text-[#00C6AD]"
        />
        <path d="M16 24 H32 M24 15 V33" strokeWidth="1.5" opacity="0.6" />

        {/* Top Prongs Section */}
        <path d="M24 15 V5" />
        <path d="M24 10 L16 7 L21 15" />
        <path d="M24 10 L32 7 L27 15" />

        {/* Bottom Prongs Section (Symmetrical) */}
        <path d="M24 33 V43" />
        <path d="M24 38 L16 41 L21 33" />
        <path d="M24 38 L32 41 L27 33" stroke="currentColor" />
      </svg>

      {/* Radar Scan Pulse Ring (On Load) */}
      {animated && (
        <span
          className="absolute inset-0 border border-[#00C6AD]/85 rounded-full pointer-events-none motion-safe:animate-[radarSweep_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]"
          style={{
            animationIterationCount: 1,
            transformOrigin: "center",
          }}
        />
      )}
    </div>
  );
};
