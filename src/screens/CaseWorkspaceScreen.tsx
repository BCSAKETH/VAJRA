import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockFIRs, mockAccused, appendAuditLog } from "../mockData";
import {
  FolderOpen,
  Calendar,
  User,
  ExternalLink,
  Shield,
  FileText,
  Clock,
  Briefcase,
  Sparkles,
  Layers,
  MapPin,
  FileSpreadsheet,
  Cpu,
  AlertTriangle,
  Bookmark,
  Info,
  Loader2,
  Activity,
  MessageSquare,
  Network,
  Crosshair,
  Radio,
  Zap,
  Target,
} from "lucide-react";

export const CaseWorkspaceScreen: React.FC = () => {
  const {
    lang,
    badgeNumber,
    setCurrentScreen,
    addToast,
    selectedFirNo,
    setSelectedFirNo,
  } = useApp();
  const activeFirNo = selectedFirNo || "FIR-2023-0142";
  const setActiveFirNo = (firNo: string) => setSelectedFirNo(firNo);

  // Two-Mode Architecture State
  const [viewMode, setViewMode] = useState<"intelligence" | "tactical">(
    "intelligence",
  );

  // Gemini Summary Panel state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [geminiSummary, setGeminiSummary] = useState<string>("");

  // Live database case details state
  const [liveFIR, setLiveFIR] = useState<any | null>(null);
  const [firs, setFirs] = useState<any[]>(mockFIRs);

  useEffect(() => {
    const fetchFirsList = async () => {
      try {
        const token = localStorage.getItem("vajra_token");
        const response = await fetch("http://localhost:8000/api/firs?limit=150", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setFirs(data);
      } catch (err) {
        console.error("Error fetching live cases list in CaseWorkspace:", err);
      }
    };
    fetchFirsList();
  }, []);

  useEffect(() => {
    const fetchLiveDetails = async () => {
      try {
        const token = localStorage.getItem("vajra_token");
        const response = await fetch(`http://localhost:8000/api/firs/${activeFirNo}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error("Not found in database");
        }
        const data = await response.json();
        setLiveFIR(data);
      } catch (err) {
        console.warn("Live FIR query failed, falling back to mock:", err);
        setLiveFIR(null);
      }
    };
    fetchLiveDetails();
  }, [activeFirNo]);

  const activeFIR = liveFIR ? {
    firNo: liveFIR.firNo,
    station: liveFIR.station,
    district: liveFIR.district,
    date: liveFIR.date,
    actSection: liveFIR.actSection,
    crimeType: liveFIR.crimeType,
    status: liveFIR.status,
    accusedName: liveFIR.accusedName,
    accusedAge: liveFIR.accusedAge,
    unemploymentRate: liveFIR.unemploymentRate,
    literacyRate: liveFIR.literacyRate,
    brieffacts: liveFIR.brieffacts,
    latitude: liveFIR.latitude,
    longitude: liveFIR.longitude,
  } : (firs.find((f) => f.firNo === activeFirNo) || firs[0]);

  const foundACC = mockAccused.find((a) => a.primaryFIR === activeFirNo);
  const activeACC = liveFIR ? {
    id: liveFIR.accusedId || "live-accused-id",
    name: liveFIR.accusedName,
    alias: "Suspect " + liveFIR.accusedName.split(" ")[0],
    age: liveFIR.accusedAge,
    gender: "Male",
    primaryFIR: liveFIR.firNo,
    associatedStations: [liveFIR.station],
    reoffendingRisk: foundACC ? foundACC.reoffendingRisk : 18,
    moFingerprint: foundACC ? foundACC.moFingerprint : ["House Theft Signature", "Night entry pattern"],
    shapFactors: foundACC ? foundACC.shapFactors : [
      { name: "UnitName_encoded", value: -0.15, contribution: "negative" },
      { name: "Accused Count", value: 0.22, contribution: "positive" }
    ],
    timeline: foundACC ? foundACC.timeline : [
      { date: liveFIR.date, event: "FIR Registered", type: "fir" },
      { date: liveFIR.date, event: "Arrest & Bail Record", type: "arrest" }
    ],
    phone: foundACC ? foundACC.phone : "+91-9988223311",
    vehicle: foundACC ? foundACC.vehicle : "KA-04-MB-2234"
  } : (foundACC || mockAccused[0]);

  // Sync state when case is swapped
  useEffect(() => {
    setGeminiSummary("");
  }, [activeFirNo]);

  // Investigator Notes state (sessionStorage-backed)
  const [notes, setNotes] = useState<string>("");
  const [notesSaveStatus, setNotesSaveStatus] = useState<
    "saved" | "saving" | "restored"
  >("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");

  useEffect(() => {
    const savedNotes = sessionStorage.getItem(`vajra_notes_for_${activeFirNo}`);
    if (savedNotes !== null) {
      setNotes(savedNotes);
      setNotesSaveStatus("restored");
      setLastSavedTime(new Date().toLocaleTimeString());
    } else {
      setNotes("");
      setNotesSaveStatus("saved");
      setLastSavedTime("");
    }
  }, [activeFirNo]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    setNotesSaveStatus("saving");
    sessionStorage.setItem(`vajra_notes_for_${activeFirNo}`, val);

    const timer = setTimeout(() => {
      setNotesSaveStatus("saved");
      setLastSavedTime(new Date().toLocaleTimeString());
    }, 300);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    const savedCase = localStorage.getItem("vajra_initial_workspace_case");
    if (savedCase) {
      const match = firs.find((f) => f.firNo === savedCase);
      if (match) {
        setActiveFirNo(savedCase);
      }
      localStorage.removeItem("vajra_initial_workspace_case");
    }
  }, []);

  const generateGeminiSummary = () => {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      const summaryText =
        lang === "en"
          ? `• **CASE SYNOPSIS**: ${activeFIR.firNo} registered on ${activeFIR.date} at ${activeFIR.station} under ${activeFIR.actSection}. This involves a category of **${activeFIR.crimeType}** with accused **${activeFIR.accusedName}** (${activeFIR.accusedAge} years old).\n• **DEMOGRAPHIC CORRELATION**: Grounded spatial models identify a local area unemployment rate of **${activeFIR.unemploymentRate}%** and literacy metric of **${activeFIR.literacyRate}%**, indicating a heightened socio-economic risk multiplier of +${Math.round(activeFIR.unemploymentRate * 1.5)}%.\n• **ACCUSED RE-OFFENDING VECTORS**: Profile database lists primary risk score at **${activeACC?.reoffendingRisk || 70}%** driven by Modus Operandi ("${activeACC?.moFingerprint?.[0] || "Unclassified"}") and a dense network of association across ${activeACC?.associatedStations?.join(", ") || activeFIR.station} precincts.\n• **PATROL RECOMMENDATION**: Kriging models and Gaussian vector fields suggest immediate high-density visible patrols at ${activeFIR.station} patrol corridors to mitigate property crime volatility.`
          : `• **ಪ್ರಕರಣದ ವಿವರ**: ${activeFIR.firNo} ದಿನಾಂಕ ${activeFIR.date} ರಂದು ${activeFIR.station} ನಲ್ಲಿ ದಾಖಲಾಗಿದೆ. ಇದು **${activeFIR.crimeType}** ವರ್ಗಕ್ಕೆ ಸೇರಿದ್ದು, ಆರೋಪಿ **${activeFIR.accusedName}** (${activeFIR.accusedAge} ವರ್ಷ) ಶಾಮೀಲಾಗಿದ್ದಾರೆ.\n• **ಜನಸಂಖ್ಯಾ ಸೂಚ್ಯಂಕಗಳು**: ಸ್ಥಳೀಯ ನಿರುದ್ಯೋಗ ದರ ಶೇಕಡಾ **${activeFIR.unemploymentRate}%** ಮತ್ತು ಸಾಕ್ಷರತೆ ಶೇಕಡಾ **${activeFIR.literacyRate}%** ಆಗಿದ್ದು, ಅಪರಾಧಕ್ಕೆ ಪೂರಕ ವಾತಾವರಣ ಸೂಚಿಸುತ್ತದೆ.\n• **ಆರೋಪಿಯ ಮರು-ಅಪರಾಧ ಅಪಾಯ**: ಪ್ರಮುಖ ಅಪಾಯದ ಸೂಚ್ಯಂಕ ಶೇಕಡಾ **${activeACC?.reoffendingRisk || 70}%** ಆಗಿದ್ದು, ಮೋಡಸ್ ಆಪರೇಂಡಿ ("${activeACC?.moFingerprint?.[0] || "ವರ್ಗೀಕರಿಸದ"}") ಮತ್ತು ${activeACC?.associatedStations?.join(", ") || activeFIR.station} ವ್ಯಾಪ್ತಿಯ ಸಂಪರ್ಕಗಳಿಂದ ಪ್ರೇರಿತವಾಗಿದೆ.\n• **ಗಸ್ತು ಶಿಫಾರಸು**: ಅಪರಾಧ ಪ್ರಮಾಣ ಕಡಿತಗೊಳಿಸಲು ${activeFIR.station} ಗಸ್ತು ಮಾರ್ಗಗಳಲ್ಲಿ ತಕ್ಷಣದ ನಿಗಾ ವಹಿಸಲು ಸೂಚಿಸಲಾಗಿದೆ.`;
      setGeminiSummary(summaryText);
      setIsGeneratingSummary(false);

      appendAuditLog({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        badgeId: badgeNumber || "KSP-2026",
        action: "Gemini Executive Synthesis",
        queryParam: `Case File Summary: ${activeFIR.firNo}`,
        recordsAccessed: 184,
      });

      addToast(
        "Gemini Summary Generated",
        `Executive synthesis for ${activeFIR.firNo} is complete.`,
        "Success",
      );
    }, 1200);
  };

  const handleLaunchModule = (module: string, screen: string) => {
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: `Launched ${module} from Workspace`,
      queryParam: `Context: ${activeFirNo}`,
      recordsAccessed: 0,
    });

    if (screen === "accused_profile" && activeACC) {
      localStorage.setItem("vajra_selected_accused_id", activeACC.id);
    }

    setCurrentScreen(screen);
  };

  return (
    <div
      className="p-6 space-y-6 animate-fade-in font-sans h-[calc(100vh-64px)] overflow-y-auto"
      id="intelligence-workshop-root"
    >
      {/* State-of-the-art Header Banner */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5 sticky top-0 z-10">
        <div className="space-y-1.5 text-left">
          <div className="inline-flex items-center space-x-2 text-[#1D4ED8] bg-blue-50 border border-blue-200/50 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
            <Cpu
              className="w-4 h-4 text-[#1D4ED8] animate-spin"
              style={{ animationDuration: "6s" }}
            />
            <span>TWO-MODE ARCHITECTURE ACTIVE</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>{lang === "en" ? "Case Workspace" : "ಪ್ರಕರಣ ಕಾರ್ಯಸ್ಥಳ"}</span>
          </h2>
          <p className="text-[12.5px] text-slate-500 font-medium max-w-3xl leading-relaxed kn-text">
            {lang === "en"
              ? "Deep dive into isolated case parameters using the Intelligence reading mode or execute deep operations using the Tactical launch mode."
              : "ಗುಪ್ತಚರ ಓದುವ ಮೋಡ್ ಅಥವಾ ಯುದ್ಧತಂತ್ರದ ಕಾರ್ಯಾಚರಣೆ ಮೋಡ್ ಬಳಸಿ ಆಳವಾದ ವಿಶ್ಲೇಷಣೆ ಮಾಡಿ."}
          </p>
        </div>

        {/* Action controls & Case selector */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-[10.5px] font-mono font-bold text-slate-400">
              ACTIVE DOSSIER:
            </span>
            <select
              value={activeFirNo}
              onChange={(e) => setActiveFirNo(e.target.value)}
              className="bg-transparent border-0 rounded text-[12.5px] font-mono font-bold text-[#1D4ED8] focus:outline-none focus:ring-0 cursor-pointer"
            >
              {firs.map((f) => (
                <option key={f.firNo} value={f.firNo}>
                  {f.firNo} ({f.station})
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

          {/* Two-Mode Switches */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-1 flex space-x-1 shadow-inner">
            <button
              onClick={() => setViewMode("intelligence")}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "intelligence"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileSpreadsheet
                className={`w-4 h-4 ${viewMode === "intelligence" ? "text-blue-600" : "text-slate-400"}`}
              />
              <span>
                {lang === "en" ? "Intelligence Mode" : "ಗುಪ್ತಚರ ಮೋಡ್"}
              </span>
            </button>
            <button
              onClick={() => setViewMode("tactical")}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "tactical"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Target
                className={`w-4 h-4 ${viewMode === "tactical" ? "text-rose-600 animate-pulse" : "text-slate-400"}`}
              />
              <span>
                {lang === "en" ? "Tactical Operations" : "ಯುದ್ಧತಂತ್ರ"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: INTELLIGENCE (Dossier & Reading) */}
      {viewMode === "intelligence" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch animate-fade-in">
          {/* Left Column: CCTNS Inquest Details & Gemini Executive Summary */}
          <div className="xl:col-span-5 flex flex-col space-y-6">
            {/* CCTNS Inquest Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-left">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono">
                      CCTNS Incident Inquest
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Integrated Government Record Reference
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    activeFIR.status === "Closed"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {activeFIR.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[12px] bg-slate-50 p-4 border border-slate-150 rounded-xl">
                <div>
                  <span className="block text-slate-400 text-[9px] uppercase font-extrabold font-mono tracking-wider">
                    Station Area Code
                  </span>
                  <span className="font-bold text-slate-950 kn-text mt-0.5 block">
                    {activeFIR.station}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[9px] uppercase font-extrabold font-mono tracking-wider">
                    Sub-District Division
                  </span>
                  <span className="font-bold text-slate-950 mt-0.5 block">
                    {activeFIR.district}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="block text-slate-400 text-[9px] uppercase font-extrabold font-mono tracking-wider">
                    Indian Penal Code Sections Applied
                  </span>
                  <span className="font-mono text-blue-700 font-bold block mt-0.5">
                    {activeFIR.actSection}
                  </span>
                </div>
                {activeFIR.brieffacts && (
                  <div className="col-span-2 pt-2 border-t border-slate-200/60">
                    <span className="block text-slate-400 text-[9px] uppercase font-extrabold font-mono tracking-wider">
                      Live Incident Narrative / ಸಂಕ್ಷಿಪ್ತ ವಿವರ
                    </span>
                    <span className="text-slate-700 font-medium block mt-0.5 kn-text leading-relaxed">
                      {activeFIR.brieffacts}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11.5px]">
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                  <span className="block text-slate-400 text-[8.5px] uppercase font-bold font-mono">
                    Unemployment Rate
                  </span>
                  <span className="font-mono font-extrabold text-emerald-800 text-[15px] block mt-0.5">
                    {activeFIR.unemploymentRate}%
                  </span>
                  <p className="text-[8px] text-slate-500 mt-1 leading-tight">
                    Data.gov.in census correlation
                  </p>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl">
                  <span className="block text-slate-400 text-[8.5px] uppercase font-bold font-mono">
                    Literacy Baseline
                  </span>
                  <span className="font-mono font-extrabold text-indigo-800 text-[15px] block mt-0.5">
                    {activeFIR.literacyRate}%
                  </span>
                  <p className="text-[8px] text-slate-500 mt-1 leading-tight">
                    Socio-demographic capacity
                  </p>
                </div>
              </div>
            </div>

            {/* Accused SHAP Profile Card Overview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-left flex-1">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100 shrink-0">
                    <Activity className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono">
                      Primary Target Overview
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Accused Identity & Risk Level
                    </p>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full border border-rose-200">
                  {activeACC?.reoffendingRisk || 70}% Risk
                </span>
              </div>

              {activeACC ? (
                <div className="space-y-4">
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                        Identified Target:
                      </span>
                      <span className="font-bold text-slate-900">
                        {activeACC.name} ({activeACC.alias})
                      </span>
                    </div>

                    <div className="bg-indigo-50/30 p-2.5 border border-indigo-100 rounded-xl">
                      <span className="block text-[#1D4ED8] font-bold font-mono text-[9px] uppercase tracking-wider">
                        Modus Operandi Blueprint:
                      </span>
                      <span className="text-slate-700 font-semibold kn-text leading-relaxed text-[11.5px] mt-1 block">
                        {activeACC.moFingerprint[0]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block border-b border-slate-100 pb-1">
                      SHAP Waterfall Factors
                    </span>
                    <div className="space-y-2">
                      {activeACC.shapFactors.slice(0, 2).map((f, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 font-mono text-[10.5px]"
                        >
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span className="truncate max-w-[180px]">
                              {f.name}
                            </span>
                            <span
                              className={
                                f.contribution === "positive"
                                  ? "text-rose-600 font-bold"
                                  : "text-emerald-700 font-bold"
                              }
                            >
                              {f.contribution === "positive" ? "+" : ""}
                              {f.value}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${f.contribution === "positive" ? "bg-rose-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.abs(f.value) * 2}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 flex space-x-2 border-t border-slate-100">
                    <button
                      onClick={() =>
                        handleLaunchModule("Case Crime Map", "spatial")
                      }
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-3 rounded-lg text-[10.5px] uppercase font-mono tracking-wider flex items-center justify-center space-x-1.5 transition-all"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>View Map</span>
                    </button>
                    <button
                      onClick={() =>
                        handleLaunchModule("Relational Network", "network")
                      }
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-3 rounded-lg text-[10.5px] uppercase font-mono tracking-wider flex items-center justify-center space-x-1.5 transition-all"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>View Network</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-6 text-xs">
                  No active accused identified in standard FIR schema.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Gemini Summary & Notes */}
          <div className="xl:col-span-7 flex flex-col space-y-6">
            {/* Gemini AI Executive Summary panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-left space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/50 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4 animate-pulse text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-slate-100 uppercase tracking-wider font-mono">
                      Gemini Cognitive Summary
                    </h3>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Automated AI Dossier Synthesis
                    </p>
                  </div>
                </div>
                <span className="text-[8.5px] font-mono bg-[#1D4ED8] text-white font-bold px-2 py-0.5 rounded uppercase">
                  v2.0 FLASH
                </span>
              </div>

              <div className="min-h-[160px] bg-slate-950/80 border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
                {isGeneratingSummary ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3 flex-grow">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-[10.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                      Analyzing grounded parameters...
                    </span>
                  </div>
                ) : geminiSummary ? (
                  <div className="space-y-3 text-[11.5px] text-slate-300 leading-relaxed font-sans max-h-[220px] overflow-y-auto pr-1">
                    {geminiSummary.split("\n").map((bullet, i) => {
                      const matches = bullet.match(/\*\*(.*?)\*\*/g);
                      let formatted = bullet;
                      if (matches) {
                        matches.forEach((m) => {
                          const clean = m.replace(/\*\*/g, "");
                          formatted = formatted.replace(
                            m,
                            `<strong class="text-white font-semibold">${clean}</strong>`,
                          );
                        });
                      }
                      return (
                        <p
                          key={i}
                          className="pl-3 border-l border-indigo-500/40 py-0.5"
                          dangerouslySetInnerHTML={{ __html: formatted }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-10 space-y-3 flex-grow">
                    <Info className="w-8 h-8 text-slate-600" />
                    <p className="text-[11.5px] text-slate-400 font-medium max-w-[240px] leading-relaxed">
                      {lang === "en"
                        ? "No summary generated yet. Ask Gemini to synthesize open incident files instantly."
                        : "ಇನ್ನೂ ಯಾವುದೇ ಸಾರಾಂಶ ಸಿದ್ಧಪಡಿಸಿಲ್ಲ. ಜೆಮಿನಿ ಮೂಲಕ ತಕ್ಷಣ ಕಡತ ವಿಶ್ಲೇಷಣೆ ಮಾಡಿ."}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={generateGeminiSummary}
                  disabled={isGeneratingSummary}
                  className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center space-x-2 shadow-lg hover:shadow-indigo-500/10 cursor-pointer transition-all duration-150"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {geminiSummary
                      ? "Regenerate Bullet Synthesis"
                      : "Generate Summary with Gemini"}
                  </span>
                </button>
              </div>
            </div>

            {/* Investigator Notes Scratchpad */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-left flex-1 flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00C6AD]/10 flex items-center justify-center text-[#00C6AD] shrink-0 border border-[#00C6AD]/20">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono">
                      Investigator Active Notes
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Persistent Session Case Scratchpad
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 font-mono text-[9px] uppercase font-bold">
                  {notesSaveStatus === "saving" && (
                    <span className="text-amber-600 animate-pulse flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...
                    </span>
                  )}
                  {notesSaveStatus === "saved" && notes && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />{" "}
                      Auto-Saved
                    </span>
                  )}
                  {notesSaveStatus === "restored" && notes && (
                    <span className="text-[#1D4ED8]">Draft Restored</span>
                  )}
                </div>
              </div>

              <div className="space-y-3 flex-1 flex flex-col">
                <textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Enter critical notes here (suspect details, phone numbers, alibis)... Automatically protected from accidental browser refresh."
                      : "ಇಲ್ಲಿ ತನಿಖಾ ಟಿಪ್ಪಣಿಗಳನ್ನು ನಮೂದಿಸಿ..."
                  }
                  className="w-full flex-1 min-h-[140px] p-3 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[#00C6AD] font-medium leading-relaxed resize-none bg-slate-50/50 text-slate-800"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>{notes.length} characters</span>
                  {lastSavedTime && <span>Last saved: {lastSavedTime}</span>}
                </div>

                {/* Quick Templates Insert Block */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10.5px] font-bold text-slate-500 block uppercase font-mono tracking-wider">
                    Quick Templates:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const template = `[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] 📋 ASSESSED ALIBI: `;
                        handleNotesChange(
                          notes ? notes + "\n" + template : template,
                        );
                        addToast(
                          "Template Inserted",
                          "Incident assessment template added.",
                          "Success",
                        );
                      }}
                      className="text-[10px] font-bold bg-slate-150 hover:bg-[#00C6AD]/10 hover:text-[#00C6AD] text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/50 cursor-pointer transition-all"
                    >
                      + Assessment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const template = `[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] 🔍 SUSPECT MO: `;
                        handleNotesChange(
                          notes ? notes + "\n" + template : template,
                        );
                        addToast(
                          "Template Inserted",
                          "Suspect MO vector added.",
                          "Success",
                        );
                      }}
                      className="text-[10px] font-bold bg-slate-150 hover:bg-[#00C6AD]/10 hover:text-[#00C6AD] text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/50 cursor-pointer transition-all"
                    >
                      + Suspect MO
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: TACTICAL OPERATIONS (Action & Launchpad) */}
      {viewMode === "tactical" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-fade-in">
          <div className="col-span-full mb-2">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-500">
              Tactical Operations Launchpad
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Execute deep-dive analysis modules configured specifically for{" "}
              {activeFirNo}.
            </p>
          </div>

          {/* Module 1: Network Analyzer */}
          <div
            onClick={() =>
              handleLaunchModule("Network Link Analyzer", "network")
            }
            className="group cursor-pointer bg-white border-2 border-slate-200 hover:border-[#1D4ED8] rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all text-left space-y-4 relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200 relative z-10">
              <Network className="w-6 h-6" />
            </div>
            <div className="relative z-10">
              <h4 className="text-[15px] font-bold text-slate-900 font-mono tracking-tight group-hover:text-blue-700 transition-colors">
                Relational Network
              </h4>
              <p className="text-[12px] text-slate-500 leading-relaxed mt-2 h-10">
                Map multi-hop linkages between suspects, vehicles, and the
                active FIR incident.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-blue-600 uppercase font-mono tracking-wider group-hover:translate-x-1 transition-transform relative z-10">
              <span>Launch Module</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Module 2: Spatial Analyst */}
          <div
            onClick={() => handleLaunchModule("Spatial Analyst", "spatial")}
            className="group cursor-pointer bg-white border-2 border-slate-200 hover:border-[#F59E0B] rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 transition-all text-left space-y-4 relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200 relative z-10">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="relative z-10">
              <h4 className="text-[15px] font-bold text-slate-900 font-mono tracking-tight group-hover:text-amber-700 transition-colors">
                Spatial Hotspots
              </h4>
              <p className="text-[12px] text-slate-500 leading-relaxed mt-2 h-10">
                Run DBSCAN clustering algorithms to predict associated
                operational zones.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-amber-600 uppercase font-mono tracking-wider group-hover:translate-x-1 transition-transform relative z-10">
              <span>Launch Module</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Module 3: Target Dossier */}
          <div
            onClick={() =>
              handleLaunchModule("Accused Full Profile", "accused_profile")
            }
            className="group cursor-pointer bg-white border-2 border-slate-200 hover:border-rose-500 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 transition-all text-left space-y-4 relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 relative z-10">
              <Crosshair className="w-6 h-6" />
            </div>
            <div className="relative z-10">
              <h4 className="text-[15px] font-bold text-slate-900 font-mono tracking-tight group-hover:text-rose-700 transition-colors">
                Target Dossier
              </h4>
              <p className="text-[12px] text-slate-500 leading-relaxed mt-2 h-10">
                Access the full SHAP risk breakdown and history for the primary
                target.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-rose-600 uppercase font-mono tracking-wider group-hover:translate-x-1 transition-transform relative z-10">
              <span>Launch Module</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Module 4: Vajra AI Copilot */}
          <div
            onClick={() =>
              handleLaunchModule("VAJRA AI Interactive", "ai_chat")
            }
            className="group cursor-pointer bg-slate-900 border-2 border-slate-800 hover:border-[#00C6AD] rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/20 transition-all text-left space-y-4 relative overflow-hidden"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-900/30 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-[#00C6AD] flex items-center justify-center border border-slate-700 relative z-10">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="relative z-10">
              <h4 className="text-[15px] font-bold text-white font-mono tracking-tight group-hover:text-[#00C6AD] transition-colors">
                VAJRA AI Copilot
              </h4>
              <p className="text-[12px] text-slate-400 leading-relaxed mt-2 h-10">
                Interact conversationally with the case files, MOs, and
                generated intelligence.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-[#00C6AD] uppercase font-mono tracking-wider group-hover:translate-x-1 transition-transform relative z-10">
              <span>Launch Module</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Tactical Context Banner */}
          <div className="col-span-full mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-mono tracking-tight">
                  Active Context Isolation
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Launching any module above will automatically filter its data
                  to focus exclusively on{" "}
                  <span className="font-bold">{activeFirNo}</span> and target{" "}
                  <span className="font-bold">
                    {activeACC?.name || "Unknown"}
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <Zap className="w-12 h-12 text-indigo-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
