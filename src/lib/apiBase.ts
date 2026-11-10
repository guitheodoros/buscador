// Em dev: Vite proxy encaminha /api -> localhost:3001.
// Em produção (GitHub Pages): aponta para o Railway backend via VITE_API_BASE.
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
