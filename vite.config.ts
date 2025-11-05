import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const buildTimestamp = new Date().toISOString();

const resolveCommitRef = (): string | null =>
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.NETLIFY_COMMIT_REF ??
  process.env.GITHUB_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.COMMIT_REF ??
  null;

const resolveDeploymentId = (): string | null =>
  process.env.CF_PAGES_DEPLOYMENT_ID ??
  process.env.NETLIFY_DEPLOY_ID ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  define: {
    "import.meta.env.VITE_BUILD_TIMESTAMP": JSON.stringify(buildTimestamp),
    "import.meta.env.VITE_COMMIT_REF": JSON.stringify(resolveCommitRef()),
    "import.meta.env.VITE_DEPLOYMENT_ID": JSON.stringify(resolveDeploymentId()),
  },
});
