import React, { useId } from "react";

interface VajraLogoProps {
  className?: string;
  animated?: boolean;
  size?: number;
}

// VAJRA crest -- rebuilt to match the client-supplied 14-layer breakdown
// exactly (outer gold spikes / gold outer ring / warm-charcoal disc / arced
// ring text / side stars / inner gold ring / gold diamond frame / pin-style
// corner connectors / a nested green-zigzag inner diamond / charcoal fill /
// gold vajra bolt / gold corner nodes), instead of the earlier hand-drawn
// approximation. All geometry below is generated from center+radius math,
// not hand-typed path coordinates, so it stays crisp and easy to re-tune.
const CENTER = 24;

function polar(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

// 12-point sunburst -- one triangle per spike, computed around the ring.
function buildSpikes(count: number, tipR: number, baseR: number, baseHalfAngle: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 360) / count;
    const [tx, ty] = polar(angle, tipR);
    const [b1x, b1y] = polar(angle - baseHalfAngle, baseR);
    const [b2x, b2y] = polar(angle + baseHalfAngle, baseR);
    parts.push(`M${tx.toFixed(2)} ${ty.toFixed(2)} L${b1x.toFixed(2)} ${b1y.toFixed(2)} L${b2x.toFixed(2)} ${b2y.toFixed(2)} Z`);
  }
  return parts.join(" ");
}
const SPIKES_PATH = buildSpikes(12, 23, 18.6, 8.5);

// Diamond frame vertices (top / right / bottom / left), radius r from center.
function diamondVertices(r: number): [number, number][] {
  return [
    [CENTER, CENTER - r],
    [CENTER + r, CENTER],
    [CENTER, CENTER + r],
    [CENTER - r, CENTER],
  ];
}
const OUTER_DIAMOND_R = 11.5;
const OUTER_DIAMOND = diamondVertices(OUTER_DIAMOND_R);
const OUTER_DIAMOND_PATH = `M${OUTER_DIAMOND.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

// Inner diamond with a sawtooth/zigzag border -- walks each of the 4 edges
// and alternates a small perpendicular offset, landing back on the real
// vertex at each corner so the diamond silhouette stays sharp.
function zigzagDiamondPath(r: number, teethPerEdge: number, depth: number): string {
  const verts = diamondVertices(r);
  const points: [number, number][] = [];
  for (let e = 0; e < 4; e++) {
    const [x0, y0] = verts[e];
    const [x1, y1] = verts[(e + 1) % 4];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len; // outward normal
    const ny = dx / len;
    const steps = teethPerEdge * 2;
    for (let s = 0; s <= steps; s++) {
      if (s === 0) {
        points.push([x0, y0]);
        continue;
      }
      if (s === steps) continue; // next edge starts here
      const t = s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const offset = s % 2 === 1 ? depth : -depth * 0.4;
      points.push([px + nx * offset, py + ny * offset]);
    }
  }
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")} Z`;
}
const INNER_DIAMOND_R = 8.1;
const ZIGZAG_PATH = zigzagDiamondPath(INNER_DIAMOND_R, 4, 1.1);

