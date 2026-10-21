"use client";
// React adapter for thinking-orbs — WRITTEN FOR THIS SKILL (not part of upstream, which ships Vue only).
// Mirrors upstream vue/ThinkingOrb.ts + vue/theme.ts behaviour on the framework-agnostic engine:
//  - canvas 2D, DPR capped at 2, role="img" + per-state aria-label
//  - prefers-reduced-motion -> one static frame
//  - pauses when offscreen (IntersectionObserver) or tab hidden; resumes in phase (shared clock)
//  - theme "auto": ancestor [data-theme] / .dark|.light class -> prefers-color-scheme, live-updating
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CanvasHTMLAttributes, type RefObject } from "react";
import { MODE_DRAWS } from "../engine/registry";
import { resolvePreset } from "../presets";
import type { OrbSize, OrbState, OrbTheme } from "../types";

const LABELS: Record<OrbState, string> = {
  working: "Working…", searching: "Searching…", solving: "Solving…",
  listening: "Listening…", composing: "Composing…", shaping: "Shaping…",
};

function ancestorTheme(el: Element | null): boolean | null {
  let node: Element | null = el;
  while (node) {
    const attr = node.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    if (node.classList.contains("dark")) return true;
    if (node.classList.contains("light")) return false;
    node = node.parentElement;
  }
  return null;
}
const systemDark = () => typeof matchMedia === "undefined" || matchMedia("(prefers-color-scheme: dark)").matches;

function useResolvedDark(theme: OrbTheme, host: RefObject<Element | null>): boolean {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    if (theme === "dark") { setDark(true); return; }
    if (theme === "light") { setDark(false); return; }
    const resolve = () => setDark(ancestorTheme(host.current) ?? systemDark());
    resolve();
    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener("change", resolve);
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && host.current) {
      observer = new MutationObserver(resolve);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"], subtree: true });
    }
    return () => { mq?.removeEventListener("change", resolve); observer?.disconnect(); };
  }, [theme, host]);
  return dark;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export interface ThinkingOrbProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "width" | "height"> {
  /** Which animation to show. @default "working" */
  state?: OrbState;
  /** Tuned size preset: 64 (chat-avatar) or 20 (inline text). @default 64 */
  size?: OrbSize;
  /** "auto" detects from the host project. @default "auto" */
  theme?: OrbTheme;
  /** Speed multiplier on the preset speed. @default 1 */
  speed?: number;
  /** Freeze on the current frame. @default false */
  paused?: boolean;
}

export const ThinkingOrb = forwardRef<HTMLCanvasElement, ThinkingOrbProps>(function ThinkingOrb(
  props: ThinkingOrbProps,
  forwardedRef,
) {
  const {
    state = "working",
    size = 64,
    theme = "auto",
    speed = 1,
    paused = false,
    style,
    "aria-label": ariaLabel,
    ...rest
  } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(forwardedRef, () => canvasRef.current as HTMLCanvasElement);
  const dark = useResolvedDark(theme, canvasRef);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(3, Math.max(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 2));
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const { mode, speed: baseSpeed, opts } = resolvePreset(state, size);
    const draw = MODE_DRAWS[mode] || MODE_DRAWS.orbits;
    if (!draw) return;
    const effSpeed = baseSpeed * speed;
    const frame = (tSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      draw(ctx, size, tSec, dark, opts);
    };

    if (reduced) { frame(0.6); return; }

    let raf = 0;
    let running = false;
    const loop = () => {
      frame((performance.now() / 1000) * effSpeed);
      if (running) raf = requestAnimationFrame(loop);
    };
    const start = () => { if (running || paused) return; running = true; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    frame((performance.now() / 1000) * effSpeed);

    let visible = true;
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && document.visibilityState !== "hidden") start(); else stop();
        })
      : null;
    io?.observe(canvas);
    const onVis = () => { if (document.visibilityState === "hidden") stop(); else if (visible) start(); };
    document.addEventListener("visibilitychange", onVis);
    if (!io) start();

    return () => { stop(); io?.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [state, size, speed, paused, dark, reduced]);

  return (
    <canvas
      {...rest}
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel ?? LABELS[state]}
      style={{ width: size, height: size, display: "block", ...style }}
    />
  );
});

export default ThinkingOrb;
