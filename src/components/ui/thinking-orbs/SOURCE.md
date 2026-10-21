# Source
- Upstream: https://github.com/RareFormLabs/thinking-orbs (live demo: https://rareformlabs.github.io/thinking-orbs/)
- Licence: MIT © 2026 Jakub Antalik (see LICENSE)
- Snapshot: e09bfa600c9196e0e8979f5ba59bcda45cbe1fa7 Tue Jul 21 12:21:52 2026 -0500
- Upstream ships **Vue 3 only** (`vue/`). `react/ThinkingOrb.tsx` is an adapter written for this skill on top of the same framework-agnostic engine; tested (tsc clean + 14 jsdom tests with a mock canvas context — verifies it runs and loops correctly, not pixel output).
- Demo app not imported, except `vue/Examples.reference.vue` (upstream's pill/chip compositions, kept as a reference) — the Vue playground/site is left out. `react/StatusPill.tsx` is my React port of those compositions.
- Refresh workflow: use `references/upstream-update-workflow.md`; compare the current upstream framework/package metadata before relying on the older local snapshot.

