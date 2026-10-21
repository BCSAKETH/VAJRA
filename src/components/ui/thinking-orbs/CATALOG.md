# Thinking Orbs — catalog (MIT)

Dotted 3D "thought-orb" loading indicators for **AI / agent UIs**. Plain 2D canvas (no WebGL, no filters), monochrome, auto light/dark, `prefers-reduced-motion` → static frame, pauses offscreen/hidden tab. ~1,100 lines, **zero runtime dependencies** (Vue adapter needs `vue>=3.4`; React adapter needs `react>=18`).

## When to use
Show that an assistant/agent is doing something specific: pick the **state that matches the verb**.
- **working** — particles on tilted orbits (generic busy)
- **searching** — scan meridian sweeping a dotted globe (retrieval, web search)
- **solving** — bands scramble in quarter-turns then click back (reasoning, computing)
- **listening** — waveform rolling through latitude rings (voice input)
- **composing** — undulating multi-band sash (writing/generating)
- **shaping** — dotted outline morphs circle→triangle→square (designing/formatting)

Two separately-tuned sizes (not a scale factor): **64** = chat-avatar scale, **20** = inline-with-text scale. Props: `state`, `size` (64|20), `theme` ("auto"|"dark"|"light"), `speed` (multiplier), `paused`, plus any canvas attrs (`aria-label` overrides the default per-state label).

## Files
- `react/ThinkingOrb.tsx` — **React/Next adapter** (client component, `forwardRef`). Use this one in React projects.
- `vue/ThinkingOrb.ts`, `vue/theme.ts` — upstream Vue 3 component.
- `engine/*`, `presets.ts`, `types.ts` — framework-agnostic painters + the 6×2 baked presets. `index.ts` re-exports `resolvePreset` + `MODE_DRAWS` for driving your own canvas (e.g. Svelte, vanilla).

## Composition patterns (from upstream's demo)
- **Status chip** — inline pill, `h-9 rounded-full pl-2 pr-3.5 gap-2 text-xs`, **20px orb** + shimmering label like "Agent searching…".
- **Large pill** — `w-[270px] h-[74px] rounded-full pl-[9px] pr-8 gap-3 text-lg`, **64px orb shown at 56px** + label like "Solving….".
- Both pair the orb with Transitions.dev's `t-shimmer` label (`libraries/transitions-dev/recipes/15-shimmer-text.md`) — orb + shimmering text reads as one "agent is working" unit.
- Ready-made: `react/StatusPill.tsx` (`<StatusPill state="searching" label="Agent searching…" variant="chip" />`). Surface tokens `--pill-fill / --pill-stroke / --pill-fg` are listed in the file header.

## Usage (React)
```tsx
import { ThinkingOrb } from "@/components/thinking-orbs/react/ThinkingOrb";
<ThinkingOrb state="searching" size={64} />
<p>Analysing <ThinkingOrb state="solving" size={20} className="inline-block align-middle" /> repository…</p>
```
Theme "auto" follows an ancestor `data-theme="dark|light"` or `.dark`/`.light` class (shadcn/Tailwind convention) then the OS. **If the project uses Untitled UI's `.dark-mode` class, pass `theme="dark"`/`"light"` explicitly** (the auto detector does not look for `.dark-mode`).
Fit: AI chat "thinking" indicator, agent status rows, voice UI (`listening`), empty/loading states of AI features. Don't use as a generic spinner for fast (<400 ms) loads.
