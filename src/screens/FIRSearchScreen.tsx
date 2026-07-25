import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { Search, ShieldAlert, FolderOpen, Calendar, MapPin, Eye } from "lucide-react";

interface CaseRecord {
  CaseMasterID: number;
  CrimeNo: string;
  BriefFacts: string;
  CrimeRegisteredDate: string;
  DistrictName: string;
  UnitName: string;
  LookupValue: string; // Heinous etc.
  VictimCount: number;
  AccusedCount: number;
}

export const FIRSearchScreen: React.FC = () => {
  const { lang, addToast, setIsAuthenticated } = useApp();
  const [query, setQuery] = useState("");
  const [firs, setFirs] = useState<CaseRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);

  // Fetch FIRs on mount/search
  const handleSearch = async (searchStr: string) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const endpoint = searchStr.trim()
        ? `${API_BASE}/api/cases/search?query=${encodeURIComponent(searchStr)}`
        : `${API_BASE}/api/cases/all`;

      const response = await fetch(endpoint, {
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
        throw new Error("Data Unavailable — Security Registry Offline");
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        setFirs([]);
        if (searchStr.trim()) {
          addToast("Search Result", "No CCTNS matches found for query.", "Info");
        }
      } else {
        setFirs(data);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to contact database registry.");
      setFirs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSearch("");
  }, []);

  return (
    <div className="h-full flex flex-col relative p-6 space-y-6 bg-stone-950/20">
      {/* Repeating security watermark overlay */}
      <WatermarkOverlay />

      {/* Top Search Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-stone-905/30 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#C79A4E]" />
            <span>FIR Security Registry</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            Audit case registry entries across the Karnataka CCTNS datastore.
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder="Search CrimeNo or facts..."
            className="w-full bg-stone-950/60 border border-stone-850 focus:border-[#C79A4E] rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-stone-200 focus:outline-none transition-all placeholder-stone-650"
          />
          <button
            onClick={() => handleSearch(query)}
            className="absolute right-2 top-2 p-1 text-stone-500 hover:text-[#C79A4E] transition-all cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table or Card details */}
      <div className="flex-1 min-h-[300px] overflow-hidden flex flex-col md:flex-row gap-6 relative">
        {errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-stone-950/40 rounded-2xl border border-rose-500/10 space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider font-mono">
                {lang === "en" ? "Data Unavailable — Security Registry Offline" : "ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ — ಸಿಐಎಸ್ ರಿಜಿಸ್ಟ್ರಿ ಆಫ್‌ಲೈನ್"}
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed font-semibold">
                Unable to establish a secure handshake with KSP directory server. Mocks are strictly blocked.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center text-stone-400 text-xs font-mono">
            Decrypting CCTNS files...
          </div>
        ) : firs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-stone-500 text-xs font-mono">
            No secure case records resolved.
          </div>
        ) : (
          <>
            {/* Table Panel */}
            <div className="flex-1 bg-stone-900/10 border border-stone-850 rounded-2xl overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-stone-950/45 border-b border-stone-800 text-stone-400 uppercase text-[9.5px] font-black tracking-wider">
                      <th className="py-3.5 px-4">Crime No</th>
                      <th className="py-3.5 px-4">Registered</th>
                      <th className="py-3.5 px-4">District / Unit</th>
                      <th className="py-3.5 px-4">Gravity</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-850">
                    {firs.map((row) => (
                      <tr
                        key={row.CaseMasterID}
                        className={`hover:bg-stone-900/40 transition-colors ${
                          selectedCase?.CaseMasterID === row.CaseMasterID ? "bg-[#C79A4E]/5 text-[#C79A4E]" : "text-stone-300"
                        }`}
                      >
                        <td className="py-3 px-4 font-bold tracking-wide">{row.CrimeNo}</td>
                        <td className="py-3 px-4 text-stone-450">{row.CrimeRegisteredDate?.split(" ")[0]}</td>
                        <td className="py-3 px-4">
                          <span className="text-stone-350">{row.DistrictName}</span>
                          <span className="block text-[10px] text-stone-500">{row.UnitName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              row.LookupValue === "Heinous" ? "bg-rose-500/10 text-rose-450" : "bg-stone-800 text-stone-400"
                            }`}
                          >
                            {row.LookupValue || "Non-Heinous"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedCase(row)}
                            className="p-1.5 rounded hover:bg-stone-850 text-stone-400 hover:text-[#C79A4E] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar Inspector Panel */}
            {selectedCase && (
              <div className="w-full md:w-96 glass-panel border border-stone-800 rounded-2xl p-5 flex flex-col gap-4 animate-fade-in relative z-10 shrink-0">
                <div className="border-b border-stone-850 pb-3 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-[#C79A4E] font-mono block">CASE DOSSIER</span>
                    <h4 className="font-extrabold text-stone-200 text-sm font-mono mt-0.5">{selectedCase.CrimeNo}</h4>
                  </div>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="text-xs text-stone-500 hover:text-stone-300 cursor-pointer font-bold font-mono"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4 text-xs font-sans text-stone-350 leading-relaxed flex-1 overflow-y-auto pr-1">
                  <div className="bg-stone-950/45 p-3 rounded-lg border border-stone-900 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-stone-200 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-[#C79A4E]" />
                      <span>Registration Log</span>
                    </div>
                    <p className="text-stone-400">{selectedCase.CrimeRegisteredDate}</p>
                  </div>

                  <div className="bg-stone-950/45 p-3 rounded-lg border border-stone-900 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-stone-200 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-[#C79A4E]" />
                      <span>Incident Precinct</span>
                    </div>
                    <p className="text-stone-400">{selectedCase.UnitName} • {selectedCase.DistrictName}</p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-stone-400 font-mono">Incident Narrative (Brief Facts):</span>
                    <div className="bg-stone-950/65 rounded-lg p-3 text-stone-300 border border-stone-900">
                      {selectedCase.BriefFacts || "No narrative details compiled."}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-stone-850 pt-3.5 font-mono text-[10.5px]">
                    <div>
                      <span className="block text-stone-500">Victim Count:</span>
                      <span className="font-extrabold text-stone-250">{selectedCase.VictimCount}</span>
                    </div>
                    <div>
                      <span className="block text-stone-500">Accused Count:</span>
                      <span className="font-extrabold text-stone-250">{selectedCase.AccusedCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
