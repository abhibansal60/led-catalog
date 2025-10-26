# Agents Overview

## Purpose
This document tracks the automated assistants and workflows that support the `led-catalog` project. It helps collaborators understand what each agent does, when it runs, and how to interact with it safely.

## Active Agents & Automations
- **GitHub Actions CI** *(planned)*: Builds and deploys the app to Netlify whenever `main` receives a new commit—either from a direct push or a merged pull request.
- **Local AI Assistant**: Assists with code changes, documentation, and developer tooling updates. All generated changes should be reviewed before merging.

## Operating Guidelines
- Keep agents focused on deterministic, reproducible tasks (build, test, deploy, linting). Avoid granting production access that bypasses review.
- Document any new automation in this file, including purpose, triggers, secrets required, and rollback steps.
- Monitor cost-sensitive services. Prefer free-tier plans and review usage periodically to ensure the project stays within budget.

## Communication & Ownership
- Changes to automation must be reviewed by at least one maintainer.
- Record the maintainer for each agent in this file when it is assigned. Update the list whenever responsibilities shift.
- When disabling or replacing an agent, leave deprecation notes and clean up unused credentials or configuration files.

## Next Steps
- Implement the GitHub Actions workflow referenced above and confirm the Netlify site is configured for deploy previews if needed.
- Evaluate whether additional automation (e.g., visual regression tests, end-to-end smoke tests) would add value before expanding the agent roster.
