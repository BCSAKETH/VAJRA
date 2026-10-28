/**
 * VAJRA-VAK Mascot Decoupled PubSub Event Bus
 * Connects backend streaming SSE events and chat pipeline states to the mascot.
 * Fully compliant with the VAJRA-VAK Sentinel Owl Master Architecture.
 */

export type VajraVakEvent =
  | "app_loaded"
  | "input_focused"
  | "user_typing"
  | "query_submitted"
  | "ai_processing_started"
  | "retrieval_started"
  | "file_uploaded"
  | "file_analysis_started"
  | "map_analysis_started"
  | "network_analysis_started"
  | "result_ready"
  | "assistant_speaking"
  | "operation_success"
  | "operation_error"
  | "critical_alert"
  | "page_changed"
  | "idle_timeout"
  | "user_returned"
  | "deep_analysis_started"
  | "agent_alert";

export interface AgentAlertEvent {
  agentId: string;
  agentCode: string;
  agentName: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  findings: string;
  caseNo?: string;
  timestamp: string;
}

export interface MascotEventPayload {
  caseNo?: string;
  riskTier?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  anchorTarget?: "ANCHOR_PERCH" | "ANCHOR_MAP" | "ANCHOR_DOSSIER" | "ANCHOR_GRAPH" | string;
  quipText?: string;
  data?: any;
}

export type EventHandler = (payload?: MascotEventPayload) => void;

export class VajraVakEventBus {
  private handlers: Map<VajraVakEvent, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<(event: { type: VajraVakEvent; payload?: MascotEventPayload }) => void> = new Set();

  on(event: VajraVakEvent, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: VajraVakEvent, handler: EventHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  subscribe(handler: (event: { type: VajraVakEvent; payload?: MascotEventPayload }) => void): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  emit(event: VajraVakEvent, payload?: MascotEventPayload): void {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`[VajraVakEventBus] Error in handler for event '${event}':`, e);
        }
      });
    }

    this.wildcardHandlers.forEach((handler) => {
      try {
        handler({ type: event, payload });
      } catch (e) {
        console.error(`[VajraVakEventBus] Error in wildcard handler for event '${event}':`, e);
      }
    });
  }
}

export const vakBus = new VajraVakEventBus();
export const vajraVakBus = vakBus;

