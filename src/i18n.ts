export type Language = 'en' | 'kn';

export interface Translations {
  title: string;
  subtitle: string;
  ksp: string;
  scrb: string;
  tagline: string;
  landingDesc: string;
  signIn: string;
  badgeNo: string;
  password: string;
  loginButton: string;
  loginHeader: string;
  credentialError: string;
  langSelect: string;
  landingHeroTitle: string;
  landingHeroSub: string;
  capabilitiesTitle: string;
  capabilityVoice: string;
  capabilityVoiceDesc: string;
  capabilityGraph: string;
  capabilityGraphDesc: string;
  capabilityHotspot: string;
  capabilityHotspotDesc: string;
  capabilityRisk: string;
  capabilityRiskDesc: string;
  footerRights: string;
  navLogin: string;
  navChat: string;
  navSpatial: string;
  navSearch: string;
  navReports: string;
  navSupervisor: string;
  navAudit: string;
  navSettings: string;
  chatPlaceholder: string;
  voiceListening: string;
  thinkingIndicator: string;
  simulatedModeWarning: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: "VAJRA Copilot Hub",
    subtitle: "KSP Core Intelligence Platform",
    ksp: "Karnataka State Police",
    scrb: "State Crime Records Bureau (SCRB)",
    tagline: "Grounded AI Copilot & Real-time Location/Relational Investigation Engine",
    landingDesc: "VAJRA is a secure conversational AI platform built for the Karnataka State Police. It empowers senior officers and field investigators to query the secure CCTNS register, reconstruct criminal network graphs, identify spatial crime hotspots, and review explainable re-offending risk assessments.",
    signIn: "Sign In to Console",
    badgeNo: "Badge ID (7-Digit KGID)",
    password: "Password / Key",
    loginButton: "Authenticate Badge",
    loginHeader: "Authorized Personnel Access Port",
    credentialError: "Invalid credentials. Authorized personnel only.",
    langSelect: "Language / ಭಾಷೆ",
    landingHeroTitle: "Karnataka State Police Automated Inquest & Relational Analysis",
    landingHeroSub: "Secure government-grade artificial intelligence engine integrated with Crime and Criminal Tracking Network & Systems (CCTNS).",
    capabilitiesTitle: "Core Tactical Capabilities",
    capabilityVoice: "Bilingual Semantic AI",
    capabilityVoiceDesc: "Execute advanced inquiries in natural English or native Kannada voice/text. Responses are mathematically grounded to official SCRB databases with exact file source attributes.",
    capabilityGraph: "Entity GraphRAG (Neo4j)",
    capabilityGraphDesc: "Map multi-hop interactions between suspects, associated physical assets, phone numbers, and past co-accused directories with depth filtering controls.",
    capabilityHotspot: "Algorithmic Spatial Hotspots",
    capabilityHotspotDesc: "Examine critical density directly plotting localized past incidents by sub-division level.",
    capabilityRisk: "Explainable Risk Profiling",
    capabilityRiskDesc: "Assess re-offending thresholds utilizing calibrated XGBoost pipelines with interactive SHAP local waterfalls highlighting predictive factors.",
    footerRights: "© 2026 Karnataka State Police (SCRB). All rights reserved. Class I Classified System.",
    navLogin: "Secure Portal",
    navChat: "AI Copilot Hub",
    navSpatial: "Spatial Analyst",
    navSearch: "FIR Repository",
    navReports: "Demographic Correlation",
    navSupervisor: "Supervisor Dashboard",
    navAudit: "Immutable Audit Ledger",
    navSettings: "System Settings",
    chatPlaceholder: "Ask VAJRA (e.g. 'Assess conviction risk for Ramesh' or 'Plot crime hotspots')...",
    voiceListening: "Listening to Karnataka voice feed...",
    thinkingIndicator: "VAJRA is reasoning over CCTNS registers...",
    simulatedModeWarning: "AI reasoning service degraded — showing offline simulated response",
  },
  kn: {
    title: "ವಜ್ರ ಕೊಪೈಲಟ್ ಹಬ್",
    subtitle: "KSP ಮುಖ್ಯ ಗುಪ್ತಚಾರ ವೇದಿಕೆ",
    ksp: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್",
    scrb: "ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆಗಳ ಬ್ಯೂರೋ (SCRB)",
    tagline: "ಸ್ಥಳೀಯ ತನಿಖೆ ಮತ್ತು ನೈಜ-ಸಮಯದ ಪ್ರಾದೇಶಿಕ/ನೆಟ್‌ವರ್ಕ್ ವಿಶ್ಲೇಷಣಾ ಇಂಜಿನ್",
    landingDesc: "ವಜ್ರವು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸರಿಗಾಗಿ ನಿರ್ಮಿಸಲಾದ ಸುರಕ್ಷಿತ ಸಂಭಾಷಣಾತ್ಮಕ AI ವೇದಿಕೆಯಾಗಿದೆ. ಇದು ಹಿರಿಯ ಅಧಿಕಾರಿಗಳು ಮತ್ತು ತನಿಖಾಧಿಕಾರಿಗಳಿಗೆ ಸುರಕ್ಷಿತ CCTNS ನೋಂದಣಿಯಿಂದ ಪ್ರಕರಣಗಳನ್ನು ಪ್ರಶ್ನಿಸಲು, ಅಪರಾಧ ನೆಟ್‌ವರ್ಕ್ ನಕ್ಷೆಗಳನ್ನು ಪುನರ್ನಿರ್ಮಿಸಲು, ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ಗುರುತಿಸಲು ಮತ್ತು ವಿವರಣಾತ್ಮಕ ಮರು-ಅಪರಾಧ ಅಪಾಯದ ಮೌಲ್ಯಮಾಪನಗಳನ್ನು ಮುನ್ಸೂಚಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
    signIn: "ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ",
    badgeNo: "ಗುರುತಿನ ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ (KGID)",
    password: "ರಹಸ್ಯಪದ / ಪಾಸ್‌ವರ್ಡ್",
    loginButton: "ಬ್ಯಾಡ್ಜ್ ದೃಢೀಕರಿಸಿ",
    loginHeader: "ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ಪ್ರವೇಶ ದ್ವಾರ",
    credentialError: "ಅಮಾನ್ಯ ರುಜುವಾತುಗಳು. ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿಗೆ ಮಾತ್ರ ಪ್ರವೇಶ.",
    langSelect: "ಭಾಷೆ / Language",
    landingHeroTitle: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ಸ್ವಯಂಚಾಲಿತ ತನಿಖೆ ಮತ್ತು ನೆಟ್‌ವರ್ಕ್ ವಿಶ್ಲೇಷಣೆ",
    landingHeroSub: "CCTNS ಸಹಯೋಗದೊಂದಿಗೆ ಸಂಯೋಜಿಸಲ್ಪಟ್ಟ ಸುರಕ್ಷಿತ ಸರ್ಕಾರಿ-ದರ್ಜೆಯ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಇಂಜಿನ್.",
    capabilitiesTitle: "Tactical ಸಾಮರ್ಥ್ಯಗಳು",
    capabilityVoice: "ದ್ವಿಭಾಷಾ ಶಬ್ದಾರ್ಥದ AI",
    capabilityVoiceDesc: "ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡ ಧ್ವನಿ/ಪಠ್ಯದಲ್ಲಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಚಲಾಯಿಸಿ. ಪ್ರತಿಕ್ರಿಯೆಗಳು ಮೂಲ ದಾಖಲೆಗಳ ಗುಣಲಕ್ಷಣಗಳೊಂದಿಗೆ ಅಧಿಕೃತ ಎಸ್‌ಸಿಆರ್‌ಬಿ ಡೇಟಾಬೇಸ್‌ಗಳಿಗೆ ದೃಢವಾಗಿರುತ್ತವೆ.",
    capabilityGraph: "ಗ್ರಾಫ್‌ಆರ್‌ಎಜಿ ನೆಟ್‌ವರ್ಕ್",
    capabilityGraphDesc: "ಆರೋಪಿಗಳು, ಫೋನ್‌ಗಳು ಮತ್ತು ವಾಹನಗಳ ನಡುವಿನ ಬಹು-ಹಂತದ ಸಂಪರ್ಕಗಳನ್ನು ಮ್ಯಾಪ್ ಮಾಡಿ.",
    capabilityHotspot: "ಪ್ರಾದೇಶಿಕ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
    capabilityHotspotDesc: "ಸ್ಥಳೀಯ ಅಪರಾಧ ಸಾಂದ್ರತೆ ಮತ್ತು ವಲಯವಾರು ಇತಿಹಾಸವನ್ನು ವಿಶ್ಲೇಷಿಸಿ.",
    capabilityRisk: "ಅಪರಾಧ ಅಪಾಯದ ವಿವರ",
    capabilityRiskDesc: "XGBoost ಇಂಜಿನ್ ಮತ್ತು SHAP ಜಲಪಾತದೊಂದಿಗೆ ಆರೋಪಿಗಳ ಅಪರಾಧ ಅಪಾಯದ ವಿಶ್ಲೇಷಣೆ ನಡೆಸಿ.",
    footerRights: "© 2026 ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ (SCRB). ಎಲ್ಲ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
    navLogin: "ಸುರಕ್ಷಿತ ಪ್ರವೇಶ",
    navChat: "AI ಕಾಪೈಲಟ್ ಹಬ್",
    navSpatial: "ಸ್ಥಳೀಯ ವಿಶ್ಲೇಷಕ",
    navSearch: "FIR ದಾಖಲೆಗಳು",
    navReports: "ಅಪರಾಧ ಅಂಕಿಅಂಶ",
    navSupervisor: "ಮೇಲ್ವಿಚಾರಕರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    navAudit: "ಅಸ್ಥಿರವಲ್ಲದ ದಾಖಲೆ ಲಾಗ್",
    navSettings: "ಸಿಸ್ಟಮ್ ಸೆಟ್ಟಿಂಗ್ಗಳು",
    chatPlaceholder: "ಪ್ರಶ್ನೆ ಕೇಳಿ (ಉದಾಹರಣೆಗೆ: 'ರಮೇಶ್ ಅಪರಾಧದ ಅಪಾಯ ವಿಶ್ಲೇಷಿಸು' ಅಥವಾ 'ಅಪರಾಧದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ')...",
    voiceListening: "ಕನ್ನಡ ಧ್ವನಿ ಸಂಜ್ಞೆ ಆಲಿಸಲಾಗುತ್ತಿದೆ...",
    thinkingIndicator: "ವಜ್ರ ಸಿಬ್ಬಂದಿ CCTNS ದಾಖಲೆಗಳನ್ನು ಹುಡುಕುತ್ತಿದ್ದಾರೆ...",
    simulatedModeWarning: "AI ತಾರ್ಕಿಕ ಸೇವೆ ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ — ಸ್ಥಳೀಯ ಆಫ್‌ಲೈನ್ ಸಿಮ್ಯುಲೇಟೆಡ್ ಉತ್ತರ ತೋರಿಸಲಾಗುತ್ತಿದೆ",
  }
};
