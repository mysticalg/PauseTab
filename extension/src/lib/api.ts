export const API_BASE_URL = import.meta.env.VITE_PAUSETAB_API_BASE_URL || "http://localhost:8787";
export const SITE_URL = import.meta.env.VITE_PAUSETAB_SITE_URL || "http://localhost:5173";

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
