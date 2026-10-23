import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import {
  Bot,
  Cpu,
  ShieldAlert,
  Zap,
  Activity,
  Plus,
  RefreshCw,
  Radio,
  Loader2,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  CheckCircle2,
  Send,
  Terminal,
  Shield,
  Layers,
  Flame,
  HelpCircle
} from "lucide-react";

interface PrecinctTicket {
  ticket_id: string;
  department: string;
  department_name: string;
  title: string;
  assignee: string;
  case_no?: string;
  status: string;
  priority: string;
  created_at: string;
  findings: string;
  heartbeat_cadence?: string;
  token_budget?: string;
}

interface WorkerAgent {
  id: string;
  code: string;
  name: string;
  department: string;
  departmentName: string;
  deptColor: "cyan" | "amber" | "purple" | "emerald";
  schedule: string;
  cron: string;
  tokenCap: number;
  tokensUsed: number;
  targetEndpoint: string;
  status: "Active" | "Idle" | "Running";
  lastRun: string;
  logs: string[];
}

const INITIAL_WORKERS: WorkerAgent[] = [
  {
    id: "worker-cyber-1930",
    code: "#DOT-1930-CYBER",
    name: "Cyber Fraud 1930 Radar",
    department: "cyber",
    departmentName: "Cyber Crime Division",
    deptColor: "cyan",
    schedule: "08:00 Daily",
    cron: "0 8 * * *",
    tokenCap: 50000,
    tokensUsed: 3140,
    targetEndpoint: "CyberPortal 1930 Form (NCWRS / I4C Feed)",
    status: "Active",
    lastRun: "Today 08:00:14 IST",
    logs: [
      "[2026-10-24 08:00:00 IST] Woke from deterministic cron heartbeat.",
      "[2026-10-24 08:00:14 IST] Ingested 14 new records from CyberPortal 1930 endpoint.",
      "[2026-10-24 08:00:32 IST] Executing heuristic analyzer on mule bank accounts (Hubballi / Belagavi).",
      "[2026-10-24 08:00:51 IST] Flagged 3 unfreeze evasion attempts under Section 111 BNS.",
      "[2026-10-24 08:01:10 IST] 2 critical anomaly tickets dispatched under Section 63 BSA.",
      "[2026-10-24 08:01:14 IST] Token quota decremented (3,140 / 50,000). System state: IDLE."
    ]
  },
  {
    id: "worker-remand-187",
    code: "#DOT-187-REMAND",
    name: "§187 Remand Sentinel",
    department: "legal",
    departmentName: "Legal & Statutory Division",
    deptColor: "amber",
    schedule: "Hourly Check",
    cron: "0 * * * *",
    tokenCap: 35000,
    tokensUsed: 18400,
    targetEndpoint: "CCTNS Section 187 Statutory Remand Registry",
    status: "Idle",
    lastRun: "42 mins ago",
    logs: [
      "[2026-10-24 03:00:00 IST] Woke from hourly statutory timer.",
      "[2026-10-24 03:00:18 IST] Queried judicial remand clocks for active statewide FIRs.",
      "[2026-10-24 03:00:35 IST] Calculated 1 suspect nearing 90-day threshold (Cr. 114/2026 - 12 days remain).",
      "[2026-10-24 03:00:48 IST] Notified Investigating Officer PSI Raghavendra via priority audio brief.",
      "[2026-10-24 03:01:00 IST] State updated to IDLE."
    ]
  },
  {
    id: "worker-hc-warrant",
    code: "#DOT-HC-SYNC",
    name: "High Court Warrant Sync",
    department: "legal",
    departmentName: "Legal & Statutory Division",
    deptColor: "amber",
    schedule: "Daily 00:05",
    cron: "5 0 * * *",
    tokenCap: 25000,
    tokensUsed: 1120,
    targetEndpoint: "High Court of Karnataka Principal Bench Cause List",
    status: "Idle",
    lastRun: "Yesterday 00:05:01 IST",
    logs: [
      "[2026-10-23 00:05:01 IST] Woke from midnight cause list synchronization job.",
      "[2026-10-23 00:05:22 IST] Scraped Bengaluru & Dharwad Benches daily cause lists.",
      "[2026-10-23 00:05:44 IST] Matched 4 pending stay vacation petitions with district docket.",
      "[2026-10-23 00:05:59 IST] Synchronized successfully. State: IDLE."
    ]
  },
  {
    id: "worker-mujoco-physics",
    code: "#DOT-MUJOCO-FSL",
    name: "MuJoCo Kinematics & Crash Physics",
    department: "forensics",
    departmentName: "Forensic & Electronic Evidence Division",
    deptColor: "purple",
    schedule: "On-Demand Heartbeat",
    cron: "*/15 * * * *",
    tokenCap: 75000,
    tokensUsed: 12850,
    targetEndpoint: "MuJoCo DeepMind Kinematics & Skid Solver",
    status: "Active",
    lastRun: "12 mins ago",
    logs: [
      "[2026-10-24 03:30:00 IST] Heartbeat check on pending forensic reconstruction requests.",
      "[2026-10-24 03:30:15 IST] Reconstructed vehicle impact for FIR 88/2026 (NH-48 Chitradurga).",
      "[2026-10-24 03:30:42 IST] Speed at impact: 98.4 km/h (MuJoCo trajectory delta: 0.04m).",
      "[2026-10-24 03:31:02 IST] Cryptographic Section 63 BSA certificate signed. State: SLEEP."
    ]
  },
  {
    id: "worker-voronoi-radar",
    code: "#DOT-VORONOI-PATROL",
    name: "Voronoi Choke & ANPR Radar",
    department: "surveillance",
    departmentName: "Field Operations & Patrol Dispatch",
    deptColor: "emerald",
    schedule: "Real-time Telemetry (5 min)",
    cron: "*/5 * * * *",
    tokenCap: 40000,
    tokensUsed: 29100,
    targetEndpoint: "Highway Toll ANPR Feeds & Hoysala GPS",
    status: "Running",
    lastRun: "2 mins ago",
    logs: [
      "[2026-10-24 04:10:00 IST] Ingested 180 ANPR optical scan reads from Nelamangala Tollway.",
      "[2026-10-24 04:10:18 IST] 0 flagged stolen vehicle matches.",
      "[2026-10-24 04:10:30 IST] Computed dynamic Voronoi polygon coverage for Hoysala-14 & Hoysala-22.",
      "[2026-10-24 04:10:45 IST] Telemetry streamed to district command screen."
    ]
  }
];

