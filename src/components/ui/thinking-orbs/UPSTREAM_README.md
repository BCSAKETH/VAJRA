# thinking-orbs

Dotted thought-orb loading indicators for AI & agent UIs. Six hand-tuned animated states, each shipped at two purpose-tuned sizes, rendered on a plain 2D canvas — no WebGL, no filters, works identically in Chrome, Safari and Firefox.

[Live demo](https://rareformlabs.github.io/thinking-orbs/) · [Repository](https://github.com/RareFormLabs/thinking-orbs) · [Report an issue](https://github.com/RareFormLabs/thinking-orbs/issues)

## Install

```bash
npm install thinking-orbs
```

## Quick start

```vue
import { ThinkingOrb } from 'thinking-orbs';
```

```vue
<ThinkingOrb state="searching" :size="64" />
```

## States

Six verbs an agent can be doing, each a distinct animation:

```vue
<ThinkingOrb state="working" />
<ThinkingOrb state="searching" />
<ThinkingOrb state="solving" />
<ThinkingOrb state="listening" />
<ThinkingOrb state="composing" />
<ThinkingOrb state="shaping" />
```

## Sizes

Two tuned presets — separate designs, not a scale factor. `64` for chat-avatar scale, `20` for inline-text scale. Each carries its own dot count, dot size and speed tuning:

```vue
<ThinkingOrb state="working" :size="64" />
<ThinkingOrb state="working" :size="20" />
```

## Theme

Strictly monochrome — light ink for dark backgrounds, dark ink for light backgrounds — with the mode picked automatically from the host project:

```vue
<ThinkingOrb theme="auto" />
<ThinkingOrb theme="dark" />
<ThinkingOrb theme="light" />
```

`auto` resolves in three layers and updates live when any of them change:

1. an ancestor `data-theme="dark|light"` attribute or `dark`/`light` class (the Tailwind / shadcn convention), watched via `MutationObserver`;
2. otherwise `prefers-color-scheme`, subscribed for live OS theme switches;
3. SSR-safe — the canvas paints only on the client, after the theme has resolved.

## Other props

```vue
<ThinkingOrb
  state="solving"
  :size="20"
  :speed="1.5"
  :paused="false"
  aria-label="Analysing repository…"
/>
```

All other `<canvas>` attrs (`class`, `style`, `data-*`, `aria-*`, …) pass through.

## Accessibility & performance

- `role="img"` with a sensible per-state `aria-label` out of the box.
- `prefers-reduced-motion: reduce` renders a static representative frame — no animation — and still follows the live theme.
- Every instance pauses automatically when scrolled offscreen (`IntersectionObserver`) or when the tab is hidden, and resumes in phase — all instances share one clock.
- Plain 2D canvas arcs only: no `ctx.filter`, no SVG filters, no WebGL — the same pixels everywhere, cheap on low-end devices. Device-pixel-ratio capped at 2.

## License

MIT © Jakub Antalik
