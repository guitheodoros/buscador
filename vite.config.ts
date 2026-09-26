import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "/buscador/",
  // Em produção, substitui VITE_API_BASE com a URL do Railway.
  // Em dev, não define nada — apiBase.ts cai no default "/api" (proxy local).
  ...(mode === "production" && {
    define: {
      "import.meta.env.VITE_API_BASE": JSON.stringify(
        process.env.VITE_API_BASE ?? "https://api-production-ed897.up.railway.app/api"
      ),
    },
  }),
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
}));
