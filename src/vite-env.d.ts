/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_TIMESTAMP?: string;
  readonly VITE_COMMIT_REF?: string;
  readonly VITE_DEPLOYMENT_ID?: string;
}
