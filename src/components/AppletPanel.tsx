import React from "react";
import { useApp } from "../AppContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Sparkles, Network, Gauge as GaugeIcon } from "lucide-react";

export interface AppletComponentSpec {
  kind: "bar_chart" | "line_chart" | "map" | "network_graph" | "stat_tile" | "table" | "timeline" | "gauge";
  title?: string;
  data?: any;
  columns?: string[];
  value?: number | string;
  label?: string;
  [key: string]: any;
}

export interface AppletSpec {
  layout: "grid" | "single";
  components: AppletComponentSpec[];
}

interface AppletPanelProps {
  spec: AppletSpec | null;
  isLoading: boolean;
}

const CardShell: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 space-y-2">
    {title && (
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{title}</h4>
    )}
    {children}
  </div>
);

const StatTile: React.FC<AppletComponentSpec> = ({ title, value, label }) => (
  <CardShell>
    <div className="text-2xl font-black text-[#00C6AD] font-mono">{String(value ?? "—")}</div>
    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label || title}</div>
  </CardShell>
);

const DataTable: React.FC<AppletComponentSpec> = ({ title, columns, data }) => {
  const { t } = useApp();
  const rows: any[] = Array.isArray(data) ? data : [];
  const cols: string[] = columns && columns.length > 0 ? columns : (rows[0] ? Object.keys(rows[0]) : []);
  return (
    <CardShell title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              {cols.map((c) => (
                <th key={c} className="text-left py-1 pr-3 uppercase tracking-wider">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((row, idx) => (
              <tr key={idx} className="border-b border-slate-900 text-slate-300">
                {cols.map((c) => (
                  <td key={c} className="py-1 pr-3">{String(row?.[c] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="text-slate-600 text-[10px] py-2">{t.noRows}</div>}
      </div>
    </CardShell>
  );
};

const BarChartCard: React.FC<AppletComponentSpec> = ({ title, data }) => (
  <CardShell title={title}>
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={Array.isArray(data) ? data : []}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 11 }} />
          <Bar dataKey="value" fill="#00C6AD" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </CardShell>
);

const LineChartCard: React.FC<AppletComponentSpec> = ({ title, data }) => (
  <CardShell title={title}>
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={Array.isArray(data) ? data : []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 11 }} />
          <Line type="monotone" dataKey="value" stroke="#00C6AD" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </CardShell>
);

// Same fix as ExpandedOverlay's map: a fixed center/zoom on point[0] left
// most markers (and their tiles) never requested whenever hotspots span a
// wide area, and the panel's own animated mount meant Leaflet sometimes
// measured its container before the flex layout settled. fitBounds() + a
// ResizeObserver fixes both at the source instead of guessing a zoom level
// or a fixed delay.
const MapFitter: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [20, 20], maxZoom: 13 });
      }
    };
    fit();
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 500);
    const container = map.getContainer();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => fit());
      observer.observe(container);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);
  return null;
};

const MapCard: React.FC<AppletComponentSpec> = ({ title, data }) => {
  const points: { lat: number; lng: number; label?: string }[] = Array.isArray(data) ? data : [];
  const center: [number, number] = points.length > 0 ? [points[0].lat, points[0].lng] : [12.9716, 77.5946];
  return (
    <CardShell title={title}>
      <div className="h-48 rounded-lg overflow-hidden">
        <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFitter points={points} />
          {points.map((p, idx) => (
            <CircleMarker
              key={idx}
              center={[p.lat, p.lng]}
              radius={8}
              pathOptions={{ color: "#00C6AD", weight: 2, fillColor: "#00C6AD", fillOpacity: 0.35 }}
            >
              <Popup>{p.label || "Incident"}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </CardShell>
  );
};

const NetworkGraphCard: React.FC<AppletComponentSpec> = ({ title, data }) => {
  const nodes: any[] = Array.isArray(data?.nodes) ? data.nodes : (Array.isArray(data) ? data : []);
  return (
    <CardShell title={title}>
      <div className="flex items-center gap-2 text-[#00C6AD] mb-2">
        <Network className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono">{nodes.length} connected entities</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.slice(0, 12).map((n: any, idx: number) => (
          <span key={idx} className="px-2 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-[9px] text-slate-300 font-mono">
            {typeof n === "string" ? n : n.name || n.label || "Node"}
          </span>
        ))}
      </div>
    </CardShell>
  );
};

const TimelineCard: React.FC<AppletComponentSpec> = ({ title, data }) => {
  const { t } = useApp();
  const events: any[] = Array.isArray(data) ? data : [];
  return (
    <CardShell title={title}>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {events.map((e: any, idx: number) => (
          <div key={idx} className="flex gap-2 text-[10px]">
            <span className="text-[#00C6AD] font-mono shrink-0">{e.date}</span>
            <span className="text-slate-400 truncate">{e.event || e.description}</span>
          </div>
        ))}
        {events.length === 0 && <div className="text-slate-600 text-[10px]">{t.noTimelineEvents}</div>}
      </div>
    </CardShell>
  );
};

const GaugeCard: React.FC<AppletComponentSpec> = ({ title, value, label }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <CardShell title={title}>
      <div className="flex items-center gap-2 mb-1.5">
        <GaugeIcon className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[10px] text-slate-400">{label}</span>
      </div>
      <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
        <div className="bg-amber-500 h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-[10px] text-amber-500 font-mono mt-1">{pct}%</div>
    </CardShell>
  );
};

const componentRenderers: Record<string, React.FC<AppletComponentSpec>> = {
  bar_chart: BarChartCard,
  line_chart: LineChartCard,
  map: MapCard,
  network_graph: NetworkGraphCard,
  stat_tile: StatTile,
  table: DataTable,
  timeline: TimelineCard,
  gauge: GaugeCard,
};

export const AppletPanel: React.FC<AppletPanelProps> = ({ spec, isLoading }) => {
  const { t } = useApp();
  return (
    <div className="w-80 shrink-0 border-l border-slate-850 bg-slate-950/30 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-850 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#00C6AD]" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{t.analysisPanel}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            <div className="shimmer-bg h-24 w-full rounded-xl border border-slate-900" />
            <div className="shimmer-bg h-24 w-full rounded-xl border border-slate-900" />
          </div>
        )}

        {!isLoading && (!spec || spec.components.length === 0) && (
          <div className="text-[10px] text-slate-600 text-center py-8 font-mono px-2">
            {t.noVisualizableData}
          </div>
        )}

        {!isLoading && spec && spec.components.map((comp, idx) => {
          const Renderer = componentRenderers[comp.kind];
          if (!Renderer) return null;
          return <Renderer key={idx} {...comp} />;
        })}
      </div>
    </div>
  );
};
