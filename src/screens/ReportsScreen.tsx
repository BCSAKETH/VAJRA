import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";

interface DemographicData {
  district: string;
  crimeCount: number;
  unemploymentRate: number;
  literacyRate: number;
}

export const ReportsScreen: React.FC = () => {
  const { lang, addToast, setIsAuthenticated } = useApp();
  const [data, setData] = useState<DemographicData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch report data on mount
  useEffect(() => {
    const fetchDemographics = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const response = await fetch(`${API_BASE}/api/cases/demographics`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          },
        });

        if (response.status === 401) {
          addToast(
            lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
            lang === "en" ? "Please sign in again to establish a secure logon." : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಲಾಗ್ ಇನ್ ಮಾಡಿ.",
            "Warning"
          );
          setIsAuthenticated(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Data Unavailable — Demographic Analytics Offline");
        }

        const resData = await response.json();
        if (!resData || resData.length === 0) {
          throw new Error("No demographic data resolved from datastore.");
        }

        setData(resData);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Failed to load demographic metrics.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDemographics();
  }, []);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-slate-950/20 overflow-y-auto">
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-905/30 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00C6AD]" />
            <span>Demographic Correlation Reports</span>
          </h2>
          <p className="text-[11px] text-slate-550 leading-relaxed font-mono">
            Statistical correlations between localized socio-demographic indicators and crime frequency indexes.
          </p>
        </div>
      </div>

      {errorMsg ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950/40 rounded-2xl border border-rose-500/10 space-y-4">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider font-mono">
              {lang === "en" ? "Data Unavailable — Analytics Offline" : "ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ — ವಿಶ್ಲೇಷಣೆ ಆಫ್‌ಲೈನ್"}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              The analytical reporting services are currently offline. Check connection to database.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-mono">
          Compiling correlation matrices...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Card 1: Crime Frequency by District */}
          <div className="glass-card p-5 border border-slate-850 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
              <Sparkles className="w-4 h-4 text-[#00C6AD]" />
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">Crime Incidence Index by District</h3>
            </div>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="district" stroke="#94A3B8" fontSize={9.5} />
                  <YAxis stroke="#94A3B8" fontSize={9.5} />
                  <Tooltip contentStyle={{ background: "rgba(10, 22, 40, 0.95)", border: "1px solid #1e293b" }} />
                  <Bar dataKey="crimeCount" fill="#00C6AD" radius={[4, 4, 0, 0]} name="Incidents Logged" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Unemployment vs Crime Correlation */}
          <div className="glass-card p-5 border border-slate-850 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
              <TrendingUp className="w-4 h-4 text-[#00C6AD]" />
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono">Unemployment Rate vs Incident Volume</h3>
            </div>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="district" stroke="#94A3B8" fontSize={9.5} />
                  <YAxis stroke="#94A3B8" fontSize={9.5} />
                  <Tooltip contentStyle={{ background: "rgba(10, 22, 40, 0.95)", border: "1px solid #1e293b" }} />
                  <Line type="monotone" dataKey="crimeCount" stroke="#F59E0B" strokeWidth={2.5} name="Incidents" />
                  <Line type="monotone" dataKey="unemploymentRate" stroke="#00C6AD" strokeWidth={2} name="Unemployment %" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
