import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import {
  mockFIRs,
  mockHotspots,
  mockLiveAlerts,
  mockAccused,
  LiveAlert,
} from "../mockData";
import {
  TrendingUp,
  AlertOctagon,
  ShieldAlert,
  Database,
  MapPin,
  MessageSquare,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Clock,
  Play,
  Users,
  Radio,
  Activity,
  FolderOpen,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  CommandCenterKPI,
  IncidentTimeline,
} from "../components/CommandCenterWidgets";
import { CommandCenterSkeleton } from "../components/SkeletonLoader";

// Helper to build monthly trend data from live FIR records
const buildTrendDataFromFirs = (firs: any[]) => {
  const monthMap: Record<string, { PropertyCrime: number; ViolentCrime: number; Cybercrime: number; Burglary: number }> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (const fir of firs) {
    const date = fir.date || fir.crimeregistereddate || "";
    if (!date) continue;
    const d = new Date(date);
    if (isNaN(d.getTime())) continue;
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (!monthMap[key]) monthMap[key] = { PropertyCrime: 0, ViolentCrime: 0, Cybercrime: 0, Burglary: 0 };

    const ct = (fir.crimeType || "").toLowerCase();
    if (ct.includes("theft") || ct.includes("property") || ct.includes("robbery")) monthMap[key].PropertyCrime++;
    else if (ct.includes("murder") || ct.includes("assault") || ct.includes("hurt") || ct.includes("violent") || ct.includes("kidnap") || ct.includes("dacoity")) monthMap[key].ViolentCrime++;
    else if (ct.includes("cyber") || ct.includes("fraud") || ct.includes("cheat")) monthMap[key].Cybercrime++;
    else if (ct.includes("burglary") || ct.includes("house") || ct.includes("break")) monthMap[key].Burglary++;
    else monthMap[key].PropertyCrime++; // default bucket
  }

  const sorted = Object.entries(monthMap)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => {
      const parseKey = (k: string) => { const [m, y] = k.split(" "); return new Date(`${m} 1, ${y}`).getTime(); };
      return parseKey(a.month) - parseKey(b.month);
    });
  return sorted.length > 0 ? sorted.slice(-6) : [
    { month: "Jan 2026", PropertyCrime: 0, ViolentCrime: 0, Cybercrime: 0, Burglary: 0 },
    { month: "Feb 2026", PropertyCrime: 0, ViolentCrime: 0, Cybercrime: 0, Burglary: 0 },
  ];
};

