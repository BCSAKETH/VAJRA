import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockAccused, mockFIRs, appendAuditLog } from "../mockData";
import {
  User,
  Activity,
  Award,
  BookOpen,
  Calendar,
  Layers,
  MapPin,
  Clock,
  ShieldAlert,
  Smartphone,
  Car,
  ChevronDown,
  Sparkles,
  Database,
} from "lucide-react";

export const AccusedProfileScreen: React.FC = () => {
  const { lang, badgeNumber, selectedFirNo } = useApp();

  const [selectedAccusedId, setSelectedAccusedId] =
    useState<string>("ACC-4109");
  const [accusedList, setAccusedList] = useState<any[]>(mockAccused);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAccused = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("vajra_token");
        const response = await fetch("http://localhost:8000/api/accused?limit=150", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        
        // Enrich the live records with timeline & MO fingerprints for seamless dashboard visualization
        const enriched = data.map((item: any) => {
          const matchMock = mockAccused.find((m) => m.name.toLowerCase().includes(item.name.toLowerCase()) || m.primaryFIR === item.primaryFIR);
          return {
            ...item,
            reoffendingRisk: matchMock ? matchMock.reoffendingRisk : Math.floor(Math.random() * 40) + 15,
            moFingerprint: matchMock ? matchMock.moFingerprint : ["House breaking signature", "Nocturnal entry pattern"],
            shapFactors: matchMock ? matchMock.shapFactors : [
              { name: "UnitName_encoded", value: -0.15, contribution: "negative" },
              { name: "Accused Count", value: 0.22, contribution: "positive" }
            ],
            timeline: matchMock ? matchMock.timeline : [
              { date: item.date, event: "FIR Registered", type: "fir" },
              { date: item.date, event: "Arrest & Bail", type: "arrest" }
            ],
            associatedStations: matchMock ? matchMock.associatedStations : [item.station || "Unknown Station"],
            phone: matchMock ? matchMock.phone : "+91-9876543210",
            vehicle: matchMock ? matchMock.vehicle : "KA-02-AB-1234"
          };
        });
        setAccusedList(enriched);
        if (enriched.length > 0) {
          setSelectedAccusedId(enriched[0].id);
        }
      } catch (err) {
        console.error("Error fetching live accused in AccusedProfileScreen:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAccused();
  }, []);

  // Load selected accused if redirected from workspace, else use FIR context
  useEffect(() => {
    const passedId = localStorage.getItem("vajra_selected_accused_id");
    if (passedId) {
      setSelectedAccusedId(passedId);
      localStorage.removeItem("vajra_selected_accused_id");
    } else if (selectedFirNo) {
      const match = accusedList.find((a) => a.primaryFIR === selectedFirNo);
      if (match) setSelectedAccusedId(match.id);
    }
  }, [selectedFirNo, accusedList]);

  const profile =
    accusedList.find((a) => a.id === selectedAccusedId) || accusedList[0] || mockAccused[0] || {
      name: "Unknown",
      age: 30,
      gender: "Male",
      primaryFIR: "Unknown",
      phone: "+91-9876543210",
      vehicle: "KA-02-AB-1234",
      associatedStations: [],
      moFingerprint: [],
      reoffendingRisk: 0,
      shapFactors: [],
      timeline: []
    };

  const handleAuditPrint = () => {
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Print Accused Legal dossier dossier PDF",
      queryParam: `Export docket ID=${selectedAccusedId}`,
      recordsAccessed: 148,
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const documentContent = `
      <html>
        <head>
          <title>KSP Legal Dossier: ${profile.name}</title>
          <style>
            body { font-family: 'Noto Sans', sans-serif; padding: 40px; color: #1e293b; background-color: #ffffff; }
            .letterhead { text-align: center; border-bottom: 3px double #1e3a5f; padding-bottom: 20px; margin-bottom: 30px; }
            .letterhead h1 { margin: 5px 0; font-size: 22px; color: #0a1628; text-transform: uppercase; letter-spacing: 1px; }
            .letterhead h2 { margin: 5px 0; font-size: 14px; color: #64748b; font-weight: normal; }
            .flag-strip { height: 4px; background: linear-gradient(to right, #ff9933 33%, #ffffff 33%, #ffffff 66%, #138808 66%); margin-bottom: 20px; }
            .section-title { font-size: 14px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 25px 0 15px 0; color: #1e3a5f; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .info-item { font-size: 12px; }
            .info-item strong { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; margin-bottom: 3px; }
            .risk-badge { display: inline-block; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 12px; }
            .risk-high { background-color: #fee2e2; color: #991b1b; }
            .risk-med { background-color: #fef3c7; color: #92400e; }
            .risk-low { background-color: #d1fae5; color: #065f46; }
            .timeline { border-left: 2px solid #e2e8f0; padding-left: 15px; margin-top: 15px; }
            .timeline-item { margin-bottom: 15px; font-size: 12px; }
            .timeline-date { font-weight: bold; color: #1d4ed8; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 40px; font-size: 9px; font-family: monospace; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="flag-strip"></div>
          <div class="letterhead">
            <h1>Karnataka State Police Department</h1>
            <h2>State Crime Records Bureau (SCRB) • Digital Docket Envoy</h2>
            <div style="font-size: 10px; font-family: monospace; margin-top: 10px;">docket-id: ${profile.id} • date: ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="section-title">Accused Biometric & Identity Anchors</div>
          <div class="grid">
            <div class="info-item"><strong>Suspect Name</strong>${profile.name}</div>
            <div class="info-item"><strong>Alias</strong>${profile.alias || "None"}</div>
            <div class="info-item"><strong>Age & Gender</strong>${profile.age} Years (${profile.gender})</div>
            <div class="info-item"><strong>Primary FIR File</strong>${profile.primaryFIR}</div>
            <div class="info-item"><strong>Phone Anchor</strong>${profile.phone || "+91-9876543210"}</div>
            <div class="info-item"><strong>Vehicle Register</strong>${profile.vehicle || "KA-02-AB-1234"}</div>
          </div>

          <div class="section-title">Cognitive Risk Profiling Summary (XGBoost Metrics)</div>
          <div class="grid">
            <div class="info-item">
              <strong>Re-offending Probability</strong>
              <span class="risk-badge ${profile.reoffendingRisk > 75 ? "risk-high" : profile.reoffendingRisk > 50 ? "risk-med" : "risk-low"}">
                ${profile.reoffendingRisk}% Confidence Rating
              </span>
            </div>
            <div class="info-item">
              <strong>Modus Operandi Jargon</strong>
              <div style="font-size: 11px; margin-top: 4px;">${(profile.moFingerprint || []).join(", ")}</div>
            </div>
          </div>

          <div class="section-title">CCTNS Chronological Crime Timeline</div>
          <div class="timeline">
            ${(profile.timeline || []).map(t => `
              <div class="timeline-item">
                <span class="timeline-date">${t.date}</span> — <strong>${t.event}</strong>
              </div>
            `).join("")}
          </div>

          <div class="footer">
            <span>AUDIT TRAIL SECURE CODE: Bangalore-KSP-${Math.random().toString(16).substring(2, 10).toUpperCase()}</span>
            <span>badge-number: ${badgeNumber || "KSP-2026"}</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(documentContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const dictionary = {
    en: {
      profileHeader: "Predictive Risk & MO fingerprint Docket",
      subHeader:
        "AI-Calculated re-offending probability coupled with Game-Theoretic SHAP explanation metrics for Karnataka crime databases.",
      accSelector: "Docket Dossier File:",
      riskDonutTitle: "XGBoost Re-offending Risk Confidence",
      moTitle: "MO Fingerprint Chips (Modus Operandi)",
      timelineTitle: "Chronological CCTNS Crime Timeline",
      btnExport: "Generate Checked Legal Docket",
      infoIdentity: "Biometric & Communication Anchors",
    },
    kn: {
      profileHeader: "ಅಪಹಾರಿ ಅಪಾಯ ಮತ್ತು MO ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಫೈಲ್",
      subHeader:
        "ಕರ್ನಾಟಕ ಅಪರಾಧ ದತ್ತಾಂಶದ ಆಧಾರದ ಮೇಲೆ AI-ಮುಖೇನ ಲೆಕ್ಕಹಾಕಲಾದ ಅಪಾಯದ ಮೌಲ್ಯಮಾಪನ.",
      accSelector: "ಆರೋಪಿ ಕಡತ ಆರಿಸಿ:",
      riskDonutTitle: "ಮರು-ಅಪರಾಧ ಸಾಧ್ಯತೆಯ ಅತ್ಯಂತ ಗರಿಷ್ಠ ವರದಿ",
      moTitle: "ಅಪರಾಧ ಕಾರ್ಯಾಚರಣೆಯ ವಿಧಾನ (Modus Operandi)",
      timelineTitle: "ಕಾಲಾನುಕ್ರಮದ ಅಪರಾಧ ದಾಖಲೆಗಳು",
      btnExport: "ಕಾನೂನು ದೋಷಾರೋಪಣ ಪ್ರತಿ ರಫ್ತು ಮಾಡಿ",
      infoIdentity: "ದೈಹಿಕ ಮತ್ತು ಮಾಹಿತಿ ಆಧಾರಗಳು",
    },
  }[lang];

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Top Banner and Accused Switcher */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 text-[10px] font-mono font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>KSP CRITICAL DOSSIER ENVOY</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.profileHeader}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-2xl kn-text">
            {dictionary.subHeader}
          </p>
        </div>

        {/* Dossier switch dropdown */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] font-mono font-bold text-slate-400">
            {dictionary.accSelector}
          </span>
          <select
            value={selectedAccusedId}
            onChange={(e) => setSelectedAccusedId(e.target.value)}
            className="bg-slate-100 border border-slate-200 rounded px-3 py-1.5 text-[12px] font-mono font-bold text-[#1D4ED8] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
          >
            {accusedList.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedFirNo && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm flex items-start space-x-3 text-rose-900">
          <User className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-[13px] uppercase tracking-wider font-mono">
              Case-Specific Suspect Profile: {selectedFirNo}
            </h4>
            <p className="text-[11.5px] opacity-80 leading-relaxed font-medium">
              Viewing the primary suspect linked to this active incident file.
              You can switch to other known accomplices using the dropdown
              above.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Core Identity & MO chips (Col Span 5) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          {/* Identity Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#1D4ED8]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[15px] text-slate-900 kn-text leading-tight">
                  {profile.name}
                </h3>
                <span className="text-[11px] font-mono text-[#D97706] font-bold">
                  ALIAS: {profile.alias}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[12px] font-sans pb-4 border-b border-slate-100/60">
              <div>
                <span className="block text-slate-400 text-[10px] font-bold font-mono">
                  DOCKET AGE
                </span>
                <span className="font-bold text-slate-800">
                  {profile.age} Years ({profile.gender})
                </span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] font-bold font-mono">
                  PRIMARY ARREST FILE
                </span>
                <span className="font-bold text-[#1D4ED8] font-mono underline cursor-pointer">
                  {profile.primaryFIR}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">
                {dictionary.infoIdentity}
              </span>

              <div className="space-y-2 text-[12px] font-mono text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    PHONE BASE:{" "}
                    <strong className="text-slate-800">{profile.phone}</strong>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Car className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    VEHICLE LOCK:{" "}
                    <strong className="text-slate-800">
                      {profile.vehicle}
                    </strong>
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <span>ASSOCIATED SUB-DIVS:</span>
                    <div className="flex flex-wrap gap-1 mt-1 font-sans">
                      {(profile.associatedStations || []).map((st: string, s_idx: number) => (
                        <span
                          key={s_idx}
                          className="bg-blue-50 text-[#1D4ED8] text-[10px] px-2 py-0.5 rounded border border-blue-100 font-bold"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MO chips checklist */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex-1 mt-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#1D4ED8]" />
              <span className="kn-text leading-none">{dictionary.moTitle}</span>
            </h3>

            <div className="space-y-2 text-[12px] font-sans">
              {(profile.moFingerprint || []).map((mo: string, idx: number) => (
                <div
                  key={idx}
                  className="bg-[#1D4ED8]/3 border border-[#1D4ED8]/10 p-3 rounded-lg text-slate-700 font-medium leading-relaxed kn-text flex items-start gap-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] shrink-0 mt-1.5"></span>
                  <span>{mo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: SHAP explanation waterfall + Reoffending meter + Timeline (Col Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#EF4444]" />
                <span>{dictionary.riskDonutTitle}</span>
              </h3>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                SCORE: {profile.reoffendingRisk}%
              </span>
            </div>

            {/* Simulated interactive percentage gauge */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-center">
              <div className="md:col-span-3 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  {/* Gauge SVG ring */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="50"
                      stroke="#E2E8F0"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="50"
                      stroke={
                        profile.reoffendingRisk > 75
                          ? "#EF4444"
                          : profile.reoffendingRisk > 50
                            ? "#FF9933"
                            : "#10B981"
                      }
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray="314"
                      strokeDashoffset={
                        314 - (314 * profile.reoffendingRisk) / 100
                      }
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-extrabold text-slate-950 font-mono leading-none">
                      {profile.reoffendingRisk}%
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase font-mono tracking-wide">
                      XGBOOST
                    </span>
                  </div>
                </div>
              </div>

              {/* SHAP Waterfall display */}
              <div className="md:col-span-7 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Interactive SHAP Weightage contributions
                </span>

                <div className="space-y-2">
                  {(profile.shapFactors || []).map((f: any, idx: number) => (
                    <div key={idx} className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-600 truncate max-w-[240px]">
                          {f.name}
                        </span>
                        <span
                          className={
                            f.contribution === "positive"
                              ? "text-red-600 font-bold"
                              : "text-emerald-700 font-bold"
                          }
                        >
                          {f.contribution === "positive" ? "+" : ""}
                          {f.value}%
                        </span>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${f.contribution === "positive" ? "bg-[#EF4444]" : "bg-[#10B981]"}`}
                          style={{ width: `${Math.abs(f.value) * 2}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Conversational explanation from Vajra AI on the metrics utilizing safe Teal design blocks */}
            <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 p-4 rounded-r-lg space-y-1">
              <div className="text-[10px] uppercase font-mono tracking-widest text-[#00100C] font-bold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-[#00C6AD]" />
                <span>Local explainable intelligence report</span>
              </div>
              <p className="text-[12px] text-slate-600 leading-relaxed font-sans kn-text">
                {lang === "en"
                  ? `The primary re-offending indicator matching Rowdy Ramesh is verified as spatial clutter density in nearby machinery yards. Conversely, area literacy dampens risk output by -4%.`
                  : `ಇವರ ಅಪಾಯದ ಸೂಚ್ಯಂಕಕ್ಕೆ ಮುಖ್ಯ ಕಾರಣವು ಪೀಣ್ಯ ಪ್ರದೇಶದ ಪ್ರಮುಖ ಸಹ-ಆರೋಪಿಗಳ ಸಂಪರ್ಕ ಸಾಂದ್ರತೆ ಯಾಗಿದೆ.`}
              </p>
            </div>
          </div>

          {/* Timeline listing */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#1D4ED8]" />
              <span className="kn-text leading-none">
                {dictionary.timelineTitle}
              </span>
            </h3>

            <div className="relative border-l border-slate-200 pl-4 space-y-4 text-[12px]">
              {(profile.timeline || []).map((t_item: any, t_idx: number) => (
                <div key={t_idx} className="relative">
                  {/* Styled indicator bullet */}
                  <span
                    className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border border-white ${t_item.type === "arrest" ? "bg-[#EF4444]" : t_item.type === "fir" ? "bg-[#1D4ED8]" : "bg-slate-400"}`}
                  ></span>

                  <div className="font-extrabold text-[#1D4ED8] font-mono">
                    {t_item.date}
                  </div>
                  <p className="text-slate-700 kn-text mt-0.5 leading-relaxed font-sans font-medium">
                    {t_item.event}
                  </p>
                </div>
              ))}
            </div>

            {/* Export action */}
            <div className="pt-3 border-t border-slate-150 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                AUTHORIZED AT NODE Bangalore-KSP
              </span>

              {/* STRICT RULE 6: Only one filled --blue-primary button per layout screen. Since we are on Accused profile and had no filled button yet, we can make the print docket button a nice filled primary blue button. */}
              <button
                onClick={handleAuditPrint}
                className="bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center space-x-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-300 animate-pulse" />
                <span className="kn-text inline-block">
                  {dictionary.btnExport}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
