import React from "react";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the inner scrollable content region. */
  contentClassName?: string;
  /** Renders inline (e.g. a floating watermark) as a sibling of the
   * scrollable content, INSIDE the outer `relative overflow-hidden` host --
   * never inside the scroll region itself. */
  overlay?: React.ReactNode;
  /** false for a panel that should never scroll internally (rare -- most
   * panels want this true). */
  scrollable?: boolean;
}

// H.4.1: shared panel host, built specifically to prevent the exact bug
// class confirmed live and fixed this session (commit 1ceca2f): a watermark
// or other `absolute inset-0` overlay escaping to a distant scrollable
// ancestor because the panel hosting it was missing `position: relative`,
// or had its OWN `overflow-y-auto` on the SAME element the overlay lived in
// instead of a separate inner scroll region. Every caller gets the correct
// split automatically -- an outer `relative overflow-hidden` host (for any
// overlay) plus a separate inner `overflow-y-auto` region for the actual
// content -- instead of each screen re-deriving this by hand and
// occasionally getting it wrong, which is how that bug happened in the
// first place.
export const Panel: React.FC<PanelProps> = ({
  children, className = "", contentClassName = "", overlay, scrollable = true,
}) => {
  return (
    <div className={`glass-card relative overflow-hidden ${className}`}>
      {overlay}
      <div className={scrollable ? `relative flex-1 overflow-y-auto ${contentClassName}` : `relative ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