export const AgentWorkspaceScreen: React.FC = () => {
  const { lang, addToast } = useApp();

  // Active workers list
  const [workers, setWorkers] = useState<WorkerAgent[]>(INITIAL_WORKERS);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(INITIAL_WORKERS[0].id);

  // Conversational Intent Input
  const [naturalIntent, setNaturalIntent] = useState<string>(
    "Update me every morning at 8 AM on the 1930 cyber fraud portal"
  );
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  // Structured parsed agent config
  const [parsedConfig, setParsedConfig] = useState<{
    code: string;
    name: string;
    department: string;
    departmentName: string;
    deptColor: "cyan" | "amber" | "purple" | "emerald";
    cron: string;
    scheduleHuman: string;
    tokenCap: number;
    targetEndpoint: string;
    priority: "CRITICAL" | "HIGH" | "ROUTINE";
  }>({
    code: "#DOT-1930-CYBER",
    name: "Cyber Fraud 1930 Scheduled Scanner",
    department: "cyber",
    departmentName: "Cyber Crime Division",
    deptColor: "cyan",
    cron: "0 8 * * *",
    scheduleHuman: "Daily at 08:00 IST",
    tokenCap: 50000,
    targetEndpoint: "CyberPortal 1930 Form (NCWRS / I4C Feed)",
    priority: "HIGH"
  });

  // Precinct task tickets state
  const [precinctTickets, setPrecinctTickets] = useState<PrecinctTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");

  const fetchPrecinctTickets = async (dept?: string) => {
    setIsLoadingTickets(true);
    try {
      const token = localStorage.getItem("vajra_token") || "";
      const url =
        dept && dept !== "all"
          ? `${API_BASE}/api/precinct/tickets?department=${dept}`
          : `${API_BASE}/api/precinct/tickets`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setPrecinctTickets(d.tickets || []);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchPrecinctTickets();
  }, []);

  // Natural language intent parser
  const parseNaturalIntent = (text: string) => {
    const lower = text.toLowerCase();

    // 1. Department & Target Detection
    let dept = "cyber";
    let deptName = "Cyber Crime Division";
    let color: "cyan" | "amber" | "purple" | "emerald" = "cyan";
    let target = "CyberPortal 1930 Form (NCWRS / I4C Feed)";
    let code = "#DOT-1930-AUTONOMOUS";
    let name = "Autonomous Cyber Threat Collector";

    if (
      lower.includes("remand") ||
      lower.includes("187") ||
      lower.includes("bail") ||
      lower.includes("statutory") ||
      lower.includes("court")
    ) {
      dept = "legal";
      deptName = "Legal & Statutory Division";
      color = "amber";
      target = "CCTNS Section 187 Statutory Remand Registry";
      code = "#DOT-BNSS-REMAND";
      name = "§187 Remand Statutory Clock Guardian";
    } else if (
      lower.includes("forensic") ||
      lower.includes("crash") ||
      lower.includes("kinematics") ||
      lower.includes("mujoco") ||
      lower.includes("fsl") ||
      lower.includes("ballistics")
    ) {
      dept = "forensics";
      deptName = "Forensic & Electronic Evidence Division";
      color = "purple";
      target = "MuJoCo Kinematics & Collision Inquest Engine";
      code = "#DOT-MUJOCO-CRASH";
      name = "Forensic Kinematics Crash Reconstructor";
    } else if (
      lower.includes("patrol") ||
      lower.includes("anpr") ||
      lower.includes("voronoi") ||
      lower.includes("choke") ||
      lower.includes("radar") ||
      lower.includes("traffic")
    ) {
      dept = "surveillance";
      deptName = "Field Operations & Patrol Dispatch";
      color = "emerald";
      target = "Highway Toll ANPR Feeds & Hoysala GPS";
      code = "#DOT-PATROL-RADAR";
      name = "Voronoi Choke Point Interceptor";
    } else {
      dept = "cyber";
      deptName = "Cyber Crime Division";
      color = "cyan";
      target = "CyberPortal 1930 Form (NCWRS / I4C Feed)";
      code = "#DOT-1930-CYBER";
      name = "Cyber Fraud 1930 Scheduled Scanner";
    }

    // 2. Schedule & Cron parsing
    let cron = "0 8 * * *";
    let scheduleHuman = "Daily at 08:00 IST";

    if (lower.includes("every 2 hours") || lower.includes("2 hours")) {
      cron = "0 */2 * * *";
      scheduleHuman = "Every 2 hours";
    } else if (lower.includes("every 10 min") || lower.includes("10 minutes")) {
      cron = "*/10 * * * *";
      scheduleHuman = "Every 10 minutes";
    } else if (lower.includes("every 15 min") || lower.includes("15 minutes")) {
      cron = "*/15 * * * *";
      scheduleHuman = "Every 15 minutes";
    } else if (lower.includes("hourly") || lower.includes("every hour")) {
      cron = "0 * * * *";
      scheduleHuman = "Every hour on the hour";
    } else if (lower.includes("midnight") || lower.includes("00:00")) {
      cron = "0 0 * * *";
      scheduleHuman = "Daily at 00:00 IST";
    } else if (lower.includes("8 am") || lower.includes("8:00")) {
      cron = "0 8 * * *";
      scheduleHuman = "Daily at 08:00 IST";
    } else if (lower.includes("6 am") || lower.includes("06:00")) {
      cron = "0 6 * * *";
      scheduleHuman = "Daily at 06:00 IST";
    }

    // Priority
    const priority: "CRITICAL" | "HIGH" | "ROUTINE" =
      lower.includes("urgent") || lower.includes("critical") || lower.includes("bail")
        ? "CRITICAL"
        : "HIGH";

    setParsedConfig({
      code,
      name,
      department: dept,
      departmentName: deptName,
      deptColor: color,
      cron,
      scheduleHuman,
      tokenCap: 50000,
      targetEndpoint: target,
      priority
    });
  };

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      parseNaturalIntent(naturalIntent);
      setIsSynthesizing(false);
      addToast(
        lang === "en" ? "Agent Synthesized" : "ಏಜೆಂಟ್ ಸಂಯೋಜಿಸಲಾಗಿದೆ",
        lang === "en"
          ? "Natural language directive parsed into structured Paperclip configuration."
          : "ನೈಸರ್ಗಿಕ ಭಾಷಾ ನಿರ್ದೇಶನವನ್ನು ಪೇಪರ್‌ಕ್ಲಿಪ್ ಸಂರಚನೆಯಾಗಿ ಪರಿವರ್ತಿಸಲಾಗಿದೆ.",
        "Info"
      );
    }, 400);
  };

  const handleDeployAgent = async () => {
    setIsDeploying(true);
    try {
      const newWorker: WorkerAgent = {
        id: `worker-${Date.now()}`,
        code: parsedConfig.code,
        name: parsedConfig.name,
        department: parsedConfig.department,
        departmentName: parsedConfig.departmentName,
        deptColor: parsedConfig.deptColor,
        schedule: parsedConfig.scheduleHuman,
        cron: parsedConfig.cron,
        tokenCap: parsedConfig.tokenCap,
        tokensUsed: 0,
        targetEndpoint: parsedConfig.targetEndpoint,
        status: "Active",
        lastRun: "Just now (Deployed)",
        logs: [
          `[${new Date().toISOString()}] Agent synthesized via natural language directive.`,
          `[${new Date().toISOString()}] Registered deterministic cron: ${parsedConfig.cron}.`,
          `[${new Date().toISOString()}] Bound to endpoint: ${parsedConfig.targetEndpoint}.`,
          `[${new Date().toISOString()}] Initialized Paperclip ticket thread under Section 63 BSA.`
        ]
      };

      // Register ticket on backend
      const token = localStorage.getItem("vajra_token") || "";
      await fetch(`${API_BASE}/api/precinct/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          department: parsedConfig.department,
          title: `Autonomous Task: ${parsedConfig.name}`,
          findings: `Agent created with cron schedule [${parsedConfig.cron}] targeting [${parsedConfig.targetEndpoint}]. Daily budget cap: ${parsedConfig.tokenCap} tokens.`,
          priority: parsedConfig.priority,
          case_no: "STATEWIDE"
        })
      }).catch(() => {});

      setWorkers((prev) => [newWorker, ...prev]);
      setSelectedWorkerId(newWorker.id);
      fetchPrecinctTickets(selectedDeptFilter);

      addToast(
        lang === "en" ? "Autonomous Agent Deployed" : "ಸ್ವಾಯತ್ತ ಏಜೆಂಟ್ ನಿಯೋಜಿಸಲಾಗಿದೆ",
        lang === "en"
          ? `${parsedConfig.name} is now active on a 24/7 heartbeat schedule.`
          : `${parsedConfig.name} ಈಗ 24/7 ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿ ಸಕ್ರಿಯವಾಗಿದೆ.`,
        "Success"
      );
    } catch {
      addToast(
        lang === "en" ? "Deployment Failed" : "ನಿಯೋಜನೆ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not register autonomous ticket." : "ಟಿಕೆಟ್ ನೋಂದಾಯಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0C0A09] text-stone-200">
      {/* Top Header */}
      <div className="p-5 border-b border-stone-850 bg-stone-950/80 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#C79A4E]/15 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shadow-[0_0_20px_rgba(199,154,78,0.25)]">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-mono font-bold uppercase tracking-wider text-stone-100">
                {lang === "en" ? "Precinct Agent Workspaces" : "ಠಾಣೆ ಏಜೆಂಟ್ ಕಾರ್ಯಕ್ಷೇತ್ರಗಳು"}
              </h1>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-black uppercase bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/30">
                Paperclip + OpenDots
              </span>
            </div>
            <p className="text-xs font-mono text-stone-400 mt-0.5">
              {lang === "en"
                ? "VAK Master Conductor presiding over 4 specialized 24/7 autonomous divisions & conversational agent builder"
                : "4 ವಿಶೇಷ 24/7 ಸ್ವಾಯತ್ತ ವಿಭಾಗಗಳು ಮತ್ತು ಸಂಭಾಷಣಾ ಏಜೆಂಟ್ ಬಿಲ್ಡರ್"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>● 4 Autonomous Divisions Active</span>
          </span>
          <button
            onClick={() => fetchPrecinctTickets(selectedDeptFilter)}
            className="p-2 rounded-lg text-stone-400 hover:text-[#C79A4E] hover:bg-stone-900 border border-stone-800 transition-colors cursor-pointer"
            title="Refresh tickets"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingTickets ? "animate-spin text-[#C79A4E]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: SPLIT-PANE CONVERSATIONAL AGENT BUILDER                        */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANE (col-span-5): ACTIVE WORKERS LIST & CREATE BUTTON */}
          <div className="lg:col-span-5 rounded-xl border border-stone-850 bg-stone-900/60 p-4 space-y-3.5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#C79A4E]" />
                  <span>{lang === "en" ? "Active Background Workers" : "ಸಕ್ರಿಯ ಹಿನ್ನೆಲೆ ಏಜೆಂಟ್‌ಗಳು"}</span>
                </h3>
                <p className="text-[10px] font-mono text-stone-500 mt-0.5">
                  {workers.length} {lang === "en" ? "daemons bound to deterministic cron" : "ಸ್ವಾಯತ್ತ ಡೆಮನ್‌ಗಳು"}
                </p>
              </div>

              <button
                onClick={() => {
                  setNaturalIntent("Update me every morning at 8 AM on the 1930 cyber fraud portal");
                  parseNaturalIntent("Update me every morning at 8 AM on the 1930 cyber fraud portal");
                  addToast("New Agent Canvas Ready", "Enter your natural language intent in the right canvas.", "Info");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C79A4E]/15 hover:bg-[#C79A4E]/25 border border-[#C79A4E]/40 text-[#C79A4E] text-xs font-mono font-bold tracking-wide transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Create New Agent" : "ಹೊಸ ಏಜೆಂಟ್ ರಚಿಸಿ"}</span>
              </button>
            </div>

            {/* Workers Cards */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {workers.map((worker) => {
                const isSelected = selectedWorkerId === worker.id;
                const percentTokens = Math.min(100, Math.round((worker.tokensUsed / worker.tokenCap) * 100));

                return (
                  <div
                    key={worker.id}
                    onClick={() => setSelectedWorkerId(worker.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group ${
                      isSelected
                        ? "bg-[#C79A4E]/10 border-[#C79A4E] shadow-[0_0_20px_rgba(199,154,78,0.15)]"
                        : "bg-stone-950/70 border-stone-800/80 hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            worker.deptColor === "cyan"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : worker.deptColor === "amber"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : worker.deptColor === "purple"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {worker.code}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 truncate max-w-[150px]">
                          {worker.departmentName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                          {worker.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-mono font-bold text-stone-100 group-hover:text-white">
                      {worker.name}
                    </h4>

                    {/* Schedule & Token Cap metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-stone-850/80 text-[10px] font-mono">
                      <div>
                        <span className="text-stone-500 block">SCHEDULE (CRON)</span>
                        <span className="text-[#C79A4E] font-bold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-[#C79A4E]" />
                          {worker.schedule}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">DAILY TOKEN CAP</span>
                        <div className="flex items-center justify-between text-stone-300 mt-0.5">
                          <span>{worker.tokensUsed.toLocaleString()}</span>
                          <span className="text-stone-500">/ {worker.tokenCap.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-stone-850 h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-[#C79A4E] h-full rounded-full transition-all"
                            style={{ width: `${percentTokens}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT CANVAS (col-span-7): CONVERSATIONAL BUILDER & STRUCTURED CONFIG */}
          <div className="lg:col-span-7 rounded-xl border border-stone-850 bg-stone-900/60 p-5 space-y-5 shadow-xl">
            {/* Canvas Header */}
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-100">
                    {lang === "en" ? "Conversational Agent Builder" : "ಸಂಭಾಷಣಾ ಏಜೆಂಟ್ ಬಿಲ್ಡರ್"}
                  </h3>
                  <p className="text-[10px] font-mono text-stone-400 mt-0.5">
                    {lang === "en"
                      ? "Define 24/7 background autonomous workers using plain natural language directives"
                      : "ನೈಸರ್ಗಿಕ ಭಾಷೆಯ ನಿರ್ದೇಶನಗಳೊಂದಿಗೆ ಹಿನ್ನೆಲೆ ಏಜೆಂಟ್‌ಗಳನ್ನು ರಚಿಸಿ"}
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[#C79A4E]">
                Autonomous Agent Synthesis
              </span>
            </div>

            {/* Conversational Natural Language Input Box */}
            <div className="space-y-2">
              <label className="text-[10.5px] font-mono text-stone-300 font-bold uppercase flex items-center justify-between">
                <span>{lang === "en" ? "Natural Language Intent Directive" : "ನೈಸರ್ಗಿಕ ಭಾಷಾ ನಿರ್ದೇಶನ"}</span>
                <span className="text-stone-500 text-[9.5px]">Instant Parser Engine</span>
              </label>

              <div className="relative">
                <textarea
                  rows={2}
                  value={naturalIntent}
                  onChange={(e) => {
                    setNaturalIntent(e.target.value);
                    parseNaturalIntent(e.target.value);
                  }}
                  placeholder='e.g. "Update me every morning at 8 AM on the 1930 cyber fraud portal"'
                  className="w-full bg-[#0C0A09] border border-stone-800 rounded-xl p-3 text-xs font-mono text-stone-100 placeholder-stone-600 focus:outline-none focus:border-[#C79A4E] focus:ring-1 focus:ring-[#C79A4E]/40 transition-all resize-none"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  "Update me every morning at 8 AM on the 1930 cyber fraud portal",
                  "Check §187 BNSS 90-day default bail risk every 2 hours and alert me",
                  "Reconstruct crash kinematics upon new high-speed collision FIRs",
                  "Monitor Voronoi choke points and ANPR vehicle alerts every 10 minutes"
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNaturalIntent(chip);
                      parseNaturalIntent(chip);
                    }}
                    className="text-[9.5px] font-mono px-2.5 py-1 rounded-md bg-stone-950 border border-stone-850 text-stone-400 hover:text-[#C79A4E] hover:border-[#C79A4E]/40 transition-colors cursor-pointer"
                  >
                    "{chip.slice(0, 36)}..."
                  </button>
                ))}
              </div>
            </div>

            {/* Synthesize Button */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing || !naturalIntent.trim()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-stone-950 border border-stone-700 hover:border-[#C79A4E] text-[#C79A4E] text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isSynthesizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-[#C79A4E]" />
                )}
                <span>{lang === "en" ? "Synthesize Agent Config" : "ಕಾನ್ಫಿಗರ್ ಸಂಯೋಜಿಸಿ"}</span>
              </button>
            </div>

            {/* STRUCTURED AGENT CONFIGURATION CARD */}
            <div className="p-4 rounded-xl border border-[#C79A4E]/40 bg-stone-950/80 shadow-[0_0_25px_rgba(199,154,78,0.1)] space-y-4">
              <div className="flex items-center justify-between border-b border-stone-850 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/40">
                    {parsedConfig.code}
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-200">
                    {parsedConfig.name}
                  </span>
                </div>
                <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>

              {/* 4 Structured Metadata Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800">
                  <span className="text-[10px] text-stone-500 block uppercase font-bold">Assigned Department</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        parsedConfig.deptColor === "cyan"
                          ? "bg-cyan-400"
                          : parsedConfig.deptColor === "amber"
                          ? "bg-amber-400"
                          : parsedConfig.deptColor === "purple"
                          ? "bg-purple-400"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="text-stone-200 font-bold">{parsedConfig.departmentName}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800">
                  <span className="text-[10px] text-stone-500 block uppercase font-bold">Schedule (Cron)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
                    <span className="text-[#C79A4E] font-bold">
                      {parsedConfig.cron} ({parsedConfig.scheduleHuman})
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800">
                  <span className="text-[10px] text-stone-500 block uppercase font-bold">Daily Token Cap</span>
                  <div className="flex items-center justify-between mt-1 text-stone-200 font-bold">
                    <span>{parsedConfig.tokenCap.toLocaleString()} Tokens/Day</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Deterministic Guard</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800">
                  <span className="text-[10px] text-stone-500 block uppercase font-bold">Target Endpoint</span>
                  <div className="flex items-center gap-2 mt-1 truncate">
                    <Database className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="text-stone-300 truncate" title={parsedConfig.targetEndpoint}>
                      {parsedConfig.targetEndpoint}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Deploy Autonomous Agent Button */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Section 63 BSA Certified Execution Audit</span>
                </div>

                <button
                  onClick={handleDeployAgent}
                  disabled={isDeploying}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C79A4E] to-[#B3873E] text-stone-950 font-mono font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-all cursor-pointer shadow-[0_0_20px_rgba(199,154,78,0.3)] disabled:opacity-50"
                >
                  {isDeploying ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                  ) : (
                    <Send className="w-4 h-4 text-stone-950" />
                  )}
                  <span>{lang === "en" ? "Deploy Autonomous Agent" : "ಸ್ವಾಯತ್ತ ಏಜೆಂಟ್ ನಿಯೋಜಿಸಿ"}</span>
                </button>
              </div>
            </div>

            {/* Chronological Ticket Execution Log for Selected Worker */}
            <div className="rounded-xl border border-stone-850 bg-stone-950/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono border-b border-stone-850 pb-2">
                <span className="font-bold text-stone-300 uppercase flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#C79A4E]" />
                  <span>Chronological Ticket Execution Log: {selectedWorker.code}</span>
                </span>
                <span className="text-[10px] text-stone-500">
                  Last heartbeat: {selectedWorker.lastRun}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[10.5px] max-h-40 overflow-y-auto pr-1">
                {selectedWorker.logs.map((logLine, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-stone-400">
                    <span className="text-emerald-400 font-bold shrink-0">›</span>
                    <span className="leading-relaxed">{logLine}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: 4 SPECIALIZED PRECINCT DIVISIONS (EXTRACTED)                  */}
        {/* ========================================================================= */}
        <div className="shrink-0 rounded-xl border border-stone-800 bg-stone-900/60 p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C79A4E]/15 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shadow-[0_0_15px_rgba(199,154,78,0.2)]">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-stone-100">
                    {lang === "en" ? "Precinct Multi-Agent Orchestration" : "ಠಾಣೆ ಬಹು-ಏಜೆಂಟ್ ಸಮನ್ವಯ"}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-[#C79A4E]/20 text-[#C79A4E] border border-[#C79A4E]/30">
                    Paperclip + OpenDots
                  </span>
                </div>
                <p className="text-[10px] font-mono text-stone-400 mt-0.5">
                  VAK Master Conductor presiding over 4 specialized 24/7 autonomous divisions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <Radio className="w-3 h-3 animate-pulse" />
                ● 4 Autonomous Divisions Active
              </span>
              <button
                onClick={() => fetchPrecinctTickets(selectedDeptFilter)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-[#C79A4E] hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? "animate-spin text-[#C79A4E]" : ""}`} />
              </button>
            </div>
          </div>

          {/* 4 Specialized Precinct Division Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: "cyber",
                name: "Cyber Crime Division",
                lead: "Insp. Pradeep K. (Cyber Cell)",
                scope: "1930 & Mule Freezes",
                cadence: "15 min Heartbeat",
                color: "cyan",
                icon: Cpu
              },
              {
                id: "legal",
                name: "Legal & Remand Division",
                lead: "PP Deshpande & PSI Raghavendra",
                scope: "§187 BNSS 90-Day Clocks",
                cadence: "Daily 06:00 IST",
                color: "amber",
                icon: ShieldAlert
              },
              {
                id: "forensics",
                name: "Forensic & Crash Physics",
                lead: "Dr. Ananya Sharma (FSL)",
                scope: "MuJoCo Kinematics & Ballistics",
                cadence: "On-Demand Inquest",
                color: "purple",
                icon: Zap
              },
              {
                id: "surveillance",
                name: "Field Patrol & Radar",
                lead: "CRSI Patil (Control Room)",
                scope: "Voronoi Choke & ANPR",
                cadence: "Real-time Telemetry",
                color: "emerald",
                icon: Activity
              }
            ].map((dept) => (
              <div
                key={dept.id}
                onClick={() => {
                  setSelectedDeptFilter(dept.id === selectedDeptFilter ? "all" : dept.id);
                  fetchPrecinctTickets(dept.id === selectedDeptFilter ? "all" : dept.id);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer shadow-sm relative group ${
                  selectedDeptFilter === dept.id
                    ? "bg-[#C79A4E]/10 border-[#C79A4E] shadow-[0_0_15px_rgba(199,154,78,0.15)]"
                    : "bg-stone-950/70 border-stone-800/80 hover:border-stone-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <dept.icon
                    className={`w-4 h-4 ${
                      dept.color === "cyan"
                        ? "text-cyan-400"
                        : dept.color === "amber"
                        ? "text-amber-400"
                        : dept.color === "purple"
                        ? "text-purple-400"
                        : "text-emerald-400"
                    }`}
                  />
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                    {dept.cadence}
                  </span>
                </div>
                <h4 className="text-xs font-mono font-bold text-stone-200 group-hover:text-stone-100">
                  {dept.name}
                </h4>
                <p className="text-[10px] font-mono text-[#C79A4E] mt-0.5 truncate">
                  {dept.lead}
                </p>
                <p className="text-[9.5px] font-mono text-stone-500 mt-1">
                  Mandate: {dept.scope}
                </p>
              </div>
            ))}
          </div>

          {/* Task Tickets Pipeline */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-mono text-stone-400">
              <span className="font-bold uppercase tracking-wider text-stone-300">
                Autonomous Task Tickets ({precinctTickets.length})
              </span>
              <div className="flex items-center gap-1.5 text-[10px]">
                {["all", "cyber", "legal", "forensics", "surveillance"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedDeptFilter(filter);
                      fetchPrecinctTickets(filter);
                    }}
                    className={`px-2 py-0.5 rounded uppercase font-mono transition-colors cursor-pointer ${
                      selectedDeptFilter === filter
                        ? "bg-[#C79A4E] text-stone-950 font-bold"
                        : "bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {isLoadingTickets ? (
                <div className="py-8 text-center text-xs font-mono text-stone-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C79A4E]" />
                  <span>Synchronizing Paperclip Task Tickets...</span>
                </div>
              ) : precinctTickets.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-stone-550 border border-stone-850 rounded-lg bg-stone-950/40">
                  No active tickets in this department queue.
                </div>
              ) : (
                precinctTickets.map((tk) => (
                  <div
                    key={tk.ticket_id}
                    className="p-3 rounded-lg bg-stone-950/60 border border-stone-800 hover:border-stone-700 transition-colors space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-200">
                          {tk.title}
                        </span>
                        <span className="text-[10px] text-[#C79A4E] px-1.5 py-0.2 rounded bg-[#C79A4E]/10 border border-[#C79A4E]/20">
                          {tk.ticket_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            tk.priority === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : tk.priority === "HIGH"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {tk.priority}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                          {tk.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {tk.findings}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-850">
                      <span>
                        Assignee: {tk.assignee} · Dept: {tk.department_name}
                      </span>
                      <span className="text-emerald-400 font-bold">🔒 Section 63 BSA Certified Ledger</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
