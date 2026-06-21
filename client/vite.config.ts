import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? "/" : "./",
  root: __dirname,
  envDir: projectRoot,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:3847",
      "/health": "http://127.0.0.1:3847",
    },
  },
});
