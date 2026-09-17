import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Search, ShieldAlert, FolderOpen, Calendar, MapPin, Eye, Users, Phone, Car, Network, Scale } from "lucide-react";

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

interface AccusedRosterEntry {
  accused_master_id: number | null;
  name: string;
  age: number | null;
  gender: string;
  phone: string | null;
  vehicle: string | null;
  status: string;
}

interface CaseConnection {
  accused: string;
  linked_case?: string;
  associate?: string;
  type: string;
}

interface CaseIntelligence {
  case_no: string;
  legal_sections: string[];
  accused_roster: AccusedRosterEntry[];
  connections: CaseConnection[];
  syndicate: {
    detection_status: string;
    is_syndicate_member: boolean;
    cluster_size?: number;
    is_hub?: boolean;
    hub_name?: string;
    threat_score_pct?: number;
    shared_case_count?: number;
    cross_district?: boolean;
    districts_involved?: string[];
    synthetic_data_disclosure?: boolean;
  };
  section_111_bns_eligible: boolean;
}

// FIR fold-in (Part G): this used to be a standalone "FIR Repository" nav
// screen (FIRSearchScreen.tsx) -- same precedent already set for Spatial
// Analyst/Demographic Correlation, which retired as separate routes and now
// live only as tabs inside District Analytics. `district`: null means
// statewide (no filter applied server-side, same convention
// DistrictDemographicPanel already uses); a district name narrows the
// existing /api/cases/all + /api/cases/search endpoints via their new
// `district` query param (server-side District->Unit->PoliceStationID
// resolution, ANDed with the existing per-officer row-level security that's
// unchanged either way).
const PAGE_SIZE = 100;

