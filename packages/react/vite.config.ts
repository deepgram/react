import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "@deepgram/agents",
      ],
    },
    minify: "terser",
    sourcemap: true,
  },
  plugins: [
    react(),
    dts({ rollupTypes: true, pathsToAliases: false }),
  ],
});
