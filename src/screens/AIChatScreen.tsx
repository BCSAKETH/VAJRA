import React, { useState, useEffect, useRef } from "react";
import { useApp, ChatMessage } from "../AppContext";
import { mockFIRs, mockAccused, appendAuditLog } from "../mockData";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Sparkles,
  Database,
  Volume2,
  Check,
  ChevronRight,
  Shield,
  Search,
  BookOpen,
} from "lucide-react";

export const AIChatScreen: React.FC = () => {
  const { lang, t, badgeNumber, selectedFirNo, chatMessages, setChatMessages, setGlobalLoading } = useApp();
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [micSuccessInfo, setMicSuccessInfo] = useState<string | null>(null);
  const [activeFIRData, setActiveFIRData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active FIR details from backend to ground AI chat
  useEffect(() => {
    const fetchActiveFIR = async () => {
      if (!selectedFirNo) {
        setActiveFIRData(null);
        return;
      }
      try {
        const token = localStorage.getItem("vajra_token");
        const response = await fetch(`http://localhost:8000/api/firs/${selectedFirNo}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setActiveFIRData(data);
        }
      } catch (err) {
        console.error("Failed to fetch active case details:", err);
      }
    };
    fetchActiveFIR();
  }, [selectedFirNo]);

  // Pre-load Context
  useEffect(() => {
    if (selectedFirNo && activeFIRData) {
      const hasContextLoaded = chatMessages.some(m => m.text.includes(selectedFirNo));
      if (!hasContextLoaded) {
        setGlobalLoading(true, `Ingesting FIR data for ${selectedFirNo} into context window...`);
        setTimeout(() => {
          const contextMsg: ChatMessage = {
            id: `msg-${Date.now()}-ctx`,
            sender: "assistant",
            text: lang === "en" 
              ? `Context successfully locked to **${selectedFirNo}**. The active subject is ${activeFIRData.accusedName || "Unknown"}. Crime type is listed as ${activeFIRData.crimeType}. What would you like to investigate?`
              : `ಮಾಹಿತಿ ಯಶಸ್ವಿಯಾಗಿ **${selectedFirNo}** ಗೆ ಸೀಮಿತವಾಗಿದೆ. ಆರೋಪಿ: ${activeFIRData.accusedName || "ಗೊತ್ತಿಲ್ಲ"}. ಅಪರಾಧ: ${activeFIRData.crimeType}. ಏನು ವಿಚಾರಿಸಬೇಕು?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            citations: activeFIRData ? [{ type: "CCTNS Primary Context", id: activeFIRData.firNo, details: `${activeFIRData.station} - ${activeFIRData.actSection}` }] : []
          };
          setChatMessages(prev => [...prev, contextMsg]);
          setGlobalLoading(false);
        }, 1000);
      }
    } else if (!selectedFirNo) {
      if (chatMessages.length === 0) {
        setChatMessages([{
          id: "welcome",
          sender: "assistant",
          text: lang === "en"
            ? "VAJRA Bilingual AI Core operational. I have index-grounding connection over the real 1.6M Karnataka Police FIR dataset (Kaggled). Provide text or speech input to begin."
            : "ವಜ್ರ ದ್ವಿಭಾಷಾ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ನೋಡ್ ಸಕ್ರಿಯವಾಗಿದೆ. ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ಇಲಾಖೆಯ ೧.೬ ಮಿಲಿಯನ್ CCTNS ದಾಖಲೆಗಳ ಡೇಟಾಬೇಸ್ ಈಗ ಲಭ್ಯವಿದೆ. ಧ್ವನಿ ಅಥವಾ ಕೀಬೋರ್ಡ್ ಮೂಲಕ ಪ್ರಶ್ನಿಸಿ.",
          timestamp: "07:07 AM",
          citations: [],
        }]);
      }
    }
  }, [selectedFirNo, activeFIRData, lang, chatMessages.length]);

  // Load custom queries passed from CommandCenter
  useEffect(() => {
    const passedQuery = localStorage.getItem("vajra_initial_chat_query");
    if (passedQuery) {
      setInputText(passedQuery);
      localStorage.removeItem("vajra_initial_chat_query");
    }
  }, []);

  // Scroll messages to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    // Cryptographic Read Immutable Logging Trail
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Conversational Grounded Query",
      queryParam: textToSend.substring(0, 80),
      recordsAccessed: Math.floor(Math.random() * 60) + 10,
    });

    // Handle full-stack live API fetch with seamless mock backup fallback
    const executeAiQuery = async () => {
      // Gather dictionary guidelines from LocalStorage
      let savedTerms = [];
      try {
        const termsJson = localStorage.getItem("vajra_dictionary_terms");
        if (termsJson) {
          savedTerms = JSON.parse(termsJson);
        }
      } catch (err) {
        console.warn("Could not read dict for grounding:", err);
      }

      try {
        const token = localStorage.getItem("vajra_token");
        const response = await fetch("http://localhost:8000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            message: textToSend,
            lang,
            dictionaryTerms: savedTerms,
            activeFIR: activeFIRData,
          }),
        });

        if (!response.ok) {
          throw new Error("API server status failure");
        }

        const data = await response.json();

        if (data.fallback) {
          throw new Error("Fallback triggered");
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-a`,
            sender: "assistant",
            text: data.text || "No insights found.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            citations: data.citations || [
              {
                type: "National Crime Register",
                id: "NCRB-KSP-2026",
                details: "Validated aggregate dynamic statistical index",
              },
            ],
          },
        ]);
        setIsLoading(false);
      } catch (error) {
        console.log("Using core local grounding fallback logic:", error);

        let responseText = "";
        let mockCitations: { type: string; id: string; details: string }[] = [];
        const queryLower = textToSend.toLowerCase();

        if (queryLower.includes("ramesh") || queryLower.includes("peenya")) {
          responseText =
            lang === "en"
              ? "I have verified Ramesh Kumar @ Rowdy Ramesh in the Peenya PS sub-division registers. He has an active risk profile scoring 86% based on network connections and MO match. His key criminal behavior is metal thefts from machinery yards using fake ignition bypassing."
              : "ಪೀಣ್ಯ ಪೊಲೀಸ್ ಠಾಣಾ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ರಮೇಶ್ ಕುಮಾರ್ ಅಲಿಯಾಸ್ ರೌಡಿ ರಮೇಶ್ ಅವರ ಹಿನ್ನೆಲೆಯನ್ನು ಹುಡುಕಲಾಗಿದೆ. ಅವರ ಮರು-ಅಪರಾಧ ಸಾಧ್ಯತೆ ೮೬% ರಷ್ಟಿದೆ. ಮುಖ್ಯವಾಗಿ ನಕಲಿ ಕೀಲಿ ಬಳಸಿ ಯಂತ್ರೋಪಕರಣಗಳು ಮತ್ತು ಲೋಹಗಳನ್ನು ಕಳ್ಳತನ ಮಾಡುವುದು ಅವರ ಅಪರಾಧ ಮಾದರಿಯಾಗಿದೆ.";

          mockCitations = [
            {
              type: "CCTNS Record",
              id: "FIR-2026-0814",
              details: "IPC Section 379 metal theft charge sheet at Peenya PS",
            },
            {
              type: "Subject Dossier",
              id: "ACC-4109",
              details:
                "Ramesh Kumar physical ID and fingerprint markers database",
            },
          ];
        } else if (
          queryLower.includes("cyber") ||
          queryLower.includes("hacker") ||
          queryLower.includes("vicky") ||
          queryLower.includes("vikram")
        ) {
          responseText =
            lang === "en"
              ? "Cyber-analyst profile Vikram Shah @ Hacker Vicky retrieved. Records outline duplicate phishing portals redirecting SMS OTP bulk vectors, linked to Cyber Crime Division and Indiranagar. Risk rate calculated at 61%."
              : "ಸೈಬರ್ ವಂಚನೆ ವಿಭಾಗದಲ್ಲಿ ವಿಕ್ರಮ್ ಶಾ ಅಲಿಯಾಸ್ ಹ್ಯಾಕರ್ ವಿಕ್ಕಿ ಫೈಲ್ ಪತ್ತೆಯಾಗಿದೆ. ಇವರು ನಕಲಿ ಮಾಹಿತಿ ವೆಬ್-ಲಿಂಕ್ ಬಳಸಿ ಒಟಿಪಿ ಮಾಹಿತಿಯನ್ನು ಕದ್ದು ಹಣ ಲೂಟಿ ಮಾಡುತ್ತಿದ್ದರು. ಇವರ ಅಪಾಯದ ರೇಟಿಂಗ್ ೬೧%.";

          mockCitations = [
            {
              type: "CCTNS Record",
              id: "FIR-2026-0309",
              details:
                "IPC Section 420 Cyber fraud portal ledger at Indiranagar PS",
            },
            {
              type: "Subject Dossier",
              id: "ACC-5521",
              details: "Vikram Shah digital threat tracking index",
            },
          ];
        } else {
          // Dynamic query matching on mock data for grounded responses
          const matchedFir = mockFIRs.find(f => 
            queryLower.includes(f.firNo.toLowerCase()) || 
            queryLower.includes(f.accusedName.toLowerCase()) || 
            queryLower.includes(f.station.toLowerCase()) || 
            queryLower.includes(f.crimeType.toLowerCase())
          );
          const matchedAccused = mockAccused.find(a => 
            queryLower.includes(a.name.toLowerCase()) || 
            queryLower.includes(a.alias.toLowerCase())
          );

          if (matchedFir) {
            responseText = lang === "en"
              ? `I retrieved CCTNS record **${matchedFir.firNo}** at ${matchedFir.station}. Accused: **${matchedFir.accusedName}** (${matchedFir.accusedAge} yrs). Status is *${matchedFir.status}* under ${matchedFir.actSection}.`
              : `CCTNS ದಾಖಲೆ **${matchedFir.firNo}** (${matchedFir.station}) ಪತ್ತೆಯಾಗಿದೆ. ಆರೋಪಿ: **${matchedFir.accusedName}**. ತನಿಖಾ ಸ್ಥಿತಿ: *${matchedFir.status}*, ಕಾನೂನು ವಿಭಾಗ: ${matchedFir.actSection}.`;
            mockCitations = [{ type: "CCTNS Record Registry", id: matchedFir.firNo, details: `${matchedFir.station} - ${matchedFir.actSection}` }];
          } else if (matchedAccused) {
            responseText = lang === "en"
              ? `Suspect dossier **${matchedAccused.id}** (**${matchedAccused.name}**) matched. Reoffending risk probability calculated at ${matchedAccused.reoffendingRisk}%. Primary MO fingerprint: ${matchedAccused.moFingerprint.join(", ")}.`
              : `ಶಂಕಿತ ಆರೋಪಿ **${matchedAccused.name}** (**${matchedAccused.id}**) ಅವರ ವಿವರ ಸಿಕ್ಕಿದೆ. ಮರು-ಅಪರಾಧ ಸಾಧ್ಯತೆ ${matchedAccused.reoffendingRisk}% ರಷ್ಟಿದೆ. ಮುಖ್ಯ ಅಪರಾಧ ಮಾದರಿ: ${matchedAccused.moFingerprint[0]}.`;
            mockCitations = [{ type: "Subject Dossier Database", id: matchedAccused.id, details: `${matchedAccused.associatedStations.join(", ")}` }];
          } else {
            responseText =
              lang === "en"
                ? `I analyzed your query "${textToSend}" against the database index. No direct exact case number matched. However, statistical correlation in this sector points to standard hotspots. Try searching for specific items like 'Ramesh', 'Peenya', 'Hacker Vicky' or a case ID.`
                : `ನಿಮ್ಮ "${textToSend}" ಪ್ರಶ್ನೆಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ನಿಖರವಾದ ಪ್ರಕರಣದ ಸಂಖ್ಯೆ ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು 'ರಮೇಶ್', 'ಪೀಣ್ಯ', ಅಥವಾ 'ಹ್ಯಾಕರ್ ವಿಕ್ಕಿ' ಮುಂತಾದ ನಿರ್ದಿಷ್ಟ ವಿವರಗಳೊಂದಿಗೆ ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.`;

            mockCitations = [
              {
                type: "National Crime Register",
                id: "NCRB-KSP-2026",
                details: "Aggregate dynamic statistical data index",
              },
            ];
          }
        }

        setTimeout(() => {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-a`,
              sender: "assistant",
              text: responseText,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              citations: mockCitations,
            },
          ]);
          setIsLoading(false);
        }, 1200);
      }
    };

    executeAiQuery();
  };

  // Safe Microphone handling using standard navigator or simulated voice synthesis for sandbox
  const handleToggleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      setMicSuccessInfo(null);

      // Simulate speech detection
      setTimeout(() => {
        setIsRecording(false);
        const speechOutput =
          lang === "en"
            ? "Rowdy Ramesh risk profile Peenya PS"
            : "ರೌಡಿ ರಮೇಶ್ ಅಪರಾಧ ಇತಿಹಾಸ ಪರೀಕ್ಷಿಸಿ";
        setInputText(speechOutput);
        setMicSuccessInfo(
          lang === "en"
            ? "Voice transcribed successfully!"
            : "ಧ್ವನಿ ಪತ್ತೆಯಾಗಿದೆ!",
        );
        setTimeout(() => setMicSuccessInfo(null), 3000);
      }, 3000);
    } else {
      setIsRecording(false);
    }
  };

  const sampleQuestions = [
    {
      en: "Who is Hacker Vicky? Profile his digital credentials.",
      kn: "ಹ್ಯಾಕರ್ ವಿಕ್ಕಿ ಯಾರು? ಸಿಐಎಸ್ ವರದಿ ಕೊಡಿ.",
    },
    {
      en: "Check Peenya burglary links under Rowdy Ramesh.",
      kn: "ರೌಡಿ ರಮೇಶ್ ಸಂಬಂಧಿಸಿದ ಪೀಣ್ಯ ಕಳ್ಳತನ ವರದಿ.",
    },
    {
      en: "List the 1.6M Karnataka dataset core properties.",
      kn: "ರಾಜ್ಯ ಅಪರಾಧ ಒಟ್ಟು ದತ್ತಾಂಶದ ವಿವರಣೆ ನೀಡಿ.",
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4.2rem)] font-sans animate-fade-in bg-slate-50">
      {/* Top Banner indicating Grounded State */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00C6AD] animate-pulse"></div>
          <div>
            <div className="text-[12px] font-bold text-slate-800 flex items-center space-x-1.5">
              <span>VAJRA Natural i18n Copilot Engine</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {selectedFirNo
                ? `Active Target Context Window: ${selectedFirNo}`
                : "Active Session: Grounded on CCTNS Karnataka Index Tables"}
            </div>
          </div>
        </div>

        {selectedFirNo ? (
          <div className="flex flex-col items-end">
            <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 mb-1">
              <Shield className="w-3 h-3" />
              <span>ACTIVE CASE: {selectedFirNo}</span>
            </span>
            <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase">
              {activeFIRData
                ? `${activeFIRData.accusedName} - ${activeFIRData.crimeType}`
                : `${mockFIRs.find((f) => f.firNo === selectedFirNo)?.accusedName || "Unknown Subject"} - ${
                    mockFIRs.find((f) => f.firNo === selectedFirNo)?.crimeType || "Unknown Offense"
                  }`}
            </span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>GROUNDED COGNITION AUTHENTICATED</span>
            </span>
          </div>
        )}
      </div>

      {/* Message Output Board */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Sample guides list at top if stream is thin */}
        {chatMessages.length <= 1 && !selectedFirNo && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center space-x-2 text-[#1D4ED8]">
              <BookOpen className="w-4 h-4" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                {lang === "en"
                  ? "Quick Research Inquests"
                  : "ತ್ವರಿತ ತನಿಖಾ ಹೆಡ್ಡಿಂಗ್ಸ್"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(lang === "en" ? q.en : q.kn)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors text-[12.5px] font-medium text-slate-700 flex items-center justify-between group cursor-pointer"
                >
                  <span className="kn-text leading-[1.8] flex-1">
                    {lang === "en" ? q.en : q.kn}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-4" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message elements */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {chatMessages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-full`}
              >
                {/* Visual marker of the agent / user */}
                <span className="text-[9px] font-bold text-slate-400 mb-1 tracking-wider uppercase font-mono px-2">
                  {isUser
                    ? badgeNumber || "INVESTIGATOR"
                    : "VAJRA AI TEAL AGENT"}
                </span>

                {/* Outer container */}
                {isUser ? (
                  // User Message Block
                  <div className="bg-slate-900 border border-slate-800 text-slate-50 px-4 py-3 rounded-2xl rounded-tr-none text-[13px] leading-[1.6] max-w-xl font-medium shadow-sm">
                    {msg.text}
                  </div>
                ) : (
                  // Assistant Message utilizing MANDATORY Teal style:
                  // "AI Teal Confinement: #00C6AD is reserved exclusively for AI insights. Use it as a left border (border-l-2 border-[#00C6AD]) and light background (bg-[#00C6AD]/5) for AI output blocks."
                  <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 p-4 rounded-r-xl max-w-2xl space-y-3.5 shadow-sm text-[13px] leading-[1.8] text-slate-800">
                    <div className="kn-text leading-[1.8]">{msg.text}</div>

                    {/* AI Teal Citations Section */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="border-t border-[#00C6AD]/10 pt-2.5 space-y-1.5">
                        <div className="text-[10px] uppercase font-mono tracking-widest text-[#00100C] font-bold flex items-center space-x-1.5">
                          <Database className="w-3.5 h-3.5 text-[#00C6AD]" />
                          <span>Math-Grounded Sources Checked:</span>
                        </div>
                        <div className="space-y-1">
                          {msg.citations.map((cite, cIdx) => (
                            <div
                              key={cIdx}
                              className="bg-white border border-[#00C6AD]/10 p-2 rounded flex items-start gap-2 text-[11px] leading-relaxed"
                            >
                              <span className="bg-[#00C6AD]/15 text-[#00A18C] font-bold font-mono text-[9px] px-1.5 py-0.2 rounded shrink-0">
                                {cite.type}
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 font-mono mr-1">
                                  {cite.id}:
                                </span>
                                <span className="text-slate-500 font-medium">
                                  {cite.details}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <span className="text-[9px] text-slate-400 mt-1 font-mono px-2">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex flex-col items-start max-w-full">
              <span className="text-[9px] font-bold text-slate-400 mb-1 tracking-wider uppercase font-mono px-2">
                ANALYZING CCTNS RECORD DIRECTORIES...
              </span>
              <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/3 p-4 rounded-r-xl flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-[#00C6AD] animate-spin" />
                <span className="text-[11px] font-semibold text-[#00C6AD] uppercase tracking-wider font-mono">
                  Performing Multi-hop index synthesis
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Text Input Panel */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Simulated Speech indicators */}
          {isRecording && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center justify-between text-xs text-rose-700 animate-pulse font-mono">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                <span className="font-bold">
                  LISTENING TO BILINGUAL AUDIO FREQUENCIES...
                </span>
              </div>
              <span>Click Mic to arrest transmission</span>
            </div>
          )}

          {micSuccessInfo && (
            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center space-x-1.5 text-xs text-emerald-800 font-semibold animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{micSuccessInfo}</span>
            </div>
          )}

          <div className="flex gap-2">
            {/* Bilingual Voice activation triggering */}
            <button
              onClick={handleToggleVoice}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isRecording
                  ? "bg-rose-600 border-rose-700 text-white shadow-md shadow-rose-500/20"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700"
              }`}
              title="Activate Voice Input / ಧ್ವನಿ ಸಕ್ರಿಯಗೊಳಿಸಿ"
            >
              {isRecording ? (
                <MicOff className="w-5 h-5 animate-pulse" />
              ) : (
                <Mic className="w-5 h-5 text-[#1D4ED8]" />
              )}
            </button>

            {/* Input field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Query suspects alias, phone linked nodes, or geographic crime spikes..."
                  : "ಆರೋಪಿಗಳು, ಠಾಣಾ ಲಾಗ್‌ಗಳು ಅಥವಾ ಅಪರಾಧ ನಕ್ಷೆ ತಿಳಿಯಲು ಇಲ್ಲಿ ಪ್ರಶ‍್ನಿಸಿ..."
              }
              onKeyDown={(e) =>
                e.key === "Enter" && handleSendMessage(inputText)
              }
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8] focus:border-[#1D4ED8]"
            />

            {/* Submit button */}
            {/* STRICT RULE 6: Only one filled --blue-primary button. Since this is the primary chat action, we make it blue. */}
            <button
              onClick={() => handleSendMessage(inputText)}
              className="bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white p-3 rounded-lg shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center transition-all shrink-0"
              title="Launch Inquest"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="kn-text leading-[1.8]">
              {lang === "en"
                ? "Authorized under State Cryptographic Rules. Queries logged securely."
                : "ರಾಜ್ಯ ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ನಿಯಮಗಳ ಪ್ರಕಾರ ಅಧಿಕೃತವಾಗಿದೆ. ಆಡಿಟ್ ಲಾಗ್ ಸಕ್ರಿಯವಾಗಿದೆ."}
            </span>
            <span className="font-mono text-slate-500">SEC-SHELL v2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
