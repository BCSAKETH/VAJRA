import React from "react";
import { VajraLogo } from "./VajraLogo";

export interface ExportChatMessage {
  role: "user" | "assistant" | "system";
  sender?: string;
  text?: string;
  textEn?: string;
  textKn?: string;
  content?: string;
  timestamp?: string;
  data?: any;
  citations?: any[];
  snapshot?: string;
}

export interface ExportDossierContainerProps {
  chatMessages: ExportChatMessage[];
  activeSessionTitle: string;
  badgeNumber?: string;
  officerName?: string;
  roleTier?: string;
  lang?: "en" | "kn";
  auditHash?: string;
  caseNo?: string;
  id?: string;
}

export const ExportDossierContainer: React.FC<ExportDossierContainerProps> = ({
  chatMessages,
  activeSessionTitle,
  badgeNumber = "2346836",
  officerName = "SAKETH B C",
  roleTier = "supervisor",
  lang = "en",
  auditHash = "7f83b1657ff19c3b88a912d09ef134a9b54c0e628174826b1fa85c2b04859a21",
  caseNo = "CR-2026-78156",
  id = "export-dossier-root",
}) => {
  const isKn = lang === "kn";
  const nowUtc = new Date().toISOString().substring(0, 19).replace("T", " ") + " UTC";
  const rankPrefix = roleTier === "supervisor" ? "SUPERVISORY " : "";
  const officerAttribution = `${rankPrefix}${officerName.toUpperCase()} (KSP-${badgeNumber})`;
  const watermarkText = `${officerAttribution} • OFFICIAL SECURITY COPY • SECURE CCTNS DIALOUT • ${nowUtc}`;

  return (
    <div
      id={id}
      className="w-full max-w-[1040px] mx-auto bg-white border border-[#e7e5e4] rounded-2xl relative overflow-hidden shadow-2xl text-[#1c1917] font-sans print:border-none print:shadow-none print:rounded-none print:max-w-none print:w-full"
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* 1. MINIMAL HEADER: Strictly VajraLogo + Chat Name */}
      <header className="relative z-10 flex items-center gap-3.5 px-6 py-4 bg-white border-b-2 border-[#C79A4E] shadow-sm">
        <VajraLogo size={26} />
        <h1 className="text-base font-extrabold tracking-tight text-[#1c1917] font-sans m-0">
          {activeSessionTitle || (isKn ? "ವಜ್ರ ತನಿಖಾ ಅವಧಿ" : "VAJRA Investigation Session")}
        </h1>
      </header>

      {/* 2. FORENSIC WATERMARK OVERLAY AT Z-40 (In-App Parity, Delicate Gold at 0.048 opacity) */}
      <div
        className="absolute inset-0 pointer-events-none z-40 overflow-hidden select-none flex flex-col justify-around"
        style={{ opacity: 0.048 }}
        aria-hidden="true"
      >
        {Array.from({ length: 14 }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="whitespace-nowrap flex justify-around text-[11px] font-mono font-black tracking-widest text-[#8c6b2d]"
            style={{
              transform: rIdx % 2 === 0 ? "rotate(-18deg) translateX(-8%)" : "rotate(-18deg) translateX(8%)",
            }}
          >
            {Array.from({ length: 4 }).map((_, cIdx) => (
              <span key={cIdx} className="mx-8 uppercase">
                {watermarkText}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* 3. TRANSCRIPT MESSAGES CONTAINER */}
      <main className="relative z-10 px-7 py-6 space-y-6">
        {chatMessages && chatMessages.length > 0 ? (
          chatMessages.map((msg, idx) => {
            const isUser = msg.role === "user" || msg.sender === "user";
            const textContent = isKn ? (msg.textKn || msg.text || msg.content) : (msg.textEn || msg.text || msg.content);
            const msgTime = msg.timestamp || "10:14 AM";

            if (isUser) {
              return (
                <div key={idx} className="flex justify-end avoid-page-break">
                  <div className="max-w-[760px] flex flex-col items-end">
                    <div className="text-[10.5px] font-mono font-bold text-[#78716c] uppercase tracking-wider mb-1">
                      {`OFFICER ${officerName} (KGID: ${badgeNumber}) • ${msgTime}`}
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[14px_14px_4px_14px] px-5 py-3 text-[#292524] text-[13.5px] leading-relaxed shadow-sm">
                      {textContent}
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant / AI Turn
            return (
              <div key={idx} className="flex justify-start avoid-page-break">
                <div className="w-full flex flex-col items-start">
                  <div className="text-[10.5px] font-mono font-bold text-[#b45309] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>{isKn ? `ವಜ್ರ.AI (CCTNS ತನಿಖಾ ದಾಖಲೆ) • ${msgTime}` : `VAJRA.AI (CCTNS INQUEST & ED SPECIAL BRIEF) • ${msgTime}`}</span>
                  </div>

                  <div className="w-full bg-white border border-[#e7e5e4] border-l-[3px] border-l-[#C79A4E] rounded-[14px_14px_14px_4px] p-5 text-[#292524] text-[13.5px] leading-relaxed shadow-sm">
                    {/* Primary Text Content */}
                    <div className="mb-4">
                      {textContent}
                    </div>

                    {/* Grounding & Statutory Compliance Badges */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e] uppercase">
                        {`CCTNS: FIR ${caseNo || "42/2024"}`}
                      </span>
                      <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e] uppercase">
                        ED-ECIR-02/2024
                      </span>
                      <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e] uppercase">
                        PMLA §3 &amp; §4
                      </span>
                      <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e] uppercase">
                        SEC 63 BSA COMPLIANT
                      </span>
                    </div>

                    {/* Key Findings Bulletins */}
                    <div className="space-y-1.5 text-[13px] text-[#44403c] mb-5">
                      <div><strong className="text-[#1c1917]">{isKn ? "ಮುಖ್ಯ ಆರೋಪಿ:" : "Prime Accused:"}</strong> B. Nagendra (Former Cabinet Minister) and J.J. Padmanabh (Managing Director, KMVSTDC).</div>
                      <div><strong className="text-[#1c1917]">{isKn ? "ದುರ್ಬಳಕೆಯ ಮೊತ್ತ:" : "Embezzled Corp:"}</strong> ₹187.33 Crores systematically siphoned from Union Bank of India (MG Road Branch).</div>
                      <div><strong className="text-[#1c1917]">{isKn ? "ಹಂತಗಳ ತಂತ್ರಗಾರಿಕೆ:" : "Layering Strategy:"}</strong> Routed into First Finance Credit Cooperative Society across 18 dormant current accounts.</div>
                    </div>

                    {/* FULL EXPANDED VISUALIZATION 1: Relational Syndicate Network Graph */}
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 mt-4 shadow-sm avoid-page-break">
                      <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-2.5 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[#9A6F27] font-bold">◈</span>
                          <span className="text-[11.5px] font-mono font-extrabold tracking-wider text-[#1e293b] uppercase">
                            {isKn ? "ಸಂಬಂಧಿತ ಗುಪ್ತಚರ ಸಿಂಡಿಕೇಟ್ ನೆಟ್‌ವರ್ಕ್ (ಪೂರ್ಣ ವಿಸ್ತೃತ ನೋಟ)" : "RELATIONAL INTELLIGENCE SYNDICATE NETWORK (FULL EXPANDED VIEW)"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fee2e2] border border-[#fecaca] text-[#b91c1c]">
                          CENTRALITY: 0.94 (CRITICAL)
                        </span>
                      </div>

                      <div className="w-full h-[380px] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg relative overflow-hidden flex items-center justify-center">
                        <svg width="100%" height="100%" viewBox="0 0 760 380" fill="none" className="overflow-visible">
                          {/* Radial Orbit Rings */}
                          <circle cx="380" cy="190" r="60" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                          <circle cx="380" cy="190" r="120" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
                          <circle cx="380" cy="190" r="170" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,5" opacity="0.4" />

                          {/* Network Links */}
                          <line x1="380" y1="190" x2="340" y2="120" stroke="#94a3b8" strokeWidth="2.2" />
                          <line x1="380" y1="190" x2="430" y2="120" stroke="#94a3b8" strokeWidth="2.2" />
                          <line x1="380" y1="190" x2="380" y2="270" stroke="#94a3b8" strokeWidth="2" />
                          <line x1="380" y1="190" x2="280" y2="190" stroke="#94a3b8" strokeWidth="2.5" />
                          <line x1="380" y1="190" x2="470" y2="200" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4,2" />

                          {/* Secondary Hop Links */}
                          <line x1="340" y1="120" x2="280" y2="90" stroke="#cbd5e1" strokeWidth="1.5" />
                          <line x1="430" y1="120" x2="500" y2="100" stroke="#cbd5e1" strokeWidth="1.5" />
                          <line x1="380" y1="270" x2="380" y2="330" stroke="#cbd5e1" strokeWidth="1.5" />

                          {/* Link Flow Arrow Badges */}
                          <rect x="300" y="178" width="60" height="15" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
                          <text x="330" y="189" fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0284c7" textAnchor="middle">₹187.33 CR</text>

                          <rect x="420" y="188" width="48" height="15" rx="3" fill="#f8fafc" stroke="#fca5a5" strokeWidth="0.8" />
                          <text x="444" y="199" fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#dc2626" textAnchor="middle">HAWALA</text>

                          {/* NODES */}
                          {/* Prime Accused Node (Center) */}
                          <circle cx="380" cy="190" r="28" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />
                          <circle cx="380" cy="190" r="23" fill="#fef2f2" />
                          <text x="380" y="194" fontSize="10.5" fontWeight="900" fontFamily="sans-serif" fill="#991b1b" textAnchor="middle">PRIME</text>
                          <text x="380" y="228" fontSize="10" fontWeight="bold" fill="#1c1917" textAnchor="middle">B. NAGENDRA</text>
                          <text x="380" y="239" fontSize="8" fontWeight="600" fill="#991b1b" textAnchor="middle">KINGPIN (MINISTER)</text>

                          {/* Co-Accused Padmanabh */}
                          <circle cx="340" cy="120" r="19" fill="#ffffff" stroke="#b45309" strokeWidth="2.5" />
                          <circle cx="340" cy="120" r="15" fill="#fefce8" />
                          <text x="340" y="123.5" fontSize="8.5" fontWeight="900" fontFamily="sans-serif" fill="#854d0e" textAnchor="middle">MD</text>
                          <text x="340" y="148" fontSize="9" fontWeight="bold" fill="#1c1917" textAnchor="middle">J.J. PADMANABH</text>

                          {/* Co-Accused Nekkanti */}
                          <circle cx="430" cy="120" r="19" fill="#ffffff" stroke="#b45309" strokeWidth="2.5" />
                          <circle cx="430" cy="120" r="15" fill="#fefce8" />
                          <text x="430" y="123.5" fontSize="8.5" fontWeight="900" fontFamily="sans-serif" fill="#854d0e" textAnchor="middle">OPS</text>
                          <text x="430" y="148" fontSize="9" fontWeight="bold" fill="#1c1917" textAnchor="middle">NEKKANTI NAGARAJ</text>

                          {/* Shell Entity First Finance */}
                          <circle cx="280" cy="190" r="17" fill="#ffffff" stroke="#0284c7" strokeWidth="2.5" />
                          <circle cx="280" cy="190" r="13" fill="#f0f9ff" />
                          <text x="280" y="193" fontSize="8" fontWeight="900" fontFamily="sans-serif" fill="#0369a1" textAnchor="middle">BANK</text>
                          <text x="280" y="215" fontSize="8.5" fontWeight="bold" fill="#1c1917" textAnchor="middle">FIRST FINANCE CO-OP</text>

                          {/* Hawala Cash Node */}
                          <circle cx="470" cy="200" r="17" fill="#ffffff" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="3,2" />
                          <circle cx="470" cy="200" r="13" fill="#fff1f2" />
                          <text x="470" y="203" fontSize="7.5" fontWeight="900" fontFamily="sans-serif" fill="#be123c" textAnchor="middle">EXIT</text>
                          <text x="525" y="203" fontSize="8.5" fontWeight="bold" fill="#be123c" textAnchor="middle">HAWALA NODE BLR-4</text>

                          {/* Co-Accused Gowda */}
                          <circle cx="380" cy="270" r="16" fill="#ffffff" stroke="#b45309" strokeWidth="2" />
                          <circle cx="380" cy="270" r="12" fill="#fefce8" />
                          <text x="380" y="273" fontSize="8" fontWeight="900" fontFamily="sans-serif" fill="#854d0e" textAnchor="middle">ACC</text>
                          <text x="380" y="296" fontSize="8.5" fontWeight="bold" fill="#1c1917" textAnchor="middle">P. GOWDA (ACCOUNTS)</text>

                          {/* Peripheral Hops */}
                          <circle cx="280" cy="90" r="13" fill="#ffffff" stroke="#0284c7" strokeWidth="1.8" />
                          <text x="280" y="93" fontSize="7" fontWeight="bold" fill="#0369a1" textAnchor="middle">CDR</text>
                          <text x="250" y="80" fontSize="8" fontWeight="bold" fill="#475569" textAnchor="middle">+91-98450XXXXX</text>

                          <circle cx="500" cy="100" r="13" fill="#ffffff" stroke="#0284c7" strokeWidth="1.8" />
                          <text x="500" y="103" fontSize="6.8" fontWeight="bold" fill="#0369a1" textAnchor="middle">CORP</text>
                          <text x="550" y="103" fontSize="8" fontWeight="bold" fill="#475569" textAnchor="middle">V-LOGIC INFRATECH</text>

                          <circle cx="380" cy="330" r="13" fill="#ffffff" stroke="#7c3aed" strokeWidth="1.8" />
                          <text x="380" y="333" fontSize="6.8" fontWeight="bold" fill="#6d28d9" textAnchor="middle">BTC</text>
                          <text x="380" y="352" fontSize="7.5" fontWeight="mono" fill="#6d28d9" textAnchor="middle">1A1zP1eP5Q... (WALLET)</text>
                        </svg>
                      </div>

                      {/* Legend */}
                      <div className="flex gap-4 justify-center mt-3 pt-2 border-t border-[#f1f5f9] text-[10.5px] font-mono text-[#64748b]">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block" /> {isKn ? "ಮುಖ್ಯ ಆರೋಪಿ" : "Prime Accused"}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block" /> {isKn ? "ಸಹ ಸಂಚುಕೋರರು" : "Key Conspirators"}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] inline-block" /> {isKn ? "ಶೆಲ್ ಸಂಸ್ಥೆಗಳು ಮತ್ತು ಖಾತೆಗಳು" : "Shell Entities &amp; Accounts"}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] inline-block" /> {isKn ? "ಹವಾಲಾ / ನಗದು ನಿರ್ಗಮನ" : "Hawala / Cash Exits"}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] inline-block" /> {isKn ? "ಕ್ರಿಪ್ಟೋ ಆಸ್ತಿಗಳು" : "Crypto Assets"}</span>
                      </div>
                    </div>

                    {/* FULL EXPANDED VISUALIZATION 2: SHAP Evidentiary Factors */}
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 mt-4 shadow-sm avoid-page-break">
                      <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-2.5 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[#9A6F27] font-bold">◈</span>
                          <span className="text-[11.5px] font-mono font-extrabold tracking-wider text-[#1e293b] uppercase">
                            {isKn ? "ಪುನರಾವರ್ತನೆ ಮತ್ತು ಪಲಾಯನ ಅಪಾಯವನ್ನು ಪ್ರೇರೇಪಿಸುವ ಸಾಕ್ಷ್ಯಾಧಾರಗಳು (SHAP ವಿವರಣೆ)" : "EVIDENTIARY FACTORS DRIVING RECIDIVISM & FLIGHT RISK (SHAP EXPLAINER)"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#b45309]">
                          RISK INDEX: 82/100
                        </span>
                      </div>

                      <div className="space-y-3 py-1">
                        <div>
                          <div className="flex justify-between text-[11px] font-mono font-bold text-[#334155] mb-1">
                            <span>{isKn ? "ಸಿಂಡಿಕೇಟ್ ಗಾತ್ರ (ಸಂಚುಕೋರರು > 12)" : "Syndicate Size (Conspirators > 12)"}</span>
                            <span className="text-[#dc2626] font-extrabold">+38.4%</span>
                          </div>
                          <div className="w-full bg-[#f1f5f9] h-3.5 rounded overflow-hidden">
                            <div className="bg-[#dc2626] h-full rounded" style={{ width: "76%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-mono font-bold text-[#334155] mb-1">
                            <span>{isKn ? "ಅಪರಾಧದ ವರ್ಗೀಕರಣ (BNS 409 / PMLA 3)" : "Offense Class (BNS 409 / PMLA 3)"}</span>
                            <span className="text-[#d97706] font-extrabold">+28.2%</span>
                          </div>
                          <div className="w-full bg-[#f1f5f9] h-3.5 rounded overflow-hidden">
                            <div className="bg-[#d97706] h-full rounded" style={{ width: "58%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-mono font-bold text-[#334155] mb-1">
                            <span>{isKn ? "ಗಡಿಯಾಚೆಗಿನ ಹವಾಲಾ ಮಾರ್ಗಗಳು" : "Cross-Border Hawala Channels"}</span>
                            <span className="text-[#d97706] font-extrabold">+19.1%</span>
                          </div>
                          <div className="w-full bg-[#f1f5f9] h-3.5 rounded overflow-hidden">
                            <div className="bg-[#d97706] h-full rounded" style={{ width: "42%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-mono font-bold text-[#334155] mb-1">
                            <span>{isKn ? "ದೃಢಪಡಿಸಿದ ನಿವಾಸದ ನಿರ್ದೇಶಾಂಕಗಳು" : "Known Residential Coordinates"}</span>
                            <span className="text-[#0d9488] font-extrabold">-12.8%</span>
                          </div>
                          <div className="w-full bg-[#f1f5f9] h-3.5 rounded overflow-hidden">
                            <div className="bg-[#0d9488] h-full rounded ml-auto" style={{ width: "26%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-mono font-bold text-[#334155] mb-1">
                            <span>{isKn ? "ಆಡಿಟ್ ಸಹಕಾರದ ಮೈಲಿಗಲ್ಲು" : "Audit Cooperation Milestone"}</span>
                            <span className="text-[#059669] font-extrabold">-22.0%</span>
                          </div>
                          <div className="w-full bg-[#f1f5f9] h-3.5 rounded overflow-hidden">
                            <div className="bg-[#059669] h-full rounded ml-auto" style={{ width: "45%" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FULL EXPANDED VISUALIZATION 3: 3-Tier Layering Ledger Table */}
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 mt-4 shadow-sm avoid-page-break">
                      <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-2.5 mb-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[#9A6F27] font-bold">◈</span>
                          <span className="text-[11.5px] font-mono font-extrabold tracking-wider text-[#1e293b] uppercase">
                            {isKn ? "೩-ಹಂತಗಳ ಹಣ ರವಾನೆ ಲೆಡ್ಜರ್ ಮತ್ತು ವಹಿವಾಟು ಪಟ್ಟಿ" : "3-TIER LAYERING LEDGER & TRANSACTION MANIFEST"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e]">
                          TOTAL DISBURSED: ₹187.33 CR
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11.5px] font-sans border-collapse">
                          <thead>
                            <tr className="border-b border-[#cbd5e1] text-[10px] font-mono font-bold text-[#475569] uppercase">
                              <th className="py-2.5 px-3">{isKn ? "ಹಂತ" : "Tier Structure"}</th>
                              <th className="py-2.5 px-3">{isKn ? "ಮೂಲ ಖಾತೆ" : "Originating Account"}</th>
                              <th className="py-2.5 px-3">{isKn ? "ಸ್ವೀಕರಿಸುವ ನೋಡ್" : "Receiving Node"}</th>
                              <th className="py-2.5 px-3">{isKn ? "ಚಾನಲ್ / IFSC" : "Channel / IFSC"}</th>
                              <th className="py-2.5 px-3 text-right">{isKn ? "ಮೊತ್ತ (INR)" : "Amount (INR)"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9] text-[#1c1917]">
                            <tr className="hover:bg-[#f8fafc]">
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#e0f2fe] text-[#0369a1]">TIER 1 (INFLOW)</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium">KMVSTDC Treasury #41029</td>
                              <td className="py-2.5 px-3 font-medium">Union Bank MG Road</td>
                              <td className="py-2.5 px-3 font-mono text-[10.5px] text-[#64748b]">RTGS / UBIN0538914</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0369a1]">₹187,33,00,000</td>
                            </tr>
                            <tr className="hover:bg-[#f8fafc]">
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#fef3c7] text-[#92400e]">TIER 2 (LAYERING)</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium">Union Bank Disbursal</td>
                              <td className="py-2.5 px-3 font-medium">First Finance Co-op (18 Accs)</td>
                              <td className="py-2.5 px-3 font-mono text-[10.5px] text-[#64748b]">NEFT / FFCB0001004</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#92400e]">₹94,50,00,000</td>
                            </tr>
                            <tr className="hover:bg-[#f8fafc]">
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#fef3c7] text-[#92400e]">TIER 2 (LAYERING)</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium">First Finance Co-op</td>
                              <td className="py-2.5 px-3 font-medium">V-Logic Infratech Pvt Ltd</td>
                              <td className="py-2.5 px-3 font-mono text-[10.5px] text-[#64748b]">Internal Transfer</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#92400e]">₹42,50,00,000</td>
                            </tr>
                            <tr className="hover:bg-[#f8fafc]">
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#fee2e2] text-[#991b1b]">TIER 3 (EXIT)</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium">V-Logic Infratech</td>
                              <td className="py-2.5 px-3 font-medium">BLR Hawala Node #4 (Cash)</td>
                              <td className="py-2.5 px-3 font-mono text-[10.5px] text-[#64748b]">Physical Angadia Handout</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#991b1b]">₹20,00,00,000</td>
                            </tr>
                            <tr className="hover:bg-[#f8fafc]">
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#fee2e2] text-[#991b1b]">TIER 3 (EXIT)</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium">V-Logic Infratech</td>
                              <td className="py-2.5 px-3 font-medium">BTC Cold Wallet Address</td>
                              <td className="py-2.5 px-3 font-mono text-[10.5px] text-[#64748b]">P2P OTC Escrow</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#991b1b]">₹15,00,00,000</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-[#fffbeb] border border-[#fef3c7] border-l-4 border-l-[#d97706] p-3 rounded-md mt-3.5 text-xs text-[#78350f] leading-relaxed">
                        <strong>{isKn ? "ಕಾನೂನುಬದ್ಧ ತಕ್ಷಣದ ವಶಪಡಿಸುವಿಕೆ:" : "Statutory Immediate Requisition:"}</strong> {isKn ? "ಭಾರತೀಯ ನಾಗರಿಕ ಸುರಕ್ಷಾ ಸಂಹಿತೆ (BNSS 2023) ಕಲಂ ೧೦೭ ಮತ್ತು ಭಾರತೀಯ ಸಾಕ್ಷ್ಯ ಅಧಿನಿಯಮ (BSA 2023) ಕಲಂ ೬೩ ರ ಅಡಿಯಲ್ಲಿ, ಮೊದಲ ಹಣಕಾಸು ಸಹಕಾರಿ ಬ್ಯಾಂಕ್‌ನಲ್ಲಿ ಉಳಿದಿರುವ ₹೧೫.೩೩ ಕೋಟಿ ದ್ರವ್ಯ ನಿಧಿಯನ್ನು ತಕ್ಷಣವೇ ಸ್ಥಗಿತಗೊಳಿಸಲು ತುರ್ತು ಡೆಬಿಟ್ ಫ್ರೀಜ್ ಆದೇಶವನ್ನು ಜಾರಿಗೊಳಿಸಲಾಗಿದೆ." : "Under Section 107 BNSS 2023 and Section 63 BSA 2023, an emergency debit freeze order has been queued for First Finance Cooperative Bank to secure the remaining ₹15.33 Crores liquid balance."}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        ) : null}

        {/* 4. OFFICIAL VAJRA VERIFICATION CONTAINER WITH RESTORED CIRCULAR SEAL */}
        <div className="mt-6 flex justify-between items-center gap-6 bg-white border border-[#e2e8f0] border-t-[3px] border-t-[#C79A4E] rounded-xl p-6 shadow-sm avoid-page-break">
          {/* Left Narrative Box */}
          <div className="flex-1">
            <div className="text-[11.5px] font-mono font-black text-[#1c1917] mb-1.5 uppercase tracking-wider flex items-center gap-2">
              <span>🛡️</span>
              <span>{isKn ? "ಕಲಂ ೬೩ ಬಿಎಸ್ಎ ದೃಢೀಕರಣ ಮತ್ತು ತಿದ್ದುವಿಕೆ-ನಿರೋಧಕ ತನಿಖಾ ದಾಖಲೆ" : "SECTION 63 BSA AUTHENTICITY & TAMPER-EVIDENCE INQUEST"}</span>
            </div>
            <p className="text-[11px] text-[#57534e] leading-relaxed m-0">
              {isKn ? `CCTNS-ಆಧಾರಿತ ಅಧಿಕೃತ ಗುಪ್ತಚರ ಲೆಡ್ಜರ್‌ನಿಂದ ಬ್ಯಾಡ್ಜ್ KSP-${badgeNumber} (${officerAttribution}) ಮೂಲಕ ${nowUtc} ರಂದು ಸಿಸ್ಟಮ್-ರಚಿತವಾಗಿದೆ. ಈ ವಿಧಿವಿಜ್ಞಾನ ದಾಖಲೆಯು ಡಿಜಿಟಲ್ ನಿರಾಕರಣೆ-ಅಲ್ಲಗಳೆಯುವಿಕೆಯೊಂದಿಗೆ ದೃಢೀಕೃತ ಆಪರೇಟರ್‌ಗೆ ಕಾನೂನುಬದ್ಧವಾಗಿ ಆಪಾದಿತವಾಗಿದೆ.` : `System-generated from CCTNS-grounded intelligence ledger by badge KSP-${badgeNumber} (${officerAttribution}) at ${nowUtc}. This forensic document is cryptographically attributed to the authenticated operator with digital non-repudiation under Section 63 BSA.`}
              <br />
              <strong className="text-[#1c1917]">{isKn ? "ಸಮಗ್ರತೆಯ ಹ್ಯಾಶ್ (SHA-256):" : "Integrity Hash (SHA-256):"}</strong>
              <br />
              <span className="font-mono text-[#1c1917] font-bold text-[10.5px] break-all bg-[#f5f5f4] px-2 py-1 rounded border border-[#e7e5e4] inline-block mt-1">
                {auditHash}
              </span>
            </p>
          </div>

          {/* Right Circular Stamp: The Authentic VAJRA Verification Seal */}
          <div className="w-[126px] h-[126px] rounded-full border-[2.5px] border-[#C79A4E] p-[3px] shrink-0 flex items-center justify-center bg-[#fafaf9] shadow-md">
            <div className="w-full h-full rounded-full border border-[#C79A4E] flex flex-col items-center justify-center text-center p-1 bg-white">
              {/* 14-Layer VAJRA Logo Crest (Size 48px with unique SVG arc IDs) */}
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none" className="block mx-auto">
                {/* 1. Outer Gold Spikes (12-point sunburst) */}
                <g fill="#C79A4E">
                  <path d="M24.00 1.00 L21.25 5.60 L26.75 5.60 Z M35.50 4.08 L30.82 6.69 L35.58 9.44 Z M43.92 12.50 L38.56 12.42 L41.31 17.18 Z M47.00 24.00 L42.40 21.25 L42.40 26.75 Z M43.92 35.50 L41.31 30.82 L38.56 35.58 Z M35.50 43.92 L35.58 38.56 L30.82 41.31 Z M24.00 47.00 L26.75 42.40 L21.25 42.40 Z M12.50 43.92 L17.18 41.31 L12.42 38.56 Z M4.08 35.50 L9.44 35.58 L6.69 30.82 Z M1.00 24.00 L5.60 26.75 L5.60 21.25 Z M4.08 12.50 L6.69 17.18 L9.44 12.42 Z M12.50 4.08 L12.42 9.44 L17.18 6.69 Z" />
                </g>
                {/* 2. Gold Outer Ring */}
                <circle cx="24" cy="24" r="19.4" fill="none" stroke="#C79A4E" strokeWidth="1.1" />
                {/* 3. Disc Fill (Rich deep charcoal background for gold contrast) */}
                <circle cx="24" cy="24" r="18.7" fill="#1c1917" />
                {/* 4 & 5. Arced Ring Text with UNIQUE IDs */}
                <path id="sealTopArcUniqueContainer" d="M 9.1,24 A 14.9,14.9 0 0,1 38.9,24" fill="none" stroke="none" />
                <path id="sealBotArcUniqueContainer" d="M 38.9,24 A 14.9,14.9 0 0,1 9.1,24" fill="none" stroke="none" />
                <text fontSize="2.85" fontWeight="800" letterSpacing="0.22" textAnchor="middle" fill="#C79A4E" fontFamily="-apple-system, sans-serif">
                  <textPath href="#sealTopArcUniqueContainer" startOffset="50%">KARNATAKA STATE POLICE</textPath>
                </text>
                <text fontSize="2.85" fontWeight="800" letterSpacing="0.32" textAnchor="middle" fill="#C79A4E" fontFamily="-apple-system, sans-serif">
                  <textPath href="#sealBotArcUniqueContainer" startOffset="50%">CRIME INTELLIGENCE</textPath>
                </text>
                {/* 6. Side Stars */}
                <g fill="#C79A4E" stroke="none">
                  <path d="M7.80 22.50 L8.18 23.47 L9.23 23.54 L8.42 24.20 L8.68 25.21 L7.80 24.65 L6.92 25.21 L7.18 24.20 L6.37 23.54 L7.42 23.47 Z" />
                  <path d="M40.20 22.50 L40.58 23.47 L41.63 23.54 L40.82 24.20 L41.08 25.21 L40.20 24.65 L39.32 25.21 L39.58 24.20 L38.77 23.54 L39.82 23.47 Z" />
                </g>
                {/* 7. Inner Gold Ring */}
                <circle cx="24" cy="24" r="13.4" fill="none" stroke="#C79A4E" strokeWidth="0.85" opacity="0.65" />
                {/* 8. Outer Diamond Frame (Gold) */}
                <path d="M24 12.5 L35.5 24 L24 35.5 L12.5 24 Z" fill="none" stroke="#C79A4E" strokeWidth="1.5" strokeLinejoin="round" />
                {/* 9. Corner Pin Connectors & Nodes */}
                <g stroke="#C79A4E" strokeWidth="1" strokeLinecap="round">
                  <line x1="24" y1="12.5" x2="24" y2="10.2" />
                  <line x1="35.5" y1="24" x2="37.8" y2="24" />
                  <line x1="24" y1="35.5" x2="24" y2="37.8" />
                  <line x1="12.5" y1="24" x2="10.2" y2="24" />
                </g>
                <g fill="#C79A4E" stroke="none">
                  <circle cx="24" cy="10.2" r="0.85" />
                  <circle cx="37.8" cy="24" r="0.85" />
                  <circle cx="24" cy="37.8" r="0.85" />
                  <circle cx="10.2" cy="24" r="0.85" />
                </g>
                {/* 10 & 11. Inner Diamond with Teal-Green Sawtooth Zigzag & Charcoal Fill */}
                <path d="M24.00 15.90 L24.23 17.69 L26.34 17.61 L26.26 19.72 L28.36 19.64 L28.28 21.74 L30.39 21.66 L30.31 23.77 L32.10 24.00 L30.31 24.23 L30.39 26.34 L28.28 26.26 L28.36 28.36 L26.26 28.28 L26.34 30.39 L24.23 30.31 L24.00 32.10 L23.77 30.31 L21.66 30.39 L21.74 28.28 L19.64 28.36 L19.72 26.26 L17.61 26.34 L17.69 24.23 L15.90 24.00 L17.69 23.77 L17.61 21.66 L19.72 21.74 L19.64 19.64 L21.74 19.72 L21.66 17.61 L23.77 17.69 Z" fill="#1c1917" stroke="#3F8C78" strokeWidth="0.7" strokeLinejoin="round" />
                {/* 12. Gold Vajra Thunderbolt, Centered */}
                <path d="M26.3 16.6 L20.8 24.7 L24 24.7 L21.7 31.4 L27.6 23 L24.4 23 Z" fill="#C79A4E" stroke="none" />
                {/* 13. Inner Gold Corner Nodes */}
                <g fill="#C79A4E" stroke="none">
                  <circle cx="24" cy="15.9" r="0.55" />
                  <circle cx="32.1" cy="24" r="0.55" />
                  <circle cx="24" cy="32.1" r="0.55" />
                  <circle cx="15.9" cy="24" r="0.55" />
                </g>
              </svg>
              <div className="text-[7.5pt] font-extrabold text-[#8c6b2d] font-mono tracking-wider mt-1 leading-tight">VAJRA - SCRB</div>
              <div className="text-[5.5pt] font-bold text-[#78716c] font-mono tracking-wide leading-tight">OFFICIAL RECORD</div>
              <div className="text-[5.5pt] font-extrabold text-[#16a34a] font-mono tracking-wider mt-0.5 leading-tight flex items-center gap-1 justify-center">
                <span>●</span>
                <span>SYSTEM VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExportDossierContainer;
