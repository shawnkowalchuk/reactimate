/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** One-line JSON of the Firebase web app config; unset = auth disabled. */
  readonly VITE_FIREBASE_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
