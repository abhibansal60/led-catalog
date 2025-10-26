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

### GitHub Actions — Netlify Deploy
- **Location:** `.github/workflows/deploy.yaml`
- **Trigger:** `push` events to the `main` branch (direct pushes or merged PRs).
- **Purpose:** Build the Vite app and publish the `dist/` output to Netlify.
- **Secrets required:**
  - `NETLIFY_AUTH_TOKEN` — personal access token (Netlify → User settings → Applications). Expires yearly; rotate before expiry.
  - `NETLIFY_SITE_ID` — site UUID (Netlify dashboard → Site configuration → Site information).
- **Steps executed:**
  1. Checkout repository.
  2. Install dependencies with `npm ci`.
  3. Create a production bundle via `npm run build`.
  4. Deploy `dist/` using `netlify/actions/netlify-deploy@v2`.
- **Outputs:** Updated production site at `https://bansallights.netlify.app/` with release logs in both GitHub Actions and the Netlify deploy history.
- **Rollback:** Revert or cherry-pick a previous commit to `main`, then re-run the workflow. If deployment must be paused, disable the workflow in GitHub (`Actions` tab → `Deploy to Netlify` → three dots → `Disable workflow`) and/or revoke the Netlify token.

### Local / On-Demand AI Assistant
- **Purpose:** Generate code, docs, and operational updates on request.
- **Scope:** Advisory only; human review required before merge.
- **Safety:** The assistant must not commit directly to `main`. All generated changes go through normal PR or push review, and sensitive tokens are never shared.

---

## Operating Guidelines
- Automations should focus on deterministic tasks (build, lint, test, deploy). Anything non-deterministic must include human approval gates.
- Store credentials exclusively in the GitHub Actions secrets vault. Never commit tokens or site IDs to the repo.
- When adjusting a workflow, update this runbook with the new behavior, triggers, and rollback steps.
- Monitor Netlify usage monthly (bandwidth and build minutes) to ensure the project stays within the free tier.
- Prefer small, composable workflows. If a workflow grows complex, break it into dedicated jobs or files with clear ownership.

---

## Handover Checklist for New Agents
1. Read the latest deployment logs (GitHub Actions + Netlify) to confirm the pipeline is healthy.
2. Verify secrets have not expired (`NETLIFY_AUTH_TOKEN` shows a recent update date).
3. Run `npm run build` locally to ensure the codebase still compiles.
4. Update both this document and `README.md` if you modify automation logic or hosting details.
5. Announce changes to the team (Slack/WhatsApp) so operators know the new behavior.

---

## Ideas Under Evaluation
- Pull request preview deploys on Netlify using branch-based contexts.
- Lightweight UI smoke tests (Playwright) that can run before deployment.
- Automated dependency update bot (Renovate or Dependabot) with a weekly cadence.

Document decisions here before implementing new agents so future maintainers know the rationale.
