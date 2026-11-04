# Deploy: GitHub Actions → Cloudflare Pages

Workflow: `.github/workflows/deploy.yaml` (workflow name "Deploy to Cloudflare Pages"), publishing to the Cloudflare Pages project `led-catalog`.

## Triggers

- `push` to `main`: production deploy.
- `pull_request`: preview deploy, published under the PR's head branch name.

## Secrets

- `CLOUDFLARE_API_TOKEN`: scope "Cloudflare Pages: Edit" on the target account.
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

## Local-only catalog and retired hosts

The site is static: no Pages Functions or catalog KV binding is required. Keep
IndexedDB and explicit file export/import; do not restore `/api/sync` on rollback.
Before deleting the retired `latest-catalog` KV value, export it through an
already authenticated Cloudflare tool to a private file outside the repo and
verify the JSON. If authentication is unavailable, leave server data untouched
and record cleanup as pending. Never back it up through the public endpoint.
After deploying, verify both GET and POST to `/api/sync` serve no catalog data
(the static SPA may return HTML rather than a 404).

Cloudflare Pages is the sole intended host. No Netlify configuration is kept in
this repo. The obsolete `bansallights` Netlify site's repository link and public
deploys must be disabled in Netlify after checking that no custom domain depends
on it. If no logged-in CLI or token is available, Abhinav's signed-in Netlify
browser is required; do not change Cloudflare hosting as part of that cleanup.
