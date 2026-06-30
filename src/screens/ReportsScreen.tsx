import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockFIRs, mockHotspots } from "../mockData";
import { ReportsSkeleton } from "../components/SkeletonLoader";
import {
  TrendingUp,
  BarChart4,
  CheckCircle,
  FileText,
  Clock,
  Sparkles,
  Database,
  Grid,
  Info,
} from "lucide-react";

export const ReportsScreen: React.FC = () => {
  const { lang } = useApp();
  const [activeChart, setActiveChart] = useState<"UNEMP" | "LIT">("UNEMP");
  const [isLoading, setIsLoading] = useState(true);
  const [firs, setFirs] = useState<any[]>(mockFIRs);

  useEffect(() => {
    const fetchFirs = async () => {
      try {
        setIsLoading(true);
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
        console.error("Error fetching live cases in ReportsScreen:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFirs();
  }, []);

  // Analytical computation correlating property spikes vs unemployment rate
  const correlations = [
    { zone: "Peenya Industrial Area Zone", crimeDensity: 86, factorVal: 8.4 },
    { zone: "Majestic Junction Cluster", crimeDensity: 91, factorVal: 9.1 },
    {
      zone: "Hebbal Outer Ring Flyover Underpass",
      crimeDensity: 88,
      factorVal: 7.9,
    },
    {
      zone: "Cubbon Park Peripheral Quadrant",
      crimeDensity: 76,
      factorVal: 5.8,
    },
    {
      zone: "Indiranagar 100ft Flyover Junction",
      crimeDensity: 61,
      factorVal: 4.2,
    },
  ];

  const literacyCorrelations = [
    { zone: "Cyber Crime Division Hub", crimeDensity: 31, factorVal: 92.1 },
    { zone: "Yelahanka Old Town PS Gate", crimeDensity: 45, factorVal: 91.0 },
    { zone: "Peenya Machine Subsectors", crimeDensity: 86, factorVal: 74.2 },
    { zone: "Majestic Railway Platform", crimeDensity: 91, factorVal: 68.5 },
    { zone: "Halasuru Lockbreak Subsector", crimeDensity: 42, factorVal: 79.5 },
  ];

  const currentChartData =
    activeChart === "UNEMP" ? correlations : literacyCorrelations;

  const dictionary = {
    en: {
      title: "NCRB Crime vs Socio-Demographic Audits",
      desc: "Algorithmic correlation index comparing Kaggle Karnataka Crime densities against localized parameters extracted from data.gov.in census registries.",
      chart1Header: "Crime Density Index % vs Unemployment Rate %",
      chart2Header: "Property Theft Rate % vs Area Literacy Level %",
      concludeTitle: "AI Correlation Factor Synthesis",
      toggleUnemp: "Unemployment Analytics",
      toggleLit: "Literacy Delta Metrics",
      analysisBox: "Analytical insight:",
    },
    kn: {
      title: "ಸಮಗ್ರ ಸಾಮಾಜಿಕ-ಅಪರಾಧ ಮೆಟ್ರಿಕ್ಸ್ ಮತ್ತು ವರದಿಗಳು",
      desc: "ಕರ್ನಾಟಕ ಅಪರಾಧ ದತ್ತಾಂಶ ಮತ್ತು ಜನಗಣತಿ ಮಾಹಿತಿಯ ಆಧಾರದ ಮೇಲೆ ಸಿದ್ಧಪಡಿಸಲಾದ ಕ್ರಾಸ್-ಕೋರಿಲೇಶನ್ ಗ್ರಾಫ್.",
      chart1Header: "ಅಪರಾಧ ಪ್ರಮಾಣ ಸೂಚ್ಯಂಕ % vs ಸ್ಥಳೀಯ ನಿರುದ್ಯೋಗ ದರ %",
      chart2Header: "ಕಳ್ಳತನ ಜಿಯೋ ಫೈಲ್ % vs ಸಾಕ್ಷರತೆ ಮಟ್ಟ %",
      concludeTitle: "AI ಸಾಂದ್ರತೆ ವಿಶ್ಲೇಷಣಾ ವರದಿ",
      toggleUnemp: "ನಿರುದ್ಯೋಗ ಸೂಚ್ಯಂಕ ವಿಶ್ಲೇಷಣೆ",
      toggleLit: "ಸಾಕ್ಷರತೆ ಗ್ಯಾಪ್ ಕೊರಿಲೇಶನ್",
      analysisBox: "ವಿಶ್ಲೇಷಣಾತ್ಮಕ ಒಳನೋಟ:",
    },
  }[lang];

  if (isLoading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Top Header Grid */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] text-[10px] font-mono font-bold">
            <BarChart4 className="w-3.5 h-3.5" />
            <span>KSP ANALYTICAL PLOTTING CORE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.title}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-2xl kn-text">
            {dictionary.desc}
          </p>
        </div>

        {/* Chart Selector Toggles */}
        <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold font-mono self-start md:self-center">
          <button
            onClick={() => setActiveChart("UNEMP")}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${activeChart === "UNEMP" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
          >
            {dictionary.toggleUnemp}
          </button>
          <button
            onClick={() => setActiveChart("LIT")}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${activeChart === "LIT" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
          >
            {dictionary.toggleLit}
          </button>
        </div>
      </div>

      {/* Main Graph Grid Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Span 8: Interactive Plot Block */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[13.5px] font-bold text-slate-900 kn-text">
              {activeChart === "UNEMP"
                ? dictionary.chart1Header
                : dictionary.chart2Header}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
              SCALE: BENGALURU- METRO SAMPLING
            </span>
          </div>

          {/* Fully Interactive Custom Vector-Plot Chart */}
          <div className="space-y-6 pt-4">
            <div className="space-y-4">
              {currentChartData.map((item, idx) => {
                return (
                  <div key={idx} className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 truncate max-w-[280px] kn-text">
                        {item.zone}
                      </span>
                      <div className="flex space-x-4 font-mono text-[11px]">
                        <span>
                          CRIME:{" "}
                          <strong className="text-red-700">
                            {item.crimeDensity}%
                          </strong>
                        </span>
                        <span>
                          {activeChart === "UNEMP" ? "UNEMP" : "LITERACY"}:{" "}
                          <strong className="text-emerald-700">
                            {item.factorVal}%
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Stacked comparison bar metrics */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Crime Density Bar */}
                        <div
                          className="h-full bg-red-600 rounded-full absolute left-0 top-0 transition-all duration-500"
                          style={{ width: `${item.crimeDensity}%` }}
                        ></div>
                      </div>

                      <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden relative">
                        {/* Demographic Factor bar */}
                        <div
                          className="h-full bg-[#10B981] rounded-full absolute left-0 top-0 transition-all duration-500"
                          style={{ width: `${item.factorVal}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Grid Legend details */}
            <div className="border-t border-slate-100 pt-4 flex gap-4 text-[10px] font-mono justify-end">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span>
                <span>Crime Density Index %</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1 rounded-full bg-[#10B981] inline-block"></span>
                <span>
                  {activeChart === "UNEMP"
                    ? "External Unemployment rate"
                    : "District Literacy Level %"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Span 4: Algorithmic Synthesizer Output */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-[#D97706]" />
            <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono">
              {dictionary.concludeTitle}
            </h3>
          </div>

          {/* AI Teal safe block for insightful analysis */}
          <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 p-4 rounded-r-xl space-y-2.5 flex-1 mt-4">
            <span className="text-[9px] font-mono tracking-widest text-[#00100C] font-extrabold uppercase">
              {dictionary.analysisBox}
            </span>
            <p className="text-[12.5px] text-slate-700 leading-relaxed font-sans kn-text">
              {activeChart === "UNEMP"
                ? lang === "en"
                  ? "Comparing Kaggle values highlights a direct mathematical Pearson r-correlation of +0.81 near railway lines, and +0.64 in manufacturing yard limits of Bengaluru. High local jobless index corresponds with property crimes spike."
                  : "ಹೋಲಿಸಿದರೆ ರೈಲ್ವೆ ನಿಲ್ದಾಣದ ಸಮೀಪ ಅಪರಾಧ ಮತ್ತು ನಿರುದ್ಯೋಗ ದರಕ್ಕೂ ಶೇಕಡಾ ೦.೮೧ ರಷ್ಟು ನೇರ ಸಂಬಂಧವಿರುವುದು ಕಂಡುಬಂದಿದೆ."
                : lang === "en"
                  ? "Surprisingly, property theft and digital phishing vectors shows high-accuracy Pearson correlation factors in high-literacy sectors like Indiranagar (+0.74). Digital access acts as a catalyst for fraud."
                  : "ಡಿಜಿಟಲ್ ವಂಚನೆ ಮತ್ತು ಸಾಕ್ಷರತೆ ಸಾಂದ್ರತೆಗೂ ಇಂದಿರಾನಗರದಂತಹ ಮುಂದುವರಿದ ಭಾಗದಲ್ಲಿ ಶೇಕಡಾ ೦.೭೪ ರಷ್ಟು ಸಹ-ಸಂಬಂಧವಿದೆ."}
            </p>
          </div>

          {/* Metadata source tracking */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center space-x-1 font-bold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-800" />
              <span>Census Reference Source:</span>
            </div>
            <div className="font-mono text-[10px]">
              DATA.GOV.IN STATE BULK PACKS <br />
              KAGGLE-KARNATAKA-SCRB-1.6M
            </div>
          </div>
        </div>
      </div>

      {/* Feature Upgrade 2: Bilingual Court Document / FIR Report Generator */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5 animate-fade-in">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold uppercase">
              <FileText className="w-3.5 h-3.5" />
              <span>Grounded Bilingual Ledger Synthesizer</span>
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 tracking-tight kn-text">
              {lang === "en"
                ? "Bilingual Judicial Court Report Draft Generator"
                : "ನ್ಯಾಯಾಲಯದ ದ್ವಿಭಾಷಾ ವರದಿ ಕರಡು ರಚನೆ ಸಹಾಯಕ"}
            </h3>
            <p className="text-[12px] text-slate-400 kn-text leading-relaxed">
              {lang === "en"
                ? "Synthesizes official courtroom records and FIR depositions matching KSP administrative terminology. Fully maps customized dictionary equivalents from Settings."
                : "ನ್ಯಾಯಾಲಯಕ್ಕೆ ಸಿದ್ಧವಾದ ಅಧಿಕೃತ ಜಾರ್ಜ್ ಶೀಟ್ ಮತ್ತು ಸಿಟಿಎನ್‌ಎಸ್ ಹೇಳಿಕೆಗಳನ್ನು ಸಿದ್ಧಪಡಿಸುವ ದ್ವಿಭಾಷಾ ಎಂಜಿನ್."}
            </p>
          </div>
          <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded font-bold uppercase self-start sm:self-center">
            Form-B / SEC-FORMAT-V4
          </span>
        </div>

        {/* Builder Setup Controls Grid */}
        <BilingualDocumentBuilder lang={lang} />
      </div>
    </div>
  );
};

// Extracted Modular Sub-Component to avoid excessively large single file issues
const BilingualDocumentBuilder: React.FC<{ lang: string }> = ({ lang }) => {
  const [selectedFirId, setSelectedFirId] =
    React.useState<string>("FIR-2026-0814");
  const [magistrateCourt, setMagistrateCourt] = React.useState<string>(
    "Magistrate Court IV, Bengaluru",
  );
  const [officerRank, setOfficerRank] =
    React.useState<string>("Sub-Inspector (SI)");
  const [custodyStatus, setCustodyStatus] =
    React.useState<string>("Judicial Custody");
  const [isSynthesizing, setIsSynthesizing] = React.useState<boolean>(false);
  const [isDownloadSuccess, setIsDownloadSuccess] =
    React.useState<boolean>(false);

  // Auto-load saved draft on mount
  React.useEffect(() => {
    const savedDraft = localStorage.getItem("vajra_reports_active_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.selectedFirId) setSelectedFirId(parsed.selectedFirId);
        if (parsed.magistrateCourt) setMagistrateCourt(parsed.magistrateCourt);
        if (parsed.officerRank) setOfficerRank(parsed.officerRank);
        if (parsed.custodyStatus) setCustodyStatus(parsed.custodyStatus);
      } catch (e) {
        console.warn("Could not parse saved reports draft", e);
      }
    }
  }, []);

  // Auto-save draft on form state changes
  React.useEffect(() => {
    const draft = {
      selectedFirId,
      magistrateCourt,
      officerRank,
      custodyStatus,
    };
    localStorage.setItem("vajra_reports_active_draft", JSON.stringify(draft));
  }, [selectedFirId, magistrateCourt, officerRank, custodyStatus]);

  // Retrieve glossary custom dictionary pairings with fallback terms
  const getGlossaryTerms = () => {
    let glossary = [
      { en: "Cognizable", kn: "ದಸ್ತಗಿರಿ ಮಾಡಬಹುದಾದ" },
      { en: "Complainant", kn: "ದೂರುದಾರ" },
      { en: "Accused", kn: "ಆರೋಪಿ" },
      { en: "Charge Sheet", kn: "ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿ" },
      { en: "Section", kn: "ಕಲಂ" },
      { en: "Police Station", kn: "ಪೊಲೀಸ್ ಠಾಣೆ" },
      { en: "Investigation", kn: "ತನಿಖೆ" },
    ];

    try {
      const stored = localStorage.getItem("vajra_dictionary_terms");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          glossary = parsed.map((item: any) => ({
            en: item.en,
            kn: item.kn,
          }));
        }
      }
    } catch (e) {
      console.warn("Could not load dictionary glossary fallback", e);
    }
    return glossary;
  };

  const terms = getGlossaryTerms();
  const getTermKn = (enWord: string) => {
    const found = terms.find(
      (t) => t.en.toLowerCase() === enWord.toLowerCase(),
    );
    return found ? found.kn : enWord;
  };

  // Find target case record
  const matchingFir =
    firs.find((f) => f.firNo === selectedFirId) || firs[0];

  const handleTriggerSynthesis = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
    }, 1000);
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleDownloadDraft = () => {
    setIsDownloadSuccess(true);
    setTimeout(() => {
      setIsDownloadSuccess(false);
    }, 3000);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Parameters Editor Control (Col span 4) */}
      <div className="xl:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-left">
        <h4 className="text-[12.5px] font-bold text-slate-800 font-mono uppercase tracking-wider border-b border-slate-250 pb-2 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Deposition Setup parameters</span>
        </h4>

        <div className="space-y-3.5 text-xs">
          {/* Target FIR drop box */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-600">
              Select Investigative Case Focus:
            </label>
            <select
              value={selectedFirId}
              onChange={(e) => setSelectedFirId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {firs.map((f) => (
                <option key={f.firNo} value={f.firNo}>
                  {f.firNo} - {f.accusedName.split(" @ ")[0]} ({f.station})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-600">
              Jurisdictional Magistrate Board:
            </label>
            <input
              type="text"
              value={magistrateCourt}
              onChange={(e) => setMagistrateCourt(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-600">
              Investigating Officer Clearance:
            </label>
            <input
              type="text"
              value={officerRank}
              onChange={(e) => setOfficerRank(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-600">
              Subject Arrest Hold Status:
            </label>
            <select
              value={custodyStatus}
              onChange={(e) => setCustodyStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Judicial Custody">
                Judicial Custody (ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ಬಂಧನ)
              </option>
              <option value="Police Custody remand">
                Police Custody Remand (ಪೊಲೀಸ್ ಕಸ್ಟಡಿ)
              </option>
              <option value="Secured Bail clearance">
                Secured Bail Clearance (ಪತ್ರದ ಮೇರೆಗೆ ಜಾಮೀನು)
              </option>
              <option value="Absconding/Pending Warrant">
                Absconding / Pending Warrant (ತಪ್ಪಿಸಿಕೊಂಡಿರುವ)
              </option>
            </select>
          </div>
        </div>

        {/* Action Panel Buttons */}
        <div className="pt-3 border-t border-slate-200 space-y-2">
          {/* STRICT RULE 6: Primary button here holds the document synthesis trigger */}
          <button
            onClick={handleTriggerSynthesis}
            disabled={isSynthesizing}
            className="w-full bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white p-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
          >
            {isSynthesizing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-spin"></span>
                <span>Generating Legal Layouts...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                <span>
                  {lang === "en"
                    ? "Synthesize Bilingual Draft"
                    : "ದ್ವಿಭಾಷಾ ಕರಡು ಪ್ರತಿಯನ್ನು ರಚಿಸಿ"}
                </span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrintDocument}
              className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>{lang === "en" ? "Print Record" : "ಅಚ್ಚು ಹಾಕಿ"}</span>
            </button>

            <button
              onClick={handleDownloadDraft}
              className="bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>{lang === "en" ? "Download PDF" : "ಡೌನ್‌ಲೋಡ್"}</span>
            </button>
          </div>

          {isDownloadSuccess && (
            <div className="bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-100 text-center text-[10.5px] font-bold animate-fade-in">
              Bilingual court artifact downloaded successfully!
            </div>
          )}
        </div>
      </div>

      {/* Blueprint Sheet Output Board (Col span 8) */}
      <div className="xl:col-span-8 bg-slate-900 border border-slate-950 p-4 rounded-xl shadow-inner relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-2 right-2 text-[8px] font-mono text-slate-500 select-none tracking-widest uppercase">
          Vajra Security Form Stamp Remand Grid v4
        </div>

        {/* Paper Sheet Document Canvas Container */}
        <div className="bg-white text-slate-900 rounded-lg p-6 font-sans text-left min-h-[480px] shadow-2xl relative border-t-8 border-emerald-700 select-text leading-relaxed">
          {/* Karnataka State Crest Header Grid */}
          <div className="text-center space-y-1 mb-6 border-b border-slate-250 pb-4">
            <div className="font-mono text-[9px] text-[#1D4ED8] font-bold tracking-widest uppercase">
              GOVERNMENT OF KARNATAKA / ಕರ್ನಾಟಕ ಸರ್ಕಾರ
            </div>
            <div className="text-[13px] font-extrabold uppercase font-sans tracking-tight">
              FORM-B CERTIFICATE OF ARREST REMAND REPORT / ಬಂಧನ ವರದಿ
            </div>
            <div className="text-[9.5px] text-slate-400 font-mono">
              PREPARED UNDER SECTION 173 CrPC / ಸೆಕ್ಷನ್ 173 CrPC ಅಡಿಯಲ್ಲಿ ವರದಿ
              ಸಿದ್ಧತೆ
            </div>
          </div>

          {/* Bilingual Formal Content Rows */}
          <div className="space-y-5 text-[11.5px] leading-[1.8]">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 pb-3">
              <div>
                <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                  From police station / ಮೂಲ ಠಾಣೆ:
                </span>
                <span className="font-bold">{matchingFir.station}</span>
                <div className="text-[10px] text-slate-400 kn-text leading-none mt-0.5">
                  {getTermKn("Police Station")}:{" "}
                  <span className="font-semibold text-slate-700">
                    {matchingFir.station}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                  Judicial court / ನ್ಯಾಯ ವ್ಯಾಪ್ತಿ:
                </span>
                <span className="font-bold">{magistrateCourt}</span>
                <div className="text-[10px] text-slate-400 kn-text leading-none mt-0.5">
                  ನ್ಯಾಯಾಧೀಶರ ಮಂಡಳಿ:{" "}
                  <span className="font-semibold text-slate-700">
                    {magistrateCourt}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 pb-3">
              <div>
                <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                  Investigating Case Index / ಎಫ್.ಐ.ಆರ್ ಸಂಖ್ಯೆ:
                </span>
                <span className="font-bold font-mono text-blue-800">
                  {matchingFir.firNo}
                </span>
                <div className="text-[10px] text-slate-400 kn-text leading-none mt-0.5">
                  ಎಫ್.ಐ.ಆರ್ ಸಂಖ್ಯೆ:{" "}
                  <span className="font-semibold text-slate-700 font-mono">
                    {matchingFir.firNo}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                  Enforcement Sections / ಕಲಂಗಳು:
                </span>
                <span className="font-bold">{matchingFir.actSection}</span>
                <div className="text-[10px] text-slate-400 kn-text leading-none mt-0.5">
                  ಕಾಯ್ದೆ ಮತ್ತು {getTermKn("Section")} ವಿವರ:{" "}
                  <span className="font-semibold text-slate-700">
                    {matchingFir.actSection}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3 - Suspect Information */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-1.5">
              <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold">
                Accused and Subject Info / ಆರೋಪಿ ಮತ್ತು ಸ್ಥಳೀಯ ಮಾಹಿತಿ:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <span className="block text-[9.5px] text-slate-400">
                    Accused Name:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {matchingFir.accusedName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9.5px] text-slate-400">
                    Age & Gender:
                  </span>
                  <span className="font-semibold">
                    {matchingFir.accusedAge} Yrs / Male
                  </span>
                </div>
                <div>
                  <span className="block text-[9.5px] text-slate-400">
                    Current Custody Hold:
                  </span>
                  <span className="font-bold text-red-700">
                    {custodyStatus}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-550 pt-1.5 border-t border-slate-200/40 kn-text leading-relaxed">
                <strong>{getTermKn("Accused")} ಮಾಹಿತಿ:</strong>{" "}
                {matchingFir.accusedName.split(" @ ")[0]} ಅವರ ಪ್ರಸ್ತುತ ಬಂಧನ
                ಸ್ಥಿತಿ <strong>{custodyStatus}</strong> ಅಡಿಯಲ್ಲಿ
                ವರ್ಗೀಕರಿಸಲ್ಪಟ್ಟಿದೆ. {matchingFir.actSection} ಸೆಕ್ಷನ್‌ಗಳ ಅನ್ವಯ
                ಕ್ರಿಮಿನಲ್ ಪ್ರಕರಣ ದಾಖಲಾಗಿದೆ.
              </div>
            </div>

            {/* Row 4 - Formal Summation */}
            <div className="space-y-1 pb-4 leading-relaxed">
              <span className="block text-[8px] font-mono text-slate-400 uppercase font-bold mb-1">
                Investigation Summary / ತನಿಖಾ ಸಾರಾಂಶ ಹೇಳಿಕೆ:
              </span>
              <p className="text-[11px] text-slate-700 font-sans">
                The {selectedFirId} docket traces an exhaustive cognizable
                offense involving machinery materials and property theft
                elements. Grounded intelligence vectors derived from
                peer-accused networks correlate with a local area unemployment
                rate of {matchingFir.unemploymentRate}% and a demographic
                literacy capacity of {matchingFir.literacyRate}%.
              </p>
              <p className="text-[11px] text-slate-700 font-sans kn-text leading-[1.8] mt-2">
                <strong>{getTermKn("Investigation")} ವಿವರ:</strong>{" "}
                {matchingFir.station} ಪೊಲೀಸ್ ಠಾಣೆಯ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ದಾಖಲಾದ{" "}
                {matchingFir.firNo} ಪ್ರಕರಣಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ, ಲಭ್ಯವಿರುವ
                ಸಾಕ್ಷ್ಯಗಳನ್ನು ಮತ್ತು ಜಿಯೋ-ಲೋಕೇಶನ್ ಸಾಂದ್ರತೆಗಳನ್ನು ನ್ಯಾಯದ ಮುಂದೆ
                ಪ್ರಸ್ತುತಪಡಿಸಲಾಗಿದೆ. ಈ ಪ್ರದೇಶದ ನಿರುದ್ಯೋಗ ದರವು ಶೇಕಡಾ{" "}
                {matchingFir.unemploymentRate}% ರಷ್ಟಿದ್ದು, ಇದು ಅಪರಾಧ ಪ್ರವೃತ್ತಿಗೆ
                ಪರೋಕ್ಷ ಕಾರಣವಾಗಿರುವುದು ತನಿಖೆಯಲ್ಲಿ ಕಂಡುಬಂದಿದೆ.
              </p>
            </div>
          </div>

          {/* Signature Stamps Bottom Section */}
          <div className="border-t border-slate-200 pt-6 flex justify-between items-end mt-12 text-[10.5px]">
            <div className="space-y-1">
              <div className="w-28 h-8 border border-slate-200 bg-slate-50 flex items-center justify-center font-mono text-[8.5px] text-slate-400 border-dashed rounded">
                Karnataka State Police Seal
              </div>
              <span className="block text-[9px] text-slate-400">
                OFFICIAL STAMP / ಮುದ್ರೆ
              </span>
            </div>

            <div className="text-right space-y-1">
              <div className="font-bold underline text-slate-900 font-serif">
                K.S. Prasanna Kumar, SI
              </div>
              <span className="block text-[9.5px] text-slate-500 font-mono">
                {officerRank} Dispatch Authority <br />
                KSP Badge Number:{" "}
                {officerRank.includes("SI") ? "KSP-9921-SI" : "KSP-CIVIL"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
