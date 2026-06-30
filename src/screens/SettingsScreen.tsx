import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import {
  Settings,
  Globe,
  Database,
  Lock,
  Server,
  Cpu,
  Shield,
  Languages,
  Plus,
  Edit,
  Trash2,
  Search,
  Check,
  X,
  Sparkles,
  BookOpen,
} from "lucide-react";

interface DictionaryTerm {
  id: string;
  en: string;
  kn: string;
  category: "LEGAL" | "CRIMINAL" | "PROTOCOL";
}

export const SettingsScreen: React.FC = () => {
  const {
    lang,
    setLang,
    badgeNumber,
    isDbConnected,
    isNeo4jConnected,
    addToast,
    theme,
    setTheme,
  } = useApp();

  // Real-time configurations
  const [computeMode, setComputeMode] = useState(true);
  const [translationDepth, setTranslationDepth] = useState<"metadata" | "full">(
    "metadata",
  );
  const [realtimeTransliteration, setRealtimeTransliteration] = useState(true);

  // Live Transliteration Preview interactive playground state
  const [sourceText, setSourceText] = useState(
    "ಫಿರ್ಯಾದಿಯು ದಿನಾಂಕ: 15-08-2023 ರಂದು ಬೆಳಿಗ್ಗೆ 10:30 ಗಂಟೆಗೆ ಮಲ್ಲೇಶ್ವರಂ ಪೊಲೀಸ್ ಠಾಣೆಗೆ ಹಾಜರಾಗಿ ನೀಡಿದ ದೂರು.",
  );
  const [translatedText, setTranslatedText] = useState(
    "The complainant appeared at the Malleshwaram Police Station on 15-08-2023 at 10:30 AM and filed a report.",
  );

  // Technical Dictionary State with full CRUD
  const [terms, setTerms] = useState<DictionaryTerm[]>(() => {
    const saved = localStorage.getItem("vajra_dictionary_terms");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore fallback
      }
    }
    return [
      {
        id: "1",
        en: "Cognizable Offence",
        kn: "ದಸ್ತಗಿರಿ ಮಾಡಬಹುದಾದ ಅಪರಾಧ",
        category: "LEGAL",
      },
      {
        id: "2",
        en: "Absconding",
        kn: "ತಲೆಮರೆಸಿಕೊಂಡಿರುವ",
        category: "CRIMINAL",
      },
      {
        id: "3",
        en: "Seizure Mahazar",
        kn: "ಜಪ್ತಿ ಮಹಜರು",
        category: "PROTOCOL",
      },
      {
        id: "4",
        en: "Aggravated Burglary",
        kn: "ಮನೆಗಳ್ಳತನ",
        category: "CRIMINAL",
      },
      {
        id: "5",
        en: "Recidivism",
        kn: "ಪುನರಾವರ್ತಿತ ಅಪರಾಧ ಜಾಲ",
        category: "LEGAL",
      },
    ];
  });

  const [dictSearch, setDictSearch] = useState("");

  // Add Term Modal/Form states
  const [isAdding, setIsAdding] = useState(false);
  const [newEn, setNewEn] = useState("");
  const [newKn, setNewKn] = useState("");
  const [newCategory, setNewCategory] = useState<
    "LEGAL" | "CRIMINAL" | "PROTOCOL"
  >("LEGAL");

  // Edit Term states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editKn, setEditKn] = useState("");
  const [editCategory, setEditCategory] = useState<
    "LEGAL" | "CRIMINAL" | "PROTOCOL"
  >("LEGAL");

  // Persist terms
  useEffect(() => {
    localStorage.setItem("vajra_dictionary_terms", JSON.stringify(terms));
  }, [terms]);

  // Reactive Transliteration preview dictionary mapper
  useEffect(() => {
    if (!realtimeTransliteration) {
      setTranslatedText(sourceText);
      return;
    }

    // Simple mock fuzzy mapping logic over dictionary terms + standard translations for interactivity
    let lowerSource = sourceText.toLowerCase();

    if (lowerSource.includes("ಫಿರ್ಯಾದಿಯು ದಿನಾಂಕ")) {
      setTranslatedText(
        "The complainant appeared at the Malleshwaram Police Station on 15-08-2023 at 10:30 AM and filed a report.",
      );
    } else if (lowerSource.trim() === "") {
      setTranslatedText("");
    } else {
      // Find matches from our dynamic dictionary
      let mappedResult = sourceText;
      let matchedAny = false;

      terms.forEach((term) => {
        const regexEn = new RegExp(`\\b${term.en}\\b`, "gi");
        if (regexEn.test(mappedResult)) {
          mappedResult = mappedResult.replace(regexEn, ` ${term.kn} `);
          matchedAny = true;
        }

        if (mappedResult.includes(term.kn)) {
          mappedResult = mappedResult.replace(
            new RegExp(term.kn, "g"),
            ` [${term.en}] `,
          );
          matchedAny = true;
        }
      });

      if (matchedAny) {
        setTranslatedText(mappedResult.trim());
      } else {
        // Fallback simulated phonetic conversion/transliterations
        setTranslatedText(
          sourceText
            .replace(/a/g, "ಅ")
            .replace(/e/g, "ಎ")
            .replace(/i/g, "ಇ")
            .replace(/o/g, "ಒ")
            .replace(/u/g, "ಉ") + " [Transliterated Dev Node]",
        );
      }
    }
  }, [sourceText, realtimeTransliteration, terms]);

  // Handle addition
  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEn.trim() || !newKn.trim()) {
      addToast(
        "Validation Failure",
        "Please provide values in both languages.",
        "Warning",
      );
      return;
    }
    const newTerm: DictionaryTerm = {
      id: Date.now().toString(),
      en: newEn.trim(),
      kn: newKn.trim(),
      category: newCategory,
    };
    setTerms([...terms, newTerm]);
    setNewEn("");
    setNewKn("");
    setNewCategory("LEGAL");
    setIsAdding(false);
    addToast(
      "Term Synced",
      `"${newTerm.en}" successfully logged into bilingual SCRB registry.`,
      "Success",
    );
  };

  // Handle Edit Action initiation
  const startEditing = (term: DictionaryTerm) => {
    setEditingId(term.id);
    setEditEn(term.en);
    setEditKn(term.kn);
    setEditCategory(term.category);
  };

  // Save edits
  const saveEdit = (id: string) => {
    if (!editEn.trim() || !editKn.trim()) {
      addToast(
        "Validation Failure",
        "Please provide values in both languages.",
        "Warning",
      );
      return;
    }
    setTerms(
      terms.map((t) =>
        t.id === id
          ? {
              ...t,
              en: editEn.trim(),
              kn: editKn.trim(),
              category: editCategory,
            }
          : t,
      ),
    );
    setEditingId(null);
    addToast(
      "Term Modified",
      "Dictionary definitions synced and locked.",
      "Success",
    );
  };

  // Handle delete
  const handleDeleteTerm = (id: string, name: string) => {
    setTerms(terms.filter((t) => t.id !== id));
    addToast(
      "Term Purged",
      `"${name}" removed from local SCRB dictionary indices.`,
      "Info",
    );
  };

  // Filter dictionary terms
  const filteredTerms = terms.filter(
    (t) =>
      t.en.toLowerCase().includes(dictSearch.toLowerCase()) ||
      t.kn.toLowerCase().includes(dictSearch.toLowerCase()) ||
      t.category.toLowerCase().includes(dictSearch.toLowerCase()),
  );

  const dictionary = {
    en: {
      title: "Settings Console & Bilingual Engine",
      desc: "Configure automated translation depth, execute live transliterations, and manage the technical law-enforcement dictionary.",
      langSec: "System Interface Language / ಭಾಷೆ ಆರಿಸಿ",
      langDesc:
        "Modify the primary language for system outputs, and reports. Kannada includes a custom 1.8 leading font-metric.",
      depthLabel: "Auto-Translation Target Depth",
      previewHeader: "Live FIR Transliteration & Parse Preview",
      dictHeader: "Operational Technical Dictionary Management",
      addBtn: "Add New Technical Term",
      termCol: "TECHNICAL TERM (EN)",
      equivCol: "KANNADA EQUIVALENT (KN)",
      catCol: "METADATA CATEGORY",
      actionCol: "DICTIONARY ACTIONS",
      boundaryHeader: "Operational Authorization Enclave Boundaries",
      jurisdiction: "Terminal Jurisdiction",
      clearance: "Officer Clearance Level",
      nodeId: "Assigned Cognitive Node",
    },
    kn: {
      title: "ಸಿಸ್ಟಮ್ ಸೆಟ್ಟಿಂಗ್ಸ್ ಮತ್ತು ದ್ವಿಭಾಷಾ ಇಂಜಿನ್",
      desc: "ಸ್ವಯಂಚಾಲಿತ ಅನುವಾದದ ಆಳವನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ, ನೈಜ-ಸಮಯದ ಲಿಪ್ಯಂತರಗಳನ್ನು ಕಾರ್ಯಗತಗೊಳಿಸಿ ಮತ್ತು ಶಬ್ದಕೋಶವನ್ನು ನಿರ್ವಹಿಸಿ.",
      langSec: "ಸಿಸ್ಟಮ್ ಇಂಟರ್ಫೇಸ್ ಗ್ಲೋಬಲ್ ಭಾಷೆ / Language",
      langDesc:
        "ಸಿಸ್ಟಮ್ ಔಟ್‌ಪುಟ್‌ಗಳು ಮತ್ತು ವರದಿಗಳಿಗಾಗಿ ಗ್ಲೋಬಲ್ ಭಾಷೆಯನ್ನು ಬದಲಾಯಿಸಿ. ಕನ್ನಡಕ್ಕೆ ೧.೮ ಲೀಡಿಂಗ್ ಫಾಂಟ್ ಬಳಕೆಯಾಗಿದೆ.",
      depthLabel: "ಸ್ವಯಂಚಾಲಿತ ಅನುವಾದದ ಆಳ",
      previewHeader: "ನೈಜ-ಸಮಯದ ಲಿಪ್ಯಂತರ ಮತ್ತು ಅನುವಾದ ಮುನ್ನೋಟ",
      dictHeader: "ತಾಂತ್ರಿಕ ಕಾನೂನು ಶಬ್ದಕೋಶ ನಿರ್ವಹಣೆ",
      addBtn: "ಹೊಸ ತಾಂತ್ರಿಕ ಪದ ಸೇರಿಸಿ",
      termCol: "ಇಂಗ್ಲಿಷ್ ಪದ (EN)",
      equivCol: "ಕನ್ನಡ ಸಮಾನಾರ್ಥಕ ಪದ (KN)",
      catCol: "ವರ್ಗೀಕರಣ",
      actionCol: "ಕ್ರಿಯೆಗಳು",
      boundaryHeader: "ಅಧಿಕೃತ ಕಾರ್ಯನಿರ್ವಹಣೆಯ ಮಿತಿಗಳು (Read-Only Enclave)",
      jurisdiction: "ಟರ್ಮಿನಲ್ ವ್ಯಾಪ್ತಿ ಜೂನ್",
      clearance: "ಅಧಿಕಾರಿಯ ಭದ್ರತಾ ಮಟ್ಟ",
      nodeId: "ನಿಯೋಜಿಸಲಾದ ನೋಡ್ ID",
    },
  }[lang];

  return (
    <div className="p-6 space-y-6 font-sans animate-fade-in bg-slate-50">
      {/* Page Title */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] text-[10px] font-mono font-bold">
            <Settings className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>KSP BILINGUAL TRANSLATION SYSTEM v4.2</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.title}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-3xl leading-relaxed kn-text">
            {dictionary.desc}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: System Configurations (Grid Span 4) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* Night Duty Theme Configuration Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-[13px] font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Settings className="w-4 h-4 text-[#1D4ED8]" />
              <span>
                {lang === "en"
                  ? "Duty Visibility Theme"
                  : "ಕರ್ತವ್ಯದ ಗೋಚರತೆ ಥೀಮ್"}
              </span>
            </h3>

            <p className="text-[12px] text-slate-500 leading-relaxed font-sans kn-text">
              {lang === "en"
                ? "Toggle high-contrast dark mode to reduce eye strain during night-shift investigation duty."
                : "ರಾತ್ರಿ ಪಾಳಿಯ ತನಿಖಾ ಕರ್ತವ್ಯದ ಸಮಯದಲ್ಲಿ ಕಣ್ಣಿನ ಆಯಾಸವನ್ನು ಕಡಿಮೆ ಮಾಡಲು ಹೈ-ಕಾಂಟ್ರಾಸ್ಟ್ ಡಾರ್ಕ್ ಮೋಡ್ ಅನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ."}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTheme("light");
                  addToast(
                    "Theme Adjusted",
                    "Day-shift light display mode restored.",
                    "Info",
                  );
                }}
                className={`flex-1 py-3 rounded-lg border font-mono font-bold text-center text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  theme === "light"
                    ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>☀️</span>
                <span>{lang === "en" ? "Day Shift" : "ಹಗಲು ಪಾಳಿ"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme("high-contrast-dark");
                  addToast(
                    "Night Mode Active",
                    "High-contrast dark mode optimized for night duty.",
                    "Success",
                  );
                }}
                className={`flex-1 py-3 rounded-lg border font-bold text-center text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 kn-text leading-[1.8] ${
                  theme === "high-contrast-dark"
                    ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>🌙</span>
                <span>{lang === "en" ? "Night Shift" : "ರಾತ್ರಿ ಪಾಳಿ"}</span>
              </button>
            </div>
          </div>

          {/* Default interface language & Compute mode */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Globe className="w-4 h-4 text-[#1D4ED8]" />
              <span>{dictionary.langSec}</span>
            </h3>

            <p className="text-[12px] text-slate-500 leading-relaxed font-sans kn-text">
              {dictionary.langDesc}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLang("en");
                  addToast(
                    "Language Switched",
                    "Global terminal language set to English.",
                    "Info",
                  );
                }}
                className={`flex-1 py-3 rounded-lg border font-mono font-bold text-center text-xs transition-all cursor-pointer ${
                  lang === "en"
                    ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                EN (English)
              </button>
              <button
                onClick={() => {
                  setLang("kn");
                  addToast(
                    "ಭಾಷೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಬದಲಾಯಿಸಲಾಗಿದೆ",
                    "ಸಿಸ್ಟಮ್ ಇಂಟರ್ಫೇಸ್ ಅನ್ನು ಕನ್ನಡ ಆಡಳಿತ ಪದಗಳಿಗೆ ಹೊಂದಿಸಲಾಗಿದೆ.",
                    "Info",
                  );
                }}
                className={`flex-1 py-3 rounded-lg border font-bold text-center text-xs transition-all cursor-pointer kn-text leading-[1.8] ${
                  lang === "kn"
                    ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                }`}
              >
                ಕನ್ನಡ (Kannada)
              </button>
            </div>

            {/* Compute selector */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-[12.5px] font-bold text-slate-950 font-sans">
                    Compute Sync Mode
                  </span>
                  <span className="block text-[11px] font-sans text-slate-400">
                    Fallback backends on bandwidth throttling.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setComputeMode(!computeMode);
                    addToast(
                      "Network Sync Modulated",
                      computeMode
                        ? "Using Local Offline State Compute."
                        : "Central State HQ Cloud activated.",
                      "Info",
                    );
                  }}
                  className="relative focus:outline-none cursor-pointer"
                >
                  <div
                    className={`w-10 h-5.5 rounded-full transition-colors ${computeMode ? "bg-[#1D4ED8]" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${computeMode ? "translate-x-5" : "translate-x-0.5"}`}
                    ></div>
                  </div>
                </button>
              </div>
            </div>

            {/* Depth translation options */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <span className="block text-[11.5px] font-bold text-slate-800 uppercase tracking-wider font-mono">
                {dictionary.depthLabel}
              </span>
              <div className="space-y-2 text-[12.5px] text-slate-700 font-sans">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="translationDepth"
                    checked={translationDepth === "metadata"}
                    onChange={() => setTranslationDepth("metadata")}
                    className="text-[#1D4ED8] focus:ring-[#1D4ED8]"
                  />
                  <span className="kn-text leading-tight">
                    Metadata &amp; Core Fields only (ಗ್ರಾಹ್ಯ ಮೆಟಾಡೇಟಾ ಮಾತ್ರ)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="translationDepth"
                    checked={translationDepth === "full"}
                    onChange={() => setTranslationDepth("full")}
                    className="text-[#1D4ED8] focus:ring-[#1D4ED8]"
                  />
                  <span className="kn-text leading-tight">
                    Full Text (AI Synthesis) (ಸಂಪೂರ್ಣ ಪಠ್ಯ ಸಂಯೋಜನೆ)
                  </span>
                </label>
              </div>
            </div>

            {/* Realtime Transliteration Trigger */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-[12.5px] font-bold text-slate-950 font-sans">
                    Real-time Transliteration
                  </span>
                  <span className="block text-[11px] font-sans text-slate-400">
                    Instantly parse phonetics.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRealtimeTransliteration(!realtimeTransliteration)
                  }
                  className="relative focus:outline-none cursor-pointer"
                >
                  <div
                    className={`w-10 h-5.5 rounded-full transition-colors ${realtimeTransliteration ? "bg-[#1D4ED8]" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${realtimeTransliteration ? "translate-x-5" : "translate-x-0.5"}`}
                    ></div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Translation Preview and Technical Dictionary Controls (Grid Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Live Translation Preview Playground (Teal Border Enclave) */}
          <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 p-5 rounded-r-xl shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[13px] font-bold text-teal-800 font-mono uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-[#00C6AD]" />
                <span>{dictionary.previewHeader}</span>
              </h3>
              <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Confidence Score: 0.98 Match
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input text */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                  Source (Type Kannada or English Terms)
                </label>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-800 focus:ring-1 focus:ring-[#00C6AD] focus:border-[#00C6AD] outline-none resize-none font-sans"
                  placeholder="ಫಿರ್ಯಾದಿಯನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ..."
                />
              </div>

              {/* Translated Output View */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-teal-600 font-mono uppercase">
                  Target (Autotranslated &amp; Transliterated)
                </label>
                <div className="w-full h-24 p-3 bg-white border border-[#00C6AD]/25 rounded-lg text-[12px] italic text-[#006f61] overflow-y-auto selection:bg-[#00C6AD]/10 whitespace-pre-wrap font-sans">
                  {translatedText || (
                    <span className="text-slate-300">
                      Awaiting input stream translation...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-teal-600 font-mono italic">
              * AI translation executes securely using the latest KSP
              Law-Enforcement LLM core with zero-exposure parameters.
            </p>
          </div>

          {/* Technical Dictionary Core Table Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-[13px] font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-[#1D4ED8]" />
                  <span>{dictionary.dictHeader}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Manage certified phonetic equivalents for court filings.
                </p>
              </div>

              {/* Add New Term Toggle Trigger */}
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="inline-flex items-center space-x-1.5 py-1.5 px-3 bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white rounded-lg font-bold text-[10.5px] uppercase tracking-wider shadow-md shadow-blue-500/10 cursor-pointer self-start sm:self-center transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>{dictionary.addBtn}</span>
              </button>
            </div>

            {/* Dynamic Add Term Inline Drawer Form */}
            {isAdding && (
              <form
                onSubmit={handleAddTerm}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3.5 animate-slide-down"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-[10.5px] font-mono font-bold text-[#1D4ED8] uppercase">
                    New Term Enlistment Portal
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase">
                      English Word (EN)
                    </label>
                    <input
                      type="text"
                      value={newEn}
                      onChange={(e) => setNewEn(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Cognizable Offence"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase">
                      Kannada Equiv (KN)
                    </label>
                    <input
                      type="text"
                      value={newKn}
                      onChange={(e) => setNewKn(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:ring-1 focus:ring-blue-500 kn-text"
                      placeholder="ದಸ್ತಗಿರಿ ಅಪರಾಧ"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="LEGAL">LEGAL (ಕಾನೂನು ವಿಧಿ)</option>
                      <option value="CRIMINAL">CRIMINAL (ಅಪರಾಧ ಜಾಲ)</option>
                      <option value="PROTOCOL">PROTOCOL (ಪ್ರವೇಶಾವಕಾಶ)</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1D4ED8] text-white font-bold rounded text-xs"
                  >
                    Enlist Term
                  </button>
                </div>
              </form>
            )}

            {/* Keyword Search inside dictionary terms */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={dictSearch}
                onChange={(e) => setDictSearch(e.target.value)}
                className="w-full pl-8.5 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                placeholder="Search legal/criminal technical glossary..."
              />
            </div>

            {/* Vocabulary Table Matrix */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-[12.5px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] uppercase font-bold text-slate-500">
                    <th className="p-3 whitespace-nowrap">
                      {dictionary.termCol}
                    </th>
                    <th className="p-3 whitespace-nowrap">
                      {dictionary.equivCol}
                    </th>
                    <th className="p-3 whitespace-nowrap">
                      {dictionary.catCol}
                    </th>
                    <th className="p-3 text-right whitespace-nowrap">
                      {dictionary.actionCol}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                  {filteredTerms.map((term) => {
                    const isEditing = editingId === term.id;
                    return (
                      <tr
                        key={term.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Term Column */}
                        <td className="p-3 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editEn}
                              onChange={(e) => setEditEn(e.target.value)}
                              className="p-1 border border-slate-200 rounded text-xs w-full bg-white"
                            />
                          ) : (
                            term.en
                          )}
                        </td>

                        {/* Equivalent Kannada Column */}
                        <td className="p-3 text-slate-800 kn-text font-medium leading-[1.8]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editKn}
                              onChange={(e) => setEditKn(e.target.value)}
                              className="p-1 border border-slate-200 rounded text-xs w-full bg-white kn-text"
                            />
                          ) : (
                            term.kn
                          )}
                        </td>

                        {/* Category Badge column */}
                        <td className="p-3">
                          {isEditing ? (
                            <select
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value as any)
                              }
                              className="p-1 border border-slate-200 rounded text-xs select-none"
                            >
                              <option value="LEGAL">LEGAL</option>
                              <option value="CRIMINAL">CRIMINAL</option>
                              <option value="PROTOCOL">PROTOCOL</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase border ${
                                term.category === "LEGAL"
                                  ? "bg-blue-50 text-blue-800 border-blue-150"
                                  : term.category === "CRIMINAL"
                                    ? "bg-rose-50 text-rose-800 border-rose-150"
                                    : "bg-[#00C6AD]/10 text-teal-800 border-teal-200"
                              }`}
                            >
                              {term.category}
                            </span>
                          )}
                        </td>

                        {/* Row Actions - EDIT, SAVE, REMOVE */}
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(term.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Save Row Definition"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                  title="Cancel changes"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditing(term)}
                                  className="p-1 text-slate-500 hover:text-[#1D4ED8] hover:bg-blue-50 rounded cursor-pointer"
                                  title="Edit dictionary definition"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteTerm(term.id, term.en)
                                  }
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Purge definition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTerms.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-400 font-sans truncate"
                      >
                        No technical words logged matching keyword filter. Check
                        filters or add a new certified equivalent.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Authorization Boundaries (ReadOnly Enclave matching the specifications) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 max-w-5xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider">
              {dictionary.boundaryHeader}
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 font-bold">
            STATE POLICE COMMAND HUB ENCLAVE SECURE ACCESS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-slate-200 rounded-lg overflow-hidden text-[12px] bg-slate-50/70 font-sans">
          <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
              {dictionary.jurisdiction}
            </span>
            <span className="text-slate-800 font-bold">
              Zone 3 - Bengaluru City (Central)
            </span>
          </div>

          <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-center items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
              {dictionary.clearance}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold font-mono">
              LEVEL 4 - INTEL OPS
            </span>
          </div>

          <div className="p-4 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
              {dictionary.nodeId}
            </span>
            <span className="font-mono text-slate-800 font-bold bg-slate-200/60 border border-slate-350 px-2 py-0.5 rounded w-fit">
              BLR-INTEL-01-A-SECURE
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