// Side stars flanking the ring at 9 and 3 o'clock.
function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * 36 - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")} Z`;
}
const [STAR_LEFT_X, STAR_LEFT_Y] = polar(270, 16.6);
const [STAR_RIGHT_X, STAR_RIGHT_Y] = polar(90, 16.6);
const STAR_LEFT_PATH = starPath(STAR_LEFT_X, STAR_LEFT_Y, 1.7, 0.75);
const STAR_RIGHT_PATH = starPath(STAR_RIGHT_X, STAR_RIGHT_Y, 1.7, 0.75);

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
        className="w-full h-full transition-transform duration-300"
      >
        {/* 1. Outer gold spikes */}
        <g
          fill="#C79A4E"
          className={animated ? "motion-safe:animate-[spin_36s_linear_infinite]" : ""}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <path d={SPIKES_PATH} />
        </g>

        {/* 2. Gold outer ring */}
        <circle cx={CENTER} cy={CENTER} r="19.4" fill="none" stroke="#C79A4E" strokeWidth="1.1" />

        {/* 3. Warm charcoal outer disc -- fills with the app surface color
            (not the reference artwork's navy) so the disc sits flush
            against any charcoal panel it's placed on. */}
        <circle cx={CENTER} cy={CENTER} r="18.7" fill="#211F1D" />

        {/* 4 & 5. Ring text -- "KARNATAKA STATE POLICE" top, "CRIME
            INTELLIGENCE" bottom. Illegible at icon sizes by design (accepted
            tradeoff); reads as a textured official ring. */}
        <path id={topArcId} d="M24 24 m-15.2,0 a15.2,15.2 0 1,1 30.4,0" fill="none" stroke="none" />
        <path id={bottomArcId} d="M24 24 m-15.2,0 a15.2,15.2 0 1,0 30.4,0" fill="none" stroke="none" />
        <text fontSize="2.85" fontWeight="700" letterSpacing="0.28" fill="#C79A4E" stroke="none">
          <textPath href={`#${topArcId}`} startOffset="12.5%">
            KARNATAKA STATE POLICE
          </textPath>
        </text>
        <text fontSize="2.55" fontWeight="600" letterSpacing="0.38" fill="#C79A4E" stroke="none">
          <textPath href={`#${bottomArcId}`} startOffset="10.5%">
            CRIME INTELLIGENCE
          </textPath>
        </text>

        {/* 6. Side stars */}
        <g fill="#C79A4E" stroke="none">
          <path d={STAR_LEFT_PATH} />
          <path d={STAR_RIGHT_PATH} />
        </g>

        {/* 7. Inner gold ring */}
        <circle cx={CENTER} cy={CENTER} r="13.4" fill="none" stroke="#C79A4E" strokeWidth="0.85" opacity="0.65" />

        {/* 8. Diamond frame (gold) */}
        <path d={OUTER_DIAMOND_PATH} fill="none" stroke="#C79A4E" strokeWidth="1.5" strokeLinejoin="round" />

        {/* 9. Corner connectors -- small pin-style elements: a short stroke
            reaching outward from each diamond vertex, capped with a node. */}
        <g stroke="#C79A4E" strokeWidth="1" strokeLinecap="round">
          {OUTER_DIAMOND.map(([vx, vy], i) => {
            const angle = i * 90;
            const [ex, ey] = polar(angle, OUTER_DIAMOND_R + 2.3);
            return <line key={i} x1={vx} y1={vy} x2={ex} y2={ey} />;
          })}
        </g>
        <g fill="#C79A4E" stroke="none">
          {OUTER_DIAMOND.map(([, ], i) => {
            const angle = i * 90;
            const [ex, ey] = polar(angle, OUTER_DIAMOND_R + 2.3);
            return <circle key={i} cx={ex} cy={ey} r="0.85" />;
          })}
        </g>

        {/* 10 & 11. Inner diamond -- teal-green zigzag border, warm-charcoal
            fill, nested inside the gold diamond frame. */}
        <path d={ZIGZAG_PATH} fill="#211F1D" stroke="#3F8C78" strokeWidth="0.7" strokeLinejoin="round" />

        {/* 12. Gold vajra bolt, centered in the inner diamond */}
        <path
          d="M26.3 16.6 L20.8 24.7 L24 24.7 L21.7 31.4 L27.6 23 L24.4 23 Z"
          fill="#C79A4E"
          stroke="none"
        />

        {/* 13. Gold nodes -- round markers at the inner diamond's own
            corners, distinct from the outer pin connectors. */}
        <g fill="#C79A4E" stroke="none">
          {diamondVertices(INNER_DIAMOND_R).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.55" />
          ))}
        </g>
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
