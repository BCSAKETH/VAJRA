import React, { useEffect, useRef, useState } from "react";
import { X, Plus, CheckCircle2, Circle, Loader2, AlertTriangle, Paperclip, FileCheck } from "lucide-react";
import { API_BASE } from "../config";

// §9.5 fix: the "forced note + upload" workflow only ever had the note half
// built -- confirmed by audit, no file-picker existed anywhere in this
// component despite the backend already accepting attachment_stratus_id.
const MAX_TASK_ATTACHMENT_BYTES = 8 * 1024 * 1024;

// §9.5 Guided Task Workflow: a supervised task loop, Investigation-only
// (confirmed with user) -- check a task -> forced note -> AI reviews it,
// optionally flags a concern -> officer can always override and close the
// task anyway (Loophole L3: advisory only, never a hard block).

interface Task {
  ROWID: number;
  description: string;
  status: "pending" | "done";
  completion_note?: string;
  completed_by?: number;
  completed_at?: string;
  ai_flag?: string;
}

interface TaskChecklistProps {
  sessionId: string;
  lang: "en" | "kn";
  onClose: () => void;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` });

export const TaskChecklist: React.FC<TaskChecklistProps> = ({ sessionId, lang, onClose }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  // Loophole L4: disabled (not hidden) while a review call is in flight.
  const [isReviewing, setIsReviewing] = useState(false);
  // Non-blocking background review tracker
  const [inFlightReviews, setInFlightReviews] = useState<Record<number, boolean>>({});
  const [lastReview, setLastReview] = useState<{ taskId: number; text: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachmentStratusId, setAttachmentStratusId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setIsLoading(true);
    setLoadError(false);
    fetch(`${API_BASE}/api/investigations/${sessionId}/tasks`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Task[]) => setTasks(data))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [sessionId]);

  const handleAddTask = async () => {
    if (!newTaskDesc.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${sessionId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ description: newTaskDesc.trim() }),
      });
      if (res.ok) {
        setNewTaskDesc("");
        load();
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
      setUploadError(lang === "en" ? "File too large (8MB limit)." : "ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ (8MB ಮಿತಿ).");
      return;
    }
    setPendingFile(file);
    setAttachmentStratusId(null);
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/investigations/${sessionId}/tasks/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.stratus_id) {
        setAttachmentStratusId(data.stratus_id);
      } else {
        setUploadError(lang === "en" ? "Upload failed -- you can still complete the task without it." : "ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ -- ಅದು ಇಲ್ಲದೆ ಕಾರ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಬಹುದು.");
        setPendingFile(null);
      }
    } catch {
      setUploadError(lang === "en" ? "Upload failed -- you can still complete the task without it." : "ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ -- ಅದು ಇಲ್ಲದೆ ಕಾರ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಬಹುದು.");
      setPendingFile(null);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleComplete = (taskId: number) => {
    if (noteDraft.trim().length < 15) return;
    const submittedNote = noteDraft.trim();
    const stratusId = attachmentStratusId || undefined;

    // Immediately unblock user: close input drawer and mark task as in-flight background review
    setCompletingId(null);
    setNoteDraft("");
    setPendingFile(null);
    setAttachmentStratusId(null);
    setUploadError(null);
    setInFlightReviews((prev) => ({ ...prev, [taskId]: true }));

    // Run AI multimodal vision & forensic analysis in parallel background
    fetch(`${API_BASE}/api/investigations/${sessionId}/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ note: submittedNote, attachment_stratus_id: stratusId }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const addedCount = Array.isArray(data.tasks_added) ? data.tasks_added.length : 0;
        if (addedCount > 0) {
          const taskWord = addedCount === 1 ? (lang === "en" ? "task" : "ಕಾರ್ಯ") : (lang === "en" ? "tasks" : "ಕಾರ್ಯಗಳು");
          setLastReview({
            taskId,
            text: lang === "en"
              ? `AI added ${addedCount} follow-up ${taskWord} based on evidence review: ${data.tasks_added.join("; ")}`
              : `ಈ ಪರಿಶೀಲನೆಯ ಆಧಾರದ ಮೇಲೆ AI ${addedCount} ಅನುಸರಣಾ ${taskWord} ಸೇರಿಸಿದೆ: ${data.tasks_added.join("; ")}`,
          });
        } else if (data.follow_up_question) {
          setLastReview({ taskId, text: data.follow_up_question });
        }
        load();
      })
      .catch(() => {
        load();
      })
      .finally(() => {
        setInFlightReviews((prev) => {
          const copy = { ...prev };
          delete copy[taskId];
          return copy;
        });
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel border border-stone-800 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono">
            {lang === "en" ? "Guided Tasks" : "ಮಾರ್ಗದರ್ಶಿ ಕಾರ್ಯಗಳು"}
          </h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-[10px] text-stone-600 text-center py-4 font-mono">
            {lang === "en" ? "Loading..." : "ಲೋಡ್ ಆಗುತ್ತಿದೆ..."}
          </div>
        ) : loadError ? (
          <div className="text-[11px] text-amber-400 text-center py-4">
            {lang === "en"
              ? "Guided tasks are not yet configured on the server (console table pending)."
              : "ಮಾರ್ಗದರ್ಶಿ ಕಾರ್ಯಗಳು ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ."}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="text-[10px] text-stone-600 text-center py-3 font-mono">
                {lang === "en" ? "No tasks yet." : "ಇನ್ನೂ ಕಾರ್ಯಗಳಿಲ್ಲ."}
              </div>
            )}
            {tasks.map((task) => (
              <div key={task.ROWID} className="border border-stone-850 rounded-lg p-2.5">
                <button
                  onClick={() => {
                    if (task.status === "done" || inFlightReviews[task.ROWID]) return;
                    setCompletingId(completingId === task.ROWID ? null : task.ROWID);
                    setNoteDraft("");
                    setPendingFile(null);
                    setAttachmentStratusId(null);
                    setUploadError(null);
                  }}
                  className="w-full flex items-start gap-2 text-left cursor-pointer disabled:cursor-not-allowed"
                  disabled={task.status === "done" || Boolean(inFlightReviews[task.ROWID])}
                >
                  {task.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5DCAA5] shrink-0 mt-0.5" />
                  ) : inFlightReviews[task.ROWID] ? (
                    <Loader2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-xs ${task.status === "done" ? "text-stone-500 line-through" : "text-stone-200"}`}>
                    {task.description}
                  </span>
                </button>
                
                {inFlightReviews[task.ROWID] && (
                  <div className="mt-2 pl-6 flex items-center gap-2 text-[10.5px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{lang === "en" ? "AI Evidence Review in progress (background)..." : "ಹಿನ್ನೆಲೆಯಲ್ಲಿ AI ಸಾಕ್ಷ್ಯ ಪರಿಶೀಲನೆ ಪ್ರಗತಿಯಲ್ಲಿದೆ..."}</span>
                  </div>
                )}

                {task.status === "done" && task.completion_note && (
                  <p className="text-[10px] text-stone-500 mt-1.5 pl-6 italic">"{task.completion_note}"</p>
                )}
                {task.status === "done" && task.ai_flag && (
                  <div className="flex items-start gap-1.5 mt-1.5 pl-6 text-[10px] text-amber-400">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{task.ai_flag}</span>
                  </div>
                )}
                {completingId === task.ROWID && !inFlightReviews[task.ROWID] && (
                  <div className="mt-2 pl-6 space-y-2">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder={lang === "en" ? "Describe what was actually done (required)..." : "ನಿಜವಾಗಿ ಏನು ಮಾಡಲಾಗಿದೆ ಎಂದು ವಿವರಿಸಿ (ಕಡ್ಡಾಯ)..."}
                      rows={3}
                      className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E]/50 rounded-lg p-2 text-[11px] text-stone-200 focus:outline-none resize-none"
                    />
                    <input ref={fileInputRef} type="file" onChange={handlePickFile} className="hidden" />
                    {pendingFile ? (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-950/40">
                        <div className="flex items-center gap-1.5 min-w-0 text-[10.5px] text-stone-300">
                          {isUploadingFile ? (
                            <Loader2 className="w-3 h-3 shrink-0 animate-spin text-stone-500" />
                          ) : attachmentStratusId ? (
                            <FileCheck className="w-3 h-3 shrink-0 text-[#5DCAA5]" />
                          ) : (
                            <Paperclip className="w-3 h-3 shrink-0 text-stone-500" />
                          )}
                          <span className="truncate">{pendingFile.name}</span>
                        </div>
                        <button
                          onClick={() => { setPendingFile(null); setAttachmentStratusId(null); }}
                          className="text-stone-600 hover:text-rose-400 cursor-pointer shrink-0"
                          aria-label={lang === "en" ? "Remove attachment" : "ಲಗತ್ತನ್ನು ತೆಗೆದುಹಾಕಿ"}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-stone-800 hover:border-stone-700 text-stone-500 hover:text-stone-300 text-[10.5px] cursor-pointer"
                      >
                        <Paperclip className="w-3 h-3" />
                        {lang === "en" ? "Attach evidence (optional)" : "ಸಾಕ್ಷ್ಯ ಲಗತ್ತಿಸಿ (ಐಚ್ಛಿಕ)"}
                      </button>
                    )}
                    {uploadError && <p className="text-[10px] text-rose-400">{uploadError}</p>}
                    <button
                      onClick={() => handleComplete(task.ROWID)}
                      disabled={isUploadingFile || noteDraft.trim().length < 15}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 border border-[#C79A4E]/30 text-[#C79A4E] text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>{lang === "en" ? "Submit Note & Evidence for AI Review" : "AI ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ"}</span>
                    </button>
                  </div>
                )}
                {lastReview?.taskId === task.ROWID && (
                  <div className="flex items-start gap-1.5 mt-1.5 pl-6 text-[10px] text-amber-400">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{lastReview.text}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-stone-850">
          <input
            type="text"
            value={newTaskDesc}
            onChange={(e) => setNewTaskDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
            placeholder={lang === "en" ? "New task..." : "ಹೊಸ ಕಾರ್ಯ..."}
            className="flex-1 bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E]/50 rounded-lg py-2 px-3 text-xs text-stone-200 focus:outline-none"
          />
          <button
            onClick={handleAddTask}
            disabled={isAdding || !newTaskDesc.trim()}
            className="p-2 rounded-lg bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 border border-[#C79A4E]/30 text-[#C79A4E] disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
