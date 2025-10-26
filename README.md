# Bansal Lights LED Catalog

Modern LED-program catalog for the Bansal Lights team. The app stores `.led` controller files, product photos, and bilingual notes entirely in the browser so technicians can manage their library from a phone even when offline. A production build is live at [https://bansallights.netlify.app/](https://bansallights.netlify.app/).

![Catalog walkthrough](docs/screenshot.png)

## What You Get
- 📱 **Mobile-first interface** with large bilingual (English | हिंदी) labels and emoji cues.
- 💾 **Offline catalog**: LED programs live in `localStorage`; nothing is sent to a server.
- 📥 **One-tap download** that always exports `00_program.led` for T-1000/T-8000 controllers.
- 📷 **Optional photo & notes** to identify how a program looks on-site.
- 🔐 **Reset switch** (hidden button) to wipe stored data if a device is being handed over.
- 🚀 **CI-backed deployment** to Netlify on every push/merge to `main`.

## Tech Stack
| Area | Choice | Notes |
| ---- | ------ | ----- |
| UI | React 18 + TypeScript | SPA bootstrapped with Vite |
| Styling | Tailwind CSS + shadcn-inspired primitives | Custom component variants live in `src/components/ui` |
| State | React hooks + browser `localStorage` | No backend services required |
| Tooling | Vite 5 | Handles dev server, bundling, and TypeScript |
| Hosting | Netlify free tier | Automated by GitHub Actions workflow `deploy.yaml` |

## Local Development
1. Install Node.js 18 (or newer LTS) and npm.
2. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the printed URL (default `http://localhost:5173`). Changes hot-reload automatically.
5. Generate a production bundle at any time with:
   ```bash
   npm run build
   ```

> Tip: Run `npm run build` before pushing to catch type or bundling errors locally.

## Deployment
### Production
- Hosted on Netlify at `bansallights.netlify.app`.
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect handled via `netlify.toml`.

### Continuous Deployment (GitHub Actions → Netlify)
Workflow file: `.github/workflows/deploy.yaml`

1. Generate a Netlify personal access token (expiry: 1 year) and note the site’s ID.
2. In the GitHub repository, add secrets:
   - `NETLIFY_AUTH_TOKEN`: the personal access token.
   - `NETLIFY_SITE_ID`: the site UUID from Netlify.
3. Push to `main` (directly or via merge). The workflow:
   - Checks out the repo.
   - Installs dependencies with `npm ci`.
   - Builds the production bundle.
   - Deploys `dist/` using `netlify/actions/netlify-deploy`.
4. Monitor the Actions tab for the “Deploy to Netlify” job. A green run equals a successful release.

To enable preview deploys for pull requests, extend the workflow with an `on: pull_request` trigger and set the Netlify deploy action’s `draft` or `deploy-message` inputs.

## Testing & Quality
- No automated tests today; rely on manual smoke testing.
- Manual QA checklist:
  - [ ] Add a program with all fields (file, photo, notes).
  - [ ] Add a program with only required fields.
  - [ ] Refresh the page and confirm saved programs persist.
  - [ ] Download button produces `00_program.led`.
  - [ ] Delete confirmation works.
  - [ ] Hidden `Reset` button clears all data.
  - [ ] App behaves correctly on Android (portrait) and desktop.
  - [ ] Install as PWA and launch offline.
- Watch the browser console logs for “✅/❌” messages when debugging.

## File Layout
```
.
├── netlify.toml                # Build command + SPA redirect for Netlify
├── public/
│   ├── manifest.json           # PWA metadata (name, colors, icons)
│   └── service-worker.js       # Caches static assets for offline support
├── src/
│   ├── App.tsx                 # Core catalog experience
│   ├── components/ui           # Button/Card/Input/Label/Textarea primitives
│   ├── index.css               # Tailwind base layers + custom theme tokens
│   ├── lib/utils.ts            # Tailwind class merger
│   └── main.tsx                # Vite bootstrap (React DOM render)
├── tailwind.config.js          # Tailwind theme and shadcn tokens
└── docs/screenshot.png         # Marketing/README image
```

## Operational Notes
- Data lives only in the user’s browser. Clearing cache or switching devices requires manual export/import.
- Keep the Netlify token fresh. Regenerate before expiry and update the GitHub secret.
- Monitor Netlify free-tier usage (bandwidth/build minutes) monthly; upgrade only if traffic demands it.
- Update this README and `AGENTS.md` whenever automation or operating practices change.

## License
MIT – tailor it freely for the Bansal Lights team.
