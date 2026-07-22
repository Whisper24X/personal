import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000"
    },
    fs: {
      allow: [workspaceRoot]
    }
  }
});
