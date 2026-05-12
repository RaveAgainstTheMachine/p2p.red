/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_BUILD_VARIANT?: string;
  readonly VITE_BUILD_VERSION?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_PEERJS_HOST?: string;
  readonly VITE_PEERJS_PORT?: string;
  readonly VITE_PEERJS_PATH?: string;
  readonly VITE_PEERJS_SECURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'streamsaver';
