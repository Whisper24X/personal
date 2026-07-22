import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"]
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api")
  }
});
