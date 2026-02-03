# Assets Needed for Top Notch Gifts Landing Page

Exact filenames, recommended dimensions, and what each asset should show. Add these to the `assets/` folder so the landing page displays them correctly.

---

## Logo

| Filename | Recommended dimensions | Notes |
|----------|------------------------|--------|
| **assets/logo.png** | 72×72 px (1:1) or 200×60 px (horizontal) | Main logo for header. If using from monolith: copy `GiftGiverApp/assets/app-logo.png` or `GiftGiverApp/assets/gradient-logo/grad-app-2.png` and optionally resize/optimize. |

**Source paths in monolith (gift-giver repo):**
- `GiftGiverApp/assets/app-logo.png`
- `GiftGiverApp/assets/gradient-logo/grad-app-2.png` (used on About screen)
- `GiftGiverApp/assets/icon.png` (app icon; square)

---

## Screenshots

Use these exact filenames in `assets/` so `index.html` can reference them. Recommended aspect ratio: **9:19** (phone) or **9:16**. Recommended width: **390 px** (or 780 px for 2x).

| Filename | Recommended dimensions | What it should show |
|----------|------------------------|----------------------|
| **assets/screen_feed.png** | 390×844 px (9:19) or 390×693 px (9:16) | **Home (Feed)** — Main tab “Home”; feed of gift cards for one search; visible “Gifts for [Recipient]” or similar. |
| **assets/screen_explore.png** | 390×844 px (9:19) or 390×693 px (9:16) | **Explore** — Main tab “Explore”; search bar and sections (e.g. Recommended for You, Trending Topics). |
| **assets/screen_saved_searches.png** | 390×844 px (9:19) or 390×693 px (9:16) | **Saved searches list** — Profile → Saved searches (or equivalent) showing multiple searches with titles/recipient/budget. |
| **assets/screen_gift_detail.png** | 390×844 px (9:19) or 390×693 px (9:16) | **Full-screen gift detail** — After tapping a gift: image, title, price, Save/Shop buttons. |

**Optional (if you want 5–6 screenshots):**
- **assets/screen_onboarding.png** — Onboarding step 1: “Who are you shopping for?” with recipient chips.
- **assets/screen_signin.png** — Sign-in screen with Google / Apple / Continue as guest.

---

## Existing screenshots in monolith

The gift-giver repo has six screenshot PNGs in **repo root** `assets/`. Filenames do not describe content; you need to open each and pick 3–6 that best match the descriptions above, then copy/rename them into this repo’s `assets/` with the filenames above.

| Monolith path | Notes |
|---------------|--------|
| `Application/gift-giver/assets/PHOTO-2025-12-05-09-52-48-3c34d046-7e63-4fd4-b887-740b7330db8d.png` | Screenshot/photo |
| `Application/gift-giver/assets/Screenshot_2025-12-05_at_10.26.13_AM-a3211d6c-c7a3-4415-88ae-51e992ee1b4d.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-05_at_9.00.02_AM-8b2fd1a7-9f5f-4b69-81f3-c38e5e306685.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-06_at_12.39.59_PM-84fd2dec-0952-4b3c-b8c6-1ac4f2e0fead.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-07_at_1.39.58_AM-ea9501f3-6e8a-4aac-956b-c00fc9094c30.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-07_at_1.51.25_AM-2b2fb448-3f43-40ca-9361-35556f08c31b.png` | Screenshot |

**Recommendation:** Copy the chosen files into `gifted-landing/assets/`, rename to `screen_feed.png`, `screen_explore.png`, etc., and optionally resize to ~390 px width for faster loading. Do not duplicate huge originals unnecessarily; prefer optimized copies.

---

## Summary checklist

- [ ] **assets/logo.png** — Logo for header (from monolith or new export).
- [ ] **assets/screen_feed.png** — Feed/Home screen.
- [ ] **assets/screen_explore.png** — Explore screen.
- [ ] **assets/screen_saved_searches.png** — Saved searches list.
- [ ] **assets/screen_gift_detail.png** — Gift detail screen.
- [ ] (Optional) **assets/screen_onboarding.png**, **assets/screen_signin.png**.

Until these are added, the landing page will show broken image placeholders for logo and screenshots; all text and links will work.
