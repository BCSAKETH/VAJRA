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

const NODE_COLORS: Record<string, string> = {
  suspect: "#00C6AD",
  case: "#f59e0b",
  person: "#f43f5e",
  vehicle: "#818cf8",
  phone: "#38bdf8",
};

// Simple deterministic radial layout: BFS distance from the "suspect" root
// determines which ring a node sits on; nodes on the same ring are spread
// evenly around the circle. No external graph/force-layout library --
// keeps this dependency-free and fully predictable for a handful of nodes.
function computeLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const root = nodes.find((n) => n.type === "suspect") || nodes[0];
  if (!root) return new Map<string, { x: number; y: number }>();

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

  const ringGroups = new Map<number, string[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 1;
    if (!ringGroups.has(d)) ringGroups.set(d, []);
    ringGroups.get(d)!.push(n.id);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const maxRadius = Math.min(width, height) / 2 - 40;
  ringGroups.forEach((ids, ringDepth) => {
    if (ringDepth === 0) {
      positions.set(ids[0], { x: cx, y: cy });
      return;
    }
    const radius = (maxRadius / Math.max(...ringGroups.keys())) * ringDepth;
    ids.forEach((id, idx) => {
      const angle = (2 * Math.PI * idx) / ids.length - Math.PI / 2;
      positions.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  });

  return positions;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, edges, height = 380 }) => {
  const width = 640;
  const positions = useMemo(() => computeLayout(nodes, edges, width, height), [nodes, edges, height]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-xs">
        No network data to visualize.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
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
      {nodes.map((n) => {
        const pos = positions.get(n.id);
        if (!pos) return null;
        const color = NODE_COLORS[n.type] || "#64748b";
        const radius = n.type === "suspect" ? 26 : 18;
        return (
          <g key={n.id}>
            <circle cx={pos.x} cy={pos.y} r={radius} fill="#0f172a" stroke={color} strokeWidth={2} />
            <text
              x={pos.x} y={pos.y + radius + 14}
              textAnchor="middle"
              fill={color}
              fontSize={10}
              fontFamily="monospace"
              fontWeight={n.type === "suspect" ? 700 : 500}
            >
              {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
            </text>
            {n.sublabel && (
              <text
                x={pos.x} y={pos.y + radius + 26}
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
  );
};
