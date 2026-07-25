import React from "react";

interface VajraLogoProps {
  className?: string;
  animated?: boolean;
  size?: number;
}

// VAJRA crest mark — a sunburst-ringed diamond holding the gold vajra bolt with
// network-node points. Scales cleanly from a 20px sidebar icon up to the login
// hero. Colour is the gold accent (#C79A4E); `animated` adds the radar pulse ring
// and a slow rotation of the outer sunburst.
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
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full text-[#C79A4E] transition-transform duration-300"
      >
        {/* Sunburst crest points (rotate slowly when animated) */}
        <g
          fill="currentColor"
          stroke="none"
          className={animated ? "motion-safe:animate-[spin_36s_linear_infinite]" : ""}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <path d="M24 2 L26.6 8 L21.4 8 Z" />
          <path d="M46 24 L40 26.6 L40 21.4 Z" />
          <path d="M24 46 L21.4 40 L26.6 40 Z" />
          <path d="M2 24 L8 21.4 L8 26.6 Z" />
          <path d="M39.6 8.4 L35.5 12.9 L33 9.5 Z" />
          <path d="M39.6 39.6 L33 38.5 L35.5 35.1 Z" />
          <path d="M8.4 39.6 L11 35.1 L15 38.5 Z" />
          <path d="M8.4 8.4 L15 9.5 L11 12.9 Z" />
        </g>

        {/* Crest ring */}
        <circle cx="24" cy="24" r="15.5" fill="none" strokeWidth="2.2" />
        <circle cx="24" cy="24" r="11.5" fill="none" strokeWidth="0.9" opacity="0.5" />

        {/* Inner diamond frame + node points */}
        <path d="M24 12.5 L35.5 24 L24 35.5 L12.5 24 Z" strokeWidth="1.6" />
        <g fill="currentColor" stroke="none">
          <circle cx="24" cy="12.5" r="1.5" />
          <circle cx="35.5" cy="24" r="1.5" />
          <circle cx="24" cy="35.5" r="1.5" />
          <circle cx="12.5" cy="24" r="1.5" />
        </g>

        {/* Gold vajra bolt */}
        <path
          d="M26.5 15 L20.5 24.5 L24 24.5 L21.5 33 L28 22.5 L24.5 22.5 Z"
          fill="currentColor"
          stroke="none"
        />
      </svg>

      {/* Radar scan pulse ring (on load) */}
      {animated && (
        <span
          className="absolute inset-0 border border-[#C79A4E]/85 rounded-full pointer-events-none motion-safe:animate-[radarSweep_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]"
          style={{
            animationIterationCount: 1,
            transformOrigin: "center",
          }}
        />
      )}
    </div>
  );
};
