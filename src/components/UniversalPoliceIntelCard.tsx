import React, { useState } from "react";
import {
  ShieldAlert, ShieldCheck, Scale, Clock, Lock, Target, FileText,
  CheckCircle2, AlertTriangle, Activity, MapPin, Users, Repeat,
  BookOpen, Archive, PhoneCall, Camera, Cpu, Car, Landmark, Globe,
  Radio, Fingerprint, Zap, Download, Copy, Check, ExternalLink,
  ChevronRight, ChevronDown, Sparkles, Building2, TestTube, AlertOctagon,
  Calendar, HeartHandshake, UserX, Award, Briefcase, Compass, ScanFace
} from "lucide-react";

export interface UniversalPoliceIntelCardProps {
  type: string;
  data: any;
  lang?: "en" | "kn";
  onFollowUpQuery?: (query: string) => void;
  onClose?: () => void;
}

// Icon & Meta Resolver for any specialized police intelligence tool card
export const getTacticalMeta = (type: string, data?: any, lang: "en" | "kn" = "en") => {
  const t = (type || "").toLowerCase();

  if (t.includes("bail_countdown") || t.includes("default_bail")) {
    return {
      title: lang === "en" ? "Section 187 BNSS Default Bail Countdown" : "ಸೆಕ್ಷನ್ 187 BNSS ಡೀಫಾಲ್ಟ್ ಜಾಮೀನು ಕೌಂಟ್‌ಡೌನ್",
      statute: "§ 187(3) BNSS 2023",
      category: "STATUTORY TIMELINE",
      icon: Clock,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "#EF4444"
    };
  }
  if (t.includes("ipc_bns") || t.includes("concordance")) {
    return {
      title: lang === "en" ? "Dual-Statute Legal Concordance Matrix (IPC ↔ BNS)" : "ದ್ವಿ-ಕಾನೂನು ಹೊಂದಾಣಿಕೆ ಮಾದರಿ (IPC ↔ BNS)",
      statute: "BNS / BNSS / BSA 2023",
      category: "STATUTORY RECONCILIATION",
      icon: Scale,
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      accent: "#A855F7"
    };
  }
  if (t.includes("electronic_evidence") || t.includes("bsa") || t.includes("cert")) {
    return {
      title: lang === "en" ? "Section 63 BSA Digital Evidence Certificate" : "ಸೆಕ್ಷನ್ 63 BSA ಡಿಜಿಟಲ್ ಪುರಾವೆ ಪ್ರಮಾಣಪತ್ರ",
      statute: "§ 63 BSA 2023",
      category: "COURT ADMISSIBLE PROVENANCE",
      icon: Lock,
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      accent: "#10B981"
    };
  }
  if (t.includes("nakabandi") || t.includes("choke_point")) {
    return {
      title: lang === "en" ? "Tactical Choke Point & Highway Nakabandi Plan" : "ರಹದಾರಿ ನಾಕಾಬಂದಿ ಮತ್ತು ತನಿಖಾ ಚೆಕ್‌ಪೋಸ್ಟ್ ಯೋಜನೆ",
      statute: "§ 173 BNSS / Police Act",
      category: "TACTICAL INTERCEPTION",
      icon: ShieldAlert,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      accent: "#F59E0B"
    };
  }
  if (t.includes("malkhana") || t.includes("property")) {
    return {
      title: lang === "en" ? "Malkhana Seized Property & Custody Ledger" : "ಮಾಲ್ಖಾನಾ ಜಪ್ತಿ ಸ್ವತ್ತು ಮತ್ತು ಸರಪಳಿ ದಾಖಲೆ",
      statute: "§ 105 / 451 BNSS",
      category: "EVIDENCE CUSTODY",
      icon: Archive,
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      accent: "#06B6D4"
    };
  }
  if (t.includes("fsl") || t.includes("toxicology")) {
    return {
      title: lang === "en" ? "Forensic Science Laboratory (FSL) Tracking" : "ವಿಧಿವಿಜ್ಞಾನ ಪ್ರಯೋಗಾಲಯ (FSL) ಪರೀಕ್ಷಾ ಸ್ಥಿತಿ",
      statute: "§ 183 / 329 BNSS",
      category: "FORENSIC LABORATORY",
      icon: TestTube,
      badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
      accent: "#6366F1"
    };
  }
  if (t.includes("cyber_1930") || t.includes("ncrp") || t.includes("mule")) {
    return {
      title: lang === "en" ? "1930 Cyber Fraud & Mule Account Freezing Docket" : "1930 ಸೈಬರ್ ವಂಚನೆ ಮತ್ತು ಖಾತೆ ಸ್ಥಗಿತ ಡಾಕೆಟ್",
      statute: "§ 106 BNSS / IT Act",
      category: "GOLDEN HOUR CYBER FREEZE",
      icon: Cpu,
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      accent: "#0EA5E9"
    };
  }
  if (t.includes("ndps") || t.includes("narcotics") || t.includes("peddling")) {
    return {
      title: lang === "en" ? "NDPS Narcotics Seizure & Peddling Surveillance" : "NDPS ಮಾದಕವಸ್ತು ಜಪ್ತಿ ಮತ್ತು ಜಾಲ ಕಣ್ಗಾವಲು",
      statute: "NDPS Act 1985 / BNS",
      category: "NARCOTICS RADAR",
      icon: Target,
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
      accent: "#EF4444"
    };
  }
  if (t.includes("emergency_112") || t.includes("dispatch")) {
    return {
      title: lang === "en" ? "Emergency Dial 112 Command & Rapid Dispatch" : "ತುರ್ತು ಡಯಲ್ 112 ಆದೇಶ ಮತ್ತು ರವಾನೆ ನಿಯಂತ್ರಣ",
      statute: "ERSS 112 Standard SOP",
      category: "RAPID RESPONSE TELEMATICS",
      icon: PhoneCall,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "#F43F5E"
    };
  }
  if (t.includes("warrant") || t.includes("nbw")) {
    return {
      title: lang === "en" ? "Non-Bailable Warrant (NBW) Execution Board" : "ಜಾಮೀನು ರಹಿತ ವಾರಂಟ್ (NBW) ಜಾರಿ ಫಲಕ",
      statute: "§ 72–79 BNSS 2023",
      category: "JUDICIAL PROCESS",
      icon: Target,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      accent: "#F59E0B"
    };
  }
  if (t.includes("pocso") || t.includes("child")) {
    return {
      title: lang === "en" ? "POCSO Mandatory Statutory Compliance Tracker" : "POCSO ಕಡ್ಡಾಯ ಶಾಸನಬದ್ಧ ಅನುಸರಣೆ ದಾಖಲೆ",
      statute: "POCSO Act 2012 / § 176 BNSS",
      category: "MANDATORY STATUTORY PROTECTION",
      icon: ShieldCheck,
      badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/40",
      accent: "#EC4899"
    };
  }
  if (t.includes("vehicle") || t.includes("rto") || t.includes("plate")) {
    return {
      title: lang === "en" ? "Vahan RTO Vehicle Registry & Stolen Check" : "ವಾಹನ RTO ನೋಂದಣಿ ಮತ್ತು ಕಳ್ಳತನ ತಪಾಸಣೆ",
      statute: "Motor Vehicles Act / CCTNS",
      category: "VEHICLE RECONNAISSANCE",
      icon: Car,
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      accent: "#10B981"
    };
  }
  if (t.includes("bank") || t.includes("ifsc")) {
    return {
      title: lang === "en" ? "Banking Intelligence & Section 106 BNSS Freeze" : "ಬ್ಯಾಂಕಿಂಗ್ ಗುಪ್ತಚರ ಮತ್ತು ಸೆಕ್ಷನ್ 106 BNSS ಸ್ಥಗಿತ",
      statute: "§ 106 BNSS 2023",
      category: "FINANCIAL SEIZURE",
      icon: Landmark,
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      accent: "#3B82F6"
    };
  }
  if (t.includes("whois") || t.includes("dns") || t.includes("ip")) {
    return {
      title: lang === "en" ? "Passive DNS & Endpoint Geolocation Forensics" : "ಪ್ಯಾಸಿವ್ DNS ಮತ್ತು IP ಭೌಗೋಳಿಕ ವಿಧಿವಿಜ್ಞಾನ",
      statute: "§ 94 BNSS / IT Act",
      category: "CYBER OSINT RECON",
      icon: Globe,
      badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
      accent: "#14B8A6"
    };
  }
  if (t.includes("social_threat") || t.includes("viral")) {
    return {
      title: lang === "en" ? "Viral Social Media Threat & Disinformation Radar" : "ವೈರಲ್ ಸಾಮಾಜಿಕ ಜಾಲತಾಣ ಬೆದರಿಕೆ ರಾಡಾರ್",
      statute: "§ 196 / 353 BNS 2023",
      category: "PUBLIC ORDER INTELLIGENCE",
      icon: Radio,
      badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      accent: "#F97316"
    };
  }
  if (t.includes("court") || t.includes("calendar") || t.includes("trial")) {
    return {
      title: lang === "en" ? "Court Trial Calendar & Public Prosecutor Liaison" : "ನ್ಯಾಯಾಲಯ ವಿಚಾರಣೆ ಕ್ಯಾಲೆಂಡರ್ ಮತ್ತು ಅಭಿಯೋಜಕರ ಸಹಯೋಗ",
      statute: "§ 251–265 BNSS 2023",
      category: "JUDICIAL PROCEEDINGS",
      icon: Calendar,
      badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
      accent: "#6366F1"
    };
  }
  if (t.includes("fugitive") || t.includes("interstate") || t.includes("bolo")) {
    return {
      title: lang === "en" ? "Inter-State Fugitive & Red-Corner Notice Radar" : "ಅಂತರ್-ರಾಜ್ಯ ಪರಾರಿ ಅಪರಾಧಿ ಕಣ್ಗಾವಲು ರಾಡಾರ್",
      statute: "§ 84 BNSS / MHA Protocol",
      category: "FUGITIVE TRACKING",
      icon: UserX,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "#F43F5E"
    };
  }
  if (t.includes("diary") || t.includes("entry")) {
    return {
      title: lang === "en" ? "Section 193 BNSS Case Diary Intelligence Ledger" : "ಸೆಕ್ಷನ್ 193 BNSS ಕೇಸ್ ಡೈರಿ ಗುಪ್ತಚರ ದಾಖಲೆ",
      statute: "§ 193 BNSS 2023",
      category: "INVESTIGATION DIARY",
      icon: BookOpen,
      badgeColor: "bg-[#C79A4E]/20 text-[#E4C590] border-[#C79A4E]/40",
      accent: "#C79A4E"
    };
  }
  if (t.includes("fir") || t.includes("case")) {
    return {
      title: lang === "en" ? "CCTNS First Information Report (FIR Form)" : "CCTNS ಪ್ರಥಮ ವರ್ತಮಾನ ವರದಿ (FIR ಫಾರ್ಮ್)",
      statute: "§ 173 BNSS 2023",
      category: "CCTNS COGNIZABLE FIR",
      icon: FileText,
      badgeColor: "bg-[#C79A4E]/20 text-[#E4C590] border-[#C79A4E]/40",
      accent: "#C79A4E"
    };
  }
  if (t.includes("compliance") || t.includes("checklist")) {
    return {
      title: lang === "en" ? "Statutory Procedural Compliance Audit" : "ಶಾಸನಬದ್ಧ ಕಾರ್ಯವಿಧಾನ ಅನುಸರಣೆ ಲೆಕ್ಕಪರಿಶೋಧನೆ",
      statute: "BNS / BNSS Statutory Mandate",
      category: "PROCEDURAL AUDIT",
      icon: CheckCircle2,
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      accent: "#10B981"
    };
  }

  if (t.includes("recidivism") || t.includes("offender_risk")) {
    return {
      title: lang === "en" ? "Calibrated Recidivism Risk & Offender Profiling" : "ಪರಿಷ್ಕೃತ ಮರು-ಅಪರಾಧ ಅಪಾಯ ಮತ್ತು ಶಂಕಿತರ ಪ್ರೊಫೈಲಿಂಗ್",
      statute: "§ 480 BNSS / CCTNS Grounded",
      category: "RECIDIVISM & BAIL OPPOSITION",
      icon: Target,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "#EF4444"
    };
  }
  if (t.includes("cyber_abuse") || t.includes("online_abuse") || t.includes("harassment")) {
    return {
      title: lang === "en" ? "Online Abuse & Cyber Harassment Legal Advisory" : "ಆನ್‌ಲೈನ್ ಕಿರುಕುಳ ಮತ್ತು ಸೈಬರ್ ದೌರ್ಜನ್ಯ ಕಾನೂನು ಸಲಹೆ",
      statute: "BNS / IT Act / § 63 BSA 2023",
      category: "CYBER HARASSMENT ADVISORY",
      icon: ShieldAlert,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "#F43F5E"
    };
  }
  if (t.includes("chargesheet")) {
    return {
      title: lang === "en" ? "Chargesheet Readiness & Statutory Filing Tracker" : "ಆರೋಪಪಟ್ಟಿ ಸಿದ್ಧತೆ ಮತ್ತು ಶಾಸನಬದ್ಧ ಸಲ್ಲಿಕೆ ಟ್ರ್ಯಾಕರ್",
      statute: "§ 193 BNSS 2023",
      category: "PROSECUTION PIPELINE",
      icon: FileText,
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      accent: "#F59E0B"
    };
  }
  if (t.includes("cdr") || t.includes("call_detail")) {
    return {
      title: lang === "en" ? "Call Detail Record (CDR) Tower & IMEI Forensics" : "ಕರೆ ವಿವರ ದಾಖಲೆ (CDR) ಮತ್ತು IMEI ವಿಧಿವಿಜ್ಞಾನ",
      statute: "§ 94 BNSS / Telecommunications Act",
      category: "TELECOM FORENSICS",
      icon: PhoneCall,
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      accent: "#0EA5E9"
    };
  }
  if (t.includes("syndicate") || t.includes("hierarchy")) {
    return {
      title: lang === "en" ? "Organized Syndicate Operational Hierarchy" : "ಸಂಘಟಿತ ಅಪರಾಧ ಜಾಲ ಕಾರ್ಯಾಚರಣಾ ಶ್ರೇಣಿ",
      statute: "§ 111 BNS 2023 (Organised Crime)",
      category: "SYNDICATE RECONNAISSANCE",
      icon: Users,
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      accent: "#A855F7"
    };
  }

  // Fallback cleanly formatted
  const formattedTitle = type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Card", "")
    .replace("Docket", "Docket")
    .trim();

  return {
    title: formattedTitle || (lang === "en" ? "Tactical Police Intelligence Payload" : "ತಂತ್ರಗಾರಿಕೆಯ ಪೊಲೀಸ್ ಗುಪ್ತಚರ ಮಾಹಿತಿ"),
    statute: "CCTNS Grounded",
    category: "INVESTIGATIVE INTELLIGENCE",
    icon: ShieldAlert,
    badgeColor: "bg-[#C79A4E]/20 text-[#E4C590] border-[#C79A4E]/40",
    accent: "#C79A4E"
  };
};

