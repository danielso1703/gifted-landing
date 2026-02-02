# gifted-landing

## Repo discovery summary

### App name & branding

The public product name is **Gifted** (from `app.json`, iOS `Info.plist`, Android `strings.xml`). The monorepo/backend name is "Gift Giver". One-sentence pitch and About copy are in `GiftGiverApp/src/screens/AboutScreen.tsx`. Brand colors: accent red `#e60232`, gradient `#ff003d` → `#e60232`, prime blue `#00A8E1`, prime gold `#FF9900`. Logo/icon paths are under `GiftGiverApp/assets/` (e.g. `gradient-logo/grad-app-2.png`, `app-logo.png`, `icon.png`).

### Screenshots

Six screenshot PNGs in root `assets/` (dates Dec 2025); filenames don't describe content. **Recommendation:** open each and pick 3–6 that best show Feed, Explore, saved searches, and gift detail.

### Features

- Personalized gift discovery (recipient/age/budget)
- Home feed, Explore (search + trending + friends)
- Saved searches and saved gifts
- Sharing/collaboration and voting
- Friends
- Multiple retailers (eBay, Etsy, Walmart; Amazon in policy)
- **Auth:** Google, Apple, guest
- No contacts permission; location optional for country; camera/photo for profile only

### Platform

iOS and Android (React Native). No TestFlight or store URL in the repo; only internal TestFlight/upload docs. No web app for end users; `apps/gifted-admin` is Next.js admin only (root redirects to `/dashboard`).

### Contact & legal

In-app strings use `support@giftedapp.io`, `privacy@giftedapp.io`, `legal@giftedapp.io`, and `www.giftedapp.io`. Root README's `support@giftgiver.com` is different; the report uses the app strings for the landing page.

### Privacy & data

In-app "Gifted Privacy & Security Policy" (Oct 27, 2025) lists: account/preferences/interactions, device/usage/analytics, Supabase, Amazon PA-API, Stripe (if used), analytics. Walmart/Rakuten is not mentioned in that policy but is used server-side (affiliate links); the report suggests adding it for the partnership page.

### Affiliate

Walmart vendor uses Rakuten LinkSynergy; product links are affiliate-style (`affiliateUrl` / `linkurl`). Docs: `docs/WALMART_SETUP.md`, `supabase/functions/ebay-fetch/src/vendors/walmart.ts`. No other affiliate disclosure text in the app; the report includes draft affiliate disclosure sentences.

### Deployment

Repo is `private: true`. No Vercel/Netlify/Cloudflare config found. Admin is Next.js; no existing public marketing site — so the report treats deployment as "any static host or new Next app."

---

## Report location and file plan

The full "Landing Page Inputs" report is in:

```
/Users/danielsolomon/Documents/Application/gift-giver/docs/LANDING_PAGE_INPUTS_REPORT.md
```

It contains:

- **A) Branding** — App name, one-sentence pitch, tone, hex palette, fonts, logo/icon paths with file references.
- **B) Features** — 5–8 user-facing bullets and sources.
- **C) Screenshots** — List of existing asset paths and which 3–6 to use; if missing, exact screens to capture (Feed, Explore, Saved searches, gift detail, onboarding, sign-in).
- **D) Links & metadata** — support/privacy/legal emails, www.giftedapp.io; social and store links marked UNKNOWN where not found.
- **E) Privacy policy facts** — Data types, third parties, storage/retention as inferred from the app and policy screen.
- **F) Affiliate disclosure** — Two short draft options tailored to Gifted and Walmart/Rakuten.
- **G) Recommended sections** — Hero, How it works, Features, Screenshots, FAQ, Privacy, Contact, optional Waitlist.
- **H) Risks / unknowns** — TestFlight/store URL, social, company name, Walmart in policy, screenshot review, domain check, admin kept private.

### File plan

- **Option 1:** Single static `index.html` + `styles.css` + `assets/` in a `landing/` (or `apps/landing/`) folder — good for GitHub Pages, Vercel, Netlify, or Cloudflare Pages with no backend.
- **Option 2:** Minimal Next.js page — either a new `apps/landing` or a public route group under gifted-admin (e.g. `(public)/page.tsx`) with middleware allowing unauthenticated access; reuse same copy and assets. Prefer a separate small app so the public page isn't tied to admin.

### Suggested next step

Implement Option 1 under `landing/` using the report for copy, colors, and asset paths; then add a TestFlight/store or waitlist link when you have it.
