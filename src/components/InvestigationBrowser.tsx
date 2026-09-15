import React, { useState } from "react";
import {
  Globe, ArrowLeft, ArrowRight, RotateCw, Plus, X, Maximize2, Minimize2,
  ShieldCheck, AlertCircle, Loader2, Send,
} from "lucide-react";
import { API_BASE } from "../config";
import { useApp } from "../AppContext";

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  inputUrl: string;
  status: "idle" | "loading" | "loaded" | "error";
  screenshotDataUrl: string | null;
  extractedText: string | null;
  leadership: string[];
  contacts: string[];
  evidenceSeal: string | null;
  errorMessage?: string;
  history: string[];
  historyIndex: number;
}

const newTab = (id: string): BrowserTab => ({
  id, title: "New tab", url: "", inputUrl: "", status: "idle",
  screenshotDataUrl: null, extractedText: null, leadership: [], contacts: [],
  evidenceSeal: null, history: [], historyIndex: -1,
});

// Section 19: sandboxed in-app investigation browser. Navigation goes through
// vajra_backend's /api/investigation/browser/navigate (SmartBrowz, SSRF-
// guarded, server-side fetch) so a suspect's server only ever sees VAJRA's
// own server IP, never the officer's own -- and every page load is sealed
// with a SHA-256 evidence hash for chain-of-custody, matching this app's
// existing BSA §63/§65B evidentiary discipline elsewhere.
export const InvestigationBrowser: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (text: string) => void;
}> = ({ isOpen, onClose, onSendToChat }) => {
  const { lang, addToast } = useApp();
  const [tabs, setTabs] = useState<BrowserTab[]>([newTab("tab-1")]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const patchActive = (patch: Partial<BrowserTab>) =>
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)));

  const handleNewTab = () => {
    const id = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, newTab(id)]);
    setActiveTabId(id);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) { onClose(); return; }
    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) setActiveTabId(filtered[filtered.length - 1].id);
  };

  const navigate = async (rawUrl: string, fromHistory = false) => {
    const target = rawUrl.trim();
    if (!target) return;
    patchActive({ status: "loading", inputUrl: target });
    try {
      const res = await fetch(`${API_BASE}/api/investigation/browser/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Navigation failed (${res.status})`);
      setTabs((prev) => prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const hist = fromHistory ? t.history : [...t.history.slice(0, t.historyIndex + 1), data.url];
        return {
          ...t, status: "loaded", url: data.url, inputUrl: data.url,
          title: data.page_title || data.url, screenshotDataUrl: data.screenshot_data_url || null,
          extractedText: data.extracted_text || null, leadership: data.leadership || [],
          contacts: data.contacts || [], evidenceSeal: data.sha256_evidence_seal || null,
          history: hist, historyIndex: hist.length - 1,
        };
      }));
    } catch (err: any) {
      patchActive({ status: "error", errorMessage: err.message || "Failed to load page" });
      addToast(
        lang === "en" ? "Navigation Failed" : "ಸಂಚರಣೆ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not reach the target page." : "ಗುರಿ ಪುಟವನ್ನು ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    }
  };

  const goBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const idx = activeTab.historyIndex - 1;
    patchActive({ historyIndex: idx });
    navigate(activeTab.history[idx], true);
  };
  const goForward = () => {
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const idx = activeTab.historyIndex + 1;
    patchActive({ historyIndex: idx });
    navigate(activeTab.history[idx], true);
  };

  const handleSendToChat = () => {
    if (!activeTab.extractedText) return;
    const summary = `[Investigation Browser -- ${activeTab.url}]\nEvidence seal: ${activeTab.evidenceSeal}\n\n${activeTab.extractedText.slice(0, 2000)}`;
    onSendToChat?.(summary);
    addToast(
      lang === "en" ? "Sent to Chat" : "ಚಾಟ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ",
      lang === "en" ? "Page content added to the conversation." : "ಪುಟದ ವಿಷಯವನ್ನು ಸಂಭಾಷಣೆಗೆ ಸೇರಿಸಲಾಗಿದೆ.",
      "Info"
    );
  };

  return (
    <div className={`flex flex-col bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl ${isFullscreen ? "fixed inset-4 z-50" : "h-full w-full"}`}>
      {/* Tab strip */}
      <div className="flex items-center gap-1 bg-stone-900 border-b border-stone-800 px-2 pt-2">
        <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center shrink-0">
          <Globe className="w-3.5 h-3.5 text-[#C79A4E]" />
        </div>
        <div className="flex items-end gap-1 overflow-x-auto flex-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-mono max-w-[160px] shrink-0 cursor-pointer ${
                t.id === activeTabId ? "bg-stone-950 text-stone-100 border-t border-x border-stone-800" : "text-stone-500 hover:text-stone-300"
              }`}
            >
              <span className="truncate">{t.title}</span>
              <X className="w-3 h-3 hover:text-red-400" onClick={(e) => handleCloseTab(e, t.id)} />
            </button>
          ))}
          <button onClick={handleNewTab} className="p-1.5 text-stone-500 hover:text-stone-200 cursor-pointer" title="New tab">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={() => setIsFullscreen((f) => !f)} className="p-1.5 text-stone-500 hover:text-stone-200 cursor-pointer" title="Expand">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onClose} className="p-1.5 text-stone-500 hover:text-red-400 cursor-pointer" title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Omnibar */}
      <div className="flex items-center gap-1.5 bg-stone-900/60 border-b border-stone-800 px-2 py-2">
        <button onClick={goBack} disabled={activeTab.historyIndex <= 0} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 disabled:opacity-30 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={goForward} disabled={activeTab.historyIndex >= activeTab.history.length - 1} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 disabled:opacity-30 cursor-pointer">
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => navigate(activeTab.url, true)} disabled={!activeTab.url} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 disabled:opacity-30 cursor-pointer">
          <RotateCw className={`w-3.5 h-3.5 ${activeTab.status === "loading" ? "animate-spin" : ""}`} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-stone-950 border border-stone-800 focus-within:border-[#C79A4E]/50 rounded-lg px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <input
            value={activeTab.inputUrl}
            onChange={(e) => patchActive({ inputUrl: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(activeTab.inputUrl); }}
            placeholder={lang === "en" ? "Type a URL" : "URL ಟೈಪ್ ಮಾಡಿ"}
            className="flex-1 bg-transparent text-xs font-mono text-stone-200 placeholder-stone-600 outline-none"
          />
        </div>
        <button
          onClick={() => navigate(activeTab.inputUrl)}
          disabled={!activeTab.inputUrl || activeTab.status === "loading"}
          className="px-3 py-1.5 rounded-lg bg-[#C79A4E] hover:bg-[#b0853e] text-stone-950 text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {lang === "en" ? "Go" : "ಹೋಗಿ"}
        </button>
      </div>

      {/* Viewport */}
      <div className="flex-1 overflow-y-auto bg-stone-950 p-4 min-h-0">
        {activeTab.status === "idle" && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-stone-600 py-16">
            <Globe className="w-12 h-12" strokeWidth={1} />
            <h3 className="text-sm font-bold text-stone-400">{lang === "en" ? "Browse with VAJRA" : "VAJRA ಜೊತೆ ಬ್ರೌಸ್ ಮಾಡಿ"}</h3>
            <p className="text-[11px] text-stone-600 max-w-xs">
              {lang === "en"
                ? "Type a URL above. Navigation runs server-side -- your IP is never exposed to the target site."
                : "ಮೇಲೆ URL ಟೈಪ್ ಮಾಡಿ. ಸಂಚರಣೆ ಸರ್ವರ್-ಸೈಡ್‌ನಲ್ಲಿ ನಡೆಯುತ್ತದೆ."}
            </p>
          </div>
        )}
        {activeTab.status === "loading" && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-stone-500 py-16">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-mono">{lang === "en" ? "Loading through sandboxed browser..." : "ಲೋಡ್ ಆಗುತ್ತಿದೆ..."}</span>
          </div>
        )}
        {activeTab.status === "error" && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-red-400 py-16">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs font-mono text-center max-w-sm">{activeTab.errorMessage}</span>
          </div>
        )}
        {activeTab.status === "loaded" && (
          <div className="space-y-3">
            {activeTab.screenshotDataUrl && (
              <img src={activeTab.screenshotDataUrl} alt={activeTab.title} className="w-full rounded-xl border border-stone-800" />
            )}
            {activeTab.evidenceSeal && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>SHA-256 {lang === "en" ? "evidence seal" : "ಸಾಕ್ಷ್ಯ ಮುದ್ರೆ"}: {activeTab.evidenceSeal.slice(0, 24)}...</span>
              </div>
            )}
            {(activeTab.leadership.length > 0 || activeTab.contacts.length > 0) && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {activeTab.leadership.length > 0 && (
                  <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-2">
                    <div className="text-stone-500 uppercase tracking-wide text-[9.5px] mb-1">{lang === "en" ? "Leadership" : "ನಾಯಕತ್ವ"}</div>
                    {activeTab.leadership.map((l, i) => <div key={i} className="text-stone-300">{l}</div>)}
                  </div>
                )}
                {activeTab.contacts.length > 0 && (
                  <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-2">
                    <div className="text-stone-500 uppercase tracking-wide text-[9.5px] mb-1">{lang === "en" ? "Contacts" : "ಸಂಪರ್ಕಗಳು"}</div>
                    {activeTab.contacts.map((c, i) => <div key={i} className="text-stone-300">{c}</div>)}
                  </div>
                )}
              </div>
            )}
            {activeTab.extractedText && (
              <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9.5px] uppercase tracking-wide text-stone-500">{lang === "en" ? "Extracted Text" : "ಹೊರತೆಗೆದ ಪಠ್ಯ"}</span>
                  {onSendToChat && (
                    <button onClick={handleSendToChat} className="flex items-center gap-1 text-[10px] text-[#C79A4E] hover:text-[#E4C590] cursor-pointer">
                      <Send className="w-3 h-3" /> {lang === "en" ? "Send to Chat" : "ಚಾಟ್‌ಗೆ ಕಳುಹಿಸಿ"}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{activeTab.extractedText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
