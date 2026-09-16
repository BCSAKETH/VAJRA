import React, { useMemo, useState, useRef, useEffect } from "react";
import { API_BASE } from "../config";

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: "suspect" | "case" | "person" | "vehicle" | "phone" | "financial_account" | string;
  // F.1/F.33: which combined-view toggle group this node belongs to.
  // Separate from "type" on purpose (Loophole L4) -- toggling a layer on/off
  // never changes a node's color/legend bucket.
  layer?: "co_accused" | "financial" | "phone_vehicle" | string;
  // A node that is a de-duplicated match across layers (Loophole L1) carries
  // every layer it appears in here; "layer" above stays its PRIMARY one for
  // color/legend purposes.
  layers?: string[];
  // F.2: BFS distance from the root suspect (1 = direct link). Missing/1
  // renders as a normal direct link; >=2 renders dashed/faded (Loophole L2).
  hop?: number;
  // F.6: real per-node degree centrality (0-1, normalized) and, ONLY when a
  // caller has actually computed one, an individual risk score (0-100) --
  // never fabricated when absent (Loophole L1).
  centrality?: number;
  risk?: number;
  // F.9: a hub also confirmed on the Repeat Offenders list.
  cross_flag?: string;
  // F.5: earliest shared-case date this specific edge/node was "first seen."
  first_seen?: string | null;
}

export interface GraphEdge {
  source?: string;
  target?: string;
  from?: string;
  to?: string;
  label?: string;
  layer?: "co_accused" | "financial" | "phone_vehicle" | string;
  hop?: number;
  // F.4: real shared-case (or transaction) count backing this edge -- drives
  // line thickness, log-scaled and capped (Loophole L1).
  weight?: number;
  first_seen?: string | null;
  // F.8: real transaction timestamp (financial edges only), used to sort a
  // time-ordered money-flow animation.
  txn_time?: string | null;
  amount?: number | null;
}

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  // F.1/F.33: which layer(s) render, and the toggle handler. Omitted
  // entirely (no layers present on any node) falls back to "show everything,
  // no toggle bar" -- fully backward compatible with every existing caller
  // that doesn't pass per-node layers yet.
  activeLayers?: string[];
  onToggleLayer?: (layer: string) => void;
  // Loophole L3 (F.1): this specific entity always renders regardless of
  // any active filter.
  primaryEntityId?: string;
  // F.1/#33 merge: hide peripheral nodes below this risk (0-100); never
  // applied to primaryEntityId.
  minRiskFilter?: number;
  // F.34: nodes/edges whose first_seen/txn_time is AFTER this ISO timestamp
  // render with a "NEW" badge -- undefined/null means no badge (either
  // never viewed before, or the feature's backing table isn't set up yet).
  newSinceTimestamp?: string | null;
  // H.1.3: fires a follow-up chat query through the existing chat pipeline
  // (same bridge already used for Repeat Offenders / suggestion chips) --
  // used by click-to-trace. Omitted entirely disables the trace affordance,
  // same backward-compatible pattern as every other optional prop here.
  onFollowUpQuery?: (text: string) => void;
}

// Categorical palette validated against the app's dark surface (#161412) via
// the dataviz skill's validator: passing lightness band (OKLCH L 0.48-0.67),
// chroma floor, adjacent-pair CVD separation, and normal-vision floor in this
// exact order.
const NODE_COLORS: Record<string, string> = {
  suspect: "#00C6AD",
  case: "#f59e0b",
  person: "#a78bfa",
  vehicle: "#e66767",
  phone: "#38bdf8",
  financial_account: "#22d3ee", // F.1/L4: distinct from "case" (#f59e0b), which already means a linked CrimeNo here
};

const NODE_TYPE_LABELS: Record<string, string> = {
  suspect: "Suspect",
  case: "Linked Case",
  person: "Co-Accused",
  vehicle: "Vehicle",
  phone: "Phone",
  financial_account: "Financial Account",
};

