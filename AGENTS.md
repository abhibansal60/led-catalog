# Automation & Agent Runbook

## Purpose
Provide a single source of truth for every automated workflow and AI helper attached to the `led-catalog` project. Any new contributor or agent should be able to answer:
1. What automation exists?
2. When does it run?
3. Which secrets or credentials does it require?
4. How do we roll back or pause it safely?

Keep this document updated whenever an agent is added, modified, or retired.

---

## Active Automations

### GitHub Actions — Cloudflare Pages Deploy
- **Location:** `.github/workflows/deploy.yaml`
- **Triggers:**
  - `push` events to the `main` branch (production deploys).
  - `pull_request` events (preview deploys per branch).
- **Purpose:** Build the Vite app and publish the `dist/` bundle plus Pages Functions to Cloudflare Pages.
- **Secrets required:**
  - `CLOUDFLARE_API_TOKEN` — API token with “Cloudflare Pages: Edit” + “Workers KV Storage: Read/Write” for the target account.
  - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier hosting the Pages project.
- **Steps executed:**
  1. Check out the repository.
  2. Provision Node.js 20 and restore the npm cache.
  3. Install dependencies with `npm ci`.
  4. Build the production bundle with `npm run build`.
  5. Publish `dist/` to Cloudflare Pages via `cloudflare/pages-action@v1` (Wrangler 4.x), bundling Functions from `functions/`.
- **Outputs:** Updated production deployment on the Cloudflare Pages project `led-catalog`, plus unique preview deployments for non-`main` branches (visible in both GitHub Actions logs and the Cloudflare Pages dashboard).
- **Rollback:** Revert or cherry-pick an earlier commit and push to `main` (the workflow redeploys automatically). To pause deployments, disable the workflow in GitHub (`Actions` → `Deploy to Cloudflare Pages` → “Disable workflow”) and/or rotate the Cloudflare API token.

### Local / On-Demand AI Assistant
- **Purpose:** Generate code, docs, and operational updates on request.
- **Scope:** Advisory only; human review required before merge.
- **Safety:** The assistant must not commit directly to `main`. All generated changes go through normal PR or push review, and sensitive tokens are never shared.

---

## Operating Guidelines
- Automations should focus on deterministic tasks (build, lint, test, deploy). Anything non-deterministic must include human approval gates.
- Store credentials exclusively in the GitHub Actions secrets vault. Never commit tokens, API keys, or account IDs to the repo.
- When adjusting a workflow, update this runbook with the new behavior, triggers, and rollback steps.
- Monitor Cloudflare Pages usage monthly (bandwidth, requests, and Durable Objects/KV quotas) to ensure the project stays within the free allocation.
- Prefer small, composable workflows. If a workflow grows complex, break it into dedicated jobs or files with clear ownership.

---

## Handover Checklist for New Agents
1. Read the latest deployment logs (GitHub Actions + Cloudflare Pages dashboard) to confirm the pipeline is healthy.
2. Verify secrets have not expired (`CLOUDFLARE_API_TOKEN` shows a recent update date and proper scopes).
3. Run `npm run build` locally to ensure the codebase still compiles.
4. Update both this document and `README.md` if you modify automation logic or hosting details.
5. Announce changes to the team (Slack/WhatsApp) so operators know the new behavior.

---

## Ideas Under Evaluation
- Pull request preview deploys on Cloudflare Pages with extra smoke checks.
- Lightweight UI smoke tests (Playwright) that can run before deployment.
- Automated dependency update bot (Renovate or Dependabot) with a weekly cadence.

Document decisions here before implementing new agents so future maintainers know the rationale.
