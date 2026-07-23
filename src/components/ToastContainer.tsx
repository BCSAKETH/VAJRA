import React, { useEffect } from "react";
import { useApp } from "../AppContext";
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, X } from "lucide-react";

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string; icon: React.ElementType }> = {
  Critical: { border: "border-rose-500/40", bg: "bg-rose-500/10", text: "text-rose-400", icon: AlertOctagon },
  Warning: { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", icon: AlertTriangle },
  Info: { border: "border-slate-600/40", bg: "bg-slate-800/40", text: "text-slate-300", icon: Info },
  Success: { border: "border-[#00C6AD]/40", bg: "bg-[#00C6AD]/10", text: "text-[#00C6AD]", icon: CheckCircle2 },
};

const AUTO_DISMISS_MS = 8000;

const ToastItem: React.FC<{
  id: string;
  title: string;
  message: string;
  severity: string;
  timestamp: string;
  onDismiss: (id: string) => void;
}> = ({ id, title, message, severity, timestamp, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.Info;
  const Icon = style.icon;

  return (
    <div
      className={`glass-panel border ${style.border} ${style.bg} rounded-xl p-3.5 shadow-2xl w-80 animate-fade-in pointer-events-auto`}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-black uppercase tracking-wider ${style.text}`}>{title}</p>
            <span className="text-[9px] text-slate-550 font-mono shrink-0">{timestamp}</span>
          </div>
          {message && <p className="text-[11px] text-slate-300 mt-1 leading-relaxed break-words">{message}</p>}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="text-slate-500 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// Capped to the most recent few: a backlog of unread alerts (e.g. 50
// proactive alerts on first login) previously stacked every single toast in
// one uncapped column tall enough to visually cover and pointer-block
// unrelated controls elsewhere on the page (confirmed live: it sat on top of
// the Supervisor Dashboard's "Verify Ledger Chain" button, making it
// unclickable). Older toasts still auto-dismiss on their own timers and
// silently drop off the visible list; nothing is lost, just not all shown
// stacked on screen at once.
const MAX_VISIBLE_TOASTS = 4;

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  const visible = toasts.slice(-MAX_VISIBLE_TOASTS);

  return (
    // Bottom-right, not top-right: the header's language/theme/bell controls,
    // their dropdowns (Cowork invitations), and several screens' own
    // top-right action buttons (e.g. Supervisor Dashboard's "Verify Ledger
    // Chain") all live in that corner too. Confirmed live, twice: a
    // top-right toast stack sat on top of both and blocked clicks on them
    // even with pointer-events-none on the wrapper, since each toast card
    // itself needs pointer-events-auto to be dismissible. Bottom-right is
    // clear screen space in this layout (chat input is bottom-center).
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2.5 pointer-events-none">
      {visible.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={removeToast} />
      ))}
      {visible.length < toasts.length && (
        <div className="text-[10px] text-slate-400 font-mono text-right pr-1 pointer-events-none">
          +{toasts.length - visible.length} more notifications
        </div>
      )}
    </div>
  );
};
