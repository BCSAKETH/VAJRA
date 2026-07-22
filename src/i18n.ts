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
  // Global chrome
  profileLabel: string;
  signOut: string;
  // Settings screen
  settingsDesc: string;
  settingsLangThemeTitle: string;
  settingsAppLanguage: string;
  settingsLangOptEn: string;
  settingsLangOptKn: string;
  settingsDisplayTheme: string;
  settingsThemeDark: string;
  settingsThemeLight: string;
  settingsDbDiagTitle: string;
  settingsZcqlLabel: string;
  settingsOnline: string;
  settingsOffline: string;
  settingsSecurityPoliciesTitle: string;
  settingsSessionTimeoutTitle: string;
  settingsPolicyEnforced: string;
  settingsTwoPersonTitle: string;
  settingsTwoPersonDesc: string;
  settingsControlEngaged: string;
  // Supervisor dashboard
  supervisorTitle: string;
  supervisorDesc: string;
  supervisorVerifyingHashes: string;
  supervisorVerifyLedger: string;
  supervisorLedgerResolvedLabel: string;
  supervisorLedgerResolvedBody: string;
  supervisorLedgerAlertLabel: string;
  supervisorLedgerAlertBody: string;
  supervisorConsistencyFlagsTitle: string;
  supervisorNoFlags: string;
  supervisorResolveDualControl: string;
  supervisorResolvedBySupervisor: string;
  supervisorAuditLedgerTitle: string;
  supervisorNoAuditLogs: string;
  supervisorQueryLabel: string;
  supervisorHashLabel: string;
  // Two-person approval modal
  tpTitle: string;
  tpActionLabel: string;
  tpWarning: string;
  tpSupervisorBadgeLabel: string;
  tpSupervisorPasswordLabel: string;
  tpCancel: string;
  tpVerifyApprove: string;
  tpVerifying: string;
  // Chat bubble
  aiUnavailableTitle: string;
  ttsStop: string;
  ttsRead: string;
  // Chat history panel
  newInvestigation: string;
  newChat: string;
  loadingLabel: string;
  noPastConversations: string;
  newConversationFallback: string;
  // Applet panel
  analysisPanel: string;
  noVisualizableData: string;
  noRows: string;
  noTimelineEvents: string;
  // Cowork invitations panel
  coworkInvitationsTitle: string;
  noPendingInvitations: string;
  invitedYouOnCase: string;
  onCaseLabel: string;
  accept: string;
  reject: string;
  // New investigation modal
  newInvestigationTitleRequired: string;
  couldNotCreateInvestigation: string;
  couldNotReachServer: string;
  titleLabel: string;
  descOptionalLabel: string;
  linkCaseOptionalLabel: string;
  creating: string;
  createInvestigation: string;
  investigationTitlePlaceholder: string;
  investigationDescPlaceholder: string;
  caseSearchPlaceholder: string;
  // AI chat screen
  chatHubTitle: string;
  chatHubDesc: string;
  exportPdf: string;
  translatingIndicator: string;
  micTitleAvailable: string;
  micTitleUnavailable: string;
  attachTitle: string;
  uploadingAttachments: string;
  chatModeChat: string;
  chatModeCowork: string;
  sharedSessionHint: string;
  inviteToCowork: string;
  badgeNumberKgidLabel: string;
  accessLevelLabel: string;
  viewerLabel: string;
  collaboratorLabel: string;
  viewerDesc: string;
  collaboratorDesc: string;
  sendInvitation: string;
  sendingInvitation: string;
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
    profileLabel: "Investigator Profile",
    signOut: "Sign Out",
    settingsDesc: "System diagnostics, security policies, and localization preferences.",
    settingsLangThemeTitle: "Language & Theme Preferences",
    settingsAppLanguage: "Application Language",
    settingsLangOptEn: "English (Bilingual)",
    settingsLangOptKn: "ಕನ್ನಡ (Kannada)",
    settingsDisplayTheme: "Display Theme",
    settingsThemeDark: "High Contrast Dark Mode",
    settingsThemeLight: "NIC Standard Light Mode",
    settingsDbDiagTitle: "Database Client Diagnostics",
    settingsZcqlLabel: "Zoho Catalyst ZCQL Client:",
    settingsOnline: "ONLINE (Catalyst serverless)",
    settingsOffline: "OFFLINE",
    settingsSecurityPoliciesTitle: "Active Security Policies",
    settingsSessionTimeoutTitle: "Session Timeout Limit",
    settingsPolicyEnforced: "⚠️ POLICY ENFORCED — READ ONLY",
    settingsTwoPersonTitle: "Two-Person Integrity (Dual-Control)",
    settingsTwoPersonDesc: "Critical adjustments, legal suggestions, and ledger overrides must be co-signed by an independent Supervisor's credentials.",
    settingsControlEngaged: "✓ CONTROL ENGAGED",
    supervisorTitle: "Supervisor Compliance Portal",
    supervisorDesc: "Dual-control authorization & cryptographic ledger verification.",
    supervisorVerifyingHashes: "Verifying hashes...",
    supervisorVerifyLedger: "Verify Ledger Chain",
    supervisorLedgerResolvedLabel: "CRYPTOGRAPHIC INTEGRITY RESOLVED:",
    supervisorLedgerResolvedBody: "AuditLog chain verified. All SHA-256 blocks are consistent.",
    supervisorLedgerAlertLabel: "SECURITY ALERT:",
    supervisorLedgerAlertBody: "AuditLog block hash verification failed. Tampering detected!",
    supervisorConsistencyFlagsTitle: "Legal Consistency Flags",
    supervisorNoFlags: "No unresolved consistency flags recorded.",
    supervisorResolveDualControl: "Resolve via Dual Control",
    supervisorResolvedBySupervisor: "✓ Resolved by Supervisor",
    supervisorAuditLedgerTitle: "Cryptographic Audit Ledger",
    supervisorNoAuditLogs: "No audit log records found.",
    supervisorQueryLabel: "Query:",
    supervisorHashLabel: "Hash:",
    tpTitle: "Two-Person Integrity Verification",
    tpActionLabel: "Action:",
    tpWarning: "This action requires secondary authorization from an officer with Supervisor clearance. Co-signing supervisor must verify credentials below.",
    tpSupervisorBadgeLabel: "Supervisor Badge No (7-Digit KGID)",
    tpSupervisorPasswordLabel: "Supervisor Password",
    tpCancel: "Cancel",
    tpVerifyApprove: "Verify & Approve",
    tpVerifying: "Verifying...",
    aiUnavailableTitle: "AI Temporarily Unavailable",
    ttsStop: "Stop reading aloud",
    ttsRead: "Read response aloud",
    newInvestigation: "New Investigation",
    newChat: "New Chat",
    loadingLabel: "Loading...",
    noPastConversations: "No past conversations yet.",
    newConversationFallback: "New Conversation",
    analysisPanel: "Analysis Panel",
    noVisualizableData: "No visualizable data for this turn yet.",
    noRows: "No rows.",
    noTimelineEvents: "No timeline events.",
    coworkInvitationsTitle: "Cowork Invitations",
    noPendingInvitations: "No pending invitations.",
    invitedYouOnCase: "invited you to a shared session",
    onCaseLabel: "on case",
    accept: "Accept",
    reject: "Reject",
    newInvestigationTitleRequired: "Title is required.",
    couldNotCreateInvestigation: "Could not create investigation.",
    couldNotReachServer: "Could not reach the server.",
    titleLabel: "Title",
    descOptionalLabel: "Description (optional)",
    linkCaseOptionalLabel: "Link a Case (optional)",
    creating: "Creating...",
    createInvestigation: "Create Investigation",
    investigationTitlePlaceholder: "e.g. Bengaluru East Theft Ring",
    investigationDescPlaceholder: "Brief notes on what this investigation covers...",
    caseSearchPlaceholder: "Search by case number (e.g. CR-2026)",
    chatHubTitle: "VAJRA Central Inquest Hub",
    chatHubDesc: "Log dialogues or speak in English/Kannada to query active CCTNS registers, analyze conviction risk indices, and plot spatial crime clusters.",
    exportPdf: "Export PDF",
    translatingIndicator: "Translating Kannada Voice Data...",
    micTitleAvailable: "Speak Kannada/English",
    micTitleUnavailable: "Voice input is not available — speech-to-text service is not yet configured",
    attachTitle: "Attach evidence (PDF or JPEG, max 3 files, 8MB each)",
    uploadingAttachments: "Uploading attachments...",
    chatModeChat: "Chat",
    chatModeCowork: "Cowork",
    sharedSessionHint: "Shared session — mention @vajra to ask the AI",
    inviteToCowork: "Invite to Cowork",
    badgeNumberKgidLabel: "Badge Number (7-digit KGID)",
    accessLevelLabel: "Access Level",
    viewerLabel: "Viewer",
    collaboratorLabel: "Collaborator",
    viewerDesc: "Can watch the thread, cannot send messages.",
    collaboratorDesc: "Can post messages and @vajra the AI.",
    sendInvitation: "Send Invitation",
    sendingInvitation: "Sending...",
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
    profileLabel: "ತನಿಖಾಧಿಕಾರಿ ಪ್ರೊಫೈಲ್",
    signOut: "ಸೈನ್ ಔಟ್",
    settingsDesc: "ಸಿಸ್ಟಮ್ ಡಯಾಗ್ನೋಸ್ಟಿಕ್ಸ್, ಭದ್ರತಾ ನೀತಿಗಳು ಮತ್ತು ಸ್ಥಳೀಕರಣ ಆದ್ಯತೆಗಳು.",
    settingsLangThemeTitle: "ಭಾಷೆ ಮತ್ತು ಥೀಮ್ ಆದ್ಯತೆಗಳು",
    settingsAppLanguage: "ಅಪ್ಲಿಕೇಶನ್ ಭಾಷೆ",
    settingsLangOptEn: "ಇಂಗ್ಲಿಷ್ (ದ್ವಿಭಾಷಾ)",
    settingsLangOptKn: "ಕನ್ನಡ (Kannada)",
    settingsDisplayTheme: "ಪ್ರದರ್ಶನ ಥೀಮ್",
    settingsThemeDark: "ಹೈ ಕಾಂಟ್ರಾಸ್ಟ್ ಡಾರ್ಕ್ ಮೋಡ್",
    settingsThemeLight: "NIC ಪ್ರಮಾಣಿತ ಲೈಟ್ ಮೋಡ್",
    settingsDbDiagTitle: "ಡೇಟಾಬೇಸ್ ಕ್ಲೈಂಟ್ ಡಯಾಗ್ನೋಸ್ಟಿಕ್ಸ್",
    settingsZcqlLabel: "Zoho Catalyst ZCQL ಕ್ಲೈಂಟ್:",
    settingsOnline: "ಆನ್‌ಲೈನ್ (Catalyst serverless)",
    settingsOffline: "ಆಫ್‌ಲೈನ್",
    settingsSecurityPoliciesTitle: "ಸಕ್ರಿಯ ಭದ್ರತಾ ನೀತಿಗಳು",
    settingsSessionTimeoutTitle: "ಅಧಿವೇಶನ ಅವಧಿ ಮಿತಿ",
    settingsPolicyEnforced: "⚠️ ನೀತಿ ಜಾರಿಯಲ್ಲಿದೆ — ಓದಲು ಮಾತ್ರ",
    settingsTwoPersonTitle: "ದ್ವಿ-ವ್ಯಕ್ತಿ ಸಮಗ್ರತೆ (ಡ್ಯುಯಲ್-ಕಂಟ್ರೋಲ್)",
    settingsTwoPersonDesc: "ನಿರ್ಣಾಯಕ ಬದಲಾವಣೆಗಳು, ಕಾನೂನು ಸಲಹೆಗಳು ಮತ್ತು ಲೆಡ್ಜರ್ ಮೀರಿಕೆಗಳಿಗೆ ಸ್ವತಂತ್ರ ಮೇಲ್ವಿಚಾರಕರ ರುಜುವಾತುಗಳ ಸಹಿ ಅಗತ್ಯವಿದೆ.",
    settingsControlEngaged: "✓ ನಿಯಂತ್ರಣ ಸಕ್ರಿಯವಾಗಿದೆ",
    supervisorTitle: "ಮೇಲ್ವಿಚಾರಕರ ಅನುಸರಣೆ ಪೋರ್ಟಲ್",
    supervisorDesc: "ಡ್ಯುಯಲ್-ಕಂಟ್ರೋಲ್ ಅನುಮತಿ ಮತ್ತು ಗುಪ್ತಲಿಪಿ ಲೆಡ್ಜರ್ ಪರಿಶೀಲನೆ.",
    supervisorVerifyingHashes: "ಹ್ಯಾಶ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
    supervisorVerifyLedger: "ಲೆಡ್ಜರ್ ಸರಪಳಿ ಪರಿಶೀಲಿಸಿ",
    supervisorLedgerResolvedLabel: "ಗುಪ್ತಲಿಪಿ ಸಮಗ್ರತೆ ಖಚಿತಪಡಿಸಲಾಗಿದೆ:",
    supervisorLedgerResolvedBody: "ಆಡಿಟ್‌ಲಾಗ್ ಸರಪಳಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಎಲ್ಲಾ SHA-256 ಬ್ಲಾಕ್‌ಗಳು ಸ್ಥಿರವಾಗಿವೆ.",
    supervisorLedgerAlertLabel: "ಭದ್ರತಾ ಎಚ್ಚರಿಕೆ:",
    supervisorLedgerAlertBody: "ಆಡಿಟ್‌ಲಾಗ್ ಬ್ಲಾಕ್ ಹ್ಯಾಶ್ ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ. ಮೋಸ ಪತ್ತೆಯಾಗಿದೆ!",
    supervisorConsistencyFlagsTitle: "ಕಾನೂನು ಸ್ಥಿರತೆ ಫ್ಲ್ಯಾಗ್‌ಗಳು",
    supervisorNoFlags: "ಬಗೆಹರಿಸದ ಸ್ಥಿರತೆ ಫ್ಲ್ಯಾಗ್‌ಗಳು ದಾಖಲಾಗಿಲ್ಲ.",
    supervisorResolveDualControl: "ಡ್ಯುಯಲ್ ಕಂಟ್ರೋಲ್ ಮೂಲಕ ಬಗೆಹರಿಸಿ",
    supervisorResolvedBySupervisor: "✓ ಮೇಲ್ವಿಚಾರಕರಿಂದ ಬಗೆಹರಿಸಲಾಗಿದೆ",
    supervisorAuditLedgerTitle: "ಗುಪ್ತಲಿಪಿ ಆಡಿಟ್ ಲೆಡ್ಜರ್",
    supervisorNoAuditLogs: "ಆಡಿಟ್ ಲಾಗ್ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
    supervisorQueryLabel: "ಪ್ರಶ್ನೆ:",
    supervisorHashLabel: "ಹ್ಯಾಶ್:",
    tpTitle: "ದ್ವಿ-ವ್ಯಕ್ತಿ ಸಮಗ್ರತೆ ಪರಿಶೀಲನೆ",
    tpActionLabel: "ಕ್ರಿಯೆ:",
    tpWarning: "ಈ ಕ್ರಿಯೆಗೆ ಮೇಲ್ವಿಚಾರಕ ಅನುಮತಿ ಹೊಂದಿರುವ ಅಧಿಕಾರಿಯ ದ್ವಿತೀಯ ಅನುಮೋದನೆ ಅಗತ್ಯವಿದೆ. ಸಹಿ ಮಾಡುವ ಮೇಲ್ವಿಚಾರಕರು ಕೆಳಗಿನ ರುಜುವಾತುಗಳನ್ನು ಪರಿಶೀಲಿಸಬೇಕು.",
    tpSupervisorBadgeLabel: "ಮೇಲ್ವಿಚಾರಕರ ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ (೭-ಅಂಕಿ KGID)",
    tpSupervisorPasswordLabel: "ಮೇಲ್ವಿಚಾರಕರ ಪಾಸ್‌ವರ್ಡ್",
    tpCancel: "ರದ್ದುಮಾಡಿ",
    tpVerifyApprove: "ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಅನುಮೋದಿಸಿ",
    tpVerifying: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
    aiUnavailableTitle: "AI ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ",
    ttsStop: "ಓದುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
    ttsRead: "ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ",
    newInvestigation: "ಹೊಸ ತನಿಖೆ",
    newChat: "ಹೊಸ ಚಾಟ್",
    loadingLabel: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    noPastConversations: "ಇನ್ನೂ ಯಾವುದೇ ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ.",
    newConversationFallback: "ಹೊಸ ಸಂಭಾಷಣೆ",
    analysisPanel: "ವಿಶ್ಲೇಷಣಾ ಫಲಕ",
    noVisualizableData: "ಈ ಸರದಿಗೆ ಇನ್ನೂ ದೃಶ್ಯೀಕರಿಸಬಹುದಾದ ಡೇಟಾ ಇಲ್ಲ.",
    noRows: "ಸಾಲುಗಳಿಲ್ಲ.",
    noTimelineEvents: "ಟೈಮ್‌ಲೈನ್ ಘಟನೆಗಳಿಲ್ಲ.",
    coworkInvitationsTitle: "ಸಹಕಾರ್ಯ ಆಹ್ವಾನಗಳು",
    noPendingInvitations: "ಬಾಕಿ ಇರುವ ಆಹ್ವಾನಗಳಿಲ್ಲ.",
    invitedYouOnCase: "ನಿಮ್ಮನ್ನು ಹಂಚಿದ ಅಧಿವೇಶನಕ್ಕೆ ಆಹ್ವಾನಿಸಿದ್ದಾರೆ",
    onCaseLabel: "ಪ್ರಕರಣದಲ್ಲಿ",
    accept: "ಒಪ್ಪಿಕೊಳ್ಳಿ",
    reject: "ತಿರಸ್ಕರಿಸಿ",
    newInvestigationTitleRequired: "ಶೀರ್ಷಿಕೆ ಅಗತ್ಯವಿದೆ.",
    couldNotCreateInvestigation: "ತನಿಖೆ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
    couldNotReachServer: "ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
    titleLabel: "ಶೀರ್ಷಿಕೆ",
    descOptionalLabel: "ವಿವರಣೆ (ಐಚ್ಛಿಕ)",
    linkCaseOptionalLabel: "ಪ್ರಕರಣ ಜೋಡಿಸಿ (ಐಚ್ಛಿಕ)",
    creating: "ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    createInvestigation: "ತನಿಖೆ ರಚಿಸಿ",
    investigationTitlePlaceholder: "ಉದಾ. ಬೆಂಗಳೂರು ಪೂರ್ವ ಕಳ್ಳತನ ಜಾಲ",
    investigationDescPlaceholder: "ಈ ತನಿಖೆ ಒಳಗೊಂಡಿರುವ ವಿಷಯದ ಕುರಿತು ಸಂಕ್ಷಿಪ್ತ ಟಿಪ್ಪಣಿಗಳು...",
    caseSearchPlaceholder: "ಪ್ರಕರಣ ಸಂಖ್ಯೆಯ ಮೂಲಕ ಹುಡುಕಿ (ಉದಾ. CR-2026)",
    chatHubTitle: "ವಜ್ರ ಕೇಂದ್ರ ತನಿಖಾ ಕೇಂದ್ರ",
    chatHubDesc: "ಸಕ್ರಿಯ CCTNS ನೋಂದಣಿಗಳನ್ನು ಪ್ರಶ್ನಿಸಲು, ಅಪರಾಧ ಅಪಾಯ ಸೂಚ್ಯಂಕಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಲು ಮತ್ತು ಪ್ರಾದೇಶಿಕ ಅಪರಾಧ ಸಮೂಹಗಳನ್ನು ಗುರುತಿಸಲು ಇಂಗ್ಲಿಷ್/ಕನ್ನಡದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ.",
    exportPdf: "PDF ರಫ್ತು ಮಾಡಿ",
    translatingIndicator: "ಕನ್ನಡ ಧ್ವನಿ ಡೇಟಾವನ್ನು ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...",
    micTitleAvailable: "ಕನ್ನಡ/ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ",
    micTitleUnavailable: "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ — ಸ್ಪೀಚ್-ಟು-ಟೆಕ್ಸ್ಟ್ ಸೇವೆ ಇನ್ನೂ ಕಾನ್ಫಿಗರ್ ಆಗಿಲ್ಲ",
    attachTitle: "ಸಾಕ್ಷ್ಯ ಲಗತ್ತಿಸಿ (PDF ಅಥವಾ JPEG, ಗರಿಷ್ಠ ೩ ಫೈಲ್‌ಗಳು, ತಲಾ ೮MB)",
    uploadingAttachments: "ಲಗತ್ತುಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    chatModeChat: "ಚಾಟ್",
    chatModeCowork: "ಸಹಕಾರ್ಯ",
    sharedSessionHint: "ಹಂಚಿದ ಅಧಿವೇಶನ — AI ಗೆ ಕೇಳಲು @vajra ಎಂದು ಉಲ್ಲೇಖಿಸಿ",
    inviteToCowork: "ಸಹಕಾರ್ಯಕ್ಕೆ ಆಹ್ವಾನಿಸಿ",
    badgeNumberKgidLabel: "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ (೭-ಅಂಕಿ KGID)",
    accessLevelLabel: "ಪ್ರವೇಶ ಮಟ್ಟ",
    viewerLabel: "ವೀಕ್ಷಕ",
    collaboratorLabel: "ಸಹಯೋಗಿ",
    viewerDesc: "ಥ್ರೆಡ್ ವೀಕ್ಷಿಸಬಹುದು, ಸಂದೇಶಗಳನ್ನು ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.",
    collaboratorDesc: "ಸಂದೇಶಗಳನ್ನು ಪೋಸ್ಟ್ ಮಾಡಬಹುದು ಮತ್ತು AI ಅನ್ನು @vajra ಮಾಡಬಹುದು.",
    sendInvitation: "ಆಹ್ವಾನ ಕಳುಹಿಸಿ",
    sendingInvitation: "ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...",
  }
};
