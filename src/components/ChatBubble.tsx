import React from "react";
import { ChatMessage } from "../AppContext";
import { AlertTriangle, Tag, Paperclip } from "lucide-react";
import { InlineWidget } from "./InlineWidget";

interface ChatBubbleProps {
  message: ChatMessage;
  onExpandWidget: (type: string, data: any) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onExpandWidget }) => {
  const isAI = message.sender === "assistant";
  
  return (
    <div className={`flex flex-col gap-1.5 w-full animate-fade-in ${isAI ? "items-start" : "items-end"}`}>
      {/* Sender Label -- shows the actual officer's name in a Cowork
          session (senderName is only ever set on WebSocket-delivered
          messages, which is the only path used once a session has real
          participants) instead of a generic "INVESTIGATOR" label that gave
          no way to tell collaborators apart. */}
      <span className="text-[10px] text-slate-500 font-semibold px-2 font-mono">
        {isAI ? "VAJRA.AI" : (message.senderName ? message.senderName.toUpperCase() : "INVESTIGATOR")} • {message.timestamp}
      </span>

      {/* Bubble Container */}
      <div className="max-w-[85%] sm:max-w-[75%] flex flex-col gap-3">
        {/* Amber Degradation Mode Banner */}
        {isAI && message.isSimulated && (
          <div className="degraded-banner rounded-xl p-3.5 flex items-start gap-2.5 max-w-full">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-350">
              <span className="font-extrabold uppercase tracking-wider block mb-0.5 text-amber-500">
                AI Reasoning Service Degraded
              </span>
              Showing a simplified, local rule-based response ({message.simulatedReason || "Grounded backup engine active"}).
            </div>
          </div>
        )}

        {/* Message Bubble Card */}
        <div
          className={`rounded-2xl p-4 border text-sm leading-relaxed ${
            isAI
              ? "glass-panel border-slate-800 text-slate-200 shadow-md"
              : "bg-slate-900 border-[#00C6AD]/20 text-slate-100 shadow-sm"
          }`}
        >
          {/* Main Text Content */}
          <div className="whitespace-pre-wrap font-sans text-slate-200">{message.text}</div>

          {/* Attachment indicator */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {message.attachments.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/40 border border-slate-800 text-[10px] text-slate-400 font-mono"
                >
                  <Paperclip className="w-3 h-3" />
                  {a.file_name}{a.page_count > 1 ? ` (${a.page_count}p)` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Citation Pills */}
          {isAI && message.citations && message.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-850">
              {message.citations.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 text-[10px] font-mono bg-[#00C6AD]/5 text-[#00C6AD] border border-[#00C6AD]/20 px-2 py-0.5 rounded"
                  title={c.details}
                >
                  <Tag className="w-2.5 h-2.5 shrink-0" />
                  <span>{c.type}: {c.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Embedded Inline Widgets */}
        {isAI && message.responseType && message.responseType !== "text" && message.data && (
          <div className="w-full">
            <InlineWidget
              type={message.responseType}
              data={message.data}
              onExpand={() => onExpandWidget(message.responseType!, message.data)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
