import React from "react";

/**
 * Statutory SVG Path Registry for Indian Penal and Procedural Law.
 * Exact Lucide vector coordinates ensuring lossless rendering for
 * court-bound SmartBrowz PDF exports and high-DPI tactical displays.
 */
export const STATUTORY_SVG_PATHS: Record<string, string> = {
  // Sec 303 BNS / 379 IPC (Theft / Property Crimes)
  bns_303: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  // Sec 111 BNS (Organized Crime Syndicate)
  bns_111: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87",
  // Sec 63 BSA (Electronic Evidence Chain of Custody)
  bsa_63: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  // Sec 187 BNSS (Statutory Remand 60/90 Day Countdown)
  bnss_187: "M12 8v4l3 3 M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5",
  // Sec 173 BNSS (CCTNS Cognizable FIR Registration)
  bnss_173: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  // Sec 193 BNSS (Case Diary & Chargesheet Readiness)
  bnss_193: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z M6 6h10 M6 10h10",
  // Sec 105 BNSS (Malkhana Seized Property / Search & Seizure)
  bnss_105: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7l8.7 5 8.7-5 M12 22V12",
  // Sec 480 BNSS (Bail Opposition / Prosecutor Docket)
  bnss_480: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M7 21h10 M12 3v18 M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",
  // Sec 66 IT Act / Cyber Fraud Freezing
  it_66: "M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z M7 7h.01",
  // Vahan RTO (Vehicle Seizure Telemetry)
  transport_vahan: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2",
};

/**
 * Normalizes user-facing statute strings into canonical dictionary keys.
 */
export function normalizeStatuteCode(rawCode?: string): string {
  if (!rawCode) return "bsa_63";

  const clean = rawCode.toLowerCase().replace(/[^a-z0-9_]/g, " ").trim();

  if (STATUTORY_SVG_PATHS[clean]) return clean;

  if (clean.includes("303") || clean.includes("theft") || clean.includes("379")) return "bns_303";
  if (clean.includes("111") || clean.includes("syndicate") || clean.includes("organized")) return "bns_111";
  if (clean.includes("63") || clean.includes("bsa") || clean.includes("electronic") || clean.includes("evidence")) return "bsa_63";
  if (clean.includes("187") || clean.includes("remand") || clean.includes("crpc")) return "bnss_187";
  if (clean.includes("173") || clean.includes("fir")) return "bnss_173";
  if (clean.includes("193") || clean.includes("diary") || clean.includes("chargesheet")) return "bnss_193";
  if (clean.includes("105") || clean.includes("451") || clean.includes("malkhana") || clean.includes("seizure")) return "bnss_105";
  if (clean.includes("480") || clean.includes("bail")) return "bnss_480";
  if (clean.includes("vahan") || clean.includes("vehicle") || clean.includes("rto")) return "transport_vahan";
  if (clean.includes("66") || clean.includes("cyber") || clean.includes("1930") || clean.includes("it")) return "it_66";

  return "bsa_63";
}

export interface StatuteIconProps {
  code?: string;
  className?: string;
  size?: number | string;
  stroke?: string;
  strokeWidth?: number;
  title?: string;
}

/**
 * StatuteIcon (Domain 6: Universal Statutory Iconography)
 * Renders raw, unpixelated inline <svg> vector paths directly into the DOM
 * guaranteeing 100% lossless resolution for court-bound SmartBrowz PDF exports.
 */
export const StatuteIcon: React.FC<StatuteIconProps> = ({
  code = "bsa_63",
  className = "w-6 h-6",
  size,
  stroke = "#C79A4E",
  strokeWidth = 2,
  title,
}) => {
  const normKey = normalizeStatuteCode(code);
  const pathD = STATUTORY_SVG_PATHS[normKey] || STATUTORY_SVG_PATHS.bsa_63;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label={title || `Statutory Icon: ${code}`}
      role="img"
    >
      {title && <title>{title}</title>}
      <path d={pathD} />
    </svg>
  );
};
