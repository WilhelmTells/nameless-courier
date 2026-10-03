import { defineConfig } from "vite";

// Served from GitHub Pages at https://wilhelmtells.github.io/nameless-courier/,
// so assets must resolve under the /nameless-courier/ base path.
export default defineConfig({
  base: "/nameless-courier/",
  build: {
    // Rapier ships its physics engine as inlined WebAssembly, which makes the
    // bundle large by design.
    chunkSizeWarningLimit: 6000,
  },
});
