import React, { ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };
  public props!: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled component error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[220px] flex items-center justify-center p-6 bg-stone-950/40 text-stone-200">
          <div className="max-w-md w-full glass-card border border-rose-500/30 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-rose-300 uppercase tracking-wider font-mono">
                {this.props.fallbackTitle || "Interface Render Interrupted"}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed font-sans">
                {this.props.fallbackMessage || "A localized error prevented this section from rendering. You can recover by resetting the view."}
              </p>
              {this.state.error && (
                <div className="mt-2 p-2 rounded bg-stone-950/80 border border-stone-850 text-[10px] font-mono text-stone-500 text-left truncate">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C79A4E]/15 border border-[#C79A4E]/30 text-[#C79A4E] hover:bg-[#C79A4E]/25 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset & Reload Section</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