export const DistrictFIRPanel: React.FC<{ district: string | null; crimeGroup?: string | null }> = ({ district, crimeGroup }) => {
  const { lang, addToast, setIsAuthenticated } = useApp();
  const [query, setQuery] = useState("");
  const [firs, setFirs] = useState<CaseRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [intelligence, setIntelligence] = useState<CaseIntelligence | null>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);

  // CONFIRMED LIVE GAP (2026-09-16, Finals-part 3.md Section 40): this
  // dossier panel showed only 5 flat CaseMaster fields -- no accused names,
  // no phone/vehicle assets, no cross-case connections, no syndicate
  // context, even though all of that data exists in the database. Fetches
  // the enrichment separately from the base case row (a second, slower
  // call) so the panel still opens instantly with what it already has.
  useEffect(() => {
    if (!selectedCase) {
      setIntelligence(null);
      return;
    }
    let cancelled = false;
    setIsLoadingIntelligence(true);
    setIntelligence(null);
    fetch(`${API_BASE}/api/cases/${encodeURIComponent(selectedCase.CrimeNo)}/intelligence`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setIntelligence(d); })
      .catch(() => { if (!cancelled) setIntelligence(null); })
      .finally(() => { if (!cancelled) setIsLoadingIntelligence(false); });
    return () => { cancelled = true; };
  }, [selectedCase]);

  // CONFIRMED LIVE BUG (2026-09-16): both endpoints below used to hardcode
  // LIMIT 300 server-side with no offset -- against a 1.69M-row CaseMaster
  // table, an officer browsing (or searching a common term) could only ever
  // see the newest 300 matches, with no way to page further. The backend now
  // takes real limit/offset and returns {cases, total, has_more}; this
  // fetches one page at a time and appends on "Load more" instead of always
  // replacing, so paging in doesn't lose what's already on screen.
  const fetchPage = async (searchStr: string, offset: number, append: boolean) => {
    try {
      if (append) setIsLoadingMore(true);
      else {
        setIsLoading(true);
        setErrorMsg(null);
      }

      const districtParam = district ? `district=${encodeURIComponent(district)}` : "";
      const crimeGroupParam = crimeGroup ? `crime_group=${encodeURIComponent(crimeGroup)}` : "";
      const scopeParams = [districtParam, crimeGroupParam].filter(Boolean).join("&");
      const pageParams = `limit=${PAGE_SIZE}&offset=${offset}`;
      const endpoint = searchStr.trim()
        ? `${API_BASE}/api/cases/search?query=${encodeURIComponent(searchStr)}${scopeParams ? `&${scopeParams}` : ""}&${pageParams}`
        : `${API_BASE}/api/cases/all${scopeParams ? `?${scopeParams}&${pageParams}` : `?${pageParams}`}`;

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
      const page: CaseRecord[] = Array.isArray(data) ? data : (data?.cases || []);
      setTotal(Array.isArray(data) ? null : (data?.total ?? null));
      setHasMore(Array.isArray(data) ? false : !!data?.has_more);

      if (page.length === 0 && !append) {
        setFirs([]);
        if (searchStr.trim()) {
          addToast(
            lang === "en" ? "Search Result" : "ಹುಡುಕಾಟ ಫಲಿತಾಂಶ",
            lang === "en" ? "No CCTNS matches found for query." : "ಪ್ರಶ್ನೆಗೆ CCTNS ಹೊಂದಾಣಿಕೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
            "Info"
          );
        }
      } else {
        setFirs((prev) => (append ? [...prev, ...page] : page));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to contact database registry.");
      if (!append) setFirs([]);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSearch = (searchStr: string) => fetchPage(searchStr, 0, false);
  const handleLoadMore = () => fetchPage(query, firs.length, true);

  useEffect(() => {
    setQuery("");
    setSelectedCase(null);
    handleSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, crimeGroup]);

  return (
    <div className="glass-card p-4 border border-stone-850 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1">
          <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-[#C79A4E]" />
            <span>{lang === "en" ? "Case Registry" : "ಪ್ರಕರಣ ರಿಜಿಸ್ಟ್ರಿ"}</span>
            <span className="text-[9px] font-mono normal-case tracking-normal text-stone-600">
              · {district || (lang === "en" ? "Statewide" : "ರಾಜ್ಯವ್ಯಾಪಿ")}
            </span>
          </h3>
          <p className="text-[10.5px] text-stone-550 leading-relaxed font-mono">
            {lang === "en"
              ? "Audit case registry entries across the Karnataka CCTNS datastore."
              : "ಕರ್ನಾಟಕ CCTNS ಡೇಟಾಸ್ಟೋರ್‌ನಾದ್ಯಂತ ಪ್ರಕರಣ ರಿಜಿಸ್ಟ್ರಿ ನಮೂದುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ."}
          </p>
        </div>

        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder={lang === "en" ? "Search CrimeNo or facts..." : "CrimeNo ಅಥವಾ ಸಂಗತಿಗಳನ್ನು ಹುಡುಕಿ..."}
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

      <div className="min-h-[300px] flex flex-col md:flex-row gap-4 relative">
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
                {lang === "en"
                  ? "Unable to establish a secure handshake with KSP directory server. Mocks are strictly blocked."
                  : "KSP ಡೈರೆಕ್ಟರಿ ಸರ್ವರ್‌ನೊಂದಿಗೆ ಸುರಕ್ಷಿತ ಹ್ಯಾಂಡ್‌ಶೇಕ್ ಸ್ಥಾಪಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಅನುಕರಣೆ ಡೇಟಾ ಕಟ್ಟುನಿಟ್ಟಾಗಿ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ."}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center text-stone-400 text-xs font-mono py-10">
            {lang === "en" ? "Decrypting CCTNS files..." : "CCTNS ಫೈಲ್‌ಗಳನ್ನು ಡೀಕ್ರಿಪ್ಟ್ ಮಾಡಲಾಗುತ್ತಿದೆ..."}
          </div>
        ) : firs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-stone-500 text-xs font-mono py-10">
            {lang === "en" ? "No secure case records resolved." : "ಯಾವುದೇ ಸುರಕ್ಷಿತ ಪ್ರಕರಣ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
          </div>
        ) : (
          <>
            <div className="flex-1 bg-stone-900/10 border border-stone-850 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-mono text-stone-500">
                <span>
                  {total != null
                    ? lang === "en"
                      ? `Showing ${firs.length} of ${total.toLocaleString()} matching records`
                      : `${total.toLocaleString()} ದಾಖಲೆಗಳಲ್ಲಿ ${firs.length} ತೋರಿಸಲಾಗುತ್ತಿದೆ`
                    : lang === "en"
                    ? `${firs.length} records`
                    : `${firs.length} ದಾಖಲೆಗಳು`}
                </span>
              </div>
              <div className="overflow-x-auto flex-1 max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="sticky top-0 bg-stone-950/95 backdrop-blur-sm">
                    <tr className="border-b border-stone-800 text-stone-400 uppercase text-[9.5px] font-black tracking-wider">
                      <th className="py-3.5 px-4">{lang === "en" ? "Crime No" : "ಅಪರಾಧ ಸಂಖ್ಯೆ"}</th>
                      <th className="py-3.5 px-4">{lang === "en" ? "Registered" : "ನೋಂದಾಯಿಸಲಾಗಿದೆ"}</th>
                      <th className="py-3.5 px-4">{lang === "en" ? "District / Unit" : "ಜಿಲ್ಲೆ / ಠಾಣೆ"}</th>
                      <th className="py-3.5 px-4">{lang === "en" ? "Gravity" : "ಗಂಭೀರತೆ"}</th>
                      <th className="py-3.5 px-4 text-center">{lang === "en" ? "Actions" : "ಕ್ರಮಗಳು"}</th>
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
                            {row.LookupValue || (lang === "en" ? "Non-Heinous" : "ಗಂಭೀರವಲ್ಲದ")}
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
              {hasMore && (
                <div className="border-t border-stone-850 p-2.5 shrink-0">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full py-2 rounded-lg text-[10.5px] font-bold font-mono uppercase tracking-wider text-[#C79A4E] bg-[#C79A4E]/5 hover:bg-[#C79A4E]/10 border border-[#C79A4E]/20 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingMore
                      ? lang === "en"
                        ? "Loading..."
                        : "ಲೋಡ್ ಆಗುತ್ತಿದೆ..."
                      : lang === "en"
                      ? `Load next ${PAGE_SIZE}`
                      : `ಮುಂದಿನ ${PAGE_SIZE} ಲೋಡ್ ಮಾಡಿ`}
                  </button>
                </div>
              )}
            </div>

            {selectedCase && (
              <div className="w-full md:w-96 glass-panel border border-stone-800 rounded-2xl p-5 flex flex-col gap-4 animate-fade-in relative z-10 shrink-0">
                <div className="border-b border-stone-850 pb-3 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-[#C79A4E] font-mono block">{lang === "en" ? "CASE DOSSIER" : "ಪ್ರಕರಣ ಕಡತ"}</span>
                    <h4 className="font-extrabold text-stone-200 text-sm font-mono mt-0.5">{selectedCase.CrimeNo}</h4>
                  </div>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="text-xs text-stone-500 hover:text-stone-300 cursor-pointer font-bold font-mono"
                  >
                    {lang === "en" ? "Close" : "ಮುಚ್ಚಿ"}
                  </button>
                </div>

                <div className="space-y-4 text-xs font-sans text-stone-350 leading-relaxed flex-1 overflow-y-auto pr-1">
                  <div className="bg-stone-950/45 p-3 rounded-lg border border-stone-900 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-stone-200 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-[#C79A4E]" />
                      <span>{lang === "en" ? "Registration Log" : "ನೋಂದಣಿ ದಾಖಲೆ"}</span>
                    </div>
                    <p className="text-stone-400">{selectedCase.CrimeRegisteredDate}</p>
                  </div>

                  <div className="bg-stone-950/45 p-3 rounded-lg border border-stone-900 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-stone-200 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-[#C79A4E]" />
                      <span>{lang === "en" ? "Incident Precinct" : "ಘಟನೆ ಠಾಣಾ ವ್ಯಾಪ್ತಿ"}</span>
                    </div>
                    <p className="text-stone-400">{selectedCase.UnitName} • {selectedCase.DistrictName}</p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-stone-400 font-mono">
                      {lang === "en" ? "Incident Narrative (Brief Facts):" : "ಘಟನೆ ವಿವರಣೆ (ಸಂಕ್ಷಿಪ್ತ ಸಂಗತಿಗಳು):"}
                    </span>
                    <div className="bg-stone-950/65 rounded-lg p-3 text-stone-300 border border-stone-900">
                      {selectedCase.BriefFacts || (lang === "en" ? "No narrative details compiled." : "ಯಾವುದೇ ವಿವರಣೆ ಸಂಗ್ರಹಿಸಲಾಗಿಲ್ಲ.")}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-stone-850 pt-3.5 font-mono text-[10.5px]">
                    <div>
                      <span className="block text-stone-500">{lang === "en" ? "Victim Count:" : "ಬಲಿಪಶು ಸಂಖ್ಯೆ:"}</span>
                      <span className="font-extrabold text-stone-250">{selectedCase.VictimCount}</span>
                    </div>
                    <div>
                      <span className="block text-stone-500">{lang === "en" ? "Accused Count:" : "ಆರೋಪಿಗಳ ಸಂಖ್ಯೆ:"}</span>
                      <span className="font-extrabold text-stone-250">{selectedCase.AccusedCount}</span>
                    </div>
                  </div>

                  {isLoadingIntelligence && (
                    <div className="border-t border-stone-850 pt-3.5 text-[10.5px] text-stone-500 font-mono">
                      {lang === "en" ? "Resolving forensic intelligence..." : "ವಿಧಿವಿಜ್ಞಾನ ಮಾಹಿತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ..."}
                    </div>
                  )}

                  {intelligence && (
                    <>
                      {intelligence.legal_sections.length > 0 && (
                        <div className="border-t border-stone-850 pt-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-stone-200 font-bold font-mono text-[11px]">
                            <Scale className="w-3.5 h-3.5 text-[#C79A4E]" />
                            <span>{lang === "en" ? "Applied Legal Sections" : "ಅನ್ವಯಿಕ ಸೆಕ್ಷನ್‌ಗಳು"}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {intelligence.legal_sections.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[9.5px] font-mono">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {intelligence.accused_roster.length > 0 && (
                        <div className="border-t border-stone-850 pt-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-stone-200 font-bold font-mono text-[11px]">
                            <Users className="w-3.5 h-3.5 text-[#C79A4E]" />
                            <span>{lang === "en" ? "Accused Roster" : "ಆರೋಪಿಗಳ ಪಟ್ಟಿ"}</span>
                          </div>
                          <div className="space-y-1.5">
                            {intelligence.accused_roster.map((a, i) => (
                              <div key={i} className="bg-stone-950/45 rounded-lg p-2.5 border border-stone-900 font-mono text-[10px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-stone-200 font-bold">{a.name}</span>
                                  <span className="text-stone-500">{a.age ?? "?"}{a.gender !== "Unknown" ? `, ${a.gender}` : ""}</span>
                                </div>
                                <div className="text-stone-450">{a.status}</div>
                                {(a.phone || a.vehicle) && (
                                  <div className="flex items-center gap-3 text-stone-500 pt-0.5">
                                    {a.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>}
                                    {a.vehicle && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{a.vehicle}</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {intelligence.connections.length > 0 && (
                        <div className="border-t border-stone-850 pt-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-stone-200 font-bold font-mono text-[11px]">
                            <Network className="w-3.5 h-3.5 text-[#C79A4E]" />
                            <span>{lang === "en" ? "Criminal Connections" : "ಅಪರಾಧ ಸಂಪರ್ಕಗಳು"}</span>
                          </div>
                          <ul className="space-y-1 font-mono text-[10px] text-stone-400">
                            {intelligence.connections.slice(0, 8).map((c, i) => (
                              <li key={i}>
                                <span className="text-stone-300">{c.accused}</span>
                                {c.linked_case && <> · {lang === "en" ? "prior case" : "ಹಿಂದಿನ ಪ್ರಕರಣ"} <span className="text-stone-300">{c.linked_case}</span></>}
                                {c.associate && <> · {lang === "en" ? "co-accused with" : "ಸಹ-ಆರೋಪಿ"} <span className="text-stone-300">{c.associate}</span></>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {intelligence.syndicate.is_syndicate_member && (
                        <div className="border-t border-rose-500/20 pt-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-rose-300 font-bold font-mono text-[11px]">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{lang === "en" ? "Syndicate-Linked (co-offending cluster)" : "ಸಿಂಡಿಕೇಟ್ ಸಂಪರ್ಕ"}</span>
                          </div>
                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5 font-mono text-[10px] text-stone-400 space-y-1">
                            <div>{lang === "en" ? "Cluster size" : "ಗುಂಪಿನ ಗಾತ್ರ"}: <span className="text-stone-200 font-bold">{intelligence.syndicate.cluster_size}</span></div>
                            <div>{lang === "en" ? "Threat score" : "ಬೆದರಿಕೆ ಸ್ಕೋರ್"}: <span className="text-stone-200 font-bold">{intelligence.syndicate.threat_score_pct}%</span></div>
                            {intelligence.syndicate.cross_district && (
                              <div className="text-amber-400">{lang === "en" ? "Cross-district footprint" : "ಅಂತರ-ಜಿಲ್ಲಾ ಚಟುವಟಿಕೆ"}: {intelligence.syndicate.districts_involved?.join(", ")}</div>
                            )}
                            {intelligence.syndicate.synthetic_data_disclosure && (
                              <div className="text-stone-600 italic">{lang === "en" ? "Includes synthetic demo phone/vehicle linkage data." : "ಸಿಂಥೆಟಿಕ್ ಡೆಮೊ ಡೇಟಾ ಒಳಗೊಂಡಿದೆ."}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {intelligence.section_111_bns_eligible && (
                        <div className="text-[9.5px] font-mono px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300">
                          {lang === "en"
                            ? "⚖ Heuristic flag: pattern may warrant Section 111 BNS (organized crime) review — not a legal determination."
                            : "⚖ ಸೂಚನೆ: ಸೆಕ್ಷನ್ 111 BNS ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿರಬಹುದು — ಕಾನೂನು ನಿರ್ಧಾರವಲ್ಲ."}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
