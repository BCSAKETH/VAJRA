import { useEffect, useRef, RefObject } from "react";

// Confirmed live bug (2026-09-15): several dropdown/overlay panels across
// the app (starting with NotificationBellPanel.tsx) had NO click-outside
// handler at all -- opening was the only state change wired, so once open,
// the only way to close was clicking the exact same trigger button again.
// One shared hook instead of re-deriving this listener by hand in every
// component, so the fix can't be half-applied and the same bug can't
// silently reappear in a future dropdown.
export function useClickOutside<T extends HTMLElement>(isOpen: boolean, onClose: () => void): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // mousedown (not click) so a drag-select that ends outside the panel
    // doesn't spuriously close it; capture phase so this still fires even
    // if a child stops propagation on its own click handler.
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);
  return ref as RefObject<T>;
}
