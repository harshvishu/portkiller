import { defineConfig } from "vite";

// Vite config tuned for Tauri: fixed dev port, no clobbering the terminal,
// and ignore the Rust source tree so the dev server doesn't reload on it.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
