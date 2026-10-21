// Framework-agnostic surface (engine + presets). Pick an adapter: ./react/ThinkingOrb or ./vue/ThinkingOrb.
export type { ThinkingOrbProps, OrbState, OrbSize, OrbTheme } from './types';
export { resolvePreset, STATE_TO_MODE, type ModeKey, type Resolved } from './presets';
export { MODE_DRAWS } from './engine/registry';
