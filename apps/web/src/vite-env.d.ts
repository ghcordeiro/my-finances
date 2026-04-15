/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta da API (produção ou dev sem proxy). */
  readonly VITE_API_URL?: string;
  /** Alvo do proxy Vite em dev (padrão http://127.0.0.1:3000). Defina no `.env` da raiz como `VITE_DEV_PROXY_TARGET`. */
  readonly VITE_DEV_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
