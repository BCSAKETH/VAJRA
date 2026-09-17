import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import karnatakaDistrictsGeo from "../assets/karnataka-districts.json";
import { localizedDistrictName } from "../i18n";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Map as MapIcon, RefreshCw, AlertTriangle, Users, ShieldAlert, Building2, Flame, Layers, UserX, Clock, TrendingUp, Activity, MapPin, BarChart3, LayoutGrid, Columns2, Rows2, FolderOpen, ArrowLeft, Link2, Unlink } from "lucide-react";
import { DistrictSpatialAnalystPanel } from "../components/DistrictSpatialAnalystPanel";
import { DistrictDemographicPanel } from "../components/DistrictDemographicPanel";
import { ComparisonDeltaHUD } from "../components/ComparisonDeltaHUD";
import { DistrictFIRPanel } from "../components/DistrictFIRPanel";
import { ReasonCollectionModal } from "../components/ReasonCollectionModal";
import { PoliceStationSelectorModal } from "../components/PoliceStationSelectorModal";

interface DistrictSummaryRow {
  district_id: number;
  district: string;
  active_cases: number;
  most_wanted: { suspect: string; case_count: number } | null;
}

// Entries for jurisdictions with real case counts but no map polygon:
// statewide special units (CID, Karnataka Railways, Coastal Security
// Police, ISD Bengaluru) and Vijayanagara (a real district created 2021,
// not yet in the map's 2011-census-era polygon dataset). Backend folds
// city commissionerates into their parent district's map tile instead of
// listing them here -- see DISTRICT_FOLD_MAP in vajra_backend/main.py.
interface SpecialUnitRow extends DistrictSummaryRow {
  reason: "special_unit" | "unmapped_district";
}

interface DistrictDetail {
  district_id: number;
  district: string;
  // Present only when this detail is actually a STATION drill-down
  // (/api/dashboard/stations/{unit_id}/detail) -- same panel shape as the
  // district detail, one level down. `district` on a station detail is its
  // PARENT district's name, not the station's own name.
  unit_id?: number;
  station?: string;
  monthly_trend?: { label: string; month: string; count: number }[];
  trend_pct?: number;
  socio_economic_chart: { data: { name: string; value: number | null }[]; disclaimer: string };
  hotspots: { lat: number; lng: number; label: string; point_count?: number }[];
  crime_type_distribution: { name: string; value: number }[];
  case_outcomes: { name: string; value: number }[];
  police_presence: { employee_headcount: number; station_count: number };
  most_wanted: { suspect: string; case_count: number } | null;
  recent_cases: { crime_no: string; registered_date: string; brief_facts: string }[];
}

// One row in the district's station picker (PS-1's "and specific police
// stations" drill-down, one level below the district grid).
interface StationRow {
  unit_id: number;
  unit_name: string;
  case_count: number;
}

// Per-category momentum vs its own historical baseline — powers the "Emerging
// Spike Alerts" panel (red-zone pulsing when a category spikes vs its average).
interface SpikeRow {
  category: string;
  recent: number;
  baseline: number;
  change_pct: number;
  severity: "high" | "medium" | "low";
}

// Statistical outliers surfaced as auditable callouts (baseline/delta carried in
// `detail`) — powers the "Anomaly Callouts" panel.
interface AnomalyRow {
  label: string;
  detail: string;
  metric: string;
  z_score: number;
}

// A cluster of accused sharing a phone or vehicle (AccusedContact demo
// enrichment) within one district — the "hidden link" syndicate signal,
// distinct from case co-offense. Always shown with its synthetic-data
// disclaimer; never presented as verified fact.
interface SyndicateGroup {
  members: string[];
  hub: string;
  hub_links: number;
  shared_kinds: string[];
}

// Fixed SVG coordinate space the map is drawn into (see MAP_PROJECTION
// below) -- the <svg> itself scales responsively via viewBox, this is just
// the internal unit space the projection targets.
const MAP_WIDTH = 780;
const MAP_HEIGHT = 760;

// karnataka-districts.json (public-domain district boundaries, 2011 census
// administrative units -- see civictech-India/udit-001 GeoJSON datasets)
// spells 4 district names differently than this project's own District
// table does. Real district shapes can't come from this project's own data
// (District only has DistrictID/DistrictName/StateID, no polygon geometry
// anywhere in the schema), so this map is external public geographic data,
// merged against live case counts by name -- never fabricated data of our
// own. Verified against a live /api/dashboard/districts/summary pull: only
// these 4 of 30 names differ; everything else matches exactly.
const GEOJSON_TO_DB_NAME: Record<string, string> = {
  "Bagalkote": "Bagalkot",
  "Chamarajanagara": "Chamarajanagar",
  "Chikkaballapura": "Chikkaballapur",
  "Shivamogga": "Shimoga",
};

function formatSummaryRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const PIE_COLORS = ["#C79A4E", "#5DCAA5", "#9085e9", "#e66767", "#3987e5", "#F59E0B", "#77a6e0", "#c98fd6"];
const OUTCOME_COLORS: Record<string, string> = { Solved: "#5DCAA5", Unsolved: "#E24B4A", Unclassified: "#77746e" };

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
  sub,
}) => (
  <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/25 flex items-center justify-center shrink-0">
      <Icon className="w-4.5 h-4.5 text-[#C79A4E]" />
    </div>
    <div className="min-w-0">
      <div className="text-lg font-black text-stone-100 font-mono truncate leading-tight">{value}</div>
      <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide truncate">{label}</div>
      {sub && <div className="text-[9.5px] text-stone-600 truncate">{sub}</div>}
    </div>
  </div>
);

