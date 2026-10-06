# Deploy: GitHub Actions → Cloudflare Pages

Workflow: `.github/workflows/deploy.yaml` (workflow name "Deploy to Cloudflare Pages"), publishing to the Cloudflare Pages project `led-catalog`.

## Triggers

- `push` to `main`: production deploy.
- `pull_request`: preview deploy, published under the PR's head branch name.

## Secrets

- `CLOUDFLARE_API_TOKEN`: scopes "Cloudflare Pages: Edit" + "Workers KV Storage: Read/Write" on the target account.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account hosting the Pages project.

## Health check

Before changing the pipeline:

1. Read the latest run logs (GitHub Actions and the Cloudflare Pages dashboard) to confirm deploys are green.
2. Confirm `CLOUDFLARE_API_TOKEN` is unexpired, recently updated and carries the scopes above.

## Rollback and pause

- **Rollback:** revert or cherry-pick an earlier commit onto `main`; the workflow redeploys.
- **Pause:** disable the workflow (GitHub `Actions` → "Deploy to Cloudflare Pages" → "Disable workflow") and/or rotate the Cloudflare API token.

## Rebuilding the Pages project

Project deleted or token lost → follow `README.md` § "Contingency: Rebuilding the Cloudflare Pages Project".
