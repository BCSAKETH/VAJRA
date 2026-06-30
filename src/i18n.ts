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
  navLanding: string;
  navLogin: string;
  navDashboard: string;
  navChat: string;
  navSpatial: string;
  navNetwork: string;
  navCase: string;
  navAccused: string;
  navSearch: string;
  navAlerts: string;
  navReports: string;
  navAudit: string;
  navSettings: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: "VAJRA Intelligence Platform",
    subtitle: "KSP Datathon 2026 Core Intelligence Prototypes",
    ksp: "Karnataka State Police",
    scrb: "State Crime Records Bureau (SCRB)",
    tagline: "Grounded Cognition & Real-time Spatial/Relational Investigation Engine",
    landingDesc: "VAJRA is a secure conversational AI platform built for the Karnataka State Police. It empowers senior officers and field investigators to query 1.6M+ historical records, reconstruct criminal network graphs, identify spatial crime hotspots using DBSCAN/KDE, and review explainable re-offending risk assessments with SHAP feedback.",
    signIn: "Sign In to Console",
    badgeNo: "Badge ID / Badge Number",
    password: "Password / Key",
    loginButton: "Authenticate Badge",
    loginHeader: "Authorised Personnel Access Port",
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
    capabilityHotspotDesc: "Examine critical density with automated DBSCAN and Kernel Density Estimation (KDE) directly plotting localized past incidents by sub-division level.",
    capabilityRisk: "Explainable Risk Profiling",
    capabilityRiskDesc: "Assess re-offending thresholds utilizing calibrated XGBoost pipelines with interactive SHAP local waterfalls highlighting predictive factors.",
    footerRights: "© 2026 Karnataka State Police (SCRB). All rights reserved. Class I Classified System.",
    navLanding: "Landing Page",
    navLogin: "Secure Portal",
    navDashboard: "Command Center",
    navChat: "Bilingual AI Chat",
    navSpatial: "Spatial Analyst",
    navNetwork: "Network GraphRAG",
    navCase: "Intelligence Workspace",
    navAccused: "Subject Dossier",
    navSearch: "FIR Repository",
    navAlerts: "AI Live Feed",
    navReports: "Demographic Correlation",
    navAudit: "Immutable Logs",
    navSettings: "System Settings",
  },
  kn: {
    title: "ವಜ್ರ ಇಂಟೆಲಿಜೆನ್ಸ್ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್",
    subtitle: "KSP ದತ್ತಾಂಶ ಹ್ಯಾಕಥಾನ್ 2026 ಮುಖ್ಯ ಗುಪ್ತಚಾರ ಮಾದರಿ",
    ksp: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್",
    scrb: "ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆಗಳ ಬ್ಯೂರೋ (SCRB)",
    tagline: "ಸ್ಥಳೀಯ ತನಿಖೆ ಮತ್ತು ನೈಜ-ಸಮಯದ ಪ್ರಾದೇಶಿಕ/ನೆಟ್‌ವರ್ಕ್ ವಿಶ್ಲೇಷಣಾ ಇಂಜಿನ್",
    landingDesc: "ವಜ್ರವು ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸರಿಗಾಗಿ ನಿರ್ಮಿಸಲಾದ ಸುರಕ್ಷಿತ ಸಂಭಾಷಣಾತ್ಮಕ AI ವೇದಿಕೆಯಾಗಿದೆ. ಇದು ಹಿರಿಯ ಅಧಿಕಾರಿಗಳು ಮತ್ತು ತನಿಖಾಧಿಕಾರಿಗಳಿಗೆ 1.6 ಮಿಲಿಯನ್‌ಗಿಂತಲೂ ಹೆಚ್ಚು ಐತಿಹಾಸಿಕ ದಾಖಲೆಗಳನ್ನು ಪ್ರಶ್ನಿಸಲು, ಅಪರಾಧ ನೆಟ್‌ವರ್ಕ್ ನಕ್ಷೆಗಳನ್ನು ಪುನರ್ನಿರ್ಮಿಸಲು, DBSCAN/KDE ಬಳಸಿ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ಗುರುತಿಸಲು ಮತ್ತು SHAP ತಂತ್ರಜ್ಞಾನದ ಮೂಲಕ ವಿವರಣಾತ್ಮಕ ಮರು-ಅಪರಾಧ ಅಪಾಯದ ಮೌಲ್ಯಮಾಪನಗಳನ್ನು ಮುನ್ಸೂಚಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
    signIn: "ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ",
    badgeNo: "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ / ಗುರುತಿನ ಚೀಟಿ",
    password: "ರಹಸ್ಯಪದ / ಪಾಸ್‌ವರ್ಡ್",
    loginButton: "ಬ್ಯಾಡ್ಜ್ ದೃಢೀಕರಿಸಿ",
    loginHeader: "ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ಪ್ರವೇಶ ದ್ವಾರ",
    credentialError: "ಅಮಾನ್ಯ ರುಜುವಾತುಗಳು. ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿಗೆ ಮಾತ್ರ ಪ್ರವೇಶ.",
    langSelect: "ಭಾಷೆ / Language",
    landingHeroTitle: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ಸ್ವಯಂಚಾಲಿತ ತನಿಖೆ ಮತ್ತು ನೆಟ್‌ವರ್ಕ್ ವಿಶ್ಲೇಷಣೆ",
    landingHeroSub: "ಸಿಐಎಸ್ (CCTNS) ಸಹಯೋಗದೊಂದಿಗೆ ಸಂಯೋಜಿಸಲ್ಪಟ್ಟ ಸುರಕ್ಷಿತ ಸರ್ಕಾರಿ-ದರ್ಜೆಯ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಇಂಜಿನ್.",
    capabilitiesTitle: "ಮುಖ್ಯ ಕಾರ್ಯಾಚರಣೆಯ ಸಾಮರ್ಥ್ಯಗಳು",
    capabilityVoice: "ದ್ವಿಭಾಷಾ ಸೆಮ್ಯಾಂಟಿಕ್ AI",
    capabilityVoiceDesc: "ಸಹಜ ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡ ಧ್ವನಿ/ಪಠ್ಯದಲ್ಲಿ ಸುಧಾರಿತ ವಿಚಾರಣೆಗಳನ್ನು ನಡೆಸಿ. ಪ್ರತಿಕ್ರಿಯೆಗಳು ನಿಖರವಾದ SCRB ಡೇಟಾಬೇಸ್‌ಗಳಿಗೆ ಸಾಕ್ಷ್ಯಗಳೊಂದಿಗೆ ಲಿಂಕ್ ಆಗಿರುತ್ತವೆ.",
    capabilityGraph: "ನೆಟ್‌ವರ್ಕ್ ಗ್ರಾಫ್‌ಆರ್‌ಎಜಿ (Neo4j)",
    capabilityGraphDesc: "ಸಂಶಯಾಸ್ಪದ ವ್ಯಕ್ತಿಗಳು, ವಾಹನಗಳು, ಪೋನ್ ನಂಬರ್‌ಗಳು ಮತ್ತು ಸಹ-ಆರೋಪಿಗಳ ನಡುವಿನ ಸಂಬಂಧಗಳನ್ನು ನಕ್ಷೆಯ ಮೂಲಕ ತನಿಖೆ ಮಾಡಿ.",
    capabilityHotspot: "ಪ್ರಾದೇಶಿಕ ಹಾಟ್‌ಸ್ಪಾಟ್ ವಿಶ್ಲೇಷಣೆ",
    capabilityHotspotDesc: "ಸ್ವಯಂಚಾಲಿತ DBSCAN ಮತ್ತು KDE ಬಳಸಿ ನಿರ್ದಿಷ್ಟ ಪೊಲೀಸ್ ಠಾಣಾ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ಅಪರಾಧ ಸಾಂದ್ರತೆಯನ್ನು ಗುರುತಿಸಿ.",
    capabilityRisk: "ವಿವರಣಾತ್ಮಕ ಅಪಾಯದ ಸ್ಕೋರಿಂಗ್",
    capabilityRiskDesc: "XGBoost ಇಂಜಿನ್ ಮತ್ತು SHAP ವಾಟರ್‌ಫಾಲ್ ಬಳಸಿ ಆರೋಪಿಯ ಮರು-ಅಪರಾಧ ಸಾಧ್ಯತೆಯನ್ನು ಪ್ರಮುಖ ಅಪರಾಧ ಕಾರಣಗಳೊಂದಿಗೆ ವಿಶ್ಲೇಷಿಸಿ.",
    footerRights: "© 2026 ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ (SCRB). ಎಲ್ಲ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ. ವರ್ಗೀಕೃತ ವ್ಯವಸ್ಥೆ.",
    navLanding: "ಮುಖಪುಟ",
    navLogin: "ಸುರಕ್ಷಿತ ಲಾಗಿನ್",
    navDashboard: "ನಿಯಂತ್ರಣ ಕೊಠಡಿ",
    navChat: "ದ್ವಿಭಾಷಾ AI ಚಾಟ್",
    navSpatial: "ಪ್ರಾದೇಶಿಕ ವಿಶ್ಲೇಷಣೆ",
    navNetwork: "ನೆಟ್‌ವರ್ಕ್ ಗ್ರಾಫ್",
    navCase: "ಕಾರ್ಯಸ್ಥಳ",
    navAccused: "ಆರೋಪಿ ಪ್ರೊಫೈಲ್",
    navSearch: "FIR ಹುಡುಕಾಟ",
    navAlerts: "AI ಅಲರ್ಟ್‌ಗಳು",
    navReports: "ಅಂಕಿ-ಅಂಶಗಳ ವರದಿ",
    navAudit: "ಬದಲಾಯಿಸಲಾಗದ ಲಾಗ್‌ಗಳು",
    navSettings: "ಸಿಸ್ಟಮ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
  }
};
