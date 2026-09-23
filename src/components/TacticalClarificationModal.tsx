import React, { useState } from 'react';
import { 
  Shield, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  Sparkles, 
  Filter, 
  Edit3, 
  Compass, 
  CheckCircle2,
  Layers,
  Search
} from 'lucide-react';

export interface InquestOption {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  description: string;
  param_patch: string;
}

export interface InquestStep {
  step_id: string;
  title: string;
  subtitle: string;
  type: 'single_select' | 'multi_select';
  write_in_placeholder?: string;
  options: InquestOption[];
}

export interface ClarificationInquest {
  inquest_id: string;
  title: string;
  summary: string;
  steps: InquestStep[];
}

interface TacticalClarificationModalProps {
  inquest: ClarificationInquest;
  baseQuery: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitRefinement: (synthesizedQuery: string, activeFilters: Record<string, any>) => void;
}

export const TacticalClarificationModal: React.FC<TacticalClarificationModalProps> = ({
  inquest,
  baseQuery,
  isOpen,
  onClose,
  onSubmitRefinement
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  // Track selections per step: { [step_id]: string[] }
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    inquest.steps.forEach(s => {
      initial[s.step_id] = [];
    });
    return initial;
  });

  // Track custom write-in text per step: { [step_id]: string }
  const [writeIns, setWriteIns] = useState<Record<string, string>>({});

  if (!isOpen || !inquest || !inquest.steps || inquest.steps.length === 0) {
    return null;
  }

  const currentStep = inquest.steps[currentStepIdx] || inquest.steps[0];
  const isMulti = currentStep.type === 'multi_select';
  const totalSteps = inquest.steps.length;

  const toggleOption = (stepId: string, optPatch: string, isSingle: boolean) => {
    setSelections(prev => {
      const currentList = prev[stepId] || [];
      if (isSingle) {
        return { ...prev, [stepId]: [optPatch] };
      }
      if (currentList.includes(optPatch)) {
        return { ...prev, [stepId]: currentList.filter(x => x !== optPatch) };
      } else {
        return { ...prev, [stepId]: [...currentList, optPatch] };
      }
    });
  };

  const handleWriteInChange = (stepId: string, val: string) => {
    setWriteIns(prev => ({ ...prev, [stepId]: val }));
  };

  // Count total active selections across all steps
  const totalSelectedCount: number =
    (Object.values(selections) as any[]).reduce<number>((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0) +
    (Object.values(writeIns) as any[]).filter((w) => typeof w === "string" && w.trim().length > 0).length;

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(prev => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  const handleFinalSubmit = () => {
    const collectedParts: string[] = [];
    
    inquest.steps.forEach(s => {
      const picked = selections[s.step_id] || [];
      const custom = writeIns[s.step_id]?.trim();
      if (picked.length > 0) {
        collectedParts.push(...picked);
      }
      if (custom) {
        collectedParts.push(custom);
      }
    });

    let synthesized = baseQuery;
    if (collectedParts.length > 0) {
      synthesized = `Refine search: ${baseQuery} [Filters: ${collectedParts.join(', ')}]`;
    }

    onSubmitRefinement(synthesized, { selections, writeIns });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-amber-500/30 bg-[#0d1117]/95 shadow-2xl shadow-amber-500/10 overflow-hidden text-neutral-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
                  Tactical Inquest Engine
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Step {currentStepIdx + 1} of {totalSteps}
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {inquest.title || 'Investigative Clarification & Refinement'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
            title="Dismiss Inquest"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 gap-1.5 px-6 pt-3 pb-2 bg-neutral-950/60 border-b border-neutral-800">
          {inquest.steps.map((s, idx) => {
            const isDone = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const count = (selections[s.step_id]?.length || 0) + (writeIns[s.step_id]?.trim() ? 1 : 0);
            
            return (
              <button
                key={s.step_id}
                onClick={() => setCurrentStepIdx(idx)}
                className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all border ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : isDone
                    ? 'bg-neutral-900 border-emerald-500/30 text-emerald-400'
                    : 'bg-neutral-900/40 border-neutral-800 text-neutral-500 hover:text-neutral-400'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : isCurrent 
                    ? 'bg-amber-500 text-black font-bold' 
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                <div className="hidden sm:block truncate">
                  <div className="text-[11px] font-medium leading-tight truncate">
                    {s.title.split(' ')[0]} {s.title.split(' ')[1] || ''}
                  </div>
                  {count > 0 && (
                    <div className="text-[9px] text-amber-400/80 font-mono">
                      {count} selected
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Question Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400">Question {currentStepIdx + 1}:</span>
              <h3 className="text-sm font-semibold text-white">
                {currentStep.title}
              </h3>
            </div>
            <p className="text-xs text-neutral-400">
              {currentStep.subtitle}
            </p>
          </div>

          {/* Option Cards */}
          <div className="space-y-2.5">
            {currentStep.options.map((opt) => {
              const isSelected = (selections[currentStep.step_id] || []).includes(opt.param_patch);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(currentStep.step_id, opt.param_patch, !isMulti)}
                  className={`group relative flex items-start gap-3.5 p-3.5 rounded-xl cursor-pointer border transition-all select-none ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/5'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850'
                  }`}
                >
                  {/* Selection Indicator */}
                  <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-amber-500 border-amber-400 text-black shadow-sm shadow-amber-500/50'
                      : 'border-neutral-700 bg-neutral-800/80 text-transparent group-hover:border-neutral-600'
                  }`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  {/* Icon */}
                  {opt.icon && (
                    <span className="text-lg select-none">
                      {opt.icon}
                    </span>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold tracking-wide ${
                        isSelected ? 'text-amber-200' : 'text-neutral-200 group-hover:text-white'
                      }`}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-400 group-hover:text-neutral-300">
                      {opt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Write-In Box */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium mb-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>✍️ Custom Parameter / Type your own specifics for this question:</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={writeIns[currentStep.step_id] || ''}
                onChange={e => handleWriteInChange(currentStep.step_id, e.target.value)}
                placeholder={currentStep.write_in_placeholder || "Type custom parameter or station..."}
                className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
              />
              {writeIns[currentStep.step_id] && (
                <button
                  onClick={() => handleWriteInChange(currentStep.step_id, '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-950/80 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-mono">
              Active Filters: <strong className="text-amber-400">{totalSelectedCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentStepIdx > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-300 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 hover:text-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            {currentStepIdx < totalSteps - 1 ? (
              <>
                <button
                  onClick={handleNext}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-all"
                >
                  Skip Step
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 transition-all"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/30 transition-all animate-pulse"
              >
                <Sparkles className="w-4 h-4" />
                <span>Execute Precision Lead ({totalSelectedCount} Active)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export interface InlineTacticalInquestProps {
  inquest: ClarificationInquest;
  baseQuery: string;
  onSubmitRefinement: (synthesizedQuery: string, activeFilters?: Record<string, any>) => void;
  onDismiss?: () => void;
}

export const InlineTacticalInquest: React.FC<InlineTacticalInquestProps> = ({
  inquest,
  baseQuery,
  onSubmitRefinement,
  onDismiss,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    inquest.steps?.forEach((s) => {
      initial[s.step_id] = [];
    });
    return initial;
  });
  const [writeIns, setWriteIns] = useState<Record<string, string>>({});

  if (!inquest || !inquest.steps || inquest.steps.length === 0) {
    return null;
  }

  const currentStep = inquest.steps[currentStepIdx] || inquest.steps[0];
  const isMulti = currentStep.type === 'multi_select';
  const totalSteps = inquest.steps.length;

  const toggleOption = (stepId: string, optPatch: string, isSingle: boolean) => {
    setSelections((prev) => {
      const currentList = prev[stepId] || [];
      if (isSingle) {
        return { ...prev, [stepId]: [optPatch] };
      }
      if (currentList.includes(optPatch)) {
        return { ...prev, [stepId]: currentList.filter((x) => x !== optPatch) };
      } else {
        return { ...prev, [stepId]: [...currentList, optPatch] };
      }
    });
  };

  const handleWriteInChange = (stepId: string, val: string) => {
    setWriteIns((prev) => ({ ...prev, [stepId]: val }));
  };

  const totalSelectedCount: number =
    (Object.values(selections) as any[]).reduce<number>((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0) +
    (Object.values(writeIns) as any[]).filter((w) => typeof w === "string" && w.trim().length > 0).length;

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  const handleFinalSubmit = () => {
    const collectedParts: string[] = [];
    inquest.steps.forEach((s) => {
      const picked = selections[s.step_id] || [];
      const custom = writeIns[s.step_id]?.trim();
      if (picked.length > 0) {
        collectedParts.push(...picked);
      }
      if (custom) {
        collectedParts.push(custom);
      }
    });

    let synthesized = baseQuery;
    if (collectedParts.length > 0) {
      synthesized = `Refine investigation: ${baseQuery} [Parameters: ${collectedParts.join(', ')}]`;
    }

    onSubmitRefinement(synthesized, { selections, writeIns });
  };

  return (
    <div className="my-3 w-full rounded-2xl border border-[#C79A4E]/40 bg-gradient-to-b from-stone-900/95 via-stone-900/90 to-stone-950/95 shadow-xl shadow-[#C79A4E]/5 overflow-hidden text-neutral-100 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#C79A4E]/20 bg-gradient-to-r from-[#C79A4E]/15 via-stone-900 to-stone-900">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#C79A4E]/20 border border-[#C79A4E]/30 text-[#C79A4E] shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#C79A4E]">
                Tactical Inquest
              </span>
              <span className="px-1.5 py-0.2 text-[9.5px] font-mono rounded bg-[#C79A4E]/20 text-amber-300 border border-[#C79A4E]/30">
                Question {currentStepIdx + 1} of {totalSteps}
              </span>
            </div>
            <div className="text-xs font-bold text-white tracking-wide">
              {inquest.title || 'Investigative Clarification & Refinement'}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            title="Dismiss Inquest"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step Pills */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-stone-950/70 border-b border-stone-800 overflow-x-auto custom-scrollbar">
        {inquest.steps.map((s, idx) => {
          const isDone = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          const count = (selections[s.step_id]?.length || 0) + (writeIns[s.step_id]?.trim() ? 1 : 0);

          return (
            <button
              key={s.step_id}
              onClick={() => setCurrentStepIdx(idx)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-left transition-all text-xs border shrink-0 ${
                isCurrent
                  ? 'bg-[#C79A4E]/15 border-[#C79A4E]/50 text-amber-300 font-semibold'
                  : isDone
                  ? 'bg-stone-900 border-emerald-500/30 text-emerald-400'
                  : 'bg-stone-900/40 border-stone-800 text-stone-500 hover:text-stone-400'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isCurrent
                    ? 'bg-[#C79A4E] text-black'
                    : 'bg-stone-800 text-stone-400'
                }`}
              >
                {isDone ? <Check className="w-2.5 h-2.5" /> : idx + 1}
              </div>
              <span className="truncate max-w-[120px]">{s.title.split(' ')[0]}</span>
              {count > 0 && (
                <span className="text-[9px] text-[#C79A4E] font-mono">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Question Details */}
      <div className="p-4 space-y-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#C79A4E]">Q{currentStepIdx + 1}:</span>
            <h4 className="text-xs font-bold text-white">{currentStep.title}</h4>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">{currentStep.subtitle}</p>
        </div>

        {/* Option Cards */}
        <div className="space-y-2">
          {currentStep.options.map((opt) => {
            const isSelected = (selections[currentStep.step_id] || []).includes(opt.param_patch);
            return (
              <div
                key={opt.id}
                onClick={() => toggleOption(currentStep.step_id, opt.param_patch, !isMulti)}
                className={`group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all select-none ${
                  isSelected
                    ? 'bg-[#C79A4E]/10 border-[#C79A4E]/60 shadow-md shadow-[#C79A4E]/5'
                    : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 hover:bg-stone-850'
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-[#C79A4E] border-amber-400 text-black shadow-sm'
                      : 'border-stone-700 bg-stone-800/80 text-transparent group-hover:border-stone-600'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>

                {opt.icon && <span className="text-base select-none shrink-0">{opt.icon}</span>}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold tracking-wide ${
                        isSelected ? 'text-amber-200' : 'text-stone-200 group-hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded-full border shrink-0 ${
                          isSelected
                            ? 'bg-[#C79A4E]/20 text-amber-300 border-[#C79A4E]/40'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400 group-hover:text-stone-300">
                    {opt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Write-In Option */}
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#C79A4E] font-medium mb-1">
            <Edit3 className="w-3 h-3" />
            <span>✍️ Type your own custom constraint or specific query:</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={writeIns[currentStep.step_id] || ''}
              onChange={(e) => handleWriteInChange(currentStep.step_id, e.target.value)}
              placeholder={currentStep.write_in_placeholder || 'Type custom constraint, station, or parameter...'}
              className="w-full px-3 py-2 text-xs bg-stone-950 border border-stone-800 rounded-xl text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#C79A4E]/50 focus:ring-1 focus:ring-[#C79A4E]/30 transition-all font-mono"
            />
            {writeIns[currentStep.step_id] && (
              <button
                onClick={() => handleWriteInChange(currentStep.step_id, '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-950/80 border-t border-stone-800">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-400 font-mono">
            Active Filters: <strong className="text-[#C79A4E]">{totalSelectedCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentStepIdx > 0 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-300 bg-stone-900 border border-stone-800 hover:bg-stone-850 hover:text-white transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}

          {currentStepIdx < totalSteps - 1 ? (
            <>
              <button
                onClick={handleNext}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-900 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-[#C79A4E]/20 transition-all"
              >
                <span>Next Question</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={handleFinalSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-[#C79A4E]/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Refine Investigation ({totalSelectedCount})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

