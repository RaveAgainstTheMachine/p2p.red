/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_BUILD_VARIANT?: string;
  readonly VITE_BUILD_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'streamsaver';
