import React, { useMemo } from "react";

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: "suspect" | "case" | "person" | "vehicle" | "phone" | string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
}

// Categorical palette validated against the app's dark surface (#070F1E) via
// the dataviz skill's validator: passing lightness band (OKLCH L 0.48-0.67),
// chroma floor, adjacent-pair CVD separation, and normal-vision floor in this
// exact order. The previous colors (brighter #00C6AD/#818cf8/#38bdf8 family)
// failed the lightness band entirely and had a sub-15 normal-vision-floor
// pair (indigo/sky, dE 13.5) -- confirmed via `validate_palette.js`, not
// eyeballed. Every node also carries a text label, satisfying the
// secondary-encoding requirement for any pair that lands in the 6-8 CVD band.
const NODE_COLORS: Record<string, string> = {
  suspect: "#199e70",
  case: "#c98500",
  person: "#9085e9",
  vehicle: "#e66767",
  phone: "#3987e5",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  suspect: "Suspect",
  case: "Linked Case",
  person: "Co-Accused",
  vehicle: "Vehicle",
  phone: "Phone",
};

// Real queries against the case DB can match dozens of records (e.g. a
// common name via LIKE '*ramesh*'). Beyond this many nodes on a single ring,
// the rest get collapsed into one "+N more" node so labels stay readable
// instead of overlapping into an unreadable mass.
const MAX_NODES_PER_RING = 10;
// Minimum arc length (px) between adjacent node centers on the same ring,
// so circles/labels don't visually collide as ring population grows.
const MIN_ARC_SPACING = 58;
const RING_STEP = 110;

