/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Injected by Vite `define` from package.json. */
declare const __APP_VERSION__: string
