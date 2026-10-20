/**
 * VAJRA-VAK Mascot Decoupled PubSub Event Bus
 * Connects backend streaming SSE events and chat pipeline states to the mascot.
 */

export type VajraVakEvent =
  | "ai_processing_started"
  | "retrieval_started"
  | "result_ready"
  | "critical_alert"
  | "operation_success";

export type EventHandler = (payload?: any) => void;

export class VajraVakEventBus {
  private handlers: Map<VajraVakEvent, Set<EventHandler>> = new Map();

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

  emit(event: VajraVakEvent, payload?: any): void {
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
  }
}

export const vakBus = new VajraVakEventBus();