export const DistrictDashboardScreen: React.FC = () => {
  const { lang, addToast } = useApp();
  const [rows, setRows] = useState<DistrictSummaryRow[]>([]);
  const [specialUnits, setSpecialUnits] = useState<SpecialUnitRow[]>([]);
  const [orphanedCases, setOrphanedCases] = useState(0);
  const [summaryComputedAt, setSummaryComputedAt] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [stateOv, setStateOv] = useState<{ total_incidents: number; monthly_trend: { label: string; count: number }[]; trend_pct: number; crime_mix: { name: string; value: number }[] } | null>(null);
  // F.17: Side-by-Side District/Time Comparison -- compareMode toggles a
  // second Spatial Analyst panel; compareDistrict picks which district it
  // shows (defaults to any other real district once the summary list
  // loads).
  //
  // Decoupled Dual-Map Viewport Lifecycle (Finals-part 3.md Section 23-27):
  // CONFIRMED LIVE GAP -- both panels were hard-wired to one shared
  // viewport unconditionally, exactly the bug the doc's own "Forensic
  // Diagnosis of Viewport Duplication" section (23) described, not its fix.
  // Two independent panels showing two DIFFERENT districts side by side
  // makes far more sense panned/zoomed independently by default (Belagavi
  // and Kalaburagi are nowhere near each other on the map) -- linking is
  // now an explicit opt-in via syncViewports, for the specific case an
  // officer genuinely wants to inspect the exact same geographic area
  // across two districts/time windows (Loophole L1's original concern,
  // now solved by making it optional instead of forced).
  const [compareMode, setCompareMode] = useState(false);
  const [compareDistrict, setCompareDistrict] = useState<string>("");
  const [syncViewports, setSyncViewports] = useState(false);
  const [primaryViewport, setPrimaryViewport] = useState<{ center: [number, number]; zoom: number }>({ center: [14.5, 75.7], zoom: 7 });
  const [secondaryViewport, setSecondaryViewport] = useState<{ center: [number, number]; zoom: number }>({ center: [14.5, 75.7], zoom: 7 });
  // When linked, moving either panel updates both; when independent, each
  // setter only ever touches its own panel's state.
  const handlePrimaryViewportChange = (vp: { center: [number, number]; zoom: number }) => {
    setPrimaryViewport(vp);
    if (syncViewports) setSecondaryViewport(vp);
  };
  const handleSecondaryViewportChange = (vp: { center: [number, number]; zoom: number }) => {
    setSecondaryViewport(vp);
    if (syncViewports) setPrimaryViewport(vp);
  };
  // Cross-Tab Crime-Category Filter Sync (Finals-part 3.md Section 85/87,
  // CONFIRMED LIVE GAP closed): lifted here so it persists across the
  // Spatial/Case Registry tabs (Demographic's own chart is already
  // per-crime-category by design, so it's not a filter target). Empty
  // string means "all crime types" (existing behavior, unchanged).
  const [crimeCategoryFilter, setCrimeCategoryFilter] = useState<string>("");
  // Finals-part 3.md §25 (L225): real per-panel incident/cluster counts
  // reported by each DistrictSpatialAnalystPanel via onStatsChange, fed
  // into ComparisonDeltaHUD above the two maps.
  const [primaryStats, setPrimaryStats] = useState<{ incidents: number; clusters: number } | null>(null);
  const [secondaryStats, setSecondaryStats] = useState<{ incidents: number; clusters: number } | null>(null);
  // Finals-part 3.md L222: explicit layout toggle for Compare mode --
  // "side-by-side" relies on the xl: breakpoint alone, which collapses to
  // a single column on laptops/tablets (<1280px) with no way to force it
  // back; "stacked" is an explicit, deliberate choice for a narrower window.
  const [compareLayout, setCompareLayout] = useState<"side-by-side" | "stacked">("side-by-side");
  const [stateNews, setStateNews] = useState<{ title: string; source: string; url: string }[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // Open-Source Signals lane (live news) — kept in its OWN state and rendered
  // in a visually separate band, never merged with the official CCTNS `detail`
  // above. Dormant (configured=false) until a news key is set in .env.
  const [signals, setSignals] = useState<{ configured: boolean; items: Array<{ title: string; source: string; published: string; url: string; snippet: string }>; note?: string } | null>(null);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  // Emerging Spike Alerts + Anomaly Callouts — official-analytics side-panels,
  // fetched per selected district. Best-effort like the rest of `detail`; a
  // slow/failed analytics call must never blank the charts. null = still loading.
  const [spikes, setSpikes] = useState<SpikeRow[] | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[] | null>(null);
  const [syndicateGroups, setSyndicateGroups] = useState<SyndicateGroup[] | null>(null);
  const [syndicateDisclaimer, setSyndicateDisclaimer] = useState("");
  const drilldownRef = useRef<HTMLDivElement | null>(null);

  // Station-level drill-down (one level below the district grid). `detail`
  // above always holds whatever is CURRENTLY on screen (district OR station);
  // `districtDetailCache` separately keeps the last-loaded district-level
  // detail so "back to district" is instant, no refetch.
  const [stations, setStations] = useState<StationRow[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [isLoadingStationDetail, setIsLoadingStationDetail] = useState(false);
  // Section 121: modal station picker replaces the old inline pill cloud.
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [districtDetailCache, setDistrictDetailCache] = useState<DistrictDetail | null>(null);

  // Inter-district access air-lock (Part C item #7): a district/station
  // outside the officer's home district returns 403 {gated:true,...} instead
  // of data. gatedInfo holds that state; requestId/requestStatus track the
  // officer's own access-request lifecycle (pending -> approved/rejected).
  // Part G (district redesign): folds the standalone Spatial Analyst and
  // Demographic Correlation screens INTO the per-district detail view, tab-
  // scoped to whichever district/station is currently selected -- instead
  // of an officer navigating away and having to re-establish which district
  // they meant on a disconnected page.
  const [detailTab, setDetailTab] = useState<"overview" | "spatial" | "demographic" | "fir">("overview");
  const [gatedInfo, setGatedInfo] = useState<{ districtId: number; message: string } | null>(null);
  const [accessRequestId, setAccessRequestId] = useState<string | null>(null);
  const [accessRequestStatus, setAccessRequestStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [isEmergencyRequesting, setIsEmergencyRequesting] = useState(false);
  const accessPollRef = useRef<number | null>(null);

  const stopAccessPoll = () => {
    if (accessPollRef.current) { window.clearInterval(accessPollRef.current); accessPollRef.current = null; }
  };

  // Section 18: Real-Time District Emergency Access Grant tracking & 3s Security Heartbeat
  const [activeEmergencyGrant, setActiveEmergencyGrant] = useState<{
    requestId: string;
    districtId: number;
    expiresAt?: string;
  } | null>(null);
  const [isRevokedModalOpen, setIsRevokedModalOpen] = useState(false);
  const [homeDistrictId, setHomeDistrictId] = useState<number | null>(null);
  const grantHeartbeatRef = useRef<number | null>(null);

  const stopGrantHeartbeat = () => {
    if (grantHeartbeatRef.current) {
      window.clearInterval(grantHeartbeatRef.current);
      grantHeartbeatRef.current = null;
    }
  };

  useEffect(() => () => stopGrantHeartbeat(), []);

  const terminateEmergencySession = (_reason?: string) => {
    stopGrantHeartbeat();
    setActiveEmergencyGrant(null);

    // Wipe all sensitive non-home district intelligence from memory immediately
    setDetail(null);
    setDistrictDetailCache(null);
    setStations([]);
    setSelectedStationId(null);
    setSpikes(null);
    setAnomalies(null);
    setSyndicateGroups(null);
    setSignals(null);
    setGatedInfo(null);
    setAccessRequestStatus("rejected");

    // Activate un-dismissible lockdown overlay
    setIsRevokedModalOpen(true);
    addToast(
      lang === "en" ? "Access Terminated" : "ಪ್ರವೇಶ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ",
      lang === "en" ? "Emergency access has been immediately revoked by your supervisor under Section 185 BNSS." : "ಮೇಲ್ವಿಚಾರಕರು ಕಲಂ 185 BNSS ಅಡಿಯಲ್ಲಿ ನಿಮ್ಮ ತುರ್ತು ಪ್ರವೇಶವನ್ನು ತಕ್ಷಣವೇ ರದ್ದುಗೊಳಿಸಿದ್ದಾರೆ.",
      "Critical"
    );
  };

  const handleReturnHome = () => {
    setIsRevokedModalOpen(false);
    setActiveEmergencyGrant(null);
    setDetail(null);
    setDistrictDetailCache(null);
    setStations([]);
    setSelectedStationId(null);
    setSpikes(null);
    setAnomalies(null);
    setSyndicateGroups(null);
    setSignals(null);
    setGatedInfo(null);
    if (homeDistrictId) {
      handleSelectDistrict(homeDistrictId);
    } else {
      setSelectedId(null);
    }
  };

  const handleEmergencyAccessSuccess = (requestId: string, districtId: number, expiresAt?: string, retryFn?: () => void) => {
    setGatedInfo(null);
    setAccessRequestStatus("idle");
    setActiveEmergencyGrant({ requestId, districtId, expiresAt });
    if (retryFn) retryFn();

    stopGrantHeartbeat();
    grantHeartbeatRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/district-access/${requestId}/status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "revoked") {
            terminateEmergencySession("Supervisor revoked emergency access grant under Section 185 BNSS.");
          }
        } else if (res.status === 403 || res.status === 404) {
          terminateEmergencySession("Emergency access authorization has expired or was revoked.");
        }
      } catch {
        /* transient network blip -- next tick retries */
      }
    }, 3000); // 3-second rapid security heartbeat
  };

  // E.1: written justification collected before a cross-district request is
  // raised (D.8: the server enforces a real minimum length here too, not
  // just this modal).
  const [showDistrictReasonModal, setShowDistrictReasonModal] = useState(false);
  const [districtReasonRetryFn, setDistrictReasonRetryFn] = useState<(() => void) | null>(null);

  const requestDistrictAccess = async (retryFn: () => void, reason: string) => {
    if (!gatedInfo) return;
    setIsRequestingAccess(true);
    try {
      const res = await fetch(`${API_BASE}/api/district-access/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ district_id: gatedInfo.districtId, reason }),
      });
      if (!res.ok) throw new Error("request failed");
      const d = await res.json();
      setAccessRequestId(d.request_id);
      setAccessRequestStatus("pending");
      stopAccessPoll();
      accessPollRef.current = window.setInterval(async () => {
        try {
          const sres = await fetch(`${API_BASE}/api/district-access/${d.request_id}/status`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          });
          const sd = await sres.json();
          if (sd.status === "approved") {
            stopAccessPoll();
            setAccessRequestStatus("approved");
            setGatedInfo(null);
            handleEmergencyAccessSuccess(d.request_id, gatedInfo.districtId, sd.grant_expires_at, retryFn);
          } else if (sd.status === "rejected") {
            stopAccessPoll();
            setAccessRequestStatus("rejected");
          }
        } catch { /* transient -- next tick retries */ }
      }, 5000);
    } catch {
      addToast(
        lang === "en" ? "Request Failed" : "ವಿನಂತಿ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not submit the access request." : "ಪ್ರವೇಶ ವಿನಂತಿ ಸಲ್ಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Warning"
      );
    } finally {
      setIsRequestingAccess(false);
    }
  };

  // Break-glass emergency override (Section 185 BNSS emergency-entry
  // principle): grants immediate, self-approved, short-lived access when a
  // genuine emergency can't wait for a supervisor to be online. Mandatory
  // justification, logged to audit, surfaced for supervisor post-hoc review
  // -- never a silent bypass.
  const requestEmergencyAccess = async (retryFn: () => void) => {
    if (!gatedInfo) return;
    const reason = window.prompt(
      lang === "en"
        ? "Emergency access is logged and reviewed by a supervisor afterwards. State why this cannot wait for approval:"
        : "ತುರ್ತು ಪ್ರವೇಶವನ್ನು ದಾಖಲಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ನಂತರ ಮೇಲ್ವಿಚಾರಕರು ಪರಿಶೀಲಿಸುತ್ತಾರೆ. ಇದು ಅನುಮೋದನೆಗಾಗಿ ಏಕೆ ಕಾಯಲು ಸಾಧ್ಯವಿಲ್ಲ ಎಂಬುದನ್ನು ತಿಳಿಸಿ:"
    );
    if (!reason || !reason.trim()) return;
    const trimmedReason = reason.trim();
    // Section 185 BNSS spec: a real, specific statutory justification, not
    // a placeholder like "urgent" -- the server enforces this too, but
    // catching it here means the officer sees why immediately instead of
    // discovering it only after the request round-trip fails.
    if (trimmedReason.length < 30) {
      addToast(
        lang === "en" ? "Justification Too Short" : "ಕಾರಣ ಚಿಕ್ಕದಾಗಿದೆ",
        lang === "en"
          ? "State a specific reason (at least 30 characters) for why this cannot wait for supervisor approval."
          : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಏಕೆ ಕಾಯಲು ಸಾಧ್ಯವಿಲ್ಲ ಎಂಬುದಕ್ಕೆ ನಿರ್ದಿಷ್ಟ ಕಾರಣವನ್ನು (ಕನಿಷ್ಠ 30 ಅಕ್ಷರಗಳು) ತಿಳಿಸಿ.",
        "Warning"
      );
      return;
    }
    setIsEmergencyRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/district-access/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ district_id: gatedInfo.districtId, reason: trimmedReason }),
      });
      if (!res.ok) throw new Error("emergency request failed");
      const d = await res.json();
      setGatedInfo(null);
      setAccessRequestStatus("idle");
      handleEmergencyAccessSuccess(d.request_id, gatedInfo.districtId, d.grant_expires_at, retryFn);
      addToast(
        lang === "en" ? "Emergency Access Granted" : "ತುರ್ತು ಪ್ರವೇಶ ನೀಡಲಾಗಿದೆ",
        lang === "en" ? "This is logged and will be reviewed by a supervisor." : "ಇದನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ ಮತ್ತು ಮೇಲ್ವಿಚಾರಕರು ಪರಿಶೀಲಿಸುತ್ತಾರೆ.",
        "Warning"
      );
    } catch {
      addToast(
        lang === "en" ? "Request Failed" : "ವಿನಂತಿ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not grant emergency access." : "ತುರ್ತು ಪ್ರವೇಶ ನೀಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsEmergencyRequesting(false);
    }
  };

  useEffect(() => () => stopAccessPoll(), []);

  // Plain SVG <path> elements per district (not a Leaflet layer), so hover/
  // select highlighting is just normal React state + re-render -- cheap for
  // 30 paths, no imperative layer manipulation needed.
  const districtPaths = useMemo(() => {
    const projection = geoMercator().fitSize(
      [MAP_WIDTH, MAP_HEIGHT],
      karnatakaDistrictsGeo as any
    );
    const pathGenerator = geoPath(projection);
    return (karnatakaDistrictsGeo as any).features.map((feature: Feature<Geometry>) => {
      const geoName = (feature.properties as any).district as string;
      const dbName = GEOJSON_TO_DB_NAME[geoName] || geoName;
      return {
        dbName,
        d: pathGenerator(feature) || "",
        centroid: pathGenerator.centroid(feature),
      };
    });
  }, []);

  // Served from a validated backend snapshot cache (near-instant) -- see
  // /api/dashboard/districts/summary in vajra_backend/main.py. Fetched
  // once per load, plus on window focus, exactly as before; the Refresh
  // button below (handleRefreshSummary) is now the only thing that
  // triggers the real live recomputation.
  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/summary`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load district summary.");
      const data = await res.json();
      setRows(data.districts || []);
      setSpecialUnits(data.special_units || []);
      setOrphanedCases(typeof data.orphaned_cases === "number" ? data.orphaned_cases : 0);
      setSummaryComputedAt(data.computed_at || null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "District summary unreachable.");
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // Runs the real live recomputation, validated before it's allowed to
  // overwrite the served snapshot. Rejections (cooldown or a failed
  // validation check) keep whatever's currently on screen and surface the
  // reason via toast -- the officer never sees a blank/partial map.
  const handleRefreshSummary = useCallback(async () => {
    setIsRefreshingSummary(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/summary/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === "rejected") {
        addToast(
          lang === "en" ? "Refresh Not Applied" : "ರಿಫ್ರೆಶ್ ಅನ್ವಯಿಸಲಾಗಿಲ್ಲ",
          data.reason || (lang === "en" ? "Previous data retained." : "ಹಿಂದಿನ ಡೇಟಾ ಉಳಿಸಿಕೊಳ್ಳಲಾಗಿದೆ."),
          "Warning"
        );
        return;
      }
      await fetchSummary();
    } catch (err: any) {
      addToast(
        lang === "en" ? "Refresh Failed" : "ರಿಫ್ರೆಶ್ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not reach the server." : "ಸರ್ವರ್ ತಲುಪಲಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    } finally {
      setIsRefreshingSummary(false);
    }
  }, [fetchSummary, lang, addToast]);

  useEffect(() => {
    fetchSummary();
    // State-level detail for the Direction-3 dashboard cards (trend, crime mix,
    // live news) -- fetched once on load, best-effort.
    const H = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    fetch(`${API_BASE}/api/dashboard/state-overview`, { headers: H })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setStateOv(d)).catch(() => {});
    fetch(`${API_BASE}/api/intelligence/district-signals?district=Karnataka`, { headers: H })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d?.items && setStateNews(d.items.slice(0, 3))).catch(() => {});
    const onFocus = () => fetchSummary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSummary]);

  // Real gap this closed: clicking a district worked, but clicking that
  // SAME district again did nothing visible -- handleSelectDistrict just
  // re-fetched identical data, so there was no way to back out to the
  // statewide view except a full page refresh. Clicking an
  // already-selected district now toggles it OFF instead.
  const handleToggleDistrict = (districtId: number) => {
    if (selectedId === districtId) {
      setSelectedId(null);
      setDetail(null);
      setDistrictDetailCache(null);
      setSelectedStationId(null);
      setStations([]);
      setGatedInfo(null);
      setAccessRequestId(null);
      setAccessRequestStatus("idle");
      stopAccessPoll();
      setDetailTab("overview");
    } else {
      handleSelectDistrict(districtId);
    }
  };

  const handleSelectDistrict = async (districtId: number) => {
    setSelectedId(districtId);
    setDetailTab("overview"); // a newly-picked district always opens on Overview, never a stale tab from the previous one
    setIsLoadingDetail(true);
    setDetail(null);
    setDistrictDetailCache(null);
    setSelectedStationId(null);
    setStations([]);
    setGatedInfo(null);
    setAccessRequestId(null);
    setAccessRequestStatus("idle");
    stopAccessPoll();
    if (activeEmergencyGrant && activeEmergencyGrant.districtId !== districtId) {
      stopGrantHeartbeat();
      setActiveEmergencyGrant(null);
    }
    setIsLoadingStations(true);
    fetch(`${API_BASE}/api/dashboard/districts/${districtId}/stations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStations(Array.isArray(d?.stations) ? d.stations : []))
      .catch(() => setStations([]))
      .finally(() => setIsLoadingStations(false));
    // Scroll to the drill-down panel right away rather than waiting on the
    // fetch -- the loading shimmer is itself the feedback that a district
    // was selected, so there's no reason to make the officer wait for data
    // before the page even moves.
    requestAnimationFrame(() => {
      drilldownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Fetch the Open-Source Signals lane in PARALLEL and independently — a slow
    // or dormant news provider must never delay or fail the official charts.
    setSignals(null);
    setIsLoadingSignals(true);
    fetch(`${API_BASE}/api/intelligence/district-signals?district_id=${districtId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSignals(s))
      .catch(() => setSignals(null))
      .finally(() => setIsLoadingSignals(false));
    // Emerging Spike Alerts + Anomaly Callouts — fetched in PARALLEL and
    // best-effort, keyed on the same selected district id. Empty/failed → calm
    // empty state, never a thrown error that could disturb the charts.
    const analyticsHeaders = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    setSpikes(null);
    fetch(`${API_BASE}/api/analytics/spikes?district_id=${districtId}`, { headers: analyticsHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSpikes(Array.isArray(d?.spikes) ? d.spikes : []))
      .catch(() => setSpikes([]));
    setAnomalies(null);
    fetch(`${API_BASE}/api/analytics/anomalies?district_id=${districtId}`, { headers: analyticsHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAnomalies(Array.isArray(d?.anomalies) ? d.anomalies : []))
      .catch(() => setAnomalies([]));
    setSyndicateGroups(null);
    fetch(`${API_BASE}/api/analytics/syndicate?district_id=${districtId}`, { headers: analyticsHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setSyndicateGroups(Array.isArray(d?.groups) ? d.groups : []);
        setSyndicateDisclaimer(d?.disclaimer || "");
      })
      .catch(() => setSyndicateGroups([]));
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/${districtId}/detail`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        const info = body?.detail;
        if (info?.revoked) {
          terminateEmergencySession("Supervisor revoked emergency access grant under Section 185 BNSS.");
          return;
        }
        if (info?.gated) {
          if (info.home_district_id) {
            setHomeDistrictId(info.home_district_id);
          }
          setGatedInfo({ districtId: info.target_district_id ?? districtId, message: info.message || "" });
          return;
        }
      }
      if (!res.ok) throw new Error("Failed to load district detail.");
      const d = await res.json();
      setDetail(d);
      setDistrictDetailCache(d);
    } catch (err: any) {
      console.error(err);
      addToast(
        lang === "en" ? "District Detail Failed" : "ಜಿಲ್ಲಾ ವಿವರ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not load this district's chart data." : "ಈ ಜಿಲ್ಲೆಯ ಚಾರ್ಟ್ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Station drill-down: one level below the district grid (PS-1's "and
  // specific police stations" ask). Reuses the exact same panel-rendering
  // JSX as the district detail below -- the station detail endpoint returns
  // the identical panel shape, just scoped to one station.
  const handleSelectStation = async (unitId: number) => {
    setSelectedStationId(unitId);
    setDetailTab("overview");
    setIsLoadingStationDetail(true);
    setGatedInfo(null);
    setAccessRequestId(null);
    setAccessRequestStatus("idle");
    stopAccessPoll();
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stations/${unitId}/detail`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        const info = body?.detail;
        if (info?.revoked) {
          terminateEmergencySession("Supervisor revoked emergency access grant under Section 185 BNSS.");
          return;
        }
        if (info?.gated) {
          if (info.home_district_id) {
            setHomeDistrictId(info.home_district_id);
          }
          setGatedInfo({ districtId: info.target_district_id, message: info.message || "" });
          return;
        }
      }
      if (!res.ok) throw new Error("Failed to load station detail.");
      setDetail(await res.json());
    } catch (err: any) {
      console.error(err);
      addToast(
        lang === "en" ? "Station Detail Failed" : "ಠಾಣಾ ವಿವರ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not load this station's chart data." : "ಈ ಠಾಣೆಯ ಚಾರ್ಟ್ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
      setSelectedStationId(null);
    } finally {
      setIsLoadingStationDetail(false);
    }
  };

  const handleBackToDistrict = () => {
    setSelectedStationId(null);
    setDetail(districtDetailCache);
    setDetailTab("overview");
  };

  const maxCases = Math.max(1, ...rows.map((r) => r.active_cases));
  const hovered = rows.find((r) => r.district_id === hoveredId);

  const totalActiveCases = useMemo(() => rows.reduce((sum, r) => sum + r.active_cases, 0), [rows]);
  const flaggedSuspectCount = useMemo(() => rows.filter((r) => r.most_wanted).length, [rows]);
  const topDistrict = rows.length ? [...rows].sort((a, b) => b.active_cases - a.active_cases)[0] : null;
  // Section 109/112: `rows` alone is only the 30 districts with a map
  // polygon -- Vijayanagara (real district, created 2021, no polygon yet)
  // is deliberately bucketed into specialUnits (reason: "unmapped_district")
  // rather than dropped, so the true monitored-district count still needs
  // to add it back in. This is the real, data-derived 31 -- not a
  // hardcoded literal that would silently go stale if a jurisdiction
  // ever changes.
  const realDistrictCount = useMemo(
    () => rows.length + specialUnits.filter((u) => u.reason === "unmapped_district").length,
    [rows, specialUnits]
  );

  const crimeTypeTotal = detail ? detail.crime_type_distribution.reduce((s, d) => s + d.value, 0) : 0;
  const caseOutcomeTotal = detail ? detail.case_outcomes.reduce((s, d) => s + d.value, 0) : 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-[#C79A4E]" />
            <span>{lang === "en" ? "District Analytics Dashboard" : "ಜಿಲ್ಲಾ ವಿಶ್ಲೇಷಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್"}</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {lang === "en"
              ? "Overview map loads from a validated snapshot for speed -- click Refresh to recompute live. Drill into a district for socio-economic, hotspot, and outcome analytics -- those stay live queries."
              : "ವೇಗಕ್ಕಾಗಿ ಅವಲೋಕನ ನಕ್ಷೆ ಪರಿಶೀಲಿಸಿದ ಸ್ನ್ಯಾಪ್‌ಶಾಟ್‌ನಿಂದ ಲೋಡ್ ಆಗುತ್ತದೆ -- ಇತ್ತೀಚಿನದಕ್ಕಾಗಿ ರಿಫ್ರೆಶ್ ಕ್ಲಿಕ್ ಮಾಡಿ."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRefreshSummary}
            disabled={isLoadingSummary || isRefreshingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSummary ? "animate-spin" : ""}`} />
            <span>{lang === "en" ? "Refresh" : "ರಿಫ್ರೆಶ್"}</span>
          </button>
          {summaryComputedAt && (
            <span className="text-[10px] text-stone-600 font-mono">
              {lang === "en" ? "Last updated: " : "ಕೊನೆಯ ನವೀಕರಣ: "}
              {formatSummaryRelativeTime(summaryComputedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Part G (district redesign): fixed page-level tab bar -- Spatial
          Analyst and Demographic Correlation are no longer separate nav
          screens (see MainLayout.tsx), they live ONLY here. With no
          district picked yet, these two tabs show the full STATEWIDE
          picture (same real engines, just no district filter applied);
          the moment a district is clicked below, switching to either tab
          narrows automatically to that one district's own data -- the
          exact same `district`/`detail` selection state drives both. */}
      <div className="flex items-center gap-1.5 border-b border-stone-850 shrink-0 overflow-x-auto">
        {([
          { id: "overview" as const, label: lang === "en" ? "Overview" : "ಅವಲೋಕನ", Icon: LayoutGrid },
          { id: "spatial" as const, label: lang === "en" ? "Spatial Analyst" : "ಪ್ರಾದೇಶಿಕ ವಿಶ್ಲೇಷಣೆ", Icon: MapPin },
          { id: "demographic" as const, label: lang === "en" ? "Demographic Correlation" : "ಜನಸಂಖ್ಯಾ ಪರಸ್ಪರ ಸಂಬಂಧ", Icon: BarChart3 },
          { id: "fir" as const, label: lang === "en" ? "Case Registry" : "ಪ್ರಕರಣ ರಿಜಿಸ್ಟ್ರಿ", Icon: FolderOpen },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setDetailTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11.5px] font-black uppercase tracking-wider font-mono border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
              detailTab === t.id
                ? "border-[#C79A4E] text-[#C79A4E]"
                : "border-transparent text-stone-500 hover:text-stone-300"
            }`}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
            {t.id !== "overview" && (
              <span className="text-[9px] font-mono normal-case tracking-normal text-stone-600">
                {selectedId && districtDetailCache ? `· ${districtDetailCache.district}` : `· ${lang === "en" ? "Statewide" : "ರಾಜ್ಯವ್ಯಾಪಿ"}`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cross-Tab Crime-Category Filter Sync (Section 85/87): shared
          across Spatial + Case Registry (Demographic's own chart is
          already broken down by crime category, so it's not a filter
          target here) -- persists when switching tabs, unlike the old
          "no filter exists anywhere" state. Options are the REAL crime
          categories present in whatever's currently on screen (district
          detail if one's selected, statewide mix otherwise), never a
          guessed/hardcoded list. */}
      {(detailTab === "spatial" || detailTab === "fir") && (() => {
        const realCategories = (
          (selectedId && districtDetailCache ? detail?.crime_type_distribution : stateOv?.crime_mix) || []
        )
          .map((c) => c.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        return (
          <div className="flex items-center gap-2 px-1 shrink-0">
            <span className="text-[9.5px] font-mono font-bold text-stone-500 uppercase tracking-wide">
              {lang === "en" ? "Crime Category" : "ಅಪರಾಧ ವರ್ಗ"}
            </span>
            <select
              value={crimeCategoryFilter}
              onChange={(e) => setCrimeCategoryFilter(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded-md text-[10.5px] font-mono font-bold text-stone-300 px-2 py-1.5 cursor-pointer"
            >
              <option value="">{lang === "en" ? "All Categories" : "ಎಲ್ಲಾ ವರ್ಗಗಳು"}</option>
              {realCategories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {crimeCategoryFilter && (
              <button
                onClick={() => setCrimeCategoryFilter("")}
                className="text-[9.5px] font-mono text-stone-500 hover:text-stone-300 underline cursor-pointer"
              >
                {lang === "en" ? "Clear" : "ತೆರವುಗೊಳಿಸಿ"}
              </button>
            )}
          </div>
        );
      })()}

      {detailTab === "spatial" && (
        <div className="glass-card p-4 border border-stone-850">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C79A4E]" />
              {selectedId && districtDetailCache ? districtDetailCache.district : (lang === "en" ? "Statewide — All Districts" : "ರಾಜ್ಯವ್ಯಾಪಿ — ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು")}
              {" — "}{lang === "en" ? "Spatial Hotspot Analysis" : "ಪ್ರಾದೇಶಿಕ ಹಾಟ್‌ಸ್ಪಾಟ್ ವಿಶ್ಲೇಷಣೆ"}
            </h3>
            {/* F.17: Side-by-Side District/Time Comparison toggle */}
            <button
              onClick={() => {
                setCompareMode((v) => !v);
                if (!compareDistrict) {
                  const currentName = selectedId && districtDetailCache ? districtDetailCache.district : "";
                  const other = rows.find((r) => r.district !== currentName)?.district || "";
                  setCompareDistrict(other);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer border ${compareMode ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E]" : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300"}`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              {lang === "en" ? "Compare" : "ಹೋಲಿಸಿ"}
            </button>
          </div>

          {compareMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2">
                {/* L222: explicit layout toggle -- the xl: breakpoint alone
                    collapses to one column on laptops/tablets (<1280px)
                    with no way to force it back to side-by-side, or to
                    deliberately stack on a wider screen. */}
                <div className="flex rounded-md border border-stone-800 bg-stone-900 p-0.5 gap-0.5">
                  <button
                    onClick={() => setCompareLayout("side-by-side")}
                    title={lang === "en" ? "Side-by-Side" : "ಅಕ್ಕಪಕ್ಕ"}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                      compareLayout === "side-by-side" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    <Columns2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setCompareLayout("stacked")}
                    title={lang === "en" ? "Stacked" : "ಪೇರಿಸಿ"}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                      compareLayout === "stacked" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    <Rows2 className="w-3 h-3" />
                  </button>
                </div>
                {/* Section 23-27: explicit opt-in viewport link -- independent
                    by default, so panning/zooming Belagavi doesn't drag
                    Kalaburagi's map along with it. */}
                <button
                  onClick={() => {
                    const next = !syncViewports;
                    setSyncViewports(next);
                    if (next) setSecondaryViewport(primaryViewport);
                  }}
                  title={lang === "en" ? "Link viewports (pan/zoom together)" : "ವೀಕ್ಷಣೆಗಳನ್ನು ಲಿಂಕ್ ಮಾಡಿ"}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide transition-colors cursor-pointer border ${
                    syncViewports ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E]" : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {syncViewports ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                  {syncViewports ? (lang === "en" ? "Linked" : "ಲಿಂಕ್ ಮಾಡಲಾಗಿದೆ") : (lang === "en" ? "Independent" : "ಸ್ವತಂತ್ರ")}
                </button>
                <select
                  value={compareDistrict}
                  onChange={(e) => setCompareDistrict(e.target.value)}
                  className="bg-stone-900 border border-stone-800 rounded-md text-[10.5px] font-mono font-bold text-stone-300 px-2 py-1.5 cursor-pointer"
                >
                  {rows.map((r) => (
                    <option key={r.district_id} value={r.district}>{r.district}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const primaryLabel = selectedId && districtDetailCache ? districtDetailCache.district : (lang === "en" ? "Statewide" : "ರಾಜ್ಯವ್ಯಾಪಿ");
                // L217: comparing a district against itself gives a
                // meaningless (identical) comparison -- nudge toward a
                // genuine differential instead of silently showing two
                // copies of the same map.
                const isSameDistrict = !!compareDistrict && compareDistrict === primaryLabel;
                return (
                  <>
                    {isSameDistrict && (
                      <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10.5px] text-amber-300/90 font-mono">
                        {lang === "en"
                          ? "Comparing this district against itself won't show anything new -- pick a different district on the right, or use the day-of-week filter on one side for a genuine temporal comparison."
                          : "ಒಂದೇ ಜಿಲ್ಲೆಯನ್ನು ಹೋಲಿಸುವುದರಿಂದ ಹೊಸದೇನೂ ಕಾಣುವುದಿಲ್ಲ -- ಬಲಭಾಗದಲ್ಲಿ ಬೇರೆ ಜಿಲ್ಲೆಯನ್ನು ಆರಿಸಿ."}
                      </div>
                    )}
                    <ComparisonDeltaHUD
                      primary={primaryStats ? { label: primaryLabel, ...primaryStats } : null}
                      secondary={secondaryStats && compareDistrict ? { label: compareDistrict, ...secondaryStats } : null}
                      lang={lang}
                    />
                  </>
                );
              })()}
              <div className={`grid gap-4 ${compareLayout === "stacked" ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"}`}>
                <div>
                  <p className="text-[10px] font-mono font-bold text-stone-500 uppercase mb-1.5">
                    {selectedId && districtDetailCache ? districtDetailCache.district : (lang === "en" ? "Statewide" : "ರಾಜ್ಯವ್ಯಾಪಿ")}
                  </p>
                  <DistrictSpatialAnalystPanel
                    district={selectedId && districtDetailCache ? districtDetailCache.district : ""}
                    sharedViewport={primaryViewport}
                    onViewportChange={handlePrimaryViewportChange}
                    onStatsChange={setPrimaryStats}
                    crimeGroup={crimeCategoryFilter}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <p className="text-[10px] font-mono font-bold text-stone-500 uppercase">{compareDistrict || "—"}</p>
                    {/* L229: Section 185 BNSS territorial-jurisdiction
                        disclosure on the comparative/secondary panel --
                        real statute, same one already cited in Settings'
                        Two-Person Integrity policy card. */}
                    {compareDistrict && (
                      <span className="text-[8.5px] font-mono font-bold uppercase tracking-wide text-stone-500 bg-stone-950/60 border border-stone-800 rounded px-1.5 py-0.5">
                        {lang === "en"
                          ? "Comparative Intel • §185 BNSS Clearance • Read-Only, Audit Logged"
                          : "ತುಲನಾತ್ಮಕ • §185 BNSS • ಓದಲು-ಮಾತ್ರ"}
                      </span>
                    )}
                  </div>
                  {compareDistrict && (
                    <DistrictSpatialAnalystPanel
                      key={compareDistrict}
                      district={compareDistrict}
                      sharedViewport={secondaryViewport}
                      onViewportChange={handleSecondaryViewportChange}
                      onStatsChange={setSecondaryStats}
                      crimeGroup={crimeCategoryFilter}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <DistrictSpatialAnalystPanel key={selectedId && districtDetailCache ? districtDetailCache.district : "__statewide__"} district={selectedId && districtDetailCache ? districtDetailCache.district : ""} crimeGroup={crimeCategoryFilter} />
          )}
        </div>
      )}

      {detailTab === "demographic" && (
        <DistrictDemographicPanel
          key={selectedId && districtDetailCache ? districtDetailCache.district : "__statewide__"}
          district={selectedId && districtDetailCache ? districtDetailCache.district : null}
          socioChart={selectedId && districtDetailCache ? districtDetailCache.socio_economic_chart : null}
        />
      )}

      {/* FIR fold-in (Part G): retired "FIR Repository" as a standalone nav
          screen, same statewide-first/district-scoped pattern as Spatial/
          Demographic above. */}
      {detailTab === "fir" && (
        <DistrictFIRPanel
          key={selectedId && districtDetailCache ? districtDetailCache.district : "__statewide__"}
          district={selectedId && districtDetailCache ? districtDetailCache.district : null}
          crimeGroup={crimeCategoryFilter}
        />
      )}

      {detailTab === "overview" && (
      <>
      {errorMsg ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-stone-950/40 rounded-2xl border border-rose-500/10 space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <p className="text-xs text-stone-500">{errorMsg}</p>
        </div>
      ) : (
        <>
          {/* Statewide telemetry strip -- quick-read totals derived from the
              same live rows the heat grid renders, so it never diverges. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <StatCard
              icon={ShieldAlert}
              value={isLoadingSummary ? "—" : totalActiveCases.toLocaleString()}
              label={lang === "en" ? "Total Active Cases" : "ಒಟ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು"}
            />
            <StatCard
              icon={Layers}
              value={isLoadingSummary ? "—" : realDistrictCount}
              sub={orphanedCases > 0 ? `${orphanedCases} ${lang === "en" ? "orphaned cases" : "ಅನಾಥ ಪ್ರಕರಣಗಳು"}` : undefined}
              label={lang === "en" ? "Districts Monitored" : "ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿದ ಜಿಲ್ಲೆಗಳು"}
            />
            <StatCard
              icon={Flame}
              value={isLoadingSummary || !topDistrict ? "—" : topDistrict.district}
              sub={topDistrict ? `${topDistrict.active_cases} ${lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}` : undefined}
              label={lang === "en" ? "Highest Load" : "ಅತಿ ಹೆಚ್ಚು ಹೊರೆ"}
            />
            <StatCard
              icon={Users}
              value={isLoadingSummary ? "—" : flaggedSuspectCount}
              label={lang === "en" ? "Districts w/ Most-Wanted" : "ಅತಿ ಬೇಕಾದ ಜಿಲ್ಲೆಗಳು"}
            />
          </div>

          {/* Direction-3 state detail cards: 12-month trend · crime mix · live news */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="glass-card p-4 border border-stone-850">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[10px] font-black text-stone-300 uppercase tracking-wider font-mono">{lang === "en" ? "State · 12-Month Trend" : "ರಾಜ್ಯ · 12-ತಿಂಗಳ ಪ್ರವೃತ್ತಿ"}</h3>
                {stateOv && <span className={`text-[10px] font-mono font-bold ${stateOv.trend_pct > 3 ? "text-rose-400" : stateOv.trend_pct < -3 ? "text-[#5DCAA5]" : "text-stone-400"}`}>{stateOv.trend_pct >= 0 ? "+" : ""}{stateOv.trend_pct}%</span>}
              </div>
              <div className="h-28">
                {stateOv?.monthly_trend?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stateOv.monthly_trend} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                      <defs><linearGradient id="stFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C79A4E" stopOpacity={0.35} /><stop offset="100%" stopColor="#C79A4E" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="label" tick={{ fontSize: 8, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8, fill: "#94A3B8" }} tickLine={false} axisLine={false} width={26} />
                      <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="count" stroke="#C79A4E" strokeWidth={2} fill="url(#stFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-full shimmer-bg rounded-lg" />}
              </div>
            </div>
            <div className="glass-card p-4 border border-stone-850">
              <h3 className="text-[10px] font-black text-stone-300 uppercase tracking-wider font-mono mb-2">{lang === "en" ? "State · Crime Mix" : "ರಾಜ್ಯ · ಅಪರಾಧ ಮಿಶ್ರಣ"}</h3>
              {stateOv?.crime_mix?.length ? (() => {
                const mx = Math.max(...stateOv.crime_mix.map((c) => c.value), 1);
                return (
                  <div className="space-y-1.5">
                    {stateOv.crime_mix.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400 w-24 truncate" title={c.name}>{c.name}</span>
                        <div className="flex-1 h-3 bg-stone-900/60 rounded overflow-hidden"><div className="h-full rounded bg-[#C79A4E]" style={{ width: `${Math.max(6, (c.value / mx) * 100)}%`, opacity: 0.6 }} /></div>
                        <span className="text-[9px] font-mono text-stone-500 w-10 text-right tabular-nums">{c.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              })() : <div className="h-28 shimmer-bg rounded-lg" />}
            </div>
            <div className="glass-card p-4 border border-[#C79A4E]/25 bg-[#C79A4E]/[0.04]">
              <h3 className="text-[10px] font-black text-[#E4C590] uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C79A4E] animate-pulse" />{lang === "en" ? "Live Signals · Karnataka" : "ನೇರ ಸಂಕೇತಗಳು · ಕರ್ನಾಟಕ"}</h3>
              {stateNews.length ? (
                <div className="space-y-1.5">
                  {stateNews.map((n, i) => (
                    <a key={i} href={n.url || undefined} target="_blank" rel="noopener noreferrer" className="block text-[11.5px] text-stone-300 hover:text-[#E4C590] leading-snug line-clamp-2">{n.title} <span className="text-[8.5px] font-mono text-[#C79A4E]/70">↗ {n.source}</span></a>
                  ))}
                </div>
              ) : <div className="text-[10px] text-stone-500 font-mono py-2">{lang === "en" ? "Loading live signals…" : "ನೇರ ಸಂಕೇತಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…"}</div>}
            </div>
          </div>

          {/* Standalone Karnataka cutout map -- no basemap/tiles at all, just
              the state's own district polygons rendered as plain SVG paths
              (d3-geo computes the projection + path geometry; nothing here
              is a Leaflet layer). Districts ARE the interactive surface now
              -- the old grid is gone entirely, replaced by hover/click on
              the polygons themselves. Shape data is external public
              geographic data (see GEOJSON_TO_DB_NAME above); every color,
              count, and most-wanted label is still a live query result. */}
          <div className="rounded-2xl border border-stone-850 bg-stone-950/40 p-4 relative">
            {isLoadingSummary ? (
              <div className="h-[560px] flex items-center justify-center">
                <div className="w-2/3 h-2/3 rounded-2xl shimmer-bg" />
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                className="w-full h-auto max-h-[620px] mx-auto"
                role="img"
                aria-label={lang === "en" ? "Interactive map of Karnataka districts" : "ಕರ್ನಾಟಕ ಜಿಲ್ಲೆಗಳ ಸಂವಾದಾತ್ಮಕ ನಕ್ಷೆ"}
              >
                {districtPaths.map(({ dbName, d, centroid }) => {
                  const row = rows.find((r) => r.district === dbName);
                  const intensity = row ? row.active_cases / maxCases : 0;
                  const isSelected = !!row && row.district_id === selectedId;
                  const isHovered = !!row && row.district_id === hoveredId;
                  const active = isSelected || isHovered;
                  return (
                    <g key={dbName}>
                      <path
                        d={d}
                        className="transition-all duration-200 cursor-pointer"
                        fill={active ? "#E4C590" : "#C79A4E"}
                        fillOpacity={row ? 0.32 + intensity * 0.45 : 0.08}
                        stroke={active ? "#F2E4C4" : "#161412"}
                        strokeWidth={active ? 2.5 : 1.25}
                        style={active ? { filter: "drop-shadow(0 0 10px rgba(228,197,144,0.65))" } : undefined}
                        onMouseEnter={() => row && setHoveredId(row.district_id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => row && handleToggleDistrict(row.district_id)}
                      />
                      {row && (
                        <text
                          x={centroid[0]}
                          y={centroid[1]}
                          textAnchor="middle"
                          className="pointer-events-none select-none transition-all duration-200"
                          fontSize={active ? 11 : 8.5}
                          fontWeight={active ? 800 : 600}
                          fill={active ? "#211F1D" : "rgba(33,31,29,0.55)"}
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {/* F.36: Kannada has no letter-case concept -- .toUpperCase() only applies to the English label */}
                          {lang === "kn" ? localizedDistrictName(row.district, lang) : row.district.toUpperCase()}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Radar sweep from the map centre — an ops-room "live scan" feel. */}
                <g className="pointer-events-none">
                  <line x1={MAP_WIDTH / 2} y1={MAP_HEIGHT / 2} x2={MAP_WIDTH / 2} y2={MAP_HEIGHT * 0.06}
                    stroke="#C79A4E" strokeWidth={1.5} opacity={0.22}>
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}`} to={`360 ${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}`}
                      dur="9s" repeatCount="indefinite" />
                  </line>
                </g>

                {/* Pulsing "live threat" markers on the 3 hottest districts. */}
                {[...rows].sort((a, b) => b.active_cases - a.active_cases).slice(0, 3).map((r, i) => {
                  const dp = districtPaths.find((p) => p.dbName === r.district);
                  if (!dp) return null;
                  const [cx, cy] = dp.centroid;
                  return (
                    <g key={`pulse-${r.district_id}`} className="pointer-events-none">
                      <circle cx={cx} cy={cy} r={5} fill="#E24B4A" opacity={0.95} />
                      <circle cx={cx} cy={cy} r={5} fill="none" stroke="#E24B4A" strokeWidth={2}>
                        <animate attributeName="r" from="5" to="28" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.75" to="0" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
                      </circle>
                    </g>
                  );
                })}
              </svg>
            )}

            <div className="absolute bottom-3 left-4 text-[9px] font-mono text-stone-500 pointer-events-none">
              {lang === "en" ? "Fill intensity = active case load. Hover to preview, click for detailed metrics." : "ಬಣ್ಣದ ತೀವ್ರತೆ = ಸಕ್ರಿಯ ಪ್ರಕರಣ ಹೊರೆ. ಪೂರ್ವವೀಕ್ಷಣೆಗೆ ಹೋವರ್ ಮಾಡಿ, ವಿವರಗಳಿಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ."}
            </div>

            {hovered && (
              <div className="absolute top-4 right-4 z-10 glass-panel border border-[#C79A4E]/30 rounded-xl p-3 w-56 shadow-2xl pointer-events-none animate-fade-in">
                <p className="text-xs font-bold text-stone-100">{hovered.district}</p>
                <p className="text-[10px] text-stone-400 font-mono mt-1">
                  {lang === "en" ? "Active cases" : "ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು"}: <span className="text-[#C79A4E] font-bold">{hovered.active_cases}</span>
                </p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                  {lang === "en" ? "Most wanted" : "ಅತಿ ಬೇಕಾದ"}:{" "}
                  <span className="text-rose-400 font-bold">
                    {hovered.most_wanted ? `${hovered.most_wanted.suspect} (${hovered.most_wanted.case_count})` : "—"}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Special Units & Pending Districts: CID, Karnataka Railways,
              Coastal Security Police, ISD Bengaluru have real case counts
              but no single geographic home to render as a map tile, and
              Vijayanagara (a real district since 2021) isn't in the map's
              polygon dataset yet. Backend folds city commissionerates
              (Belagavi City, Mysuru City, etc.) into their parent
              district's tile instead of listing them here -- so nothing
              from the live data is silently invisible. */}
          {specialUnits.length > 0 && (
            <div className="rounded-2xl border border-stone-850 bg-stone-950/40 p-4">
              <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider font-mono mb-3">
                {lang === "en" ? "Special Units & Pending Districts" : "ವಿಶೇಷ ಘಟಕಗಳು"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {specialUnits.map((u) => (
                  <div key={u.district_id} className="rounded-lg border border-stone-800 bg-stone-900/50 p-2.5">
                    <p className="text-[10.5px] font-semibold text-stone-200 truncate" title={u.district}>{u.district}</p>
                    <p className="text-lg font-black text-[#C79A4E] font-mono leading-tight">{u.active_cases}</p>
                    <p className="text-[9px] text-stone-500 font-mono">
                      {u.reason === "unmapped_district"
                        ? (lang === "en" ? "map shape pending" : "ನಕ್ಷೆ ಬಾಕಿ")
                        : (lang === "en" ? "statewide unit" : "ರಾಜ್ಯವ್ಯಾಪಿ ಘಟಕ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drill-down panel */}
          {selectedId && (
            <div ref={drilldownRef} className="space-y-4 animate-fade-in scroll-mt-6">
              {isLoadingDetail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="h-64 rounded-2xl shimmer-bg border border-stone-900" />
                  ))}
                </div>
              ) : gatedInfo ? (
                // Inter-district access air-lock (Part C item #7): this
                // district/station is outside the officer's home
                // jurisdiction. Same request -> supervisor-approve -> unlock
                // UX as the POCSO/export workflows, not a dead end.
                <div className="glass-card p-6 border border-rose-500/30 bg-rose-500/[0.04] flex flex-col items-center text-center gap-3 max-w-xl mx-auto">
                  <ShieldAlert className="w-8 h-8 text-rose-400" />
                  <h3 className="text-sm font-black text-stone-100 uppercase tracking-wide font-mono">
                    {lang === "en" ? "Outside your jurisdiction" : "ನಿಮ್ಮ ವ್ಯಾಪ್ತಿಯ ಹೊರಗೆ"}
                  </h3>
                  <p className="text-xs text-stone-400 leading-relaxed">{gatedInfo.message}</p>
                  {accessRequestStatus === "pending" ? (
                    <div className="text-[11px] font-mono text-amber-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {lang === "en" ? "Waiting for supervisor approval..." : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ..."}
                    </div>
                  ) : accessRequestStatus === "rejected" ? (
                    <div className="text-[11px] font-mono text-rose-400">
                      {lang === "en" ? "Access request was denied." : "ಪ್ರವೇಶ ವಿನಂತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ."}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          setDistrictReasonRetryFn(() => () =>
                            selectedStationId !== null ? handleSelectStation(selectedStationId) : handleSelectDistrict(selectedId!)
                          );
                          setShowDistrictReasonModal(true);
                        }}
                        disabled={isRequestingAccess || isEmergencyRequesting}
                        className="px-4 py-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wide hover:bg-rose-500/25 disabled:opacity-50 cursor-pointer"
                      >
                        {isRequestingAccess
                          ? (lang === "en" ? "Submitting..." : "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...")
                          : (lang === "en" ? "Request Access" : "ಪ್ರವೇಶ ವಿನಂತಿಸಿ")}
                      </button>
                      <button
                        onClick={() => requestEmergencyAccess(() =>
                          selectedStationId !== null ? handleSelectStation(selectedStationId) : handleSelectDistrict(selectedId!)
                        )}
                        disabled={isRequestingAccess || isEmergencyRequesting}
                        title={lang === "en"
                          ? "Only for a genuine active situation that cannot wait -- every use is logged and reviewed."
                          : "ಕಾಯಲಾಗದ ನಿಜವಾದ ಸಕ್ರಿಯ ಪರಿಸ್ಥಿತಿಗೆ ಮಾತ್ರ -- ಪ್ರತಿ ಬಳಕೆ ದಾಖಲಾಗುತ್ತದೆ ಮತ್ತು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ."}
                        className="text-[10px] font-mono uppercase tracking-wide text-amber-400/80 hover:text-amber-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isEmergencyRequesting
                          ? (lang === "en" ? "Granting..." : "ನೀಡಲಾಗುತ್ತಿದೆ...")
                          : (lang === "en" ? "Emergency access (logged & reviewed)" : "ತುರ್ತು ಪ್ರವೇಶ (ದಾಖಲಿಸಲಾಗಿದೆ)")}
                      </button>
                    </div>
                  )}
                </div>
              ) : detail ? (
                <>
                {/* Station-scoped header, shown INSTEAD of the district Threat
                    Index hero when drilled into one station -- the hero's
                    "vs state" math is a district-level comparison and would
                    misleadingly attribute a whole district's standing to one
                    station's charts below it. Always visible above the tabs
                    (it's "where am I" navigation, not tab-specific content). */}
                {detail.unit_id && (
                  <div className="glass-card p-4 border border-[#C79A4E]/30 flex items-center gap-3 flex-wrap">
                    <Building2 className="w-5 h-5 text-[#C79A4E] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-stone-500">
                        {lang === "en" ? "Police Station" : "ಪೊಲೀಸ್ ಠಾಣೆ"} · {detail.district}
                      </div>
                      <div className="text-lg font-black text-stone-100 leading-tight truncate">{detail.station}</div>
                    </div>
                    <button
                      onClick={handleBackToDistrict}
                      className="ml-auto shrink-0 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-[11px] font-bold text-stone-300 hover:text-white transition-all cursor-pointer"
                    >
                      {lang === "en" ? `← Back to ${detail.district}` : `← ${detail.district} ಗೆ ಹಿಂತಿರುಗಿ`}
                    </button>
                  </div>
                )}

                {/* Part G (district redesign): the Overview/Spatial/Demographic
                    switch now lives ONCE at the top of the whole screen (see
                    the page-level tab bar) -- this district-detail view no
                    longer needs its own inner tab bar, it just renders this
                    district's Overview content whenever the page-level tab
                    is "overview". */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Section 121: Threat Index hero, now fused with the Most
                      Wanted module and the "Select Police Station" trigger --
                      the standalone Most Wanted card and the inline
                      pill-cloud (unusable at 100+ stations in a dense
                      commissionerate) are both gone. District-level only,
                      same reasoning as the station picker it now launches. */}
                  {!detail.unit_id && (() => {
                    const stateAvg = rows.length ? Math.round(totalActiveCases / rows.length) : 0;
                    const districtActive = rows.find((r) => r.district_id === selectedId)?.active_cases ?? 0;
                    const vsAvg = stateAvg ? Math.round(((districtActive - stateAvg) / stateAvg) * 100) : 0;
                    const tp = typeof detail.trend_pct === "number" ? detail.trend_pct : 0;
                    const threat = Math.max(5, Math.min(99, Math.round(45 + vsAvg * 0.35 + tp * 1.2)));
                    const tColor = threat > 66 ? "#E24B4A" : threat > 40 ? "#E4C590" : "#5DCAA5";
                    const dash = (threat / 100) * 158;
                    return (
                      <div className="glass-card p-4 border border-stone-850 lg:col-span-2 flex items-center gap-5 flex-wrap">
                        <div className="flex items-center gap-4">
                          <svg viewBox="0 0 120 72" width="128" height="78">
                            <path d="M10,64 A54,54 0 0,1 110,64" fill="none" stroke="#2A2724" strokeWidth="9" strokeLinecap="round" />
                            <path d="M10,64 A54,54 0 0,1 110,64" fill="none" stroke={tColor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} 999`} />
                            <text x="60" y="56" textAnchor="middle" style={{ fontFamily: "'JetBrains Mono',monospace" }} fontSize="26" fontWeight="800" fill={tColor}>{threat}</text>
                          </svg>
                          <div>
                            <div className="text-[9px] font-mono uppercase tracking-widest text-stone-500">{lang === "en" ? "Composite Threat Index" : "ಸಂಯುಕ್ತ ಅಪಾಯ ಸೂಚ್ಯಂಕ"}</div>
                            <div className="text-xl font-black text-stone-100 leading-tight">{detail.district}</div>
                            <div className="text-[9px] font-mono text-stone-600">{lang === "en" ? "load vs state × momentum · 0–100" : "ಹೊರೆ × ವೇಗ · 0–100"}</div>
                          </div>
                        </div>
                        <div className="flex gap-5 flex-wrap">
                          <div><div className="text-[9px] font-mono uppercase tracking-wide text-stone-500">{lang === "en" ? "Active" : "ಸಕ್ರಿಯ"}</div><div className="text-lg font-black text-[#C79A4E] font-mono tabular-nums">{districtActive}</div></div>
                          <div><div className="text-[9px] font-mono uppercase tracking-wide text-stone-500">{lang === "en" ? "Trend" : "ಪ್ರವೃತ್ತಿ"}</div><div className="text-lg font-black font-mono tabular-nums" style={{ color: tp > 3 ? "#E24B4A" : tp < -3 ? "#5DCAA5" : "#A8A096" }}>{tp >= 0 ? "+" : ""}{tp}%</div></div>
                          <div><div className="text-[9px] font-mono uppercase tracking-wide text-stone-500">{lang === "en" ? "vs State" : "ರಾಜ್ಯ"}</div><div className="text-lg font-black font-mono tabular-nums" style={{ color: vsAvg > 0 ? "#E24B4A" : "#5DCAA5" }}>{vsAvg >= 0 ? "+" : ""}{vsAvg}%</div></div>
                        </div>
                        {/* Embedded Most Wanted module */}
                        <div className="shrink-0">
                          {detail.most_wanted ? (
                            <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/15 rounded-lg px-3 py-2">
                              <UserX className="w-4 h-4 text-rose-450 shrink-0" />
                              <div>
                                <div className="text-[9px] font-mono uppercase tracking-wide text-stone-500">{lang === "en" ? "Most Wanted" : "ಅತಿ ಬೇಕಾದ"}</div>
                                <div className="text-[12px] font-extrabold text-stone-100 truncate max-w-[160px]">{detail.most_wanted.suspect}</div>
                              </div>
                              <span className="text-[10px] font-mono font-black text-rose-400 shrink-0">{detail.most_wanted.case_count} {lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-stone-600 font-mono">
                              {lang === "en" ? "No repeat suspect flagged" : "ಪುನರಾವರ್ತಿತ ಶಂಕಿತರಿಲ್ಲ"}
                            </div>
                          )}
                        </div>
                        {/* Select Police Station trigger */}
                        <button
                          onClick={() => setShowStationPicker(true)}
                          className="ml-auto shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 hover:border-[#C79A4E]/40 transition-all cursor-pointer"
                        >
                          <Building2 className="w-4 h-4 text-[#C79A4E]" />
                          <span className="text-[11px] font-bold text-stone-200">{lang === "en" ? "Select Police Station" : "ಠಾಣೆ ಆಯ್ಕೆಮಾಡಿ"}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-800 text-[#E4C590]">{stations.length}</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Section 121 Pair 1 (left): 12-month incident trend --
                      time dimension + benchmark vs state. Was lg:col-span-2
                      (full width); now col-span-1, paired with Recent Case
                      Activity to its right. */}
                  {detail.monthly_trend && detail.monthly_trend.length > 0 && (
                    <div className="glass-card p-4 border border-stone-850 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                          {detail.district} — {lang === "en" ? "12-Month Incident Trend" : "12-ತಿಂಗಳ ಘಟನಾ ಪ್ರವೃತ್ತಿ"}
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-mono">
                          {typeof detail.trend_pct === "number" && (
                            <span className={`font-bold ${detail.trend_pct > 3 ? "text-rose-400" : detail.trend_pct < -3 ? "text-[#5DCAA5]" : "text-stone-400"}`}>
                              {detail.trend_pct > 3 ? "▲" : detail.trend_pct < -3 ? "▼" : "▬"} {detail.trend_pct >= 0 ? "+" : ""}{detail.trend_pct}% <span className="text-stone-500 font-normal">{lang === "en" ? "vs prior qtr" : "ಹಿಂದಿನ ತ್ರೈಮಾಸಿಕ"}</span>
                            </span>
                          )}
                          {(() => {
                            const stateAvg = rows.length ? Math.round(totalActiveCases / rows.length) : 0;
                            const districtActive = rows.find((r) => r.district_id === selectedId)?.active_cases ?? 0;
                            const vsAvg = stateAvg ? Math.round(((districtActive - stateAvg) / stateAvg) * 100) : 0;
                            if (!stateAvg) return null;
                            return (
                              <span className={`font-bold ${vsAvg > 0 ? "text-rose-400" : "text-[#5DCAA5]"}`}>
                                {vsAvg > 0 ? "+" : ""}{vsAvg}% <span className="text-stone-500 font-normal">{lang === "en" ? "vs state avg" : "ರಾಜ್ಯ ಸರಾಸರಿ"}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={detail.monthly_trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                            <defs>
                              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#C79A4E" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#C79A4E" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 4" stroke="#2a2724" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} axisLine={false} width={30} />
                            <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 11, borderRadius: 8 }} />
                            <Area type="monotone" dataKey="count" stroke="#C79A4E" strokeWidth={2} fill="url(#trendFill)" dot={{ r: 2, fill: "#C79A4E" }} activeDot={{ r: 4 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Section 121 Pair 1 (right): Recent Case Activity. Was
                      lg:col-span-2 (full width, breaking the dual-column
                      symmetry); now col-span-1, paired with the trend chart
                      above. Height-matched via h-44+header to the chart's
                      own h-44 body so the pair reads as one balanced row. */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
                      {lang === "en" ? "Recent Case Activity" : "ಇತ್ತೀಚಿನ ಪ್ರಕರಣ ಚಟುವಟಿಕೆ"}
                    </h3>
                    {detail.recent_cases.length === 0 ? (
                      <div className="text-[10px] text-stone-600 font-mono py-2">
                        {lang === "en" ? "No recent case records found." : "ಇತ್ತೀಚಿನ ಪ್ರಕರಣ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                      </div>
                    ) : (
                      <div className="h-44 overflow-y-auto divide-y divide-stone-850">
                        {detail.recent_cases.map((c, i) => (
                          <div key={i} className="py-2 flex items-start gap-3 font-mono">
                            <span className="text-[10px] font-black text-[#C79A4E] shrink-0 w-24 truncate">{c.crime_no}</span>
                            <span className="text-[9.5px] text-stone-500 shrink-0 w-20">{c.registered_date?.split(" ")[0]}</span>
                            <span className="text-[10.5px] text-stone-400 truncate flex-1">{c.brief_facts || "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CONFIRMED LIVE BUG (2026-09-17, Finals-part 3.md Section
                      85): this was a raw Pie+Legend over ALL CrimeMajorHeadID
                      categories -- verified against the live database at 119
                      distinct categories (worse than the plan doc's own 80-
                      category example), heavily long-tailed. A 119-slice pie
                      mathematically collapses (a 5-case slice out of 13k+ is
                      a fraction of a degree, thinner than its own 1px
                      stroke) and a 119-item flex-wrap legend blows out any
                      fixed-height container. Replaced with a ranked top-10
                      bar list -- the SAME proven pattern this screen's own
                      statewide "Crime Mix" card already uses (line ~1011
                      above), just scoped to this district's detail data,
                      with an honest "+N more" disclosure for the long tail
                      instead of silently dropping it. */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                        {lang === "en" ? "Crime Types Breakdown" : "ಅಪರಾಧ ಪ್ರಕಾರಗಳ ವಿಭಜನೆ"}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-500">
                        {crimeTypeTotal.toLocaleString()} {lang === "en" ? "total" : "ಒಟ್ಟು"}
                      </span>
                    </div>
                    {(() => {
                      const sorted = [...detail.crime_type_distribution].sort((a, b) => b.value - a.value);
                      const top = sorted.slice(0, 10);
                      const rest = sorted.length - top.length;
                      const mx = Math.max(...top.map((c) => c.value), 1);
                      return (
                        <div className="space-y-1.5">
                          {top.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[9px] font-mono text-stone-600 w-5 shrink-0">#{i + 1}</span>
                              <span className="text-[10px] text-stone-400 w-28 truncate" title={c.name}>{c.name}</span>
                              <div className="flex-1 h-3 bg-stone-900/60 rounded overflow-hidden">
                                <div className="h-full rounded" style={{ width: `${Math.max(6, (c.value / mx) * 100)}%`, background: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.75 }} />
                              </div>
                              <span className="text-[9px] font-mono text-stone-500 w-16 text-right tabular-nums">
                                {c.value.toLocaleString()} ({crimeTypeTotal ? ((c.value / crimeTypeTotal) * 100).toFixed(1) : "0.0"}%)
                              </span>
                            </div>
                          ))}
                          {rest > 0 && (
                            <p className="text-[9px] font-mono text-stone-600 pt-1">
                              {lang === "en"
                                ? `Showing top ${top.length} of ${sorted.length} crime categories · ${rest} more in the long tail.`
                                : `${sorted.length} ವರ್ಗಗಳಲ್ಲಿ ಟಾಪ್ ${top.length} ತೋರಿಸಲಾಗುತ್ತಿದೆ · ${rest} ಇನ್ನಷ್ಟು.`}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Solved vs unsolved pie + police presence */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#C79A4E]" />
                        {lang === "en" ? "Case Outcomes" : "ಪ್ರಕರಣದ ಫಲಿತಾಂಶಗಳು"}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-500">
                        {caseOutcomeTotal.toLocaleString()} {lang === "en" ? "total" : "ಒಟ್ಟು"}
                      </span>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detail.case_outcomes} dataKey="value" nameKey="name" innerRadius={26} outerRadius={54} paddingAngle={2}>
                            {detail.case_outcomes.map((entry, i) => (
                              <Cell key={i} fill={OUTCOME_COLORS[entry.name] || PIE_COLORS[i]} stroke="#161412" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10, borderRadius: 8 }} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={7}
                            wrapperStyle={{ fontSize: 9, color: "#A8A49C", paddingTop: 4 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="border-t border-stone-850 pt-2.5 grid grid-cols-2 gap-2">
                      <div className="bg-stone-950/40 rounded-lg p-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                        <div>
                          <div className="text-sm font-black text-stone-100">{detail.police_presence.employee_headcount}</div>
                          <div className="text-[8.5px] text-stone-500 uppercase font-mono">{lang === "en" ? "Officers" : "ಅಧಿಕಾರಿಗಳು"}</div>
                        </div>
                      </div>
                      <div className="bg-stone-950/40 rounded-lg p-2 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                        <div>
                          <div className="text-sm font-black text-stone-100">{detail.police_presence.station_count}</div>
                          <div className="text-[8.5px] text-stone-500 uppercase font-mono">{lang === "en" ? "Stations" : "ಠಾಣೆಗಳು"}</div>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Emerging Spike Alerts — per crime-CATEGORY momentum vs its
                      own historical baseline. High + rising pulses in danger red
                      (the problem-statement's "red-zone pulsing when a category
                      spikes vs its historical average"); medium = gold; a falling
                      category reads teal, because a shrinking type is relief. */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#C79A4E]" />
                        {lang === "en" ? "Emerging Spike Alerts" : "ಉದಯೋನ್ಮುಖ ಏರಿಕೆ ಎಚ್ಚರಿಕೆಗಳು"}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wide">
                        {lang === "en" ? "vs historical avg" : "ಐತಿಹಾಸಿಕ ಸರಾಸರಿ"}
                      </span>
                    </div>
                    {spikes === null ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map((n) => <div key={n} className="h-6 rounded shimmer-bg" />)}
                      </div>
                    ) : spikes.length === 0 ? (
                      <div className="text-[10.5px] text-stone-500 font-mono py-3 leading-relaxed flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#5DCAA5] shrink-0" />
                        {lang === "en" ? "No categories are sharply accelerating." : "ಯಾವುದೇ ವರ್ಗಗಳು ತೀವ್ರವಾಗಿ ಏರುತ್ತಿಲ್ಲ."}
                      </div>
                    ) : (() => {
                      const sorted = [...spikes].sort((a, b) => b.change_pct - a.change_pct);
                      const maxRecent = Math.max(1, ...sorted.map((s) => s.recent || 0));
                      return (
                        <div className="space-y-1.5">
                          {sorted.map((s, i) => {
                            // change_pct < 0 → teal (relief); else severity drives
                            // it: high = danger red + pulse, medium = gold, low = muted.
                            const rising = s.change_pct > 0;
                            const isHot = rising && s.severity === "high";
                            const color = !rising ? "#5DCAA5" : s.severity === "high" ? "#E24B4A" : s.severity === "medium" ? "#C79A4E" : "#A8A096";
                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${isHot ? "border-[#E24B4A]/30 bg-[#E24B4A]/[0.06] animate-pulse" : "border-transparent"}`}
                              >
                                <span className="text-[11px] text-stone-300 w-24 sm:w-28 truncate shrink-0" title={s.category}>{s.category}</span>
                                <div className="flex-1 h-3.5 bg-stone-900/60 rounded overflow-hidden">
                                  <div className="h-full rounded" style={{ width: `${Math.max(6, (s.recent / maxRecent) * 100)}%`, background: color, opacity: 0.55 }} />
                                </div>
                                <span className="text-[10px] font-mono text-stone-400 w-8 text-right shrink-0 tabular-nums" title={lang === "en" ? "recent count" : "ಇತ್ತೀಚಿನ ಎಣಿಕೆ"}>{s.recent}</span>
                                <span
                                  className="text-[10px] font-mono font-black w-14 text-right shrink-0 tabular-nums"
                                  style={{ color }}
                                  title={`${lang === "en" ? "baseline" : "ಆಧಾರ"} ${s.baseline}`}
                                >
                                  {rising ? "▲" : s.change_pct < 0 ? "▼" : "▬"}{s.change_pct >= 0 ? "+" : ""}{s.change_pct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Anomaly Callouts — statistical outliers as auditable, red-tinted
                      cards. Each detail sentence carries its own baseline/delta so a
                      reviewer can check the claim; the z-score chip shows how far out. */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-450" />
                      {lang === "en" ? "Anomaly Callouts" : "ಅಸಂಗತ ಸೂಚನೆಗಳು"}
                    </h3>
                    {anomalies === null ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((n) => <div key={n} className="h-14 rounded-lg shimmer-bg" />)}
                      </div>
                    ) : anomalies.length === 0 ? (
                      <div className="text-[10.5px] text-stone-500 font-mono py-3 leading-relaxed">
                        {lang === "en" ? "No statistical anomalies detected for this district." : "ಈ ಜಿಲ್ಲೆಗೆ ಯಾವುದೇ ಸಾಂಖ್ಯಿಕ ಅಸಂಗತಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {anomalies.map((a, i) => (
                          <div key={i} className="bg-rose-500/[0.06] border border-rose-500/20 rounded-lg p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11.5px] font-bold text-stone-100 leading-snug">{a.label}</span>
                              <span className="text-[9px] font-mono font-black text-rose-400 shrink-0 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 tabular-nums">
                                z={a.z_score}
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">{a.detail}</p>
                            {a.metric && <div className="text-[8.5px] font-mono text-stone-600 uppercase tracking-wide mt-1">{a.metric}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Syndicate Signals — accused sharing a phone/vehicle within
                      this district (union-find over AccusedContact), the
                      "hidden link" story distinct from case co-offense.
                      District-level only (unit_id absent) -- not shown while
                      drilled into one station. Always carries its synthetic-
                      data disclaimer; never presented as verified fact. */}
                  {!detail.unit_id && (
                    <div className="glass-card p-4 border border-stone-850 space-y-3">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-450" />
                        {lang === "en" ? "Syndicate Signals" : "ಸಿಂಡಿಕೇಟ್ ಸಂಕೇತಗಳು"}
                      </h3>
                      {syndicateGroups === null ? (
                        <div className="space-y-2">
                          {[1, 2].map((n) => <div key={n} className="h-12 rounded-lg shimmer-bg" />)}
                        </div>
                      ) : syndicateGroups.length === 0 ? (
                        <div className="text-[10.5px] text-stone-500 font-mono py-3 leading-relaxed">
                          {lang === "en"
                            ? "No shared-phone/vehicle clusters found among this district's accused."
                            : "ಈ ಜಿಲ್ಲೆಯ ಆರೋಪಿಗಳಲ್ಲಿ ಯಾವುದೇ ಹಂಚಿಕೆಯ ಫೋನ್/ವಾಹನ ಸಮೂಹಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {syndicateGroups.map((g, i) => (
                            <div key={i} className="bg-rose-500/[0.06] border border-rose-500/20 rounded-lg p-2.5">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <span className="text-[11.5px] font-bold text-stone-100 leading-snug">
                                  {g.members.join(", ")}
                                </span>
                                <span className="text-[9px] font-mono font-black text-rose-400 shrink-0 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                  {lang === "en" ? "hub" : "ಕೇಂದ್ರ"}: {g.hub} ({g.hub_links})
                                </span>
                              </div>
                              <div className="text-[9px] font-mono text-stone-500 uppercase tracking-wide mt-1">
                                {lang === "en" ? "shared" : "ಹಂಚಿಕೆ"}: {g.shared_kinds.join(", ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {syndicateDisclaimer && (
                        <p className="text-[9px] text-stone-600 italic">{syndicateDisclaimer}</p>
                      )}
                    </div>
                  )}

                  {/* Section 121 Pair 4 (right): Open-Source Signals, now
                      inside the same dual-column grid as its own pair
                      partner (Syndicate Signals) instead of a separate
                      full-width section below everything. Keeps its
                      distinct gold-tinted "unverified lead" styling --
                      Section 121 asks for a shared card SIZE/placement,
                      not an identical look, since this trust boundary
                      (open-source vs official CCTNS record) is a real,
                      deliberate distinction elsewhere in this codebase. */}
                  <div className="rounded-2xl border border-[#C79A4E]/35 bg-[#C79A4E]/[0.05] p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-[11px] font-black uppercase tracking-wider font-mono flex items-center gap-1.5 text-[#E4C590]">
                        <span className="w-2 h-2 rounded-full bg-[#C79A4E] animate-pulse" />
                        {lang === "en" ? "Open-Source Signals · Live" : "ಮುಕ್ತ-ಮೂಲ ಸಂಕೇತಗಳು · ನೇರ"}
                      </h3>
                      <span className="text-[8.5px] font-mono text-[#C79A4E]/80 uppercase tracking-wide">
                        {lang === "en" ? "Unverified leads — not official record" : "ಪರಿಶೀಲಿಸದ ಸುಳಿವುಗಳು — ಅಧಿಕೃತ ದಾಖಲೆ ಅಲ್ಲ"}
                      </span>
                    </div>

                    {isLoadingSignals ? (
                      <div className="space-y-2">
                        {[1, 2].map((n) => <div key={n} className="h-16 rounded-lg shimmer-bg" />)}
                      </div>
                    ) : signals && signals.configured && signals.items.length > 0 ? (
                      <div className="space-y-2">
                        {signals.items.map((it, i) => (
                          <a
                            key={i}
                            href={it.url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-stone-950/40 hover:bg-stone-950/70 border border-stone-850 hover:border-[#C79A4E]/40 rounded-lg p-3 transition-colors group"
                          >
                            <p className="text-[12px] font-semibold text-stone-100 leading-snug line-clamp-2 group-hover:text-[#E4C590]">{it.title}</p>
                            {it.snippet && <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">{it.snippet}</p>}
                            <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-stone-500">
                              <span className="text-[#C79A4E] truncate max-w-[45%]">{it.source}</span>
                              {it.published && <span className="shrink-0">{it.published.split("T")[0]}</span>}
                              <span className="ml-auto text-[#C79A4E]/70 group-hover:text-[#E4C590]">↗</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-stone-500 font-mono py-2 leading-relaxed">
                        {signals && !signals.configured
                          ? (lang === "en"
                              ? "Live news is off. Add a free GNEWS_API_KEY in .env and redeploy to light up this lane."
                              : "ನೇರ ಸುದ್ದಿ ಆಫ್ ಆಗಿದೆ. .env ನಲ್ಲಿ GNEWS_API_KEY ಸೇರಿಸಿ ಮರುನಿಯೋಜಿಸಿ.")
                          : (lang === "en"
                              ? "No recent crime-relevant news found for this district."
                              : "ಈ ಜಿಲ್ಲೆಗೆ ಇತ್ತೀಚಿನ ಸಂಬಂಧಿತ ಸುದ್ದಿ ಕಂಡುಬಂದಿಲ್ಲ.")}
                      </div>
                    )}
                  </div>
                </div>
              </>
              ) : null}
            </div>
          )}
        </>
      )}
      </>
      )}

      {/* E.1: written justification before a cross-district access request */}
      <ReasonCollectionModal
        isOpen={showDistrictReasonModal}
        title={lang === "en" ? "Justification Required" : "ಸಮರ್ಥನೆ ಅಗತ್ಯವಿದೆ"}
        subtitle={
          lang === "en"
            ? "This district is outside your home jurisdiction. Provide a real operational reason before requesting supervisor approval."
            : "ಈ ಜಿಲ್ಲೆ ನಿಮ್ಮ ಸ್ವಂತ ವ್ಯಾಪ್ತಿಯ ಹೊರಗಿದೆ. ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆ ಕೋರುವ ಮೊದಲು ನಿಜವಾದ ಕಾರ್ಯಾಚರಣೆಯ ಕಾರಣ ನೀಡಿ."
        }
        onClose={() => setShowDistrictReasonModal(false)}
        onSubmit={async (reason) => {
          setShowDistrictReasonModal(false);
          await requestDistrictAccess(districtReasonRetryFn || (() => {}), reason);
        }}
      />

      {/* Section 121: searchable modal station picker, triggered from the
          Threat Index hero's "Select Police Station" button. */}
      {showStationPicker && detail && (
        <PoliceStationSelectorModal
          lang={lang}
          districtName={detail.district}
          stations={stations}
          selectedStationId={selectedStationId}
          isLoading={isLoadingStations}
          onSelectStation={(unitId) => {
            setShowStationPicker(false);
            handleSelectStation(unitId);
          }}
          onClose={() => setShowStationPicker(false)}
        />
      )}

      {/* Section 18: Un-dismissible Immediate Revocation Shield Modal */}
      {isRevokedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border-2 border-rose-600/80 rounded-2xl p-6 shadow-2xl space-y-5 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 mx-auto flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black text-rose-400 uppercase tracking-wide">
                {lang === "en" ? "EMERGENCY ACCESS REVOKED" : "ತುರ್ತು ಪ್ರವೇಶವನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ"}
              </h2>
              <p className="text-xs text-stone-300 leading-relaxed">
                {lang === "en"
                  ? "Your supervisor has reviewed and immediately revoked this out-of-jurisdiction emergency grant under Section 185 BNSS 2023. All sensitive case records and maps have been purged from memory."
                  : "ಮೇಲ್ವಿಚಾರಕರು ಕಲಂ 185 BNSS ಅಡಿಯಲ್ಲಿ ನಿಮ್ಮ ತುರ್ತು ಪ್ರವೇಶವನ್ನು ತಕ್ಷಣವೇ ರದ್ದುಗೊಳಿಸಿದ್ದಾರೆ. ಎಲ್ಲಾ ಗೌಪ್ಯ ದಾಖಲೆಗಳನ್ನು ತೆರವುಗೊಳಿಸಲಾಗಿದೆ."}
              </p>
            </div>

            <div className="p-3 bg-stone-950/60 rounded-xl border border-stone-800 text-[11px] font-mono text-stone-400 text-left">
              <div><span className="text-stone-500">Statutory Order:</span> BNSS §185 Supervisory Revocation</div>
              <div><span className="text-stone-500">Action Taken:</span> Immediate Session Termination & Memory Flush</div>
              <div><span className="text-stone-500">Audit Chain:</span> Logged to Immutable Ledger</div>
            </div>

            <button
              onClick={handleReturnHome}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              {lang === "en" ? "Return to Home Station" : "ಸ್ವಂತ ಠಾಣೆಗೆ ಹಿಂತಿರುಗಿ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
