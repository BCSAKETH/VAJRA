import React, { useState } from "react";
import { useApp } from "../AppContext";
import { mockAuditLogs, AuditLog, appendAuditLog } from "../mockData";
import {
  FileCode,
  Shield,
  Search,
  CheckCircle,
  Database,
  Lock,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";

export const AuditTrailScreen: React.FC = () => {
  const { lang, badgeNumber } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [filterAction, setFilterAction] = useState("All");

  // Trigger local state reload with fresh mock telemetry log
  const handleReloadLedger = () => {
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Audited Cryptographic Ledger reload",
      queryParam: "Manual refresh click on block index",
      recordsAccessed: logs.length,
    });
    setLogs(mockAuditLogs);
  };

  const actionsSet = ["All", ...Array.from(new Set(logs.map((l) => l.action)))];

  const filteredLogs = logs.filter(
    (l) => filterAction === "All" || l.action === filterAction,
  );

  const dictionary = {
    en: {
      title: "Immutable Access Ledger & Block Audit Trail",
      desc: "Each query, model calculation, and profile retrieval produces an immutable block transaction token with secure SHA-256 signatures for accountability.",
      btnReload: "Reload Authenticated Logs",
      colTime: "TIMESTAMP (UTC)",
      colBadge: "CREDENTIAL NO.",
      colAction: "OPERATING COMMANDED ACTION",
      colParam: "GROUNDING PARAMETERS",
      colHash: "SECURE CRYPTO RECORD INDEX",
      securityBanner: "BLOCK INTEGRITY VALIDATED",
    },
    kn: {
      title: "ಅಪರಾಧ ತನಿಖಾ ದಾಖಲೆಗಳ ಆಡಿಟ್ ಲಾಗ್",
      desc: "ಪ್ರತಿ ತನಿಖಾ ಹೆಜ್ಜೆ, ಶೋಧನೆಗಳು ಮತ್ತು ಮಾದರಿ ಲನ್ಚರ್‌ಗಳು ಒಂದು ತಿದ್ದುಪಡಿ ಮಾಡಲಾಗದ ಡಿಜಿಟಲ್ ಇತಿಹಾಸ ಲಾಗ್‌ನಲ್ಲಿ ಭದ್ರವಾಗಿ ದಾಖಲಾಗುತ್ತವೆ.",
      btnReload: "ದಾಖಲೆಗಳನ್ನು ನವೀಕರಿಸಿ",
      colTime: "ಸಮಯ (UTC)",
      colBadge: "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ",
      colAction: "ಪ್ರಕ್ರಿಯೆಯ ವಿವರಣೆ",
      colParam: "ಹುಡುಕಾಟದ ಕೀಲಿಪದಗಳು",
      colHash: "ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ಹ್ಯಾಶ್ ಸೂಚ್ಯಂಕ",
      securityBanner: "ಅಖಂಡತೆ ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿದೆ",
    },
  }[lang];

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Top Banner Warning & Title Link */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-800">
        <div className="flex items-center space-x-2 font-mono font-bold">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span className="tracking-wide uppercase">
            {dictionary.securityBanner}
          </span>
        </div>
        <div className="font-mono text-[10px]">
          LEDGER SYNCHRONIZED: SUCCESS
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
            <Database className="w-3.5 h-3.5 text-emerald-700" />
            <span>KSP CRYPTO-AUDIT NODE LOCK</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.title}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-3xl leading-relaxed kn-text">
            {dictionary.desc}
          </p>
        </div>

        {/* Action Toggle reloading */}
        <button
          onClick={handleReloadLedger}
          className="border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center space-x-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="kn-text leading-none">{dictionary.btnReload}</span>
        </button>
      </div>

      {/* Filter and Content details */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex items-center space-x-2 text-[12px]">
          <span className="text-slate-400 font-bold font-mono">
            FILTER BY ACTION JURISDICTION:
          </span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-[11px] font-mono font-bold text-[#1D4ED8] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
          >
            {actionsSet.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden text-[12px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border-0 font-mono text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <th className="p-4">{dictionary.colTime}</th>
                  <th className="p-4">{dictionary.colBadge}</th>
                  <th className="p-4">{dictionary.colAction}</th>
                  <th className="p-4">{dictionary.colParam}</th>
                  <th className="p-4 text-right">{dictionary.colHash}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredLogs.map((log, idx) => {
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* DateTime Stamp */}
                      <td className="p-4 text-slate-500 font-mono flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{log.timestamp}</span>
                      </td>

                      {/* Badge Holder */}
                      <td className="p-4">
                        <span className="bg-blue-50 text-[#1D4ED8] px-1.5 py-0.5 rounded border border-blue-100/50 font-bold">
                          {log.badgeId}
                        </span>
                      </td>

                      {/* Decided Action */}
                      <td className="p-4 text-slate-900 font-semibold font-sans kn-text">
                        {log.action}
                      </td>

                      {/* Target search values */}
                      <td
                        className="p-4 text-slate-500 font-sans truncate max-w-[200px]"
                        title={log.queryParam}
                      >
                        {log.queryParam}
                      </td>

                      {/* Mock Secure digest hash */}
                      <td className="p-4 text-right">
                        <span className="text-emerald-700 bg-emerald-50/60 border border-emerald-100/50 px-2 py-0.5 rounded font-bold">
                          {log.hash}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center p-8 text-slate-450 font-sans kn-text"
                    >
                      No active cryptographically logged queries recorded in
                      this stream.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
