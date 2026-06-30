import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockFIRs, FIRRecord } from "../mockData";
import { FIRSearchSkeleton } from "../components/SkeletonLoader";
import {
  Search,
  Filter,
  CheckCircle,
  FileText,
  Clock,
  ArrowRight,
  Database,
  ExternalLink,
} from "lucide-react";

export const FIRSearchScreen: React.FC = () => {
  const { lang, setCurrentScreen, setSelectedFirNo } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStation, setSelectedStation] = useState("All");
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [firs, setFirs] = useState<FIRRecord[]>([]);

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
        if (!response.ok) {
          throw new Error("Failed to fetch records from registry.");
        }
        const data = await response.json();
        setFirs(data);
      } catch (err: any) {
        console.error("Error fetching live FIRs:", err);
        // Fallback to mock data to prevent blocking prototype auditing
        setFirs(mockFIRs);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFirs();
  }, []);

  const filteredFIRs = firs.filter((fir) => {
    const matchesSearch =
      fir.firNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fir.accusedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fir.actSection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fir.crimeType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDistrict =
      selectedDistrict === "All" || fir.district.toLowerCase() === selectedDistrict.toLowerCase();
    const matchesStation =
      selectedStation === "All" || fir.station.toLowerCase() === selectedStation.toLowerCase();
    const matchesStatus =
      selectedStatus === "All" || fir.status === selectedStatus;

    return matchesSearch && matchesDistrict && matchesStation && matchesStatus;
  });

  const districts = [
    "All",
    ...Array.from(new Set(firs.map((f) => f.district).filter(Boolean))),
  ];

  const stations = [
    "All",
    ...Array.from(new Set(firs.map((f) => f.station))),
  ];
  const statuses = [
    "All",
    "Under Investigation",
    "Charge Sheeted",
    "Closed",
    "Untraced",
  ];

  const handleLaunchWorkspace = (firNo: string) => {
    // Save chosen file to local storage so workspace can mount it
    localStorage.setItem("vajra_initial_workspace_case", firNo);
    setSelectedFirNo(firNo);
    setCurrentScreen("case_workspace");
  };

  const dictionary = {
    en: {
      title: "CCTNS FIR Registry Index Directory",
      desc: "Instant search of 1.6 Million historical entries from the Kaggle SCRB dataset. Instantly filter by police station jurisdiction and file processing state.",
      searchPlaceholder: "Enter suspect name, IPC section, or FIR card ID...",
      colNo: "FIR No.",
      colStation: "Subdivision PS",
      colType: "Crime Classification",
      colAccused: "Charged Suspect",
      colStatus: "CCTNS Status",
      colActions: "Workspace Actions",
      inspectBtn: "Deport to Workspace",
    },
    kn: {
      title: "CCTNS ಎಫ್ಐಆರ್ ನೋಂದಣಿ ಸೂಚಿಕೆ ಡೈರೆಕ್ಟರಿ",
      desc: "ರಾಜ್ಯ ಪೊಲೀಸ್ ಇಲಾಖೆಯ ೧.೬ ಮಿಲಿಯನ್ CCTNS ದಾಖಲೆಗಳ ಸುಧಾರಿತ ಹುಡುಕಾಟ. ಠಾಣೆ ಮತ್ತು ತನಿಖೆಯ ಸ್ಥಿತಿಯ ಆಧಾರದ ಮೇಲೆ ಫಿಲ್ಟರ್ ಮಾಡಿ.",
      searchPlaceholder:
        "ಆರೋಪಿಯ ಹೆಸರು, ಕಾನೂನು ಕಲಂಗಳು ಅಥವಾ ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ...",
      colNo: "ಎಫ್ಐಆರ್ ಸಂಖ್ಯೆ",
      colStation: "ಪೊಲೀಸ್ ಠಾಣೆ",
      colType: "ಅಪರಾಧ ವಿಧ",
      colAccused: "ಸಂಶಯಾಸ್ಪದ ಆರೋಪಿ",
      colStatus: "ತನಿಖಾ ಸ್ಥಿತಿ",
      colActions: "ಕ್ರಿಯೆಗಳು",
      inspectBtn: "ಕಾರ್ಯಸ್ಥಳದಲ್ಲಿ ನೋಡಿ",
    },
  }[lang];

  if (isLoading) {
    return <FIRSearchSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Title */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-1">
        <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] text-[10px] font-mono font-bold">
          <Database className="w-3.5 h-3.5" />
          <span>KSP SECURE DATABASE ACCESS NODE</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
          {dictionary.title}
        </h2>
        <p className="text-[12.5px] text-slate-500 max-w-2xl kn-text">
          {dictionary.desc}
        </p>
      </div>

      {/* Filter and Search Layout Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder={dictionary.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            />
          </div>

          {/* District Filter Dropdown */}
          <div className="md:col-span-3 flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5 text-[12.5px] text-slate-700 focus:outline-none"
            >
              <option disabled>Filter District</option>
              {districts.map((dst) => (
                <option key={dst} value={dst}>
                  {dst === "All" ? "All Districts / ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು" : dst}
                </option>
              ))}
            </select>
          </div>

          {/* Station drop */}
          <div className="md:col-span-3 flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5 text-[12.5px] text-slate-700 focus:outline-none"
            >
              <option disabled>Filter Police Station</option>
              {stations.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All Stations / ಎಲ್ಲಾ ಠಾಣೆಗಳು" : st}
                </option>
              ))}
            </select>
          </div>

          {/* Status drop */}
          <div className="md:col-span-2 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2.5 text-[12.5px] text-slate-700 focus:outline-none"
            >
              <option disabled>Filter File Status</option>
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All Statuses / ಎಲ್ಲಾ ಸ್ಥಿತಿಗಳು" : st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table View */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Count stripe */}
        <div className="bg-slate-50/55 border-b border-slate-100 p-3 flex justify-between items-center text-[11px] font-mono font-bold text-slate-500">
          <span>INDEX RESULTS MATCHED: {filteredFIRs.length} ENTRIES</span>
          <span className="text-[#1D4ED8]">SECURE DIRECT QUERY COMPLIABLE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border-0 text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold">
                <th className="p-4">{dictionary.colNo}</th>
                <th className="p-4">{dictionary.colStation}</th>
                <th className="p-4">{dictionary.colType}</th>
                <th className="p-4">{dictionary.colAccused}</th>
                <th className="p-4">{dictionary.colStatus}</th>
                <th className="p-4 text-right">{dictionary.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
              {filteredFIRs.map((fir) => {
                return (
                  <tr
                    key={fir.firNo}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* FIR ID */}
                    <td className="p-4 font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                      <span>{fir.firNo}</span>
                    </td>

                    {/* Sub station */}
                    <td className="p-4">
                      <div className="font-bold text-slate-800 kn-text leading-tight">
                        {fir.station}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {fir.district}
                      </div>
                    </td>

                    {/* Classification */}
                    <td className="p-4">
                      <div
                        className="font-medium text-slate-700 truncate max-w-[170px]"
                        title={fir.actSection}
                      >
                        {fir.crimeType}
                      </div>
                      <div
                        className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]"
                        title={fir.actSection}
                      >
                        {fir.actSection}
                      </div>
                    </td>

                    {/* Charge block */}
                    <td className="p-4">
                      <div className="font-bold text-slate-800 kn-text leading-tight">
                        {fir.accusedName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Age: {fir.accusedAge}
                      </div>
                    </td>

                    {/* Case state */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          fir.status === "Closed"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : fir.status === "Charge Sheeted"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : fir.status === "Untraced"
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {fir.status}
                      </span>
                    </td>

                    {/* Jump buttons */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleLaunchWorkspace(fir.firNo)}
                        className="bg-white border border-slate-200 hover:border-[#1D4ED8] text-[#1D4ED8] hover:bg-blue-50/50 text-[11px] font-bold px-3 py-1.5 rounded transition-all flex items-center justify-center space-x-1 ml-auto cursor-pointer"
                      >
                        <span className="kn-text">{dictionary.inspectBtn}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredFIRs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center p-8 text-slate-400 kn-text"
                  >
                    {lang === "en"
                      ? "No indexed files match query. Try modifying your Station or Status filters."
                      : "ಯಾವುದೇ ಸೂಕ್ತ ಸಿಐಎಸ್ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಬದಲಾಯಿಸಿ."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
