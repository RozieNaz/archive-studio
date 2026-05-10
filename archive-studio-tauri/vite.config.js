import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "@tauri-apps/api"],
          data: ["./src/data/metadata-index.json"]
        }
      }
    }
  }
});
