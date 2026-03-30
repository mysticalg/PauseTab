/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAUSETAB_API_BASE_URL?: string;
  readonly VITE_PAUSETAB_SITE_URL?: string;
  readonly VITE_PAUSETAB_ENABLE_LOCAL_TRIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