// F.1/F.33: toggle-bar labels for the three combined-view layers.
const LAYER_LABELS: Record<string, string> = {
  co_accused: "Co-accused",
  financial: "Financial",
  phone_vehicle: "Phone/Vehicle",
};

// F.6: blends real degree centrality with an individual risk score WHEN one
// has actually been computed for that node -- otherwise falls back to
// centrality alone and marks the node as risk-not-yet-assessed (Loophole L1:
// never implies a real low-risk score for a node that was simply never
// individually scored).
function getNodeImportance(node: GraphNode): { score: number; assessed: boolean } {
  if (node.risk == null) return { score: node.centrality ?? 0.3, assessed: false };
  return { score: 0.5 * (node.centrality ?? 0) + 0.5 * (node.risk / 100), assessed: true };
}

// Allow up to 16 nodes on a ring so medium clusters display all distinct entities
// rather than prematurely collapsing into an aggregated overflow bubble.
const MAX_NODES_PER_RING = 16;
// Minimum arc length (px) between adjacent node centers on the same ring.
const MIN_ARC_SPACING = 54;
const RING_STEP = 115;

const getEdgeEndpoints = (e: any): { source: string; target: string } => ({
  source: String(e?.source || e?.from || ""),
  target: String(e?.target || e?.to || ""),
});

