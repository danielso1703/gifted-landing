# gifted-landing

Static public landing page for **Top Notch Gifts** — for Rakuten Advertising / Walmart Canada affiliate partnership review. HTML and CSS only; no frameworks or build step.

## Contents

- **index.html** — Main landing: hero, how it works (3 steps), features (6 cards), screenshots grid, FAQ, footer with contact and links to Privacy and Affiliate Disclosure.
- **styles.css** — Single stylesheet (brand colors, responsive layout).
- **privacy.html** — Full Privacy & Security Policy (truthful to app; placeholders marked where unknown).
- **affiliate-disclosure.html** — Short affiliate disclosure (Rakuten/Walmart Canada).
- **assets/** — Logo and screenshots go here. See [ASSETS_NEEDED.md](ASSETS_NEEDED.md) for exact filenames and dimensions.
- **DISCOVERY_REPORT.md** — Monolith scan results (branding, features, privacy facts, affiliate draft).
- **ASSETS_NEEDED.md** — Checklist of images to provide (filenames, dimensions, what each should show).
- **REVIEW_CHECKLIST.md** — Pre-submission checklist and submission notes for Rakuten/Walmart.

## How to run locally

1. Clone this repo.
2. Add logo and screenshots to `assets/` per ASSETS_NEEDED.md (optional; page works without them).
3. Open `index.html` in a browser, or serve the folder with any static server, e.g.:
   - `npx serve .`
   - `python3 -m http.server 8000`
   - VS Code “Live Server” extension.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. **Settings → Pages** → Source: **Deploy from a branch**.
3. Branch: `main` (or your default), folder: **/ (root)**.
4. Save. The site will be at `https://<username>.github.io/<repo-name>/`.
5. If the site is in a subpath (e.g. `/gifted-landing/`), set a base path or use a custom domain.

## Deploy (Vercel)

1. Install Vercel CLI: `npm i -g vercel` (or use the Vercel dashboard).
2. In this repo directory: `vercel`.
3. Follow prompts (link to existing project or create new). No build command or output directory needed — it’s static.
4. Vercel will detect static files and deploy. Your site will be at `https://<project>.vercel.app`.

**Alternative (drag-and-drop):** At [vercel.com](https://vercel.com), drag this folder into the deploy zone. No config required.

## Deploy (Netlify / Cloudflare Pages)

- **Netlify:** Drag the folder into [app.netlify.com/drop](https://app.netlify.com/drop), or connect the repo and set publish directory to `/` (no build).
- **Cloudflare Pages:** Connect the repo, build command: none, output directory: `/` (or upload the folder).

## Contact and legal

- Support: **team@topnotchgifts.ca**
- Privacy: **team@topnotchgifts.ca**
- Legal: **team@topnotchgifts.ca**
- Website: **https://www.topnotchgifts.ca**

---

## Repo discovery summary (reference)

The public product name is **Top Notch Gifts**. One-sentence pitch and About copy are in the monolith `GiftGiverApp/src/screens/AboutScreen.tsx`. Brand colors: `#e60232`, gradient `#ff003d` → `#e60232`, `#00A8E1`, `#FF9900`. Logo/icon paths under `GiftGiverApp/assets/`. Full discovery is in **DISCOVERY_REPORT.md**; inputs for the landing page were also taken from the monolith’s `docs/LANDING_PAGE_INPUTS_REPORT.md`.
