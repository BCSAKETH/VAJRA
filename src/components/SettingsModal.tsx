import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SettingsScreen } from "../screens/SettingsScreen";

/**
 * Finals-part 3.md §32-35: converts Settings from a full-page screen
 * (which unmounted whatever workspace the officer was in) into an
 * application-wide modal overlay. Deliberately WRAPS the existing,
 * already-working `SettingsScreen` rather than reimplementing its four
 * tabs from scratch -- every real feature (profile, password change,
 * appearance, Zia voice studio, diagnostics) stays exactly as tested; only
 * the presentation shell changes from "replace the page" to "float over
 * it." `SettingsScreen`'s own outer wrapper already uses `h-full` +
 * `overflow-y-auto` (not a hardcoded viewport height), so it drops into a
 * fixed-height dialog box cleanly with no internal changes needed.
 *
 * z-index layering (L254): backdrop z-[100], dialog z-[105], nested child
 * modals SettingsScreen opens (ChangePasswordModal, the inline Profile
 * Change Request modal) bumped to z-[120] so they render ABOVE this dialog
 * instead of trapped behind it -- see those two files' own comments on the
 * matching fix.
 */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // L251: background scroll bleed -- lock body scroll while the overlay is up.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // L252 (focus trap) + L261 (Escape must not propagate to background
  // listeners -- notification bell, active tool-turn cancellation, etc.).
  // Capture phase (`true`) so this fires before any background `keydown`
  // listener attached without a capture flag of its own.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;

    const getFocusable = (): HTMLElement[] => {
      if (!dialog) return [];
      const nodeList: NodeListOf<HTMLElement> = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
      const all: HTMLElement[] = Array.prototype.slice.call(nodeList);
      return all.filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    // Focus the close button on open so a keyboard/screen-reader user lands
    // somewhere sane immediately, rather than focus staying on whatever
    // triggered the modal (now hidden behind the backdrop).
    const raf = requestAnimationFrame(() => {
      const focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onMouseDown={(e) => {
        // Plain backdrop click closes -- a click that started inside the
        // dialog and only ended on the backdrop (a text selection dragged
        // past the edge) must NOT close it and silently discard typed
        // input (L262). onMouseDown + currentTarget-equality check is the
        // narrow, reliable version of that guard.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative z-[105] flex flex-col w-full h-full sm:h-[85vh] sm:max-h-[720px] md:h-[640px] max-w-none sm:max-w-4xl bg-[#181614] border border-stone-800 sm:rounded-xl shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-stone-900/85 border border-stone-800 text-stone-400 hover:text-white hover:border-stone-600 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-h-0">
          <SettingsScreen />
        </div>
      </div>
    </div>
  );
};