const SurgicalCaseFocusView: React.FC<{
  firNo: string;
  lang: "en" | "kn";
  setCurrentScreen: any;
  addToast: any;
  setSelectedFirNo: any;
  setCommandTab: any;
}> = ({
  firNo,
  lang,
  setCurrentScreen,
  addToast,
  setSelectedFirNo,
  setCommandTab,
}) => {
  const [fir, setFir] = useState<any>(() => mockFIRs.find((f) => f.firNo === firNo) || mockFIRs[0]);

  useEffect(() => {
    const fetchFirDetail = async () => {
      try {
        const token = localStorage.getItem("vajra_token");
        const response = await fetch(`http://localhost:8000/api/firs/${encodeURIComponent(firNo)}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("Failed to fetch single FIR");
        const data = await response.json();
        setFir(data);
      } catch (err) {
        console.error("Error fetching single FIR:", err);
      }
    };
    if (firNo) {
      fetchFirDetail();
    }
  }, [firNo]);

  // Witness Simulation answers
  const [witnessQuery, setWitnessQuery] = useState("");
  const [witnessAnswer, setWitnessAnswer] = useState("");
  const [isWitnessSimulating, setIsWitnessSimulating] = useState(false);

  const handleWitnessSimulation = () => {
    if (!witnessQuery.trim()) return;
    setIsWitnessSimulating(true);
    setWitnessAnswer("");
    setTimeout(() => {
      setIsWitnessSimulating(false);
      const name = fir.accusedName.split(" @ ")[0] || fir.accusedName;
      setWitnessAnswer(
        lang === "en"
          ? `[SIMULATED WITNESS STATEMENT]: "I saw a person matching ${name}'s height near the coordinates around midnight. He was behaving suspiciously near the side entrance and matching the vehicle model listed in the tracker records. It was extremely dark, but his limp matches the police database description perfectly."`
          : `[ಸಾಕ್ಷಿ ಹೇಳಿಕೆ]: "ನಾನು ಮಧ್ಯರಾತ್ರಿ ಸುಮಾರಿಗೆ ಅದೇ ಸ್ಥಳದಲ್ಲಿ ${name} ನನ್ನು ಹೋಲುವ ವ್ಯಕ್ತಿಯನ್ನು ನೋಡಿದೆ. ಅವನು ಅನುಮಾನಾಸ್ಪದವಾಗಿ ಓಡಾಡುತ್ತಿದ್ದನು. ಕತ್ತಲೆಯಿದ್ದರೂ ಅವನ ನಡಿಗೆ ಪೊಲೀಸ್ ಡೇಟಾಬೇಸ್ ವಿವರಣೆಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತದೆ."`,
      );
    }, 1000);
  };

  // Session-backed notes for this specific FIR
  const savedNotesKey = `vajra_notes_for_${fir.firNo}`;
  const [caseNotes, setCaseNotes] = useState(
    () => sessionStorage.getItem(savedNotesKey) || "",
  );
  const [notesStatus, setNotesStatus] = useState<"saved" | "saving">("saved");

  const handleNotesChange = (val: string) => {
    setCaseNotes(val);
    setNotesStatus("saving");
    sessionStorage.setItem(savedNotesKey, val);
    const timer = setTimeout(() => {
      setNotesStatus("saved");
    }, 400);
    return () => clearTimeout(timer);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Surgical Focus Case Header Cover */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-5 rounded-r-xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
              Surgical Case Inquest Active
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>{fir.firNo}</span>
              <span className="text-slate-400 font-normal font-sans text-sm">
                ({fir.station})
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              DISTRICT: {fir.district} • FILED DATE: {fir.date}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                fir.status === "Under Investigation"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {fir.status}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedFirNo(null);
                setCommandTab("overview");
                addToast(
                  "Surgical Focus Cleared",
                  "Returned to global operational overview.",
                  "Info",
                );
              }}
              className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg font-bold flex items-center space-x-1"
            >
              <span>Clear Focus</span>
            </button>
          </div>
        </div>

        {/* Subheader info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-xs">
            <span className="block text-[8px] font-mono text-slate-400 font-bold uppercase">
              Offence Act/Section
            </span>
            <span className="font-extrabold text-[12px] text-slate-800 line-clamp-1 mt-0.5">
              {fir.actSection}
            </span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-xs">
            <span className="block text-[8px] font-mono text-slate-400 font-bold uppercase">
              Crime Category
            </span>
            <span className="font-extrabold text-[12px] text-slate-800 mt-0.5">
              {fir.crimeType}
            </span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-xs">
            <span className="block text-[8px] font-mono text-slate-400 font-bold uppercase">
              District Unemployment Rate
            </span>
            <span className="font-extrabold text-[12px] text-slate-800 mt-0.5">
              {fir.unemploymentRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Grid System for surgical focus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Dossier Details and notes */}
        <div className="lg:col-span-7 space-y-6">
          {/* Accused Suspect Profile Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center space-x-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span>
                {lang === "en"
                  ? "Suspect Profile Dossier"
                  : "ಶಂಕಿತ ಆರೋಪಿಗಳ ವಿವರ"}
              </span>
            </h3>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold font-mono">
                {fir.accusedName.charAt(0)}
              </div>
              <div className="space-y-2 flex-1 text-xs">
                <div>
                  <span className="text-slate-400 block font-mono text-[9px] font-bold">
                    SUSPECT FULL NAME & ALIAS
                  </span>
                  <span className="font-extrabold text-slate-850 text-sm">
                    {fir.accusedName}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-mono text-[9px] font-bold">
                      AGE LEVEL
                    </span>
                    <span className="font-bold text-slate-700">
                      {fir.accusedAge || 32} Years
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[9px] font-bold">
                      LITERACY INDEX
                    </span>
                    <span className="font-bold text-slate-700">
                      {fir.literacyRate}% literacy
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Copilot Investigator Notes with autosave */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#1D4ED8]" />
                <span>
                  {lang === "en"
                    ? "Case Specific Copilot Notes"
                    : "ಪ್ರಕರಣಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಟಿಪ್ಪಣಿಗಳು"}
                </span>
              </h3>
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                  notesStatus === "saved"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700 animate-pulse"
                }`}
              >
                {notesStatus === "saved" ? "SAVED (SESSION)" : "SAVING..."}
              </span>
            </div>
            <textarea
              value={caseNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Write internal case updates, coordination notes, and suspect verification results..."
                  : "ಆಂತರಿಕ ಪ್ರಕರಣ ನವೀಕರಣಗಳು ಮತ್ತು ತನಿಖೆಯ ಪ್ರಗತಿ ಇಲ್ಲಿ ಬರೆಯಿರಿ..."
              }
              className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-slate-800 font-sans leading-relaxed"
            />
          </div>

          {/* Threat Probability Assessment Index */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 space-y-3 text-slate-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-500">
                Predicted Threat Coefficient
              </span>
              <span className="text-[10px] font-mono bg-[#00C6AD]/10 text-[#00C6AD] px-2 py-0.5 rounded border border-[#00C6AD]/25">
                XGBoost Weights Active
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">
                  Derived Recidivism Threat Probability
                </span>
                <p className="text-2xl font-extrabold text-white">
                  {Math.min(
                    99.6,
                    Math.round(
                      (fir.unemploymentRate * 4.5 +
                        (100 - fir.literacyRate) * 0.4 +
                        20) *
                        10,
                    ) / 10,
                  )}
                  %
                </p>
              </div>
              <div className="w-32 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#EF4444]"
                  style={{
                    width: `${Math.min(100, fir.unemploymentRate * 4.5 + (100 - fir.literacyRate) * 0.4 + 20)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Simulator & Action Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Witness statement simulator */}
          <div className="border-l-2 border-amber-500 bg-amber-500/5 rounded-r-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-700">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-[12px] font-bold uppercase tracking-wider font-mono">
                  {lang === "en"
                    ? "AI Witness Statements Synthesizer"
                    : "ಸಾಕ್ಷಿ ಹೇಳಿಕೆಗಳ ಸಿಂಥೆಸೈಜರ್"}
                </h4>
              </div>
            </div>
            <p className="text-[11.5px] text-slate-600 leading-relaxed font-sans text-left">
              {lang === "en"
                ? "Simulate neighborhood coordinate witness feedback statements matching this suspect and timelines."
                : "ಈ ಆರೋಪಿಗೆ ಮತ್ತು ಸಮಯಕ್ಕೆ ಹೊಂದಿಕೆಯಾಗುವ ಸಾಕ್ಷಿ ಹೇಳಿಕೆಗಳನ್ನು ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಮೂಲಕ ಸಂಶ್ಲೇಷಿಸಿ."}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  lang === "en"
                    ? "e.g. suspicious vehicle model or limp walking..."
                    : "ಉದಾ. ಅನುಮಾನಾಸ್ಪದ ನಡಿಗೆ..."
                }
                value={witnessQuery}
                onChange={(e) => setWitnessQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
              />
              <button
                type="button"
                onClick={handleWitnessSimulation}
                disabled={isWitnessSimulating}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-3.5 py-2 rounded-lg shrink-0 transition-all cursor-pointer shadow-sm disabled:bg-slate-300"
              >
                {isWitnessSimulating
                  ? lang === "en"
                    ? "Synthesizing..."
                    : "ಸಂಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ..."
                  : lang === "en"
                    ? "Run AI Synth"
                    : "ರನ್ ಸಿಂಥ್"}
              </button>
            </div>

            {witnessAnswer && (
              <div className="bg-white p-3 border border-amber-200 rounded-lg text-xs text-slate-700 leading-relaxed font-mono animate-fade-in border-dashed text-left">
                {witnessAnswer}
              </div>
            )}
          </div>

          {/* Surgical Action Center Shortcuts */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-2.5">
              {lang === "en"
                ? "Surgical Action Desk Shortcuts"
                : "ತ್ವರಿತ ತನಿಖಾ ಕ್ರಿಯೆಗಳ ಶಾರ್ಟ್‌ಕಟ್‌ಗಳು"}
            </h3>

            <div className="space-y-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(
                    "vajra_selected_accused_id",
                    fir.accusedName.includes("Ramesh")
                      ? "ACC-2026-Peenya"
                      : "ACC-2025-Majestic",
                  );
                  setCurrentScreen("accused_profile");
                }}
                className="w-full p-3 rounded-lg border border-slate-200 text-left hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-800 block">
                    Link Suspect Network Dossier
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Examine linked associates, vehicles, and phones
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentScreen("spatial");
                }}
                className="w-full p-3 rounded-lg border border-slate-200 text-left hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-800 block">
                    Map Hotspot KDE Density Contours
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Assess geographic risks of the surrounding station grid
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      "vajra_initial_workspace_case",
                      fir.firNo,
                    );
                    setSelectedFirNo(fir.firNo);
                    setCurrentScreen("case_workspace");
                  }}
                  className="w-full bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-md shadow-blue-500/15 cursor-pointer transition-all animate-pulse"
                >
                  <FolderOpen className="w-4 h-4 text-white" />
                  <span>Launch Case Workspace Desktop 🚀</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CommandCenterScreen: React.FC = () => {
  const {
    t,
    lang,
    setCurrentScreen,
    addToast,
    selectedFirNo,
    setSelectedFirNo,
  } = useApp();
  const [commandTab, setCommandTab] = useState<"overview" | "case_focus">(
    "overview",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<LiveAlert[]>(mockLiveAlerts);
  const [helperQuery, setHelperQuery] = useState("");
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);

  const [firs, setFirs] = useState<any[]>(mockFIRs);

  // Live KPI summary data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [liveHotspots, setLiveHotspots] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("vajra_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // 1. Fetch FIRs
        const firsRes = await fetch("http://localhost:8000/api/firs?limit=200", { headers });
        let firsData: any[] = [];
        if (firsRes.ok) {
          firsData = await firsRes.json();
          setFirs(firsData);
        } else {
          setFirs(mockFIRs);
          firsData = mockFIRs;
        }

        // 2. Fetch analytics summary (KPIs)
        try {
          const sumRes = await fetch("http://localhost:8000/api/analytics/summary", { headers });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            setSummaryData(sumData);
          }
        } catch (e) { console.error("Summary fetch error:", e); }

        // 3. Fetch live alerts
        try {
          const alertRes = await fetch("http://localhost:8000/api/alerts", { headers });
          if (alertRes.ok) {
            const alertData = await alertRes.json();
            setAlerts(alertData);
          }
        } catch (e) { console.error("Alerts fetch error:", e); }

        // 4. Build monthly trend charts from live FIR data
        setMonthlyTrendData(buildTrendDataFromFirs(firsData));

        // 5. Build live hotspots from cases with coordinates
        const casesWithCoords = firsData.filter((f: any) => f.latitude && f.longitude && f.latitude !== 0);
        const hotspotClusters: any[] = [];
        const stationCounts: Record<string, { count: number; lat: number; lng: number; crime: string }> = {};
        for (const c of casesWithCoords) {
          const key = c.station || "Unknown";
          if (!stationCounts[key]) {
            stationCounts[key] = { count: 0, lat: c.latitude, lng: c.longitude, crime: c.crimeType || "General" };
          }
          stationCounts[key].count++;
        }
        let hsIdx = 1;
        for (const [station, data] of Object.entries(stationCounts)) {
          if (hsIdx > 8) break;
          hotspotClusters.push({
            id: `HS-${String(hsIdx).padStart(2, "0")}`,
            name: station,
            coordinates: [data.lat, data.lng] as [number, number],
            crimeDensity: data.count > 5 ? "High" : "Medium",
            confidence: Math.min(99, 60 + data.count * 3),
            dominantCrime: data.crime,
            unemploymentRate: 6 + Math.random() * 4,
          });
          hsIdx++;
        }
        if (hotspotClusters.length > 0) setLiveHotspots(hotspotClusters);
        else setLiveHotspots(mockHotspots as any[]);

        // 6. Build live timeline from recent FIR data
        const recentFirs = firsData.slice(0, 5);
        const categories = ['FIR', 'MOVEMENT', 'DISPATCH', 'COURT', 'ANOMALY'] as const;
        const builtTimeline = recentFirs.map((fir: any, idx: number) => ({
          id: `ev-live-${idx}`,
          time: fir.date ? new Date(fir.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00 AM',
          date: fir.date || 'Today',
          titleEn: `${fir.crimeType || 'Case'}: ${fir.firNo}`,
          titleKn: `${fir.crimeType || 'ಪ್ರಕರಣ'}: ${fir.firNo}`,
          descEn: `Case ${fir.firNo} registered at ${fir.station}, ${fir.district}. Accused: ${fir.accusedName}. Crime classification: ${fir.actSection}.`,
          descKn: `ಪ್ರಕರಣ ${fir.firNo} ${fir.station}, ${fir.district} ನಲ್ಲಿ ನೋಂದಾಯಿಸಲಾಗಿದೆ. ಆರೋಪಿ: ${fir.accusedName}.`,
          category: categories[idx % categories.length],
          officer: fir.station || 'System',
          badge: `KSP-${1000 + idx}`,
        }));
        if (builtTimeline.length > 0) setTimelineEvents(builtTimeline);

      } catch (err) {
        console.error("Error fetching live data in CommandCenter:", err);
        setFirs(mockFIRs);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Background Alert Scheduler checking crime threshold metrics dynamically
  useEffect(() => {
    const alertTimer = setInterval(() => {
      // Simulate checking live database anomaly thresholds (e.g. crime rate spike)
      const thresholdSpike = Math.random() > 0.65;
      if (thresholdSpike && firs.length > 0) {
        const randomCase = firs[Math.floor(Math.random() * firs.length)];
        const isKn = lang === "kn";
        addToast(
          isKn ? "ಅಪರಾಧ ಎಚ್ಚರಿಕೆ ಸಿಗ್ನಲ್ ಪತ್ತೆಯಾಗಿದೆ!" : "Proactive Crime Threshold Alert!",
          isKn 
            ? `${randomCase.station} ವಲಯದಲ್ಲಿ ಹೊಸ ${randomCase.crimeType || "ಅಪರಾಧ"} ಪ್ರಕರಣ ದಾಖಲಾಗಿದೆ. ತಕ್ಷಣದ ನಿಗಾ ವಹಿಸಿ.` 
            : `Caseload threshold limit crossed at ${randomCase.station || "Station Grid"}. Case ${randomCase.firNo} registered.`,
          "Critical"
        );
      }
    }, 15000); // check threshold every 15 seconds

    return () => clearInterval(alertTimer);
  }, [firs, lang, addToast]);

  // States for Optimal Patrol Routing deployment simulation
  const [activeRouteId, setActiveRouteId] = useState<
    "ALPHA" | "BETA" | "GAMMA"
  >("ALPHA");
  const [deployedRoutes, setDeployedRoutes] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  const handleDeployPatrol = (routeId: string) => {
    setIsDeploying(true);
    setDeployLogs([
      "[INIT] Compiling cryptographic KSP dispatch coordinates...",
      "[GRID] Transmitting vector maps to field swarmers...",
    ]);

    setTimeout(() => {
      setDeployLogs((prev) => [
        ...prev,
        "[COMMS] Blue-Hawk unit transceiver handshake online...",
        "[GPS] Waypoint routing vectors verified on unit dashboard.",
      ]);
    }, 700);

    setTimeout(() => {
      setDeployedRoutes((prev) => [...prev, routeId]);
      setIsDeploying(false);
      addToast(
        "Squad Dispatched Successfully / ಗಸ್ತು ನಿಯೋಜಿಸಲಾಗಿದೆ",
        `KSP Blue-Hawk patrol squad has been dynamically dispatched to Route ${routeId}. Tactical GPS grids activated.`,
        "Success",
      );
    }, 1500);
  };

  // Live streaming ticker states & dynamic array
  const [tickerIndex, setTickerIndex] = useState(0);
  const tickerItems = [
    {
      type: "FIR REGISTRY",
      text: "FIR-2026-0811 at Kengeri PS: Theft of industrial metals updated for suspect Rowdy Ramesh.",
      time: "1m ago",
    },
    {
      type: "THREAT ANOMALY",
      text: "GRID AL-4011 Peenya Sector 3: Hotspot cell count breached (High DBSCAN Density: 87.5%).",
      time: "3m ago",
    },
    {
      type: "COURT TRANSITION",
      text: "ACC-4109 Court custody status: Bail hearing assigned to Magistrate Court 4.",
      time: "8m ago",
    },
    {
      type: "CHARGE SHEET",
      text: "FIR-2025-4121 status transitioned to [Charge Sheet Filed] for Peenya Industrial area.",
      time: "15m ago",
    },
    {
      type: "DEMOGRAPHIC HAZARD",
      text: "Bengaluru West division: Cybercrime threat index surged (+12.4% trend increase).",
      time: "22m ago",
    },
    {
      type: "SYS AUDIT FOOTPRINT",
      text: "Vajra Intel Desk: Bulk SHAP XGBoost re-run completed for 12,492 CCTNS logs.",
      time: "40m ago",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const activeAlertsCount = alerts.filter((a) => !a.isAcknowledged).length;

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, isAcknowledged: true } : alert,
      ),
    );
  };

  const handleQuickChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helperQuery.trim()) return;

    // Store quick query to show on the Chat screen
    localStorage.setItem("vajra_initial_chat_query", helperQuery);
    setCurrentScreen("ai_chat");
  };

  // Kannada i18n helper dictionary for the dashboard widgets
  const dictionary = {
    en: {
      kpiTotalFIRs: "Total Indexed FIRs",
      kpiTotalFIRsSub: "1.6M+ Historical Coverage",
      kpiActiveAlerts: "Critical Alerts Feed",
      kpiActiveAlertsSub: "Awaiting Action Desk",
      kpiDBSCANClusters: "DBSCAN Clusters",
      kpiDBSCANClustersSub: "Bengaluru Subsections",
      kpiConnectivity: "CCTNS Stream Lock",
      kpiConnectivitySub: "SEC-Platform Authenticated",
      liveFeedHeader: "Real-time AI Threat Broadcasts",
      embedHelperHeader: "Vajra Conversational Copilot",
      embedHelperDesc:
        "Ask in English or native Kannada voice/text. Responses are mathematically grounded mapped with sources.",
      queryPlaceholder:
        "Search suspects, vehicle plates, or station crime index...",
      sendBtn: "Launch Deep Query",
      miniHotspotHeader: "Spatial Core Hotspot Density KDE",
      hotspotSelectionText: "Select cluster node to fetch telemetry:",
      secAlertWarning: "CLASS I SECURE CHANNEL INTEL DATASTREAM",
      ackButton: "Acknowledge Thread",
      ackStatus: "Investigated & Stored",
    },
    kn: {
      kpiTotalFIRs: "ಒಟ್ಟು ದಾಖಲಾದ ಎಫ್ ಐ ಆರ್",
      kpiTotalFIRsSub: "೧.೬ ಮಿಲಿಯನ್ ಐತಿಹಾಸಿಕ ದಾಖಲೆಗಳು",
      kpiActiveAlerts: "ಗಂಭೀರ ಅಲರ್ಟ್‌ಗಳ ಫೀಡ್",
      kpiActiveAlertsSub: "ತ್ವರಿತ ಕ್ರಿಯೆಗೆ ಬಾಕಿ",
      kpiDBSCANClusters: "DBSCAN ಕ್ಲಸ್ಟರ್‌ಗಳು",
      kpiDBSCANClustersSub: "ಬೆಂಗಳೂರು ಉಪವಿಭಾಗೀಯ",
      kpiConnectivity: "ಸಿಐಎಸ್ ಸಿಂಕ್ರೊನೈಸೇಶನ್",
      kpiConnectivitySub: "ಸುರಕ್ಷಿತ ದೃಢೀಕರಣ ಸಕ್ರಿಯ",
      liveFeedHeader: "ನೈಜ-ಸಮಯದ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಎಚ್ಚರಿಕೆ ಫೀಡ್",
      embedHelperHeader: "ವಜ್ರ ಸಂಭಾಷಣಾತ್ಮಕ ಕೋಪೈಲಟ್",
      embedHelperDesc:
        "ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡ ಧ್ವನಿ/ಪಠ್ಯದಲ್ಲಿ ಪ್ರಶ್ನಿಸಿ. ಪ್ರತಿಕ್ರಿಯೆಗಳು ಮೂಲ ದಾಖಲೆಗಳೊಂದಿಗೆ ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿವೆ.",
      queryPlaceholder: "ಆರೋಪಿಗಳು, ವಾಹನ ಸಂಖ್ಯೆ ಅಥವಾ ಅಪರಾಧ ನಕ್ಷೆ ತಿಳಿಯಿರಿ...",
      sendBtn: "ಸುಧಾರಿತ ತನಿಖೆ ಪ್ರಾರಂಭಿಸಿ",
      miniHotspotHeader: "ಪ್ರಾದೇಶಿಕ ಹಾಟ್‌ಸ್ಪಾಟ್ ಸಾಂದ್ರತೆ ವಿಶ್ಲೇಷಣೆ",
      hotspotSelectionText: "ಟೆಲಿಮೆಟ್ರಿ ವೀಕ್ಷಿಸಲು ಕ್ಲಸ್ಟರ್ ಆರಿಸಿ:",
      secAlertWarning: "ವರ್ಗೀಕೃತ ಸರ್ಕಾರಿ ಗುಪ್ತಚರ ಡೇಟಾ ಚಾನೆಲ್",
      ackButton: "ದೃಡೀಕರಿಸಿ",
      ackStatus: "ತನಿಖೆ ನಡೆಸಲಾಗಿದೆ",
    },
  }[lang];

  if (isLoading) {
    return <CommandCenterSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in font-sans">
      {/* Top Banner Warning/Info Stripe */}
      <div className="bg-[#FF9933]/5 border-l-4 border-[#FF9933] p-3 rounded-r-lg flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center space-x-2">
          <AlertOctagon className="w-4 h-4 text-[#FF9933] shrink-0" />
          <span className="font-mono font-bold tracking-wide uppercase">
            {dictionary.secAlertWarning}
          </span>
        </div>
        <div className="font-mono text-slate-500 hidden sm:block">
          TIMESTAMP: 2026-06-23 UTC
        </div>
      </div>

      {/* Live Incident Ticker */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center overflow-hidden h-10 text-xs font-mono relative uppercase shadow-md select-none">
        <div className="flex items-center text-[#EF4444] font-bold border-r border-slate-800 pr-3.5 shrink-0 select-none">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] inline-block animate-ping mr-2"></span>
          <Radio className="w-3.5 h-3.5 text-[#EF4444] mr-1.5 shrink-0" />
          <span>LIVE COMMAND STREAM</span>
        </div>
        <div className="flex-1 overflow-hidden px-4 relative flex items-center h-full">
          <div
            key={tickerIndex}
            className="animate-fade-in flex flex-row items-center space-x-3.5 text-left w-full"
          >
            <span className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0">
              {tickerItems[tickerIndex].type}
            </span>
            <span className="text-slate-300 font-sans tracking-wide truncate max-w-[200px] sm:max-w-md md:max-w-xl xl:max-w-2xl">
              {tickerItems[tickerIndex].text}
            </span>
            <span className="text-amber-500 font-bold shrink-0 ml-auto flex items-center space-x-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>{tickerItems[tickerIndex].time}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Command Center Tab Bar */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setCommandTab("overview")}
          className={`px-5 py-3 text-xs font-bold font-mono uppercase border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            commandTab === "overview"
              ? "border-[#1D4ED8] text-[#1D4ED8]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>
            {lang === "en"
              ? "Global Operational Overview"
              : "ಜಾಗತಿಕ ಕಾರ್ಯಾಚರಣೆಯ ಅವಲೋಕನ"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selectedFirNo) {
              addToast(
                "No Case Selected",
                "Please select an FIR case from the directory below to unlock surgical focus.",
                "Warning",
              );
              return;
            }
            setCommandTab("case_focus");
          }}
          className={`px-5 py-3 text-xs font-bold font-mono uppercase border-b-2 transition-all cursor-pointer flex items-center space-x-2 relative ${
            commandTab === "case_focus"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FolderOpen
            className={`w-4 h-4 ${selectedFirNo ? "text-amber-500 animate-pulse" : ""}`}
          />
          <span>
            {lang === "en"
              ? `Surgical Case Focus ${selectedFirNo ? `(${selectedFirNo})` : ""}`
              : `ನಿರ್ದಿಷ್ಟ ಪ್ರಕರಣದ ಗಮನ ${selectedFirNo ? `(${selectedFirNo})` : ""}`}
          </span>
          {selectedFirNo && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
          )}
        </button>
      </div>

      {commandTab === "overview" ? (
        <>
          {/* KPI 4-Grid Dashboard Indicators */}
          <CommandCenterKPI
            lang={lang}
            totalFIRsCount={summaryData?.total_cases || firs.length}
            activeAlertsCount={activeAlertsCount}
            highRiskHotspotsCount={liveHotspots.length || mockHotspots.length}
            totalAccused={summaryData?.total_accused || 0}
            districtCount={summaryData?.district_count || 0}
            stationCount={summaryData?.station_count || 0}
          />

          {/* 5. CCTNS Recharts Monthly Crime Trends Dashboard */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-2 kn-text">
                  <Activity className="w-4 h-4 text-[#1D4ED8]" />
                  <span>
                    {lang === "en"
                      ? "SCRB Automated Crime Trend Index & Forecasts"
                      : "ಎಸ್‌ಸಿಆರ್‌ಬಿ ಮಾಸಿಕ ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ಮತ್ತು ಮುನ್ಸೂಚನೆ"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 kn-text">
                  {lang === "en"
                    ? "Mathematical monthly category patterns evaluated across 1,100 Karnataka stations (XGBoost Analysis)"
                    : "೧,೧೦೦ ಕ್ಕೂ ಹೆಚ್ಚು ಪೊಲೀಸ್ ಠಾಣೆಗಳಿಂದ ವಿಶ್ಲೇಷಿಸಲಾದ ವರ್ಗವಾರು ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ಸೂಚ್ಯಂಕ"}
                </p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[10px] bg-[#00C6AD]/10 text-[#008F7C] border border-[#00C6AD]/25 px-2 py-0.5 rounded font-mono font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C6AD] animate-pulse"></span>
                  <span>FORECAST MODEL: ACTIVE</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Chart 1: Area chart showing Property and Violent Crimes */}
              <div className="space-y-2">
                <div className="text-[12px] font-bold text-slate-700 font-mono tracking-wide uppercase">
                  {lang === "en"
                    ? "A. Volumetric Security Index Trends"
                    : "ಎ. ಮಾಸಿಕ ಅಪರಾಧ ತೀವ್ರತೆ ಸೂಚ್ಯಂಕ"}
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyTrendData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorProperty"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#1D4ED8"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#1D4ED8"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorViolent"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#FF9933"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#FF9933"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        axisLine={{ stroke: "#CBD5E1" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        axisLine={{ stroke: "#CBD5E1" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "6px",
                        }}
                        labelStyle={{
                          color: "#F8FAFC",
                          fontWeight: "bold",
                          fontSize: "11px",
                        }}
                        itemStyle={{ color: "#E2E8F0", fontSize: "11px" }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                      <Area
                        name={
                          lang === "en"
                            ? "Property Crimes Index"
                            : "ಆಸ್ತಿ ಅಪರಾಧಗಳು"
                        }
                        type="monotone"
                        dataKey="PropertyCrime"
                        stroke="#1D4ED8"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProperty)"
                      />
                      <Area
                        name={
                          lang === "en"
                            ? "Violent Crimes Index"
                            : "ದೈಹಿಕ ದೌರ್ಜನ್ಯ"
                        }
                        type="monotone"
                        dataKey="ViolentCrime"
                        stroke="#FF9933"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorViolent)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Bar chart showing Cybercrime and Burglary details */}
              <div className="space-y-2">
                <div className="text-[12px] font-bold text-slate-700 font-mono tracking-wide uppercase">
                  {lang === "en"
                    ? "B. Cyber & Burglary Core Distribution"
                    : "ಬಿ. ಸೈಬರ್ ಅಪರಾಧ ಮತ್ತು ಮನೆಗಳ್ಳತನ ಪ್ರವೃತ್ತಿ"}
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyTrendData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        axisLine={{ stroke: "#CBD5E1" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        axisLine={{ stroke: "#CBD5E1" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "6px",
                        }}
                        labelStyle={{
                          color: "#F8FAFC",
                          fontWeight: "bold",
                          fontSize: "11px",
                        }}
                        itemStyle={{ color: "#E2E8F0", fontSize: "11px" }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="rect"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                      <Bar
                        name={
                          lang === "en" ? "Cybercrime Spikes" : "ಸೈಬರ್ ಅಪರಾಧ"
                        }
                        dataKey="Cybercrime"
                        fill="#00C6AD"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        name={lang === "en" ? "Burglary Events" : "ಮನೆಗಳ್ಳತನ"}
                        dataKey="Burglary"
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Main Panel grid bifurcation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Alerts Feed & Embedded AI Copilot (Col Span 7) */}
            <div className="lg:col-span-7 space-y-6">
              {/* 1. Live Alerts Feed Panel */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-2 kn-text">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping"></span>
                    <span>{dictionary.liveFeedHeader}</span>
                  </h3>
                  <button
                    onClick={() => setCurrentScreen("alerts_feed")}
                    className="text-xs text-[#1D4ED8] hover:underline font-bold flex items-center space-x-0.5"
                  >
                    <span>
                      {lang === "en" ? "Open Dashboard" : "ಎಲ್ಲವನ್ನೂ ವೀಕ್ಷಿಸಿ"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`border rounded-lg p-3.5 transition-all text-[12px] flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                        alert.isAcknowledged
                          ? "bg-slate-50 border-slate-200 opacity-75"
                          : alert.severity === "Critical"
                            ? "bg-red-50/50 border-red-200"
                            : "bg-amber-50/50 border-amber-200"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                              alert.severity === "Critical"
                                ? "bg-[#EF4444] text-white"
                                : "bg-[#FF9933] text-white"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="font-mono text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {alert.timestamp.split(" ")[1]}
                          </span>
                          <span className="text-slate-500 font-bold">
                            ({alert.station})
                          </span>
                        </div>

                        <div className="font-bold text-slate-900 text-[12.5px] kn-text leading-tight">
                          {alert.type}
                        </div>
                        <p className="text-slate-600 kn-text leading-relaxed mt-1">
                          {alert.details}
                        </p>
                      </div>

                      <div className="shrink-0 pt-1">
                        {!alert.isAcknowledged ? (
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="bg-white border border-slate-200 hover:border-[#1D4ED8] text-[#1D4ED8] hover:bg-blue-50/50 text-[11px] font-bold px-2.5 py-1.5 rounded transition-colors"
                          >
                            {dictionary.ackButton}
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-bold flex items-center space-x-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-[10px]">
                            <CheckCircle className="w-3 h-3 shrink-0" />
                            <span>{dictionary.ackStatus}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Embedded Conversational AI helper box (Strict AI Teal design block) */}
              <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 rounded-r-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[#00C6AD]">
                    <Sparkles className="w-4 h-4 text-[#00C6AD]" />
                    <h3 className="text-[12px] font-bold uppercase tracking-wider font-mono">
                      {dictionary.embedHelperHeader}
                    </h3>
                  </div>
                  <span className="text-[10px] bg-[#00C6AD]/10 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded">
                    GEMINI-2.5-FLASH
                  </span>
                </div>

                <p className="text-[12px] text-slate-600 leading-relaxed font-sans kn-text">
                  {dictionary.embedHelperDesc}
                </p>

                <form onSubmit={handleQuickChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={dictionary.queryPlaceholder}
                    value={helperQuery}
                    onChange={(e) => setHelperQuery(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[#00C6AD] focus:border-[#00C6AD]"
                  />
                  {/* STRICT RULE 6: Only 1 primary --blue-primary button. We are on CommandCenter, which can have 1 filled button. If not, this is outline. Let's make it styled filled since it's the primary submit inside the widget, or clean dark blue. */}
                  <button
                    type="submit"
                    className="bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center space-x-1.5 shrink-0 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    <span>{dictionary.sendBtn}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Socio-Demographic Correlation Chart - OpenCity Census Integration */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
                <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-900 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-[#10B981]" />
                    <span>{lang === "en" ? "District Socio-Demographic Correlation" : "ಜಿಲ್ಲಾವಾರು ಸಾಮಾಜಿಕ-ಅಪರಾಧ ಸಹ-ಸಂಬಂಧ"}</span>
                  </h4>
                  <span className="text-[9.5px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-bold uppercase">
                    OpenCity Mapped
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 font-medium">
                  {lang === "en" 
                    ? "Live cross-referencing of Census Unemployment indices against active FIR caseload volumes." 
                    : "ಒಟ್ಟು ದಾಖಲಾದ ಪ್ರಕರಣಗಳ ವಿರುದ್ಧ ಜನಗಣತಿಯ ನಿರುದ್ಯೋಗ ಸೂಚ್ಯಂಕದ ಹೋಲಿಕೆ."}
                </p>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summaryData?.district_demographics || [
                        { district: "Bengaluru", unemploymentRate: 4.2, caseVolume: 35 },
                        { district: "Belagavi", unemploymentRate: 6.8, caseVolume: 22 },
                        { district: "Mysuru", unemploymentRate: 5.9, caseVolume: 18 },
                        { district: "Ballari", unemploymentRate: 9.4, caseVolume: 29 },
                        { district: "Kalaburagi", unemploymentRate: 9.8, caseVolume: 41 }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="district" tick={{ fill: "#64748B", fontSize: 9 }} />
                      <YAxis tick={{ fill: "#64748B", fontSize: 9 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar name={lang === "en" ? "Unemployment Rate %" : "ನಿರುದ್ಯೋಗ ದರ %"} dataKey="unemploymentRate" fill="#D97706" radius={[3, 3, 0, 0]} />
                      <Bar name={lang === "en" ? "Crime Volume (FIRs)" : "ಅಪರಾಧ ಪ್ರಕರಣಗಳು"} dataKey="caseVolume" fill="#1D4ED8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Incident Timeline Component - Live Data */}
              <IncidentTimeline lang={lang} events={timelineEvents.length > 0 ? timelineEvents : undefined} />
            </div>

            {/* Right Column: Mini Map & Coordinate Analytics (Col Span 5) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4 flex flex-col h-full">
                <h3 className="text-[14px] font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2 kn-text">
                  <MapPin className="w-4 h-4 text-[#1D4ED8]" />
                  <span>{dictionary.miniHotspotHeader}</span>
                </h3>

                {/* Simulated Interactive Vector Map of Bengaluru Hotspot Coordinates */}
                <div className="bg-slate-900 aspect-square rounded-lg relative overflow-hidden flex items-center justify-center border border-slate-800 select-none">
                  {/* Simulated GPS grid overlays */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>

                  <div className="absolute top-2 left-2 text-[9px] font-mono text-slate-500">
                    GRID AREA: BENGALURU-URBAN CENTRAL
                  </div>

                  {/* Graphical representation of the city divisions */}
                  <div className="w-4/5 h-4/5 border border-slate-800/60 rounded-full absolute opacity-30 flex items-center justify-center">
                    <div className="w-3/5 h-3/5 border border-slate-800/60 rounded-full flex items-center justify-center">
                      <div className="w-2/5 h-2/5 border border-slate-800/60 rounded-full"></div>
                    </div>
                  </div>

                  {/* Dynamic plotting of Hotspot coordinates from live data */}
                  {(liveHotspots.length > 0 ? liveHotspots : mockHotspots).map((hs: any, index: number) => {
                    // Map coordinates roughly into aspect box coordinates
                    const coords = hs.coordinates || [12.97, 77.59];
                    const minLng = Math.min(...(liveHotspots.length > 0 ? liveHotspots : mockHotspots).map((h: any) => (h.coordinates || [0, 77.45])[1])) - 0.02;
                    const maxLng = Math.max(...(liveHotspots.length > 0 ? liveHotspots : mockHotspots).map((h: any) => (h.coordinates || [0, 77.70])[1])) + 0.02;
                    const minLat = Math.min(...(liveHotspots.length > 0 ? liveHotspots : mockHotspots).map((h: any) => (h.coordinates || [12.92, 0])[0])) - 0.02;
                    const maxLat = Math.max(...(liveHotspots.length > 0 ? liveHotspots : mockHotspots).map((h: any) => (h.coordinates || [13.07, 0])[0])) + 0.02;
                    const xOffset = ((coords[1] - minLng) / (maxLng - minLng || 1)) * 80 + 10;
                    const yOffset = 100 - ((coords[0] - minLat) / (maxLat - minLat || 1)) * 80 - 10;

                    const isSelected = selectedHotspot === hs.id;

                    return (
                      <button
                        key={hs.id}
                        onClick={() => setSelectedHotspot(hs.id)}
                        className="absolute cursor-pointer group"
                        style={{
                          left: `${Math.min(90, Math.max(10, xOffset))}%`,
                          top: `${Math.min(90, Math.max(10, yOffset))}%`,
                        }}
                      >
                        <span
                          className={`absolute -left-3 -top-3 w-8 h-8 rounded-full border opacity-50 ${isSelected ? "animate-ping border-[#EF4444] bg-[#EF4444]/20" : "group-hover:scale-150 border-[#FF9933] bg-[#FF9933]/10 transition-transform"}`}
                        ></span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform hover:scale-125 ${isSelected ? "bg-[#EF4444] border-white" : "bg-[#FF9933] border-slate-900"}`}
                        >
                          <span className="text-[7px] text-white font-bold leading-none">
                            {index + 1}
                          </span>
                        </div>
                        <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 w-48 bg-slate-950/95 border border-slate-800 text-slate-200 text-[10px] p-2 rounded shadow-2xl z-50 pointer-events-none font-mono">
                          <div className="font-bold text-white border-b border-slate-800 pb-0.5 truncate">
                            {hs.name}
                          </div>
                          <div className="flex justify-between mt-1 text-[#00C6AD]">
                            <span>CONFIDENCE</span>
                            <span className="font-bold">{hs.confidence}%</span>
                          </div>
                          <div className="text-slate-400 mt-0.5 truncate">
                            Crime: {hs.dominantCrime}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Legend checklist */}
                  <div className="absolute bottom-2 right-2 bg-slate-950/80 border border-slate-800 p-2 rounded font-mono text-[8px] text-slate-400 space-y-1 leading-none">
                    <div className="text-white font-bold pb-0.5 uppercase tracking-wider">
                      KDE Density Map
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>
                      <span>Primary Hotspots (DBSCAN)</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933]"></span>
                      <span>Anomalies Flagged</span>
                    </div>
                  </div>
                </div>

                {/* Selected hotspot telemetry panel */}
                <div className="flex-1 flex flex-col justify-end">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {dictionary.hotspotSelectionText}
                  </span>

                  {selectedHotspot ? (
                    (() => {
                      const hotspotSource = liveHotspots.length > 0 ? liveHotspots : mockHotspots;
                      const hs = hotspotSource.find(
                        (h: any) => h.id === selectedHotspot,
                      ) || hotspotSource[0];
                      return (
                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 animate-fade-in">
                          <div className="flex justify-between items-start">
                            <span className="text-[13px] font-bold text-slate-900 leading-tight kn-text">
                              {hs.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-red-100 text-red-800 rounded">
                              {hs.crimeDensity} risk
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                            <div className="bg-white p-1.5 rounded border border-slate-100">
                              <span className="block text-slate-400 text-[9px]">
                                DBSCAN CONFIDENCE
                              </span>
                              <span className="font-bold text-slate-900">
                                {hs.confidence}% accuracy
                              </span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-slate-100">
                              <span className="block text-slate-400 text-[9px]">
                                DOMINANT CRIME TYPE
                              </span>
                              <span className="font-bold text-slate-900 truncate block">
                                {hs.dominantCrime}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between text-[11px] font-mono border-t border-slate-200/60 pt-2 text-slate-500">
                            <span>
                              COORDINATES: lat={hs.coordinates[0]}, lng=
                              {hs.coordinates[1]}
                            </span>
                            <button
                              onClick={() => setCurrentScreen("spatial")}
                              className="text-[#1D4ED8] font-bold hover:underline"
                            >
                              {lang === "en"
                                ? "Launch Spatial Desk"
                                : "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಿಶ್ಲೇಷಣೆ"}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mt-2 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-[12px] kn-text bg-slate-50">
                      {lang === "en"
                        ? "Click any coordinate bubble above to load algorithmic Density metrics."
                        : "ಸಾಂದ್ರತೆಯ ಮೆಟ್ರಿಕ್ಸ್ ಲೋಡ್ ಮಾಡಲು ಯಾವುದೇ ಕ್ಲಸ್ಟರ್ ಆರಿಸಿ."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 6. AI-Suggested Optimal Patrol Deployment Routing (KSP Smart Dispatch) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
              <div>
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-2 kn-text">
                  <Radio className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
                  <span>
                    {lang === "en"
                      ? "AI-Suggested Optimal Patrol Deployment Routing"
                      : "ಶಿಫಾರಸು ಮಾಡಲಾದ ಗಸ್ತು ನಿಯೋಜನಾ ಮಾರ್ಗ ಮಾರ್ಗದರ್ಶನ"}
                  </span>
                </h3>
                <p className="text-[11.5px] text-slate-400 mt-0.5 font-sans leading-relaxed">
                  {lang === "en"
                    ? "Dynamically derived patrol waypoints routing based on density contours of DBSCAN analysis hotspots. Suggests optimal deployment nodes and times."
                    : "DBSCAN ವಿಶ್ಲೇಷಣಾತ್ಮಕ ಸಾಂದ್ರತೆಯ ಆಧಾರದ ಮೇಲೆ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಶಿಫಾರಸು ಮಾಡಿದ ಗಸ್ತು ಮಾರ್ಗ ಮತ್ತು ಸಮಯ ಅನುಸೂಚಿ."}
                </p>
              </div>
              <span className="text-[9px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold uppercase shrink-0 self-start sm:self-auto">
                Tactical Smart Pathing
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left">
              {/* Active Route Selectors (Col span 4) */}
              <div className="lg:col-span-4 space-y-2.5">
                {[
                  {
                    id: "ALPHA",
                    name:
                      lang === "en"
                        ? "Route Alpha (Peenya Corridor)"
                        : "ಮಾರ್ಗ ಆಲ್ಫಾ (ಪೀಣ್ಯ ಕಾರಿಡಾರ್)",
                    risk: "Critical 94.6%",
                    color: "border-red-200 text-red-900 bg-red-50/20",
                  },
                  {
                    id: "BETA",
                    name:
                      lang === "en"
                        ? "Route Beta (Majestic Central)"
                        : "ಮಾರ್ಗ ಬೀಟಾ (ಮೆಜೆಸ್ಟಿಕ್ ಸೆಂಟ್ರಲ್)",
                    risk: "Elevated 82.1%",
                    color: "border-amber-200 text-amber-900 bg-amber-50/20",
                  },
                  {
                    id: "GAMMA",
                    name:
                      lang === "en"
                        ? "Route Gamma (Cubbon IT Precinct)"
                        : "ಮಾರ್ಗ ಗ್ಯಾಮ (ಕಬ್ಬನ್ ಐಟಿ ವಲಯ)",
                    risk: "Medium 54.8%",
                    color:
                      "border-emerald-200 text-emerald-950 bg-emerald-50/25",
                  },
                ].map((route) => {
                  const active = activeRouteId === route.id;
                  const isDeployed = deployedRoutes.includes(route.id);
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveRouteId(route.id as any)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        active
                          ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-500 shadow-sm font-bold"
                          : "border-slate-200 hover:bg-slate-50"
                      } cursor-pointer relative block`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-extrabold text-[12.5px] font-sans leading-tight text-slate-900">
                          {route.name}
                        </span>
                        <span className="text-[8.5px] font-mono bg-slate-100 font-bold px-1.5 py-0.2 rounded shrink-0">
                          {route.risk}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isDeployed ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`}
                        ></span>
                        <span className="text-[9.5px] text-slate-400 font-mono font-bold uppercase">
                          {isDeployed
                            ? lang === "en"
                              ? "Squad Deployed"
                              : "ಸಿಬ್ಬಂದಿ ನಿಯೋಜಿಸಲಾಗಿದೆ"
                            : lang === "en"
                              ? "Awaiting Dispatch"
                              : "ನಿಯೋಜನೆಗೆ ಬಾಕಿ"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Route Waypoints & Core suggestions (Col span 5) */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-between">
                {(() => {
                  const detailsMap: Record<string, any> = {
                    ALPHA: {
                      start:
                        lang === "en"
                          ? "Kengeri Division Headquarters"
                          : "ಕೆಂಗೇರಿ ವಿಭಾಗೀಯ ಪೊಲೀಸ್ ಪ್ರಧಾನ ಕಚೇರಿ",
                      waypoints:
                        lang === "en"
                          ? [
                              "Peenya Industrial Subsector 2",
                              "Nagasandra Metro Junction Grid",
                              "Peenya Metal Warehouse Zone",
                            ]
                          : [
                              "ಪೀಣ್ಯ ಕೈಗಾರಿಕಾ ಉಪವಲಯ ೨",
                              "ನಾಗಸಂದ್ರ ಮೆಟ್ರೋ ಜಂಕ್ಷನ್ ಗ್ರಿಡ್",
                              "ಪೀಣ್ಯ ಲೋಹದ ಗೋದಾಮು ವಲಯ",
                            ],
                      targetHour: "11:00 PM - 03:30 AM",
                      unit: "KSP Blue-Hawk Squad 4 (Blue Swarmer interceptor)",
                      rationale:
                        lang === "en"
                          ? "Active property theft cluster detected under DBSCAN. Highly matches rowdy Ramesh recidivism timelines."
                          : "ಅಪರಾಧಿ ರೋಡಿ ರಮೇಶ್ ಇರುವ ಅದೇ ಸ್ಥಳದಲ್ಲಿ ಪತ್ತೆಯಾದ ಆಸ್ತಿ ಕಳ್ಳತನ ಕ್ಲಸ್ಟರ್.",
                    },
                    BETA: {
                      start:
                        lang === "en"
                          ? "Majestic Central Bus Stand Station"
                          : "ಮೆಜೆಸ್ಟಿಕ್ ಕೇಂದ್ರೀಯ ಬಸ್ ನಿಲ್ದಾಣ ಪೊಲೀಸ್ ಠಾಣೆ",
                      waypoints:
                        lang === "en"
                          ? [
                              "KSR Railway Entry Gantry",
                              "Kempegowda Underpass Core",
                              "Chamarajapet East Terminal",
                            ]
                          : [
                              "ಕೆಎಸ್‌ಆರ್ ರೈಲ್ವೆ ನಿಲ್ದಾಣ ಪ್ರವೇಶ",
                              "ಕೆಂಪೇಗೌಡ ಅಂಡರ್‌ಪಾಸ್ ಕೋರ್",
                              "ಚಾಮರಾಜಪೇಟೆ ಪೂರ್ವ ಟರ್ಮಿನಲ್",
                            ],
                      targetHour: "05:30 PM - 09:30 PM",
                      unit: "West Division Hawk-15 (Two patrol bikes)",
                      rationale:
                        lang === "en"
                          ? "High frequency pickpocketing and device snatching during rush hour traffic congestion grids."
                          : "ರಶ್ ಅವರ್ ಗರಿಷ್ಠ ಸಂಚಾರ ದಟ್ಟಣೆಯ ಸಮಯದಲ್ಲಿ ಜೇಬುಕಳ್ಳತನ ಜಾಲ ಪತ್ತೆ.",
                    },
                    GAMMA: {
                      start:
                        lang === "en"
                          ? "Cubbon Park Police Outpost"
                          : "ಕಬ್ಬನ್ ಪಾರ್ಕ್ ಪೊಲೀಸ್ ಹೊರಠಾಣೆ",
                      waypoints:
                        lang === "en"
                          ? [
                              "Kasturba Road IT Gantry",
                              "Indiranagar 100ft Road intersection",
                              "Metro Phase 2 construction hub",
                            ]
                          : [
                              "ಕಸ್ತೂರ್ಬಾ ರಸ್ತೆ ಐಟಿ ಗ್ಯಾಂಟ್ರಿ",
                              "ಇಂದಿರಾನಗರ ೧೦೦ ಅಡಿ ರಸ್ತೆ ಜಂಕ್ಷನ್",
                              "ಮೆಟ್ರೋ ಹಂತ ೨ ನಿರ್ಮಾಣ ಕೇಂದ್ರ",
                            ],
                      targetHour: "09:00 AM - 12:30 PM",
                      unit: "Central Precinct Blue Swarmer 1",
                      rationale:
                        lang === "en"
                          ? "Elevated violent assault profiles and evening POS/cyber phishing activities near terminal nodes."
                          : "ಸಂಜೆ ವೇಳೆ ಸೈಬರ್ ವಂಚನೆ ಮತ್ತು ವೈಯಕ್ತಿಕ ಗಲಾಟೆಗಳು ಘಟಿಸುವ ಹಾಟ್‌ಸ್ಪಾಟ್.",
                    },
                  };

                  const d = detailsMap[activeRouteId];
                  const isDeployed = deployedRoutes.includes(activeRouteId);

                  return (
                    <div className="space-y-3 text-xs leading-relaxed flex flex-col justify-between h-full">
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono border-b border-slate-200 pb-1 flex justify-between">
                          <span>
                            {lang === "en"
                              ? "Waypoints & Dispatch Data"
                              : "ಹೆಚ್ಚುವರಿ ಗಸ್ತು ವಿವರ"}
                          </span>
                          <span>ACTIVE SECTOR VIEW</span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                              {lang === "en"
                                ? "STARTING BASE / ಘಟಕ ಪ್ರಧಾನ ಕಚೇರಿ:"
                                : "ಪ್ರಾರಂಭದ ಬೇಸ್:"}
                            </span>
                            <span className="font-extrabold text-slate-850 block">
                              {d.start}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold mb-1">
                              {lang === "en"
                                ? "SUGGESTED DISPATCH PATHWAY / ಗಸ್ತು ಮಾರ್ಗಸೂಚಿ:"
                                : "ಶಿಫಾರಸು ಮಾಡಿದ ಗಸ್ತು ಮಾರ್ಗ:"}
                            </span>
                            <div className="relative pl-3.5 border-l-2 border-dashed border-red-300 space-y-1.5 font-mono text-[10.5px]">
                              {d.waypoints.map((wp: string, idx: number) => (
                                <div key={idx} className="relative">
                                  <span className="absolute -left-[18.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  <span className="font-semibold text-slate-800">
                                    {wp}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[9.5px]">
                            <div className="bg-white p-1.5 border border-slate-200/60 rounded">
                              <span className="block text-slate-400 text-[7.5px] font-sans font-bold uppercase">
                                {lang === "en"
                                  ? "PATROL HOURS / ಸಮಯ:"
                                  : "ಗಸ್ತು ಸಮಯ:"}
                              </span>
                              <span className="font-bold text-slate-900">
                                {d.targetHour}
                              </span>
                            </div>
                            <div className="bg-white p-1.5 border border-slate-200/60 rounded">
                              <span className="block text-slate-400 text-[7.5px] font-sans font-bold uppercase">
                                {lang === "en"
                                  ? "ALLOCATED UNIT / ಸಿಬ್ಬಂದಿ:"
                                  : "ನಿಯೋಜಿತ ತಂಡ:"}
                              </span>
                              <span className="font-bold text-slate-900 truncate block">
                                {d.unit}
                              </span>
                            </div>
                          </div>

                          <div className="bg-blue-50/50 p-2 text-[10px] rounded border border-blue-100 text-slate-650 leading-relaxed font-sans">
                            <b>
                              {lang === "en"
                                ? "Tactical Rationale:"
                                : "ತಂತ್ರಜ್ಞಾನದ ಆಧಾರ:"}
                            </b>{" "}
                            {d.rationale}
                          </div>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          disabled={isDeployed || isDeploying}
                          onClick={() => handleDeployPatrol(activeRouteId)}
                          className="w-full bg-[#EF4444] hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center space-x-2 shadow-md hover:shadow-red-500/10 cursor-pointer transition-all"
                        >
                          <Radio className="w-4 h-4 text-white shrink-0" />
                          <span className="text-[11.5px]">
                            {isDeployed
                              ? lang === "en"
                                ? "Squad Commissioned to Coordinates"
                                : "ಗಸ್ತು ಯಶಸ್ವಿಯಾಗಿ ನಿಯೋಜಿಸಲಾಗಿದೆ"
                              : isDeploying
                                ? lang === "en"
                                  ? "Transmitting GPS Dispatch..."
                                  : "ವೈರ್‌ಲೆಸ್ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ..."
                                : lang === "en"
                                  ? "Deploy Patrol Squad To Waypoints"
                                  : "ಗಸ್ತು ತಂಡವನ್ನು ನಿಯೋಜಿಸಿ"}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Dispatch telemetry real-time log terminal (Col span 3) */}
              <div className="lg:col-span-3 bg-slate-900 border border-slate-850 rounded-xl p-4 flex flex-col justify-between h-full select-none">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1.5 text-slate-400 font-mono text-[9px] uppercase tracking-wider font-bold justify-between">
                    <span>Radio Telemetry Log</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  </div>

                  <div className="font-mono text-[9px] text-slate-350 space-y-1.5 max-h-[140px] overflow-y-auto leading-normal text-left">
                    <div>
                      [02:00 AM] [SYSTEM] Vajra grid intercept analysis
                      active...
                    </div>
                    <div>
                      [02:11 AM] [INTELLIGENCE] Hotspot threat weights
                      converged.
                    </div>

                    {deployLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="text-emerald-400 animate-fade-in font-bold"
                      >
                        {log}
                      </div>
                    ))}

                    {deployedRoutes.includes(activeRouteId) && (
                      <div className="text-[#00C6AD] font-bold">
                        [ONLINE] Blue-Hawk Squad monitoring coordinates.
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-2 text-[8px] font-mono text-slate-500 leading-tight">
                  KSP SECURE RADIO TRANSMISSION CHANNEL. ALL GPS DISPATCH
                  BLUEPRINTS ARE CRYPTOGRAPHICALLY ENCRYPTED.
                </div>
              </div>
            </div>
          </div>

          {/* CCTNS Case Chronicle section removed - available via FIR Repository screen */}
        </>
      ) : (
        selectedFirNo && (
          <SurgicalCaseFocusView
            firNo={selectedFirNo}
            lang={lang}
            setCurrentScreen={setCurrentScreen}
            addToast={addToast}
            setSelectedFirNo={setSelectedFirNo}
            setCommandTab={setCommandTab}
          />
        )
      )}
    </div>
  );
};
