/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_POSTHOG_KEY?: string;
    readonly VITE_POSTHOG_API_HOST?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Injected via vite.config.ts's `define`, from version.json at the repo root.
declare const __APP_VERSION__: string;