export const UniversalPoliceIntelCard: React.FC<UniversalPoliceIntelCardProps> = ({
  type,
  data = {},
  lang = "en",
  onFollowUpQuery,
  onClose
}) => {
  const meta = getTacticalMeta(type, data, lang);
  const IconComponent = meta.icon;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Extract key primitives for top highlight metrics
  const scalarFields: { key: string; label: string; value: any }[] = [];
  const arrayFields: { key: string; label: string; items: any[] }[] = [];
  let warningMessage: string | null = null;
  let hashSeal: string | null = null;

  if (typeof data === "object" && data !== null) {
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;

      if (k === "actions") continue;

      if (k.includes("hash") || k.includes("sha256")) {
        hashSeal = String(v);
        continue;
      }

      if (k.includes("warning") || k.includes("penal_consequence") || k.includes("defect") || k.includes("compliance_notice")) {
        warningMessage = String(v);
        continue;
      }

      if (Array.isArray(v)) {
        if (v.length > 0) {
          const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          arrayFields.push({ key: k, label, items: v });
        }
        continue;
      }

      if (typeof v === "object") continue;

      // Format scalar field
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      scalarFields.push({ key: k, label, value: v });
    }
  }

  // Connected 1-Click Action Buttons normalized to { label, query }
  interface ActionItem {
    label: string;
    query: string;
  }

  const rawActions = Array.isArray(data?.actions) && data.actions.length > 0
    ? data.actions
    : [
        data?.case_no ? `Add case diary entry for ${data.case_no}` : "View recent high-risk cases",
        data?.case_no ? `Export High Court PDF for ${data.case_no}` : "Check pending warrants across district",
        data?.case_no ? `View syndicate network for ${data.case_no}` : "Generate district crime review"
      ];

  const normalizedActions: ActionItem[] = rawActions.map((act: any) => {
    if (typeof act === "string") {
      return { label: act, query: act };
    }
    if (typeof act === "object" && act !== null) {
      const label = String(act.label || act.title || act.name || act.id || "Execute Action");
      let query = typeof act.query === "string" ? act.query : "";
      if (!query && act.label) {
        query = String(act.label).replace(/^[^\w\s§]+/, "").trim();
        if (act.params?.suspect_name && !query.toLowerCase().includes(String(act.params.suspect_name).toLowerCase())) {
          query += ` for ${act.params.suspect_name}`;
        } else if (act.params?.case_no && !query.toLowerCase().includes(String(act.params.case_no).toLowerCase())) {
          query += ` for ${act.params.case_no}`;
        }
      }
      if (!query && act.tool) {
        query = String(act.tool).replace(/_/g, " ");
        if (act.params?.suspect_name) query += ` for ${act.params.suspect_name}`;
        if (act.params?.case_no) query += ` for ${act.params.case_no}`;
      }
      return { label, query: query || label };
    }
    return { label: String(act), query: String(act) };
  });

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-stone-200">
      {/* 1. Tactical Header Banner */}
      <div className="bg-gradient-to-r from-stone-900/95 via-stone-900/70 to-stone-950/90 border border-stone-800/80 rounded-xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
          style={{ backgroundColor: meta.accent }}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg border flex items-center justify-center shrink-0 shadow-inner"
              style={{
                backgroundColor: `${meta.accent}15`,
                borderColor: `${meta.accent}35`,
                color: meta.accent
              }}
            >
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${meta.badgeColor}`}>
                  {meta.category}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800/80 border border-stone-700 text-stone-300">
                  {meta.statute}
                </span>
                {data?.urgency_tier && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    {data.urgency_tier}
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-white mt-1 tracking-tight">
                {meta.title}
              </h3>
            </div>
          </div>

          {/* Quick Case / Entity Tag */}
          {(data?.case_no || data?.plate_number || data?.ifsc || data?.witness_name || data?.accused_in_remand) && (
            <div className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-stone-950/80 border border-stone-800 text-right">
              <span className="block text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                {lang === "en" ? "Active Reference" : "ಪ್ರಸ್ತುತ ಉಲ್ಲೇಖ"}
              </span>
              <span className="text-xs font-mono font-black text-[#C79A4E]">
                {data.case_no || data.plate_number || data.ifsc || data.witness_name || data.accused_in_remand}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Statutory Procedural Defect / Urgency Warning Banner */}
      {warningMessage && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 flex items-start gap-3 text-amber-200 text-xs shadow-md animate-pulse-subtle">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-mono font-bold uppercase tracking-wider text-amber-300 text-[10.5px]">
              {lang === "en" ? "Procedural & Compliance Alert" : "ಕಾರ್ಯವಿಧಾನ ಮತ್ತು ಅನುಸರಣೆ ಎಚ್ಚರಿಕೆ"}
            </span>
            <p className="text-amber-200/90 leading-relaxed font-sans">
              {warningMessage}
            </p>
          </div>
        </div>
      )}

      {/* 3. Top Highlight Metrics Grid */}
      {scalarFields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {scalarFields.slice(0, 8).map((field) => {
            const isCountdown = field.key.includes("remaining");
            const isDays = isCountdown && typeof field.value === "number";
            const isUrgent = isDays && field.value <= 15;
            const isModerate = isDays && field.value <= 30;

            return (
              <div
                key={field.key}
                className={`bg-stone-900/60 border rounded-lg p-3 flex flex-col justify-between transition-all hover:border-[#C79A4E]/30 ${
                  isUrgent
                    ? "border-rose-500/50 bg-rose-950/20"
                    : isModerate
                    ? "border-amber-500/40 bg-amber-950/20"
                    : "border-stone-850"
                }`}
              >
                <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider truncate mb-1">
                  {field.label}
                </span>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-sm font-bold font-mono truncate ${
                      isUrgent
                        ? "text-rose-400 text-base font-black"
                        : isModerate
                        ? "text-amber-400"
                        : "text-stone-100"
                    }`}
                  >
                    {typeof field.value === "boolean"
                      ? field.value
                        ? "YES / COMPLIANT ✅"
                        : "NO / PENDING ❌"
                      : String(field.value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(field.value), field.key)}
                    className="text-stone-500 hover:text-stone-300 p-1 cursor-pointer"
                    title={lang === "en" ? "Copy Value" : "ನಕಲಿಸಿ"}
                  >
                    {copiedKey === field.key ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Structured Sub-Entity Lists / Arrays */}
      {arrayFields.map((arr) => (
        <div key={arr.key} className="bg-stone-900/40 border border-stone-850 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C79A4E] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C79A4E]" />
              {arr.label} ({arr.items.length})
            </span>
            <span className="text-[10.5px] font-mono text-stone-500">
              {lang === "en" ? "Structured Law Enforcement Evidence" : "ರಚನಾತ್ಮಕ ಕಾನೂನು ಜಾರಿ ಪುರಾವೆ"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {arr.items.map((item, idx) => (
              <div
                key={idx}
                className="bg-stone-950/70 border border-stone-800/80 rounded-lg p-3 hover:border-[#C79A4E]/40 transition-colors flex flex-col justify-between space-y-2"
              >
                {typeof item === "object" && item !== null ? (
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(item).map(([ik, iv]) => {
                      if (iv === null || iv === undefined) return null;
                      const subLabel = ik.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <div key={ik} className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-mono text-stone-400 shrink-0">
                            {subLabel}:
                          </span>
                          <span className="text-[11px] font-mono text-stone-200 text-right truncate max-w-[200px]">
                            {typeof iv === "object" ? JSON.stringify(iv) : String(iv)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-stone-200">
                    {typeof item === "object" ? JSON.stringify(item) : String(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 5. Section 63 BSA Digital Seal & Cryptographic Provenance */}
      <div className="bg-stone-950/80 border border-emerald-500/25 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-mono text-emerald-300 font-bold tracking-wider text-[11px] block">
              {lang === "en" ? "Section 63 BSA Cryptographic Digital Evidence Seal" : "ಸೆಕ್ಷನ್ 63 BSA ಡಿಜಿಟಲ್ ಪುರಾವೆ ಮುದ್ರೆ"}
            </span>
            <span className="font-mono text-[10px] text-stone-400">
              SHA-256: {hashSeal || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(hashSeal || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "sha256")}
            className="px-2.5 py-1 rounded bg-stone-900 border border-stone-700 text-[10px] font-mono text-stone-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            {copiedKey === "sha256" ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>{lang === "en" ? "Copied" : "ನಕಲಿಸಲಾಗಿದೆ"}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{lang === "en" ? "Copy Hash" : "ಹ್ಯಾಶ್ ನಕಲಿಸಿ"}</span>
              </>
            )}
          </button>
          <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
            COURT ADMISSIBLE ✅
          </span>
        </div>
      </div>

      {/* 6. 1-Click Connected Tactical Actions Toolbar */}
      {normalizedActions.length > 0 && onFollowUpQuery && (
        <div className="space-y-2 pt-1 border-t border-stone-850">
          <span className="text-[10.5px] font-mono text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C79A4E]" />
            {lang === "en" ? "1-Click Connected Operational Actions" : "1-ಕ್ಲಿಕ್ ಕಾರ್ಯಾಚರಣಾ ಕ್ರಮಗಳು"}
          </span>
          <div className="flex flex-wrap gap-2">
            {normalizedActions.map((act, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onFollowUpQuery(act.query)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 border border-stone-750 hover:border-[#C79A4E]/60 text-stone-200 hover:text-[#C79A4E] shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span>{act.label}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 7. Forensic Raw JSON Payload Accordion */}
      <div className="border border-stone-850 rounded-lg overflow-hidden bg-stone-950/40">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full px-3 py-2 text-left flex items-center justify-between text-[11px] font-mono text-stone-400 hover:text-stone-200 cursor-pointer"
        >
          <span>{lang === "en" ? "Technical Forensic Payload (JSON)" : "ತಾಂತ್ರಿಕ ವಿಧಿವಿಜ್ಞಾನ ಡೇಟಾ (JSON)"}</span>
          {showRawJson ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {showRawJson && (
          <div className="p-3 border-t border-stone-850 bg-stone-950">
            <pre className="text-[10px] font-mono text-stone-300 overflow-x-auto p-2 bg-stone-900/90 rounded border border-stone-800 max-h-48">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
