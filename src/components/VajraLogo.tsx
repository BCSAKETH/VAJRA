import React, { useId } from "react";

interface VajraLogoProps {
  className?: string;
  animated?: boolean;
  size?: number;
}

// VAJRA crest mark -- the official police-crest emblem: a gold sunburst ring
// reading "KARNATAKA STATE POLICE" / "CRIME INTELLIGENCE", a charcoal disc
// (matches the app's #211F1D surface, not the original artwork's navy, and
// fully transparent outside the disc so it blends onto every surface), and a
// central diamond holding the gold vajra bolt with network-node points.
// Used everywhere (login hero, sidebar, header, favicon) per product
// decision -- the ring text is accepted as illegible at icon sizes; the
// shape still reads as an official crest at any size. `animated` rotates the
// outer sunburst tips slowly and adds a one-shot radar pulse on mount.
export const VajraLogo: React.FC<VajraLogoProps> = ({
  className = "",
  animated = false,
  size = 24,
}) => {
  // Unique per-instance ids for the textPath targets -- this component can
  // render more than once on screen at a time (sidebar + mobile header, or
  // the sidebar's own two branches), and duplicate SVG ids would make every
  // instance's curved text silently resolve to whichever copy is first in
  // the DOM instead of its own arc.
  const uid = useId().replace(/:/g, "");
  const topArcId = `vajra-crest-top-${uid}`;
  const bottomArcId = `vajra-crest-bottom-${uid}`;

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
          <path d="M24 1 L25.9 5.3 L22.1 5.3 Z" />
          <path d="M47 24 L42.7 25.9 L42.7 22.1 Z" />
          <path d="M24 47 L22.1 42.7 L25.9 42.7 Z" />
          <path d="M1 24 L5.3 22.1 L5.3 25.9 Z" />
          <path d="M40.3 7.7 L37.4 11 L34.8 8.4 Z" />
          <path d="M40.3 40.3 L34.8 39.6 L37.4 37 Z" />
          <path d="M7.7 40.3 L10.6 37 L13.2 39.6 Z" />
          <path d="M7.7 7.7 L13.2 8.4 L10.6 11 Z" />
        </g>

        {/* Charcoal crest disc -- fills with the app surface color (not the
            reference artwork's navy) so the disc itself sits flush against
            any charcoal panel it's placed on; the SVG canvas beyond it stays
            fully transparent. */}
        <circle cx="24" cy="24" r="19.7" fill="#211F1D" strokeWidth="0.9" />

        {/* Sunburst ring text -- "KARNATAKA STATE POLICE" arced along the top,
            "CRIME INTELLIGENCE" along the bottom. Illegible at icon sizes by
            design (accepted tradeoff); reads as a textured official ring. */}
        <path id={topArcId} d="M24 24 m-17.3,0 a17.3,17.3 0 1,1 34.6,0" fill="none" stroke="none" />
        <path id={bottomArcId} d="M24 24 m-17.3,0 a17.3,17.3 0 1,0 34.6,0" fill="none" stroke="none" />
        <text fontSize="3" fontWeight="700" letterSpacing="0.3" fill="currentColor" stroke="none">
          <textPath href={`#${topArcId}`} startOffset="12%">
            KARNATAKA STATE POLICE
          </textPath>
        </text>
        <text fontSize="2.7" fontWeight="600" letterSpacing="0.4" fill="currentColor" stroke="none">
          <textPath href={`#${bottomArcId}`} startOffset="10%">
            CRIME INTELLIGENCE
          </textPath>
        </text>

        {/* Crest ring */}
        <circle cx="24" cy="24" r="14.9" fill="none" strokeWidth="0.9" opacity="0.55" />

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