// Simple deterministic radial layout: BFS distance from the "suspect" root
// determines which ring a node sits on; nodes on the same ring are spread
// evenly around the circle. No external graph/force-layout library --
// keeps this dependency-free and fully predictable. Canvas size and per-ring
// radius both scale with how many nodes actually need to fit, and
// overcrowded rings are capped with an aggregated overflow node.
function computeLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const root = nodes.find((n) => n.type === "suspect") || nodes[0];
  if (!root) return { positions: new Map<string, { x: number; y: number }>(), width: 640, height: 380, renderNodes: nodes, overflowByRing: new Map<number, number>() };

  const adjacency = new Map<string, string[]>();
  nodes.forEach((n) => adjacency.set(n.id, []));
  edges.forEach((e) => {
    adjacency.get(e.source)?.push(e.target);
    adjacency.get(e.target)?.push(e.source);
  });

  const depth = new Map<string, number>();
  depth.set(root.id, 0);
  const queue = [root.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current)!;
    for (const neighbor of adjacency.get(current) || []) {
      if (!depth.has(neighbor)) {
        depth.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ringGroups = new Map<number, string[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 1;
    if (!ringGroups.has(d)) ringGroups.set(d, []);
    ringGroups.get(d)!.push(n.id);
  });

  // Cap each ring's population, folding the overflow into a single
  // aggregated node so the graph stays legible instead of crowding.
  const overflowByRing = new Map<number, number>();
  ringGroups.forEach((ids, ringDepth) => {
    if (ringDepth === 0 || ids.length <= MAX_NODES_PER_RING) return;
    const overflowCount = ids.length - (MAX_NODES_PER_RING - 1);
    overflowByRing.set(ringDepth, overflowCount);
    ringGroups.set(ringDepth, ids.slice(0, MAX_NODES_PER_RING - 1));
  });

  const maxRingDepth = Math.max(...ringGroups.keys(), 1);
  // Radius needed on each ring so nodes have enough arc spacing, given how
  // many will actually be drawn on it (including the +N overflow node).
  let maxRadius = 0;
  ringGroups.forEach((ids, ringDepth) => {
    if (ringDepth === 0) return;
    const count = ids.length + (overflowByRing.has(ringDepth) ? 1 : 0);
    const spacingRadius = (count * MIN_ARC_SPACING) / (2 * Math.PI);
    const stepRadius = RING_STEP * ringDepth;
    maxRadius = Math.max(maxRadius, spacingRadius, stepRadius);
  });
  maxRadius = Math.max(maxRadius, RING_STEP);

  const width = Math.max(640, maxRadius * 2 + 160);
  const height = Math.max(380, maxRadius * 2 + 160);
  const cx = width / 2;
  const cy = height / 2;

  const positions = new Map<string, { x: number; y: number }>();
  const renderNodes: GraphNode[] = [];
  ringGroups.forEach((ids, ringDepth) => {
    if (ringDepth === 0) {
      positions.set(ids[0], { x: cx, y: cy });
      renderNodes.push(nodeById.get(ids[0])!);
      return;
    }
    const overflowCount = overflowByRing.get(ringDepth) || 0;
    const totalOnRing = ids.length + (overflowCount > 0 ? 1 : 0);
    const radius = (maxRadius / maxRingDepth) * ringDepth;
    ids.forEach((id, idx) => {
      const angle = (2 * Math.PI * idx) / totalOnRing - Math.PI / 2;
      positions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
      renderNodes.push(nodeById.get(id)!);
    });
    if (overflowCount > 0) {
      const overflowId = `__overflow_ring_${ringDepth}`;
      const angle = (2 * Math.PI * ids.length) / totalOnRing - Math.PI / 2;
      positions.set(overflowId, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
      renderNodes.push({ id: overflowId, label: `+${overflowCount} more`, type: "overflow" });
    }
  });

  return { positions, width, height, renderNodes, overflowByRing };
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, edges, height: minHeight = 380 }) => {
  const { positions, width, height, renderNodes } = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-xs">
        No network data to visualize.
      </div>
    );
  }

  const isDense = renderNodes.length > 14;

  // Legend only lists types actually present in this graph -- a fixed
  // suspect/case/person/vehicle/phone legend would show swatches for node
  // types that never appear in a small network (e.g. no vehicle/phone links
  // found), which is more confusing than a legend scoped to what's on screen.
  const presentTypes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const n of renderNodes) {
      if (n.type !== "overflow" && NODE_COLORS[n.type] && !seen.has(n.type)) {
        seen.add(n.type);
        ordered.push(n.type);
      }
    }
    return ordered;
  }, [renderNodes]);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Legend -- required whenever >=2 categorical series are on screen;
          node labels alone aren't a substitute since the color itself still
          needs an explained meaning (a first-time viewer can't infer "amber
          circle = linked case" from the label text next to it alone). */}
      {presentTypes.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center px-2 shrink-0">
          {presentTypes.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[t] }} />
              <span className="text-[9.5px] font-mono text-slate-400">{NODE_TYPE_LABELS[t] || t}</span>
            </div>
          ))}
        </div>
      )}
      <div className="w-full flex-1 overflow-auto">
      <svg width={width} height={Math.max(height, minHeight)} viewBox={`0 0 ${width} ${Math.max(height, minHeight)}`} className="block mx-auto">
        {edges.map((e, idx) => {
          const from = positions.get(e.source);
          const to = positions.get(e.target);
          if (!from || !to) return null;
          return (
            <line
              key={idx}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke="#1e293b"
              strokeWidth={1.5}
            />
          );
        })}
        {renderNodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const isOverflow = n.type === "overflow";
          const color = isOverflow ? "#94a3b8" : NODE_COLORS[n.type] || "#64748b";
          const radius = n.type === "suspect" ? 26 : isDense ? 14 : 18;
          const maxLabelLen = isDense ? 12 : 18;
          const tooltipText = isOverflow
            ? n.label
            : `${NODE_TYPE_LABELS[n.type] || n.type}: ${n.label}${n.sublabel ? ` (${n.sublabel})` : ""}`;
          return (
            <g key={n.id} className="cursor-default">
              {/* Native <title> gives every node a real hover tooltip with no
                  extra JS state/positioning logic -- appropriate for a
                  lightweight SVG diagram like this one (see interaction.md:
                  "per-mark hover tooltip" is required, not a specific
                  implementation). */}
              <title>{tooltipText}</title>
              <circle
                cx={pos.x} cy={pos.y} r={radius}
                fill="#0f172a"
                stroke={color}
                strokeWidth={2}
                strokeDasharray={isOverflow ? "3 3" : undefined}
              />
              <text
                x={pos.x} y={pos.y + radius + 13}
                textAnchor="middle"
                fill={color}
                fontSize={isDense ? 8.5 : 10}
                fontFamily="monospace"
                fontWeight={n.type === "suspect" ? 700 : 500}
              >
                {n.label.length > maxLabelLen ? n.label.slice(0, maxLabelLen - 2) + "…" : n.label}
              </text>
              {n.sublabel && !isDense && (
                <text
                  x={pos.x} y={pos.y + radius + 25}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={8.5}
                  fontFamily="monospace"
                >
                  {n.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
};
