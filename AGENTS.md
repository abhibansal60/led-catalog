# AGENTS.md: led-catalog

A push to `main` deploys straight to production, so work on a branch and open a PR for human review.

`npm test` esbuild-bundles each tested `src/lib` module into a `.tmp-*.mjs` file that `test/*.test.mjs` imports; a test for a new module needs its bundle and cleanup added to the `test` script in `package.json`.

## Pointers

- **Deploy**: touching the workflow, Cloudflare Pages, secrets, or a rollback → `docs/agents/deploy.md`.
- **Issues**: filing, reading or updating GitHub Issues → `docs/agents/issue-tracker.md`.
- **Triage**: applying triage labels → `docs/agents/triage-labels.md`.
- **Domain**: domain terms or architecture decisions → `GLOSSARY.md` and `docs/adr/`, per `docs/agents/domain.md`.
