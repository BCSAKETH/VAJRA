import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'client',
    },
    // Finals-part 3.md §21: MapLibre GL JS v6 ships its tile-processing
    // worker as a separate .mjs file it locates at runtime relative to its
    // own module URL. Vite's dependency pre-bundling can fold that worker
    // file into the wrong chunk before Rollup ever sees the `?worker&url`
    // import in Tactical3DMap.tsx, breaking the same worker resolution the
    // explicit setWorkerUrl() call there is meant to fix. Excluding it from
    // pre-bundling keeps the worker as a real, separately-emitted asset.
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
