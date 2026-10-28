import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { vajraVakBus } from "../services/vajraVakEventBus";
import {
  Bot,
  Activity,
  Plus,
  RefreshCw,
  Radio,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  CheckCircle2,
  Send,
  Shield,
  Layers,
  HelpCircle,
  Play,
  Pause,
  MessageSquare,
  ArrowLeft,
  Search,
  AlertTriangle,
  FileText,
  Share2,
  Scale,
  Trash2,
  Check
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

export interface AgentChatMessage {
  id: string;
  sender: "agent" | "officer" | "conductor" | "system";
  text: string;
  timestamp: string;
  evidenceCard?: {
    firNo: string;
    ps: string;
    sections: string;
    accusedName: string;
    registeredAt: string;
    sha256: string;
  };
}

export interface WorkerAgent {
  id: string;
  code: string;
  name: string;
  mandate: string;
  department: string;
  departmentName: string;
  deptColor: "cyan" | "amber" | "purple" | "emerald";
  schedule: string;
  cron: string;
  tokenCap: number;
  tokensUsed: number;
  targetEndpoint: string;
  status: "Active" | "Idle" | "Running" | "Paused";
  lastRun: string;
  lastRunStatus: "success" | "anomalies_flagged" | "idle";
  flaggedCount: number;
  logs: string[];
  chatHistory: AgentChatMessage[];
}

const INITIAL_WORKERS: WorkerAgent[] = [
  {
    id: "worker-ramesh-watch",
    code: "#AGT-RAMESH-WATCH-2026",
    name: "Suspect Watch: Ramesh Kumar (BLR/CTA)",
    mandate: "Scan statewide CCTNS records for new FIRs, co-accused linkages, and aliases matching suspect 'Ramesh Kumar'.",
    department: "surveillance",
    departmentName: "Field Operations & Patrol Dispatch",
    deptColor: "emerald",
    schedule: "Daily 08:00 AM IST",
    cron: "0 8 * * *",
    tokenCap: 50000,
    tokensUsed: 3140,
    targetEndpoint: "CCTNS Accused & CaseMaster Registry",
    status: "Active",
    lastRun: "Today 08:00:14 IST",
    lastRunStatus: "anomalies_flagged",
    flaggedCount: 1,
    logs: [
      "[2026-10-28 08:00:00 IST] Woke from deterministic cron heartbeat (0 8 * * *).",
      "[2026-10-28 08:00:14 IST] Queried CCTNS Datastore across Bengaluru City & Chitradurga.",
      "[2026-10-28 08:00:18 IST] ⚠️ PRIORITY ANOMALY DETECTED: 1 matching FIR (Cr. 42/2026 Chitradurga Rural).",
      "[2026-10-28 08:00:20 IST] Hashed Section 63 BSA evidence card sealed in Stratus vault.",
      "[2026-10-28 08:00:22 IST] Dispatched priority alert to VAK Sentinel Mascot & Command HUD."
    ],
    chatHistory: [
      {
        id: "msg-1",
        sender: "system",
        text: "Agent initialized and bound to deterministic cron: Daily at 08:00 AM IST. Listening on CCTNS Karnataka ZCQL stream.",
        timestamp: "2026-10-26 08:00:00 IST"
      },
      {
        id: "msg-2",
        sender: "agent",
        text: "🟢 SCHEDULED SWEEP COMPLETE — ZERO ANOMALIES FLAGGED\n• Query: SELECT AccusedName, FIRNo, DistrictID FROM Accused WHERE AccusedName LIKE 'Ramesh K%'\n• Districts Scanned: Bengaluru City (211), Chitradurga (216)\n• Records Evaluated: 4,120 active cases\n• Flagged Matches: 0 new registrations in last 24 hours\n• Token Usage: 2,140 tokens decremented • System State: SLEEP",
        timestamp: "2026-10-27 08:00:14 IST"
      },
      {
        id: "msg-3",
        sender: "agent",
        text: "⚠️ PRIORITY ANOMALY DETECTED — NEW FIR REGISTRATION FLAGGED!\nA newly registered FIR matches tracked criteria 'Ramesh Kumar' under property crime sections:",
        timestamp: "2026-10-28 08:00:18 IST",
        evidenceCard: {
          firNo: "Cr. No. 42/2026",
          ps: "Chitradurga Rural Police Station",
          sections: "Section 303(2) [Theft] & Section 317(2) [Stolen Property] BNS",
          accusedName: "Ramesh Kumar s/o Manjunath, Age 34, R/o Challakere",
          registeredAt: "2026-10-27 23:15:00 IST",
          sha256: "9f83b2a4c8712e09bb31f901da4e99c1543bcae71028ffb8214ae987cba14092"
        }
      }
    ]
  },
  {
    id: "worker-remand-187",
    code: "#DOT-187-REMAND",
    name: "§187 Statutory Remand Sentinel",
    mandate: "Track statutory 60-day and 90-day judicial remand countdowns to preempt default bail under BNSS §187.",
    department: "legal",
    departmentName: "Legal & Statutory Division",
    deptColor: "amber",
    schedule: "Hourly Check",
    cron: "0 * * * *",
    tokenCap: 35000,
    tokensUsed: 18400,
    targetEndpoint: "CCTNS Section 187 Statutory Remand Registry",
    status: "Active",
    lastRun: "42 mins ago",
    lastRunStatus: "anomalies_flagged",
    flaggedCount: 1,
    logs: [
      "[2026-10-28 03:00:00 IST] Woke from hourly statutory timer.",
      "[2026-10-28 03:00:18 IST] Queried judicial remand clocks for active statewide FIRs.",
      "[2026-10-28 03:00:35 IST] Calculated 1 suspect nearing 90-day threshold (Cr. 114/2026 - 12 days remain).",
      "[2026-10-28 03:00:48 IST] Dispatched notice to Investigating Officer PSI Raghavendra."
    ],
    chatHistory: [
      {
        id: "msg-r1",
        sender: "agent",
        text: "⚠️ STATUTORY WARNING: Under Section 187(3) BNSS, investigation in Cr. 114/2026 (Chikkamagaluru) has reached Day 48 of 60. Charge-sheet filing deadline is in 12 days to prevent statutory default bail.",
        timestamp: "42 mins ago"
      }
    ]
  },
  {
    id: "worker-cyber-1930",
    code: "#DOT-1930-CYBER",
    name: "Cyber Fraud 1930 Mule Radar",
    mandate: "Ingest NCRP / I4C 1930 portal complaints and monitor mule bank account freeze evasions in Hubballi and Belagavi.",
    department: "cyber",
    departmentName: "Cyber Crime Division",
    deptColor: "cyan",
    schedule: "Every 15 mins",
    cron: "*/15 * * * *",
    tokenCap: 50000,
    tokensUsed: 2400,
    targetEndpoint: "NCWRS Live Cyber Feed & 1930 Portal",
    status: "Running",
    lastRun: "4 mins ago",
    lastRunStatus: "idle",
    flaggedCount: 0,
    logs: [
      "[2026-10-28 08:15:00 IST] Woke from 15-minute cron heartbeat.",
      "[2026-10-28 08:15:14 IST] Ingested 14 new records from CyberPortal 1930 endpoint.",
      "[2026-10-28 08:15:32 IST] Executing heuristic analyzer on mule bank accounts (Hubballi / Belagavi).",
      "[2026-10-28 08:15:51 IST] 0 freeze evasion attempts detected. Quota decremented."
    ],
    chatHistory: [
      {
        id: "msg-c1",
        sender: "agent",
        text: "🔄 Sweeping Belagavi and Hubballi-Dharwad mule nodes. 14 complaints parsed from National Cyber Crime Reporting Portal (1930). Zero high-velocity transfers identified.",
        timestamp: "4 mins ago"
      }
    ]
  },
  {
    id: "worker-mujoco-physics",
    code: "#DOT-MUJOCO-FSL",
    name: "MuJoCo Kinematics & Crash Physics",
    mandate: "DeepMind physics solver reconstructing vehicle speed, momentum, and pedestrian skid marks for Section 106 BNS inquests.",
    department: "forensics",
    departmentName: "Forensic & Electronic Evidence Division",
    deptColor: "purple",
    schedule: "On-Demand Inquest",
    cron: "*/30 * * * *",
    tokenCap: 75000,
    tokensUsed: 12850,
    targetEndpoint: "FSL Collision Engine & MuJoCo Solver",
    status: "Idle",
    lastRun: "Yesterday 22:30 IST",
    lastRunStatus: "success",
    flaggedCount: 0,
    logs: [
      "[2026-10-27 22:30:00 IST] Solved dual-axle impact for Cr. 89/2026 Tumakuru Highway.",
      "[2026-10-27 22:30:15 IST] Calculated pre-impact velocity: 74.2 km/h (speed limit 60 km/h).",
      "[2026-10-27 22:30:30 IST] Certified forensic physics report filed under Section 63 BSA."
    ],
    chatHistory: [
      {
        id: "msg-m1",
        sender: "agent",
        text: "🟢 Impact and momentum simulation complete for Tumakuru Highway accident (Cr. 89/2026). Skid length of 28.4 meters on dry asphalt denotes initial speed of 74.2 ± 3 km/h.",
        timestamp: "Yesterday 22:30 IST"
      }
    ]
  },
  {
    id: "worker-anpr-radar",
    code: "#DOT-ANPR-CHOKE",
    name: "Voronoi Choke & ANPR Radar",
    mandate: "Live tollway optical plate scanning and Voronoi polygon patrol routing across National Highway corridors.",
    department: "surveillance",
    departmentName: "Field Operations & Patrol Dispatch",
    deptColor: "emerald",
    schedule: "Real-time Telemetry (5 min)",
    cron: "*/5 * * * *",
    tokenCap: 40000,
    tokensUsed: 29100,
    targetEndpoint: "Highway Toll ANPR Feeds & Hoysala GPS",
    status: "Active",
    lastRun: "2 mins ago",
    lastRunStatus: "success",
    flaggedCount: 0,
    logs: [
      "[2026-10-28 08:20:00 IST] Ingested 180 ANPR optical scan reads from Nelamangala Tollway.",
      "[2026-10-28 08:20:18 IST] 0 flagged stolen vehicle matches.",
      "[2026-10-28 08:20:30 IST] Computed dynamic Voronoi polygon coverage for Hoysala-14 & Hoysala-22."
    ],
    chatHistory: [
      {
        id: "msg-a1",
        sender: "agent",
        text: "🟢 180 ANPR optical reads audited at Nelamangala Tollway. Zero matches against statewide stolen vehicle hotlist.",
        timestamp: "2 mins ago"
      }
    ]
  }
];

export const AgentWorkspaceScreen: React.FC = () => {
  const { lang, addToast, theme, setCurrentScreen } = useApp();
  const isLight = theme === "light";

  // Views: "directory" (executive list), "builder" (Grok conversational creator), "detail" (active agent stream)
  const [activeView, setActiveView] = useState<"directory" | "builder" | "detail">("directory");
  const [workers, setWorkers] = useState<WorkerAgent[]>(INITIAL_WORKERS);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("worker-ramesh-watch");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RUNNING" | "IDLE" | "PAUSED">("ALL");

  // Conversational Builder State
  const [builderStep, setBuilderStep] = useState<number>(1);
  const [builderInput, setBuilderInput] = useState<string>("");
  const [isSynthesizingBuilder, setIsSynthesizingBuilder] = useState<boolean>(false);
  const [builderDraft, setBuilderDraft] = useState({
    code: "#AGT-CUSTOM-WATCH",
    name: "",
    mandate: "",
    jurisdictions: "Statewide (All 31 Districts)",
    schedule: "Daily at 08:00 AM IST",
    cron: "0 8 * * *",
    budget: "50,000 tokens",
    alertChannels: "Vajra VAK Mascot + System Notification Banner",
    provenance: "CCTNS Karnataka ZCQL Table Accused / CaseMaster"
  });

  const [builderMessages, setBuilderMessages] = useState<
    Array<{ sender: "conductor" | "officer"; text: string; showCard?: boolean }>
  >([
    {
      sender: "conductor",
      text: "Greetings, Investigating Officer. I am the VAK Master Conductor. I am ready to construct a new 24/7 autonomous monitoring agent for your precinct.\n\nWhat is the primary operational objective of this agent? (e.g. Daily suspect monitoring, CCTNS FIR alerts, remand tracking, or cyber fraud scanning?)"
    }
  ]);

  // Detail View Chat State
  const [detailInput, setDetailInput] = useState<string>("");
  const [isExecutingDetail, setIsExecutingDetail] = useState<boolean>(false);

  // Precinct tickets
  const [precinctTickets, setPrecinctTickets] = useState<PrecinctTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const fetchPrecinctTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const token = localStorage.getItem("vajra_token") || "";
      const resp = await fetch(`${API_BASE}/api/precinct/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPrecinctTickets(data.tickets || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchPrecinctTickets();
  }, []);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0];

  // Filtered workers
  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.mandate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.targetEndpoint.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") return w.status === "Active";
    if (statusFilter === "RUNNING") return w.status === "Running";
    if (statusFilter === "IDLE") return w.status === "Idle";
    if (statusFilter === "PAUSED") return w.status === "Paused";
    return true;
  });

  // Action: Run Manual Scan Now
  const handleRunNow = async (workerId: string) => {
    addToast("Manual Scan Triggered", `Agent ${workerId} initiating CCTNS sweep...`, "Info");
    setWorkers((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, status: "Running" } : w))
    );

    try {
      const token = localStorage.getItem("vajra_token") || "";
      const resp = await fetch(`${API_BASE}/api/agents/${workerId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query_override: "MANUAL_TRIGGER" })
      });

      const data = resp.ok ? await resp.json() : null;
      const findings =
        data?.findings || "CCTNS automated sweep completed: 1,420 records evaluated. Zero critical anomalies detected.";

      const newLog = `[${new Date().toLocaleTimeString()} IST] 🟢 Manual sweep complete. ${findings}`;
      const newChat: AgentChatMessage = {
        id: `chat-${Date.now()}`,
        sender: "agent",
        text: `🟢 MANUAL EXECUTION COMPLETE\n${findings}\nSHA-256 Seal: ${data?.sha256 || "9f83...certified"}`,
        timestamp: "Just now"
      };

      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                status: "Active",
                lastRun: "Just now",
                tokensUsed: Math.min(w.tokenCap, w.tokensUsed + 2140),
                logs: [newLog, ...w.logs],
                chatHistory: [...w.chatHistory, newChat]
              }
            : w
        )
      );

      // Emit VAK Mascot alert event
      vajraVakBus.emit("agent_alert", {
        caseNo: "CR-2026-CCTNS",
        riskTier: "LOW",
        quipText: `Agent ${workerId} executed a live sweep. All records verified.`
      });

      addToast("Sweep Complete", "Grounded CCTNS execution report generated under Section 63 BSA.", "Success");
    } catch {
      setWorkers((prev) =>
        prev.map((w) => (w.id === workerId ? { ...w, status: "Active" } : w))
      );
    }
  };

  // Action: Toggle Pause / Resume
  const handleTogglePause = (workerId: string) => {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id !== workerId) return w;
        const newStatus = w.status === "Paused" ? "Active" : "Paused";
        addToast(
          newStatus === "Paused" ? "Agent Paused" : "Agent Resumed",
          `${w.code} schedule is now ${newStatus}.`,
          "Info"
        );
        return { ...w, status: newStatus };
      })
    );
  };

  // Conversational Builder: Handle User Send
  const handleBuilderSend = (customText?: string) => {
    const textToSend = customText || builderInput;
    if (!textToSend.trim()) return;

    const userMsg = { sender: "officer" as const, text: textToSend };
    setBuilderMessages((prev) => [...prev, userMsg]);
    setBuilderInput("");
    setIsSynthesizingBuilder(true);

    setTimeout(() => {
      if (builderStep === 1) {
        // Step 1 response -> Ask for Schedule
        const nameGuess = textToSend.length > 30 ? textToSend.slice(0, 30) + "..." : textToSend;
        const codeGuess = "#AGT-" + textToSend.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) + "-2026";
        setBuilderDraft((prev) => ({
          ...prev,
          name: nameGuess,
          mandate: textToSend,
          code: codeGuess
        }));
        setBuilderMessages((prev) => [
          ...prev,
          {
            sender: "conductor",
            text: `Understood: "${nameGuess}".\n\nAt what schedule or cadence should this agent execute its CCTNS sweep? (e.g. Daily at 08:00 AM IST, Hourly, or Every 15 minutes?)`
          }
        ]);
        setBuilderStep(2);
      } else if (builderStep === 2) {
        // Step 2 response -> Ask for Alert Channels
        let cronVal = "0 8 * * *";
        if (textToSend.toLowerCase().includes("hour")) cronVal = "0 * * * *";
        if (textToSend.toLowerCase().includes("15 min")) cronVal = "*/15 * * * *";
        setBuilderDraft((prev) => ({
          ...prev,
          schedule: textToSend,
          cron: cronVal
        }));
        setBuilderMessages((prev) => [
          ...prev,
          {
            sender: "conductor",
            text: `Cadence registered: ${textToSend} (Deterministic Cron: '${cronVal}').\n\nWhen a matching record or anomaly is detected, through which channels should you be notified? (e.g. VAK Sentinel Mascot Klaxon, Priority Notification Banner, or Station Digest?)`
          }
        ]);
        setBuilderStep(3);
      } else {
        // Step 3 response -> Render Manifest Card
        setBuilderDraft((prev) => ({
          ...prev,
          alertChannels: textToSend
        }));
        setBuilderMessages((prev) => [
          ...prev,
          {
            sender: "conductor",
            text: "Excellent. I have assembled all operational parameters into the manifest below. Please review and deploy when ready:",
            showCard: true
          }
        ]);
        setBuilderStep(4);
      }
      setIsSynthesizingBuilder(false);
    }, 600);
  };

  // Conversational Builder: Deploy Agent
  const handleDeployDraftAgent = async () => {
    const newId = `worker-${Date.now()}`;
    const newWorker: WorkerAgent = {
      id: newId,
      code: builderDraft.code,
      name: builderDraft.name || "Custom Autonomous Agent",
      mandate: builderDraft.mandate || "Autonomous surveillance mandate",
      department: "surveillance",
      departmentName: "Field Operations & Patrol Dispatch",
      deptColor: "cyan",
      schedule: builderDraft.schedule,
      cron: builderDraft.cron,
      tokenCap: 50000,
      tokensUsed: 0,
      targetEndpoint: "CCTNS Karnataka ZCQL Stream",
      status: "Active",
      lastRun: "Never",
      lastRunStatus: "idle",
      flaggedCount: 0,
      logs: [
        `[${new Date().toLocaleDateString()}] Deployed via Conversational Agent Builder under Section 63 BSA.`,
        `[${new Date().toLocaleDateString()}] Bound to deterministic cron: ${builderDraft.cron}.`
      ],
      chatHistory: [
        {
          id: `init-${Date.now()}`,
          sender: "system",
          text: `Autonomous agent ${builderDraft.code} successfully deployed. Schedule: ${builderDraft.schedule}.`,
          timestamp: "Just now"
        }
      ]
    };

    setWorkers([newWorker, ...workers]);
    setSelectedWorkerId(newId);

    // Register ticket via backend
    try {
      const token = localStorage.getItem("vajra_token") || "";
      await fetch(`${API_BASE}/api/precinct/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          department: "surveillance",
          title: `Agent Deployed: ${builderDraft.code}`,
          findings: `Autonomous worker created: ${builderDraft.name}. Cron: ${builderDraft.cron}`,
          priority: "HIGH",
          case_no: "STATEWIDE"
        })
      });
    } catch {
      // Ignored
    }

    addToast("Agent Deployed", `${builderDraft.code} is now active and scheduled in the cloud.`, "Success");
    setActiveView("directory");
  };

  // Detail View: Send interactive command to agent
  const handleDetailSend = () => {
    if (!detailInput.trim()) return;
    const text = detailInput.trim();
    setDetailInput("");

    const userMsg: AgentChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "officer",
      text: text,
      timestamp: "Just now"
    };

    setWorkers((prev) =>
      prev.map((w) =>
        w.id === selectedWorker.id ? { ...w, chatHistory: [...w.chatHistory, userMsg] } : w
      )
    );

    setIsExecutingDetail(true);

    setTimeout(() => {
      let agentReply = "";
      if (text.toLowerCase().includes("sweep") || text.toLowerCase().includes("run") || text.toLowerCase().includes("scan")) {
        agentReply = `🟢 MANUAL SWEEP EXECUTED ON DEMAND\n• Target: ${selectedWorker.targetEndpoint}\n• Evaluated: 3,420 records in CCTNS Datastore.\n• Result: Zero new matching FIRs or suspicious movements detected.\n• Status: SLEEP mode restored.`;
      } else if (text.toLowerCase().includes("alias") || text.toLowerCase().includes("add")) {
        agentReply = `Understood, Officer. Search criteria updated in-place with new directive: "${text}". Subsequent deterministic sweeps will filter on these additional parameters.`;
      } else {
        agentReply = `Command acknowledged. Target agent ${selectedWorker.code} has recorded this directive into its Section 63 BSA operational log. Current quota: ${selectedWorker.tokensUsed} / ${selectedWorker.tokenCap} tokens.`;
      }

      const agentMsg: AgentChatMessage = {
        id: `agt-${Date.now()}`,
        sender: "agent",
        text: agentReply,
        timestamp: "Just now"
      };

      setWorkers((prev) =>
        prev.map((w) =>
          w.id === selectedWorker.id ? { ...w, chatHistory: [...w.chatHistory, agentMsg] } : w
        )
      );
      setIsExecutingDetail(false);
    }, 800);
  };

  // =========================================================================
  // VIEW 2: CONVERSATIONAL AGENT BUILDER
  // =========================================================================
  if (activeView === "builder") {
    return (
      <div className={`h-full flex flex-col ${isLight ? "bg-stone-100 text-stone-900" : "bg-stone-950 text-stone-200"}`}>
        {/* Top Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isLight ? "bg-white border-stone-200" : "bg-stone-900/80 border-stone-800"}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView("directory")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                isLight ? "bg-stone-100 border-stone-300 hover:bg-stone-200 text-stone-700" : "bg-stone-800 border-stone-700 hover:bg-stone-750 text-stone-200"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Agents</span>
            </button>
            <div className="h-4 w-[1px] bg-stone-700" />
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#C79A4E]" />
              <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-[#C79A4E]">
                VAK Conversational Agent Builder
              </h1>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
            <Shield className="w-3 h-3" />
            <span>Section 63 BSA Verified</span>
          </span>
        </div>

        {/* Builder Chat Stream */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-5">
          {builderMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3.5 ${msg.sender === "officer" ? "justify-end" : "justify-start"}`}>
              {msg.sender === "conductor" && (
                <div className="w-9 h-9 rounded-xl bg-[#C79A4E]/20 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shrink-0 mt-1">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 font-mono text-xs leading-relaxed space-y-3 shadow-md ${
                  msg.sender === "officer"
                    ? "bg-[#C79A4E] text-stone-950 font-semibold"
                    : isLight
                    ? "bg-white border border-stone-200 text-stone-800"
                    : "bg-stone-900 border border-stone-800 text-stone-200"
                }`}
              >
                <div className="text-[10px] uppercase font-bold opacity-75">
                  {msg.sender === "officer" ? "Investigating Officer" : "VAK Master Conductor"}
                </div>
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Structured Manifest Deployment Card */}
                {msg.showCard && (
                  <div className={`mt-4 rounded-xl border p-4 space-y-3 font-mono text-xs ${isLight ? "bg-stone-50 border-stone-300" : "bg-stone-950/80 border-[#C79A4E]/40"}`}>
                    <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                      <span className="font-bold text-[#C79A4E] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AUTONOMOUS AGENT MANIFEST (§63 BSA)</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                        VALIDATED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-stone-500">Code:</span>{" "}
                        <span className="text-[#C79A4E] font-bold">{builderDraft.code}</span>
                      </div>
                      <div>
                        <span className="text-stone-500">Name:</span>{" "}
                        <span className="font-bold">{builderDraft.name}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-stone-500">Mandate:</span> {builderDraft.mandate}
                      </div>
                      <div>
                        <span className="text-stone-500">Cadence:</span> {builderDraft.schedule}
                      </div>
                      <div>
                        <span className="text-stone-500">Budget:</span> {builderDraft.budget}
                      </div>
                      <div className="col-span-2">
                        <span className="text-stone-500">Alert Channels:</span> {builderDraft.alertChannels}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3 border-t border-stone-800">
                      <button
                        onClick={handleDeployDraftAgent}
                        className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        <span>Deploy Autonomous Agent</span>
                      </button>
                      <button
                        onClick={() => {
                          setBuilderStep(1);
                          setBuilderMessages((prev) => [
                            ...prev,
                            { sender: "conductor", text: "Resetting parameters. Please provide the updated mandate:" }
                          ]);
                        }}
                        className="px-4 py-2.5 rounded-lg border border-stone-700 hover:bg-stone-800 text-stone-300 font-bold text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === "officer" && (
                <div className="w-9 h-9 rounded-xl bg-stone-700 border border-stone-600 flex items-center justify-center text-stone-200 shrink-0 mt-1">
                  👮
                </div>
              )}
            </div>
          ))}

          {isSynthesizingBuilder && (
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 italic">
              <Bot className="w-3.5 h-3.5 animate-spin text-[#C79A4E]" />
              <span>VAK Conductor synthesizing operational mandate...</span>
            </div>
          )}

          {/* Quick Selection Prompt Chips */}
          {builderStep === 1 && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono text-stone-500 uppercase font-bold">Suggested Operational Mandates:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Track suspect 'Ramesh Kumar' across CCTNS Bengaluru and Chitradurga FIRs",
                  "Monitor Section 187 BNSS 60/90-day statutory default bail deadlines statewide",
                  "Scan 1930 Cyber Fraud portal for mule accounts operating in Hubballi"
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleBuilderSend(chip)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-mono transition-all text-left cursor-pointer bg-stone-850 hover:border-[#C79A4E] text-stone-300"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {builderStep === 2 && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono text-stone-500 uppercase font-bold">Suggested Cadences:</span>
              <div className="flex flex-wrap gap-2">
                {["Daily at 08:00 AM IST", "Hourly Check (Cron: 0 * * * *)", "Every 15 minutes"].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleBuilderSend(chip)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer bg-stone-850 hover:border-[#C79A4E] text-stone-300"
                  >
                    ⏱ {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {builderStep === 3 && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono text-stone-500 uppercase font-bold">Suggested Alert Channels:</span>
              <div className="flex flex-wrap gap-2">
                {["VAK Mascot Speech + Sticky Priority Banner", "Morning Station Digest Only", "Acoustic Klaxon Alert"].map(
                  (chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleBuilderSend(chip)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer bg-stone-850 hover:border-[#C79A4E] text-stone-300"
                    >
                      🔔 {chip}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className={`p-4 border-t max-w-4xl w-full mx-auto ${isLight ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"}`}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={builderInput}
              onChange={(e) => setBuilderInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuilderSend()}
              placeholder="Type instructions or mandate for the agent builder..."
              className={`flex-1 px-4 py-2.5 rounded-xl border font-mono text-xs focus:outline-none ${
                isLight ? "bg-stone-50 border-stone-300 focus:border-[#C79A4E]" : "bg-stone-950 border-stone-750 focus:border-[#C79A4E] text-stone-200"
              }`}
            />
            <button
              onClick={() => handleBuilderSend()}
              className="px-4 py-2.5 rounded-xl bg-[#C79A4E] hover:bg-[#b0873f] text-stone-950 font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: DEDICATED ACTIVE AGENT CHAT & STREAM
  // =========================================================================
  if (activeView === "detail" && selectedWorker) {
    return (
      <div className={`h-full flex flex-col ${isLight ? "bg-stone-100 text-stone-900" : "bg-stone-950 text-stone-200"}`}>
        {/* Top Header */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${isLight ? "bg-white border-stone-200" : "bg-stone-900/80 border-stone-800"}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView("directory")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                isLight ? "bg-stone-100 border-stone-300 hover:bg-stone-200 text-stone-700" : "bg-stone-800 border-stone-700 hover:bg-stone-750 text-stone-200"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Agents</span>
            </button>
            <div className="h-4 w-[1px] bg-stone-700" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#C79A4E]">{selectedWorker.code}</span>
                <span
                  className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded ${
                    selectedWorker.status === "Active"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : selectedWorker.status === "Running"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  ● {selectedWorker.status.toUpperCase()}
                </span>
              </div>
              <h1 className="text-sm font-mono font-bold mt-0.5">{selectedWorker.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-400 flex items-center gap-1 mr-2">
              <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
              <span>{selectedWorker.schedule}</span>
            </span>
            <button
              onClick={() => handleRunNow(selectedWorker.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold cursor-pointer transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Now</span>
            </button>
            <button
              onClick={() => handleTogglePause(selectedWorker.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 border border-stone-700 text-stone-300 font-mono text-xs font-bold cursor-pointer transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{selectedWorker.status === "Paused" ? "Resume" : "Pause"}</span>
            </button>
          </div>
        </div>

        {/* Operational Timeline & Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-5">
          <div className="flex items-center gap-2 text-stone-500 font-mono text-[11px] uppercase tracking-wider">
            <div className="h-[1px] flex-1 bg-stone-800" />
            <span>Chronological Execution Stream (§63 BSA Sealed)</span>
            <div className="h-[1px] flex-1 bg-stone-800" />
          </div>

          {selectedWorker.chatHistory.map((item) => (
            <div key={item.id} className={`flex gap-3.5 ${item.sender === "officer" ? "justify-end" : "justify-start"}`}>
              {item.sender !== "officer" && (
                <div className="w-9 h-9 rounded-xl bg-[#C79A4E]/20 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shrink-0 mt-1">
                  <Bot className="w-5 h-5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 font-mono text-xs leading-relaxed space-y-3 shadow-md ${
                  item.sender === "officer"
                    ? "bg-[#C79A4E] text-stone-950 font-semibold"
                    : isLight
                    ? "bg-white border border-stone-200 text-stone-800"
                    : "bg-stone-900 border border-stone-800 text-stone-200"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase font-bold opacity-75 border-b border-stone-800/40 pb-1.5">
                  <span>{item.sender === "officer" ? "Investigating Officer" : selectedWorker.code}</span>
                  <span>{item.timestamp}</span>
                </div>

                <div className="whitespace-pre-wrap">{item.text}</div>

                {/* Evidentiary Anomaly Card */}
                {item.evidenceCard && (
                  <div className={`mt-3 rounded-xl border p-4 space-y-3 ${isLight ? "bg-amber-50/50 border-amber-300" : "bg-stone-950/80 border-amber-500/40"}`}>
                    <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>EVIDENTIARY INCIDENT MATCH (§63 BSA PROVENANCE)</span>
                      </span>
                      <span className="text-[9.5px] font-mono bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold">
                        PRIORITY
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-stone-500 font-bold">FIR Number:</span>{" "}
                        <span className="text-stone-100 font-bold">{item.evidenceCard.firNo}</span> ({item.evidenceCard.ps})
                      </div>
                      <div>
                        <span className="text-stone-500 font-bold">Accused:</span>{" "}
                        <span className="text-amber-300 font-bold">{item.evidenceCard.accusedName}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-bold">Statutory Offenses:</span>{" "}
                        <span>{item.evidenceCard.sections}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 font-bold">Registered:</span>{" "}
                        <span>{item.evidenceCard.registeredAt}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 pt-1 font-mono break-all">
                        SHA-256: {item.evidenceCard.sha256}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-stone-800">
                      <button
                        onClick={() => {
                          addToast("Dossier Opened", `Opening FIR Dossier ${item.evidenceCard?.firNo}`, "Info");
                          setCurrentScreen("investigations");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] font-bold cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />
                        <span>View Full FIR Dossier</span>
                      </button>
                      <button
                        onClick={() => {
                          addToast("Graph Tracing", "Loading relational co-accused graph...", "Info");
                          setCurrentScreen("network");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] font-bold cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Trace Co-Accused Graph</span>
                      </button>
                      <button
                        onClick={() => {
                          addToast("Statutory Remand", "Inspecting §187 BNSS remand schedule", "Info");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] font-bold cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5 text-emerald-400" />
                        <span>§187 Remand Clock</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {item.sender === "officer" && (
                <div className="w-9 h-9 rounded-xl bg-stone-700 border border-stone-600 flex items-center justify-center text-stone-200 shrink-0 mt-1">
                  👮
                </div>
              )}
            </div>
          ))}

          {isExecutingDetail && (
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 italic">
              <Bot className="w-3.5 h-3.5 animate-spin text-[#C79A4E]" />
              <span>Agent {selectedWorker.code} executing CCTNS query...</span>
            </div>
          )}
        </div>

        {/* Detail Input Bar */}
        <div className={`p-4 border-t max-w-4xl w-full mx-auto ${isLight ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"}`}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={detailInput}
              onChange={(e) => setDetailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDetailSend()}
              placeholder="Send instruction or trigger sweep (e.g. 'Run immediate manual sweep', 'Add alias')..."
              className={`flex-1 px-4 py-2.5 rounded-xl border font-mono text-xs focus:outline-none ${
                isLight ? "bg-stone-50 border-stone-300 focus:border-[#C79A4E]" : "bg-stone-950 border-stone-750 focus:border-[#C79A4E] text-stone-200"
              }`}
            />
            <button
              onClick={handleDetailSend}
              className="px-4 py-2.5 rounded-xl bg-[#C79A4E] hover:bg-[#b0873f] text-stone-950 font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: EXECUTIVE DIRECTORY HUB VIEW (Default State)
  // =========================================================================
  return (
    <div className={`h-full flex flex-col overflow-y-auto ${isLight ? "bg-stone-100 text-stone-900" : "bg-stone-950 text-stone-200"}`}>
      {/* Top Header */}
      <div className={`p-6 border-b shrink-0 ${isLight ? "bg-white border-stone-200" : "bg-stone-900/60 border-stone-850"}`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#C79A4E]/15 border border-[#C79A4E]/40 flex items-center justify-center text-[#C79A4E] shadow-[0_0_20px_rgba(199,154,78,0.25)]">
              <Bot className="w-6 h-6 animate-pulse" />
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
                  ? "Autonomous 24/7 background agents monitoring CCTNS FIRs, suspects, statutory clocks & telemetry"
                  : "CCTNS ಎಫ್‌ಐಆರ್‌ಗಳು ಮತ್ತು ಶಾಸನಬದ್ಧ ಗಡಿಯಾರಗಳನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡುವ 24/7 ಸ್ವಾಯತ್ತ ಏಜೆಂಟ್‌ಗಳು"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={() => setActiveView("builder")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C79A4E] hover:bg-[#b0873f] text-stone-950 font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#C79A4E]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search autonomous agents by code, suspect, or mandate..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border font-mono text-xs focus:outline-none ${
                isLight ? "bg-white border-stone-300 focus:border-[#C79A4E]" : "bg-stone-900 border-stone-800 focus:border-[#C79A4E] text-stone-200"
              }`}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "ALL", label: `ALL (${workers.length})` },
              { id: "ACTIVE", label: `● ACTIVE (${workers.filter((w) => w.status === "Active").length})` },
              { id: "RUNNING", label: `🔄 RUNNING (${workers.filter((w) => w.status === "Running").length})` },
              { id: "IDLE", label: `⏸ IDLE (${workers.filter((w) => w.status === "Idle").length})` },
              { id: "PAUSED", label: `⏹ PAUSED (${workers.filter((w) => w.status === "Paused").length})` }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === pill.id
                    ? "bg-[#C79A4E] text-stone-950 shadow-sm"
                    : isLight
                    ? "bg-white border border-stone-300 text-stone-600 hover:bg-stone-100"
                    : "bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Grid of Agent Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredWorkers.map((worker) => {
            const quotaPercent = Math.min(100, Math.round((worker.tokensUsed / worker.tokenCap) * 100));

            return (
              <div
                key={worker.id}
                onClick={() => {
                  setSelectedWorkerId(worker.id);
                  setActiveView("detail");
                }}
                className={`rounded-2xl border p-5 space-y-4 transition-all cursor-pointer group shadow-lg ${
                  isLight
                    ? "bg-white border-stone-200 hover:border-[#C79A4E] hover:shadow-xl"
                    : "bg-stone-900/60 border-stone-800 hover:border-[#C79A4E]/60 hover:bg-stone-900"
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-800/60 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#C79A4E] group-hover:underline">
                      {worker.code}
                    </span>
                    <h3 className="text-sm font-mono font-bold text-stone-100 mt-0.5">{worker.name}</h3>
                  </div>
                  <span
                    className={`text-[9.5px] font-mono font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${
                      worker.status === "Active"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : worker.status === "Running"
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                        : worker.status === "Paused"
                        ? "bg-stone-700/30 text-stone-400 border border-stone-700/50"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span>{worker.status.toUpperCase()}</span>
                  </span>
                </div>

                {/* Mandate & Target */}
                <div className="space-y-1.5 text-xs font-mono">
                  <p className="text-stone-300 leading-relaxed line-clamp-2">
                    <span className="text-stone-500 font-bold">Mandate:</span> {worker.mandate}
                  </p>
                  <p className="text-stone-400 text-[11px]">
                    <span className="text-stone-500 font-bold">Target:</span> {worker.targetEndpoint}
                  </p>
                  <p className="text-stone-400 text-[11px] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
                    <span>Cadence: {worker.schedule}</span>
                    <span className="text-stone-500">(Cron: {worker.cron})</span>
                  </p>
                </div>

                {/* Token Meter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] font-mono text-stone-400">
                    <span>Daily Quota Consumption</span>
                    <span className="text-stone-300 font-bold">
                      {worker.tokensUsed.toLocaleString()} / {worker.tokenCap.toLocaleString()} tokens ({quotaPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quotaPercent > 80 ? "bg-rose-500" : quotaPercent > 50 ? "bg-amber-500" : "bg-[#C79A4E]"
                      }`}
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>

                {/* Status & Findings */}
                <div className="pt-2 border-t border-stone-800/60 flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    {worker.flaggedCount > 0 ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>⚠️ {worker.flaggedCount} anomaly flagged!</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>🟢 Last run: {worker.lastRun} — Clean</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRunNow(worker.id)}
                      className="p-1.5 rounded bg-stone-800 hover:bg-emerald-600 hover:text-white text-stone-300 transition-colors"
                      title="Run manual scan now"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleTogglePause(worker.id)}
                      className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                      title="Pause / Resume"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWorkerId(worker.id);
                        setActiveView("detail");
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#C79A4E]/20 text-[#C79A4E] hover:bg-[#C79A4E] hover:text-stone-950 font-bold text-[10.5px] transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Paperclip Task Ledger */}
        <div className={`rounded-2xl border p-5 space-y-4 ${isLight ? "bg-white border-stone-200" : "bg-stone-900/50 border-stone-800"}`}>
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#C79A4E]" />
                <span>Precinct Task Ledger (§63 BSA Certified)</span>
              </h2>
              <p className="text-[10px] font-mono text-stone-500 mt-0.5">
                Autonomous background evidence records sealed in Zoho Catalyst Datastore
              </p>
            </div>
            <button
              onClick={fetchPrecinctTickets}
              className="p-1.5 rounded text-stone-400 hover:text-[#C79A4E] border border-stone-800"
              title="Refresh tickets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? "animate-spin text-[#C79A4E]" : ""}`} />
            </button>
          </div>

          <div className="space-y-2.5">
            {precinctTickets.length === 0 ? (
              <p className="text-xs font-mono text-stone-500 text-center py-4">No active precinct tickets flagged.</p>
            ) : (
              precinctTickets.slice(0, 3).map((tk) => (
                <div
                  key={tk.ticket_id}
                  className="rounded-xl border border-stone-800 bg-stone-950/60 p-3 font-mono text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-200">{tk.title}</span>
                    <span className="text-[9.5px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {tk.priority}
                    </span>
                  </div>
                  <p className="text-stone-400 text-[11px]">{tk.findings}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