// Simple deterministic radial layout: BFS distance from the "suspect" root
// determines which ring a node sits on; nodes on the same ring are spread
// evenly around the circle.
function computeLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const root = nodes.find((n) => n.type === "suspect") || nodes[0];
  if (!root) return { positions: new Map<string, { x: number; y: number }>(), width: 640, height: 380, renderNodes: nodes, overflowByRing: new Map<number, number>() };

  const adjacency = new Map<string, string[]>();
  nodes.forEach((n) => adjacency.set(n.id, []));
  edges.forEach((rawE) => {
    const e = getEdgeEndpoints(rawE);
    if (e.source && e.target) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      if (!adjacency.has(e.target)) adjacency.set(e.target, []);
      adjacency.get(e.source)!.push(e.target);
      adjacency.get(e.target)!.push(e.source);
    }
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

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes: propNodes, edges: propEdges, height: minHeight = 380,
  activeLayers, onToggleLayer, primaryEntityId, minRiskFilter, newSinceTimestamp,
  onFollowUpQuery,
}) => {
  // H.1.7: click-to-expand -- fetched expansions merge into ONE combined
  // node/edge list right here, so every existing computation below (layout,
  // filtering, date range, etc.) keeps working against a single `nodes`/
  // `edges` pair exactly as before, with no separate merge step needed at
  // each call site. De-duplicated by real node id against whatever the
  // caller's own props already contain.
  const [expandedNodes, setExpandedNodes] = useState<GraphNode[]>([]);
  const [expandedEdges, setExpandedEdges] = useState<GraphEdge[]>([]);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const nodes = useMemo(() => {
    const seen = new Set(propNodes.map((n) => n.id));
    return [...propNodes, ...expandedNodes.filter((n) => !seen.has(n.id))];
  }, [propNodes, expandedNodes]);
  const edges = useMemo(() => [...propEdges, ...expandedEdges], [propEdges, expandedEdges]);

  const handleNodeExpand = async (n: GraphNode) => {
    if (n.type === "overflow" || expandingNodeId) return;
    setExpandingNodeId(n.id);
    try {
      const res = await fetch(`${API_BASE}/api/network/expand?suspect_name=${encodeURIComponent(n.label)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ambiguous_match) return; // silent -- expanding is a nicety, not worth a blocking error for an ambiguous name
      const newNodes: GraphNode[] = (data.nodes || []).filter((nn: GraphNode) => nn.id !== n.id);
      const newEdges: GraphEdge[] = data.edges || [];
      if (newNodes.length) setExpandedNodes((prev) => [...prev, ...newNodes]);
      if (newEdges.length) setExpandedEdges((prev) => [...prev, ...newEdges]);
    } catch {
      // silent -- click-to-expand is progressive enrichment, never a hard failure
    } finally {
      setExpandingNodeId(null);
    }
  };
  // F.1/F.33: which layers this graph actually carries (legacy payloads with
  // no "layer" field on any node render exactly as before -- no toggle bar,
  // no filtering, zero behavior change for every caller that predates this).
  const availableLayers = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.layer).filter((l): l is string => !!l))),
    [nodes]
  );
  // Self-contained toggle state -- always interactive regardless of whether
  // a parent listens via onToggleLayer (Loophole L2: a wrong initial guess
  // never blocks access, it just costs one click).
  const [internalActiveLayers, setInternalActiveLayers] = useState<string[]>(
    () => (activeLayers && activeLayers.length ? activeLayers : availableLayers)
  );
  const activeSet = useMemo(() => new Set(internalActiveLayers), [internalActiveLayers]);
  const handleToggle = (layer: string) => {
    setInternalActiveLayers((prev) => (prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]));
    onToggleLayer?.(layer);
  };

  // F.1 Loophole L3 (risk filter, #33 merge): a node passes if its layer is
  // active (or it carries no layer at all -- legacy data) AND (it's the
  // specifically-queried primary entity OR its risk clears minRiskFilter).
  const nodeVisible = (n: GraphNode): boolean => {
    if (n.id === primaryEntityId) return true;
    if (availableLayers.length > 0) {
      const nodeLayers = n.layers && n.layers.length ? n.layers : [n.layer].filter(Boolean);
      if (nodeLayers.length && !nodeLayers.some((l) => activeSet.has(l as string))) return false;
    }
    if (minRiskFilter != null && n.risk != null && n.risk < minRiskFilter) return false;
    return true;
  };

  // H.1.1: time-slider playback. Edges/nodes with a real first_seen/txn_time
  // are hidden once the "as-of" cursor is before that date; anything with NO
  // date (phone/vehicle links have no date column, per the plan's own
  // finding) always stays visible -- the slider never dishonestly implies a
  // date VAJRA doesn't actually have. Range/slider are only shown at all
  // when at least one dated item exists, so an undated legacy graph renders
  // with zero UI change.
  const dateRangeMs = useMemo(() => {
    const stamps: number[] = [];
    nodes.forEach((n) => { const t = n.first_seen ? Date.parse(n.first_seen) : NaN; if (!isNaN(t)) stamps.push(t); });
    edges.forEach((rawE) => {
      const e = rawE as GraphEdge;
      const t1 = e.first_seen ? Date.parse(e.first_seen) : NaN;
      const t2 = e.txn_time ? Date.parse(e.txn_time) : NaN;
      if (!isNaN(t1)) stamps.push(t1);
      if (!isNaN(t2)) stamps.push(t2);
    });
    if (stamps.length < 2) return null;
    return { min: Math.min(...stamps), max: Math.max(...stamps) };
  }, [nodes, edges]);

  const [asOfCursor, setAsOfCursor] = useState<number>(100); // 0-100, % through dateRangeMs
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    if (!isPlaying || !dateRangeMs) return;
    if (asOfCursor >= 100) { setIsPlaying(false); return; }
    const id = setTimeout(() => setAsOfCursor((c) => Math.min(100, c + 2)), 120);
    return () => clearTimeout(id);
  }, [isPlaying, asOfCursor, dateRangeMs]);
  const asOfDateMs = dateRangeMs ? dateRangeMs.min + ((dateRangeMs.max - dateRangeMs.min) * asOfCursor) / 100 : null;
  const passesDateCursor = (ts?: string | null): boolean => {
    if (!dateRangeMs || asOfDateMs == null || !ts) return true; // undated -- always visible, never hidden dishonestly
    const t = Date.parse(ts);
    return isNaN(t) || t <= asOfDateMs;
  };

  // F.1 Loophole L3 (risk filter, #33 merge): a node passes if its layer is
  // active (or it carries no layer at all -- legacy data) AND (it's the
  // specifically-queried primary entity OR its risk clears minRiskFilter).
  const visibleNodes = useMemo(
    () => nodes.filter((n) => nodeVisible(n) && (n.id === primaryEntityId || passesDateCursor(n.first_seen))),
    [nodes, activeSet, availableLayers, minRiskFilter, primaryEntityId, asOfDateMs, dateRangeMs]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => edges.filter((rawE) => {
    const e = getEdgeEndpoints(rawE);
    if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return false;
    const edgeData = rawE as GraphEdge;
    return passesDateCursor(edgeData.first_seen) && passesDateCursor(edgeData.txn_time);
  }), [edges, visibleIds, asOfDateMs, dateRangeMs]);

  const { positions, width, height, renderNodes } = useMemo(() => computeLayout(visibleNodes, visibleEdges), [visibleNodes, visibleEdges]);

  // H.1.4: zoom (wheel) & pan (drag) -- a viewBox-space transform on a
  // wrapping <g>, not a change to the underlying layout coordinates, so
  // computeLayout/positions stay exactly as before.
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => ({ ...z, scale: Math.min(3, Math.max(0.4, z.scale * factor)) }));
  };
  const handleBgMouseDown = (e: React.MouseEvent<SVGRectElement>) => {
    setIsDragging(true);
    setSelectedEdge(null);
    dragState.current = { x: e.clientX, y: e.clientY, tx: zoom.tx, ty: zoom.ty };
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragState.current) return;
    setZoom((z) => ({ ...z, tx: dragState.current!.tx + (e.clientX - dragState.current!.x), ty: dragState.current!.ty + (e.clientY - dragState.current!.y) }));
  };
  const handleMouseUp = () => { setIsDragging(false); dragState.current = null; };
  const resetView = () => setZoom({ scale: 1, tx: 0, ty: 0 });

  // H.1.3: click-to-trace shortest path. Selecting two nodes shows a
  // confirmation chip; confirming fires a normal chat follow-up through the
  // existing pipeline (which already calls trace_connection_path) rather
  // than splicing a second graph payload into this component's own state.
  const [selectedForTrace, setSelectedForTrace] = useState<string[]>([]);
  const handleNodeClick = (n: GraphNode) => {
    if (!onFollowUpQuery || n.type === "overflow") return;
    setSelectedForTrace((prev) => {
      if (prev.includes(n.id)) return prev.filter((id) => id !== n.id);
      if (prev.length >= 2) return [prev[1], n.id];
      return [...prev, n.id];
    });
  };
  const selectedTraceNodes = selectedForTrace.map((id) => renderNodes.find((n) => n.id === id)).filter(Boolean) as GraphNode[];
  const fireTrace = () => {
    if (selectedTraceNodes.length !== 2 || !onFollowUpQuery) return;
    onFollowUpQuery(`how are ${selectedTraceNodes[0].label} and ${selectedTraceNodes[1].label} connected`);
    setSelectedForTrace([]);
  };

  // CONFIRMED LIVE GAP (2026-09-16): edges rendered as plain <line>s with no
  // interaction at all -- a real shared-case/transaction count backs every
  // edge (weight/first_seen/txn_time/amount, see GraphEdge above) but an
  // officer had no way to see it short of asking a follow-up chat question.
  // Click-to-inspect surfaces that same real data directly on the graph.
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const nodeLabelById = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => m.set(n.id, n.label));
    return m;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-600 text-xs">
        No network data to visualize.
      </div>
    );
  }

  const isDense = renderNodes.length > 14;

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

  // F.34: "new since last visit" -- an edge/node whose real first_seen/
  // txn_time postdates the officer's own last view of THIS network.
  const isNew = (ts?: string | null): boolean => {
    if (!newSinceTimestamp || !ts) return false;
    const t = Date.parse(ts);
    const since = Date.parse(newSinceTimestamp);
    return !isNaN(t) && !isNaN(since) && t > since;
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {availableLayers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center px-2 shrink-0">
          {availableLayers.map((layer) => (
            <button
              key={layer}
              onClick={() => handleToggle(layer)}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                activeSet.has(layer)
                  ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#E4C590]"
                  : "bg-stone-900 border-stone-800 text-stone-500"
              }`}
              title={`Toggle ${LAYER_LABELS[layer] || layer} layer`}
            >
              {activeSet.has(layer) ? "✓ " : ""}{LAYER_LABELS[layer] || layer}
            </button>
          ))}
        </div>
      )}
      {presentTypes.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center px-2 shrink-0">
          {presentTypes.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[t] }} />
              <span className="text-[9.5px] font-mono text-stone-400">{NODE_TYPE_LABELS[t] || t}</span>
            </div>
          ))}
        </div>
      )}
      {/* H.1.1: time-slider playback -- only rendered when the graph
          actually carries at least 2 dated items (co-accused/financial
          edges have real dates; phone/vehicle links never do and always
          stay visible, per the plan's own honesty rule). */}
      {dateRangeMs && (
        <div className="flex items-center gap-2 px-3 shrink-0 text-[10px] font-mono text-stone-400">
          <button
            onClick={() => { if (asOfCursor >= 100) setAsOfCursor(0); setIsPlaying((p) => !p); }}
            className="px-2 py-1 rounded-lg border border-stone-800 bg-stone-900 hover:bg-stone-800 text-[#C79A4E] cursor-pointer shrink-0"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <span className="shrink-0">{new Date(dateRangeMs.min).toLocaleDateString()}</span>
          <input
            type="range" min={0} max={100} value={asOfCursor}
            onChange={(e) => { setIsPlaying(false); setAsOfCursor(Number(e.target.value)); }}
            className="flex-1 accent-[#C79A4E]"
          />
          <span className="shrink-0">{new Date(dateRangeMs.max).toLocaleDateString()}</span>
          {asOfDateMs != null && (
            <span className="shrink-0 text-[#C79A4E]">as of {new Date(asOfDateMs).toLocaleDateString()}</span>
          )}
        </div>
      )}
      <div className="w-full flex-1 overflow-auto relative">
      {/* H.1.4: zoom/pan control cluster */}
      <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
        <button onClick={() => setZoom((z) => ({ ...z, scale: Math.min(3, z.scale * 1.2) }))} className="w-6 h-6 flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900/90 hover:bg-stone-800 text-stone-300 text-xs font-bold cursor-pointer" title="Zoom in">+</button>
        <button onClick={() => setZoom((z) => ({ ...z, scale: Math.max(0.4, z.scale / 1.2) }))} className="w-6 h-6 flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900/90 hover:bg-stone-800 text-stone-300 text-xs font-bold cursor-pointer" title="Zoom out">−</button>
        <button onClick={resetView} className="w-6 h-6 flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900/90 hover:bg-stone-800 text-stone-300 text-[9px] font-bold cursor-pointer" title="Reset view">⟲</button>
      </div>
      {/* H.1.3: trace confirmation chip */}
      {selectedTraceNodes.length === 2 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-stone-900 border border-[#C79A4E]/40 rounded-xl px-3 py-2 shadow-xl flex items-center gap-2 text-[11px]">
          <span className="text-stone-300">
            Trace connection between <b className="text-[#E4C590]">{selectedTraceNodes[0].label}</b> and <b className="text-[#E4C590]">{selectedTraceNodes[1].label}</b>?
          </span>
          <button onClick={fireTrace} className="px-2 py-0.5 rounded-lg bg-[#C79A4E] text-stone-950 font-bold cursor-pointer">Trace</button>
          <button onClick={() => setSelectedForTrace([])} className="px-2 py-0.5 rounded-lg border border-stone-700 text-stone-400 cursor-pointer">Cancel</button>
        </div>
      )}
      {/* Edge click inspection: real shared-case/transaction data behind the
          clicked edge, not just a decorative line. */}
      {selectedEdge && (() => {
        const srcLabel = nodeLabelById.get(getEdgeEndpoints(selectedEdge).source) || getEdgeEndpoints(selectedEdge).source;
        const tgtLabel = nodeLabelById.get(getEdgeEndpoints(selectedEdge).target) || getEdgeEndpoints(selectedEdge).target;
        const rows: { label: string; value: string }[] = [];
        if (selectedEdge.layer) rows.push({ label: "Layer", value: LAYER_LABELS[selectedEdge.layer] || selectedEdge.layer });
        if (selectedEdge.weight != null) rows.push({ label: "Shared cases/txns", value: String(selectedEdge.weight) });
        if (selectedEdge.hop != null && selectedEdge.hop > 1) rows.push({ label: "Hop distance", value: String(selectedEdge.hop) });
        if (selectedEdge.amount != null) rows.push({ label: "Amount", value: `₹${selectedEdge.amount.toLocaleString("en-IN")}` });
        if (selectedEdge.txn_time) rows.push({ label: "Transaction time", value: new Date(selectedEdge.txn_time).toLocaleString() });
        if (selectedEdge.first_seen) rows.push({ label: "First seen", value: new Date(selectedEdge.first_seen).toLocaleDateString() });
        return (
          <div className="absolute top-2 right-2 z-10 bg-stone-900 border border-[#C79A4E]/40 rounded-xl px-3 py-2.5 shadow-xl text-[11px] max-w-[260px]">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-stone-200 font-bold leading-snug">
                {srcLabel} <span className="text-stone-500">↔</span> {tgtLabel}
              </span>
              <button onClick={() => setSelectedEdge(null)} className="text-stone-500 hover:text-stone-300 cursor-pointer shrink-0 leading-none" aria-label="Close">×</button>
            </div>
            {rows.length > 0 ? (
              <div className="space-y-0.5 font-mono text-[10px] text-stone-400">
                {rows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-3">
                    <span className="text-stone-500">{r.label}:</span>
                    <span className="text-stone-300">{r.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-stone-500 font-mono">No additional edge metadata on this connection.</p>
            )}
          </div>
        );
      })()}
      <svg
        width={width} height={Math.max(height, minHeight)} viewBox={`0 0 ${width} ${Math.max(height, minHeight)}`}
        className={`block mx-auto ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <radialGradient id="suspectGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00C6AD" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00C6AD" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={width} height={Math.max(height, minHeight)} fill="transparent" onMouseDown={handleBgMouseDown} />
        <g transform={`translate(${zoom.tx},${zoom.ty}) scale(${zoom.scale})`}>
        {visibleEdges.map((rawE, idx) => {
          const e = getEdgeEndpoints(rawE);
          const from = positions.get(e.source);
          const to = positions.get(e.target);
          if (!from || !to) return null;
          // F.4: real shared-case/transaction COUNT scales stroke width,
          // log-scaled and capped so one outlier can't visually dominate.
          const strokeWidth = Math.min(6, 1 + Math.log2(((rawE as GraphEdge).weight || 1) + 1) * 1.5);
          // F.2: 2nd/3rd-degree links render dashed + faded, visually
          // distinct from a direct 1-hop connection.
          const isMultiHop = ((rawE as GraphEdge).hop || 1) > 1;
          const edgeIsNew = isNew((rawE as GraphEdge).first_seen) || isNew((rawE as GraphEdge).txn_time);
          const isSelectedEdge = selectedEdge === rawE;
          const srcLabel = nodeLabelById.get(e.source) || e.source;
          const tgtLabel = nodeLabelById.get(e.target) || e.target;
          return (
            <g key={idx} className="cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setSelectedEdge(rawE as GraphEdge); }}>
              {/* Wider transparent hit-area -- the visible stroke (1-6px) is
                  too thin to reliably click on its own. */}
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="transparent"
                strokeWidth={Math.max(14, strokeWidth + 10)}
              >
                <title>{`${srcLabel} ↔ ${tgtLabel}${(rawE as GraphEdge).weight ? ` · ${(rawE as GraphEdge).weight} shared` : ""}`}</title>
              </line>
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={isSelectedEdge ? "#C79A4E" : edgeIsNew ? "#5DCAA5" : "#64748b"}
                strokeWidth={isSelectedEdge ? strokeWidth + 1 : strokeWidth}
                strokeOpacity={isSelectedEdge ? 0.95 : isMultiHop ? 0.35 : 0.65}
                strokeDasharray={isMultiHop ? "4 3" : undefined}
              />
              {edgeIsNew && (
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 4} textAnchor="middle" fill="#5DCAA5" fontSize={8} fontFamily="monospace" fontWeight={700}>NEW</text>
              )}
            </g>
          );
        })}
        {renderNodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const isOverflow = n.type === "overflow";
          const color = isOverflow ? "#94a3b8" : NODE_COLORS[n.type] || "#64748b";
          const isMultiHopNode = (n.hop || 1) > 1;
          // F.6: importance blends real degree centrality with an
          // individual risk score ONLY when one exists for this node.
          const importance = getNodeImportance(n);
          const baseRadius = n.type === "suspect" ? 26 : isDense ? 14 : 18;
          const radius = n.type === "suspect" || isOverflow ? baseRadius : baseRadius * (0.85 + importance.score * 0.4);
          const maxLabelLen = isDense ? 12 : 18;
          const nodeIsNew = isNew(n.first_seen);
          const tooltipParts = [isOverflow ? n.label : `${NODE_TYPE_LABELS[n.type] || n.type}: ${n.label}${n.sublabel ? ` (${n.sublabel})` : ""}`];
          if (importance.assessed) tooltipParts.push(`Risk-weighted importance: ${(importance.score * 100).toFixed(0)}%`);
          if (n.cross_flag) tooltipParts.push(n.cross_flag);
          const tooltipText = tooltipParts.join(" · ");
          const isSelectedForTrace = selectedForTrace.includes(n.id);
          const traceable = !!onFollowUpQuery && !isOverflow;
          const expandable = !isOverflow && n.type !== "suspect";
          const isExpanding = expandingNodeId === n.id;
          return (
            <g
              key={n.id}
              className={traceable || expandable ? "cursor-pointer" : "cursor-default"}
              opacity={isMultiHopNode ? 0.6 : isExpanding ? 0.5 : 1}
              onClick={() => handleNodeClick(n)}
              onDoubleClick={(e) => { e.stopPropagation(); if (expandable) handleNodeExpand(n); }}
            >
              {/* Native <title> gives every node a real hover tooltip with no
                  extra JS state/positioning logic -- appropriate for a
                  lightweight SVG diagram like this one (see interaction.md:
                  "per-mark hover tooltip" is required, not a specific
                  implementation). H.1.7: double-click expands a non-root
                  node's own network in place -- a distinct gesture from
                  H.1.3's single-click trace-select so the two features
                  never fight over the same click. */}
              <title>{tooltipText}{traceable ? " · click to select for trace" : ""}{expandable ? " · double-click to expand" : ""}</title>
              {n.type === "suspect" && (
                <circle
                  cx={pos.x} cy={pos.y} r={radius + 8}
                  fill="url(#suspectGlow)"
                  stroke="#00C6AD"
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              )}
              {n.cross_flag && (
                <circle cx={pos.x} cy={pos.y} r={radius + 4} fill="none" stroke="#E24B4A" strokeWidth={1.5} strokeDasharray="2 2" />
              )}
              {isSelectedForTrace && (
                <circle cx={pos.x} cy={pos.y} r={radius + 6} fill="none" stroke="#C79A4E" strokeWidth={2} strokeDasharray="2 2">
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${pos.x} ${pos.y}`} to={`360 ${pos.x} ${pos.y}`} dur="3s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={pos.x} cy={pos.y} r={radius}
                fill="#0f172a"
                stroke={color}
                strokeWidth={n.type === "suspect" ? 2.5 : 2}
                strokeDasharray={isOverflow || isMultiHopNode ? "3 3" : undefined}
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
              {nodeIsNew && (
                <text x={pos.x} y={pos.y - radius - 6} textAnchor="middle" fill="#5DCAA5" fontSize={8} fontFamily="monospace" fontWeight={700}>NEW</text>
              )}
            </g>
          );
        })}
        </g>
      </svg>
      </div>
    </div>
  );
};
