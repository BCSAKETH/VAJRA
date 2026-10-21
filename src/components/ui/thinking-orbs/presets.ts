// The shipped tunings: six states × two sizes, baked from the inkform
// mini-page tuning session. `count`/`size` are multipliers over the base
// fine profiles; `speed` multiplies the shared clock. Resolved once per
// (state, size) pair and cached — the render loop sees plain numbers.

import type { ModeOpts } from './engine/profiles';
import { BASE_PROFILES, scaleCounts, scaleRadii } from './engine/profiles';
import type { OrbSize, OrbState } from './types';

export type ModeKey = 'orbits' | 'globe' | 'rubik' | 'wave' | 'ribbon' | 'morph';

export const STATE_TO_MODE: Record<OrbState, ModeKey> = {
  working: 'orbits',
  searching: 'globe',
  solving: 'rubik',
  listening: 'wave',
  composing: 'ribbon',
  shaping: 'morph'
};

interface Preset {
  speed: number;
  count: number;
  size: number;
  /** Extra mode opts merged verbatim after scaling. */
  extra?: ModeOpts;
}

const PRESETS: Record<ModeKey, Record<OrbSize, Preset>> = {
  orbits: {
    64: { speed: 1.885, count: 1.0, size: 1.15 },
    20: { speed: 3.2, count: 0.65, size: 1.8 }
  },
  globe: {
    64: { speed: 2.015, count: 0.65, size: 1.25, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.4, count: 0.45, size: 1.6, extra: { scanMul: 4.335, dimBase: 0.45 } }
  },
  rubik: {
    64: { speed: 1.82, count: 0.55, size: 1.15 },
    20: { speed: 2.1, count: 0.40, size: 1.6 }
  },
  wave: {
    64: { speed: 4.388, count: 0.55, size: 1.2 },
    20: { speed: 3.6, count: 0.42, size: 1.5 }
  },
  ribbon: {
    64: { speed: 2.34, count: 0.45, size: 1.1, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 2.8, count: 0.35, size: 1.3, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } }
  },
  morph: {
    64: { speed: 2.405, count: 0.85, size: 0.65, extra: { spread: 1.45 } },
    20: { speed: 2.2, count: 0.65, size: 1.0, extra: { spread: 1.45 } }
  }
};

export interface Resolved {
  mode: ModeKey;
  speed: number;
  opts: ModeOpts;
}

const cache = new Map<string, Resolved>();

/** Resolve a (state, size) pair to its mode + fully-scaled draw options. */
export function resolvePreset(state: OrbState, size: OrbSize): Resolved {
  const key = `${state}-${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const mode = STATE_TO_MODE[state] || 'orbits';
  const modePresets = PRESETS[mode] || PRESETS.orbits;
  
  // High-clarity resolution: size >= 28 uses high-density preset
  const basePresetKey: 20 | 64 = size >= 28 ? 64 : 20;
  const preset: Preset = (modePresets as any)[size] ?? modePresets[basePresetKey] ?? { speed: 2, count: 1, size: 1 };
  
  let opts: ModeOpts = { ...(BASE_PROFILES[mode] || BASE_PROFILES.orbits) };
  if (preset && typeof preset.count === 'number' && preset.count !== 1) {
    opts = scaleCounts(opts, preset.count);
  }
  if (preset && typeof preset.size === 'number' && preset.size !== 1) {
    opts = scaleRadii(opts, preset.size);
  }
  if (preset && preset.extra) {
    opts = { ...opts, ...preset.extra };
  }

  const resolved: Resolved = { mode, speed: preset?.speed ?? 2, opts };
  cache.set(key, resolved);
  return resolved;
}
