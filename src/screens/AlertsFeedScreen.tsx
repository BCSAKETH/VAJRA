import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockLiveAlerts, LiveAlert, appendAuditLog } from "../mockData";
import {
  Bell,
  CheckCircle,
  Clock,
  CheckSquare,
} from "lucide-react";

export const AlertsFeedScreen: React.FC = () => {
  const { lang, badgeNumber } = useApp();
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSeverity, setActiveSeverity] = useState<
    "All" | "Critical" | "Warning" | "Info"
  >("All");

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("vajra_token");
        const response = await fetch("http://localhost:8000/api/alerts", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setAlerts(data);
        } else {
          setAlerts(mockLiveAlerts);
        }
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
        setAlerts(mockLiveAlerts);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter(
    (a) => activeSeverity === "All" || a.severity === activeSeverity,
  );

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, isAcknowledged: true } : alert,
      ),
    );
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Acknowledge Threat Alert",
      queryParam: `Alert Thread ID=${id}`,
      recordsAccessed: 1,
    });
  };

  const handleAcknowledgeAll = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isAcknowledged: true })));
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Acknowledge All Open Alerts",
      queryParam: "Flush active threat broadcast desk",
      recordsAccessed: alerts.length,
    });
    alert(
      lang === "en"
        ? "All live threat channels flushed and acknowledged."
        : "ಎಲ್ಲಾ ಸಕ್ರಿಯ ಕೊಂಡಿಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ದೃಡೀಕರಿಸಲಾಗಿದೆ."
    );
  };

  const dictionary = {
    en: {
      title: "Proactive AI Severe Threats Desk",
      desc: "Live stream of anomalies, SIM spoofing signals, and court release status trackers processed by the neural engine models.",
      ackAll: "Acknowledge All Live Anomalies",
      colNode: "INCIDENT TELEMETRY NODE",
      colStatus: "DESK AUDIT ACTION",
      emptyState: "No threat signals active under chosen filter.",
    },
    kn: {
      title: "ಸಕ್ರಿಯ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಬೆದರಿಕೆ ಫೀಡ್",
      desc: "ಸಿಮ್ ಕಾರ್ಡ್ ದುರ್ಬಳಕೆ, ಅಸಹಜ ಪ್ರವೃತ್ತಿ ಮತ್ತು ಪ್ರಮುಖ ಆದೇಶಗಳ ನೈಜ-ಸಮಯದ ಸ್ವಯಂಚಾಲಿತ ಫೀಡ್.",
      ackAll: "ಎಲ್ಲಾ ಎಚ್ಚರಿಕೆಗಳನ್ನು ದೃಡೀಕರಿಸಿ",
      colNode: "ಘಟನೆ ತನಿಖಾ ಹೆಡ್ಡಿಂಗ್ಸ್",
      colStatus: "ಆಕ್ಷನ್ ಲಾಗ್",
      emptyState: "ಯಾವುದೇ ಹೊಸ ಸಿಗ್ನಲ್‌ಗಳು ಸಕ್ರಿಯವಾಗಿಲ್ಲ.",
    },
  }[lang];

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800 text-[10px] font-mono font-bold">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            <span>KSP AI SECURE BROADCAST HUB</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.title}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-2xl kn-text">
            {dictionary.desc}
          </p>
        </div>

        {/* Flush CTA */}
        {alerts.some((a) => !a.isAcknowledged) && (
          <button
            onClick={handleAcknowledgeAll}
            className="border border-[#1D4ED8] bg-white hover:bg-blue-50/50 text-[#1D4ED8] font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-[#1D4ED8]" />
            <span className="kn-text">{dictionary.ackAll}</span>
          </button>
        )}
      </div>

      {/* Severity filter tags */}
      <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg max-w-sm font-mono text-[10px] font-bold">
        {(["All", "Critical", "Warning", "Info"] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setActiveSeverity(sev)}
            className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${activeSeverity === sev ? "bg-white text-slate-1000 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
          >
            {sev.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main Alerts directory panels */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white border border-slate-200 rounded-xl max-w-4xl shadow-sm">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-mono">Querying real-time neural threat matrix...</span>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-xl p-5 shadow-sm transition-all text-[12.5px] flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                alert.isAcknowledged
                  ? "bg-white opacity-60"
                  : alert.severity === "Critical"
                    ? "bg-red-50/40 border-red-200"
                    : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      alert.severity === "Critical"
                        ? "bg-[#EF4444] text-white"
                        : alert.severity === "Warning"
                          ? "bg-[#FF9933] text-white"
                          : "bg-slate-500 text-white"
                    }`}
                  >
                    {alert.severity}
                  </span>

                  <span className="font-mono text-slate-400 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {alert.timestamp}
                  </span>

                  <span className="text-slate-500 font-extrabold font-mono">
                    NODE-ID: {alert.id}
                  </span>
                </div>

                <div className="font-sans font-bold text-slate-900 text-[14px] leading-tight kn-text">
                  {alert.type}
                </div>

                <p className="text-slate-600 kn-text leading-relaxed font-medium">
                  {alert.details}
                </p>

                <div className="text-[11px] font-mono text-slate-400">
                  CRIMINAL DIVISION INQUEST APPLIED:{" "}
                  <strong>{alert.station}</strong>
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0 pt-1">
                {!alert.isAcknowledged ? (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-[12px] px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Acknowledge Thread
                  </button>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />
                    <span>Investigated & Logged</span>
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredAlerts.length === 0 && (
            <div className="border-2 border-dashed border-slate-200 bg-white rounded-xl p-8 text-center text-slate-400 kn-text">
              {dictionary.emptyState}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
