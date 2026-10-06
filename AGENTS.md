# Automation & Agent Runbook

## Agent skills

### Issue tracker

Issues tracked as GitHub Issues in this repo (github.com/abhibansal60/led-catalog), using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/` at repo root, created lazily as needed). See `docs/agents/domain.md`.

---

## Active Automations

### GitHub Actions — Cloudflare Pages Deploy
- **Location:** `.github/workflows/deploy.yaml`
- **Triggers:**
  - `push` events to the `main` branch (production deploys).
  - `pull_request` events (preview deploys per branch).
- **Secrets required:**
  - `CLOUDFLARE_API_TOKEN` — API token with “Cloudflare Pages: Edit” + “Workers KV Storage: Read/Write” for the target account.
  - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier hosting the Pages project.
- **Outputs:** production deployment on the Cloudflare Pages project `led-catalog`; each PR run deploys a preview under the PR's head branch name.
- **Rollback:** Revert or cherry-pick an earlier commit and push to `main` (the workflow redeploys automatically). To pause deployments, disable the workflow in GitHub (`Actions` → `Deploy to Cloudflare Pages` → “Disable workflow”) and/or rotate the Cloudflare API token.

### Local / On-Demand AI Assistant
- **Safety:** Work on a branch and open a PR for human review; a push to `main` deploys straight to production.

---

## Handover Checklist for New Agents
1. Read the latest deployment logs (GitHub Actions + Cloudflare Pages dashboard) to confirm the pipeline is healthy.
2. Verify secrets have not expired (`CLOUDFLARE_API_TOKEN` shows a recent update date and proper scopes).
