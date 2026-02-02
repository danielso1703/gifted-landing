# Discovery Report — Gifted Landing Page

**Purpose:** Public-facing landing page for Rakuten Advertising / Walmart Canada affiliate partnership review.  
**Source:** Read-only scan of monolith repo `Application/gift-giver`. No facts invented; unknowns labeled.

---

## Branding

| Field | Value | Source (file path) |
|-------|--------|---------------------|
| **App name** | **Gifted** | `GiftGiverApp/app.json` (`displayName`), `GiftGiverApp/ios/GiftGiverApp/Info.plist` (CFBundleDisplayName), `GiftGiverApp/android/app/src/main/res/values/strings.xml` (`app_name`) |
| **One-sentence pitch** | *"Discover the perfect gifts for your loved ones with personalized recommendations based on their preferences, age, and budget."* | `GiftGiverApp/src/screens/AboutScreen.tsx` (lines 215–217, `AppDescription` component) |
| **Taglines** | In-app: "About", "Privacy & Security", "Terms of Service". Onboarding uses recipient/age/budget prompts; no marketing tagline in repo. | `AboutScreen.tsx`, `PrivacySecurityScreen.tsx`, `TermsOfServiceScreen.tsx`, onboarding screens |
| **Tone** | Modern, clean, user-focused (minimal in-app copy) | Inferred from AboutScreen, OnboardingScreen, PrivacySecurityScreen |
| **Colors (hex)** | **Brand:** `#e60232` (accent red), gradient `#ff003d` → `#e60232`. **Secondary:** `#00A8E1` (prime blue), `#FF9900` (prime gold). **Light:** bg `#FFFFFF`, surface `#F8F8FB`, text `#121212`, textMuted `#707487`. **Dark:** bg `#0B0B0D`, surface `#131318`, text `#FFFFFF`, textMuted `#A7A9B5`. **Status:** success `#00C851`, warning `#FF8800`, error `#FF4444`, info `#33B5E5`. | `GiftGiverApp/src/theme/colors.light.ts`, `colors.dark.ts`, `GiftGiverApp/src/components/GradientBackground.tsx` (lines 28–30: `#ff003d`, `#e60232`) |
| **Fonts** | System font (no custom font family in code); MaterialIcons for icons. | `GiftGiverApp/src/navigation/AppNavigator.tsx`, `Info.plist` UIAppFonts: MaterialIcons.ttf |
| **Logo/icon paths** | **App icon:** `GiftGiverApp/assets/icon.png`, `GiftGiverApp/assets/app-icon-white-bg.png`. **Logos:** `GiftGiverApp/assets/app-logo.png`, `app-logo-white.png`, `logo.png`. **Gradient/ribbon:** `GiftGiverApp/assets/gradient-logo/grad-app-2.png`, `ribbon-icon fill.png`, `rib/` (best-large-fill, etc.). About screen uses: `GiftGiverApp/assets/gradient-logo/grad-app-2.png`. | `GiftGiverApp/assets/`, `AboutScreen.tsx` (gradient-logo/grad-app-2.png) |

---

## Feature summary

Features derived from real code and docs (6–10 bullets):

1. **Personalized gift discovery** — Recommendations based on recipient, age range, and budget. Onboarding: “Who are you shopping for?”, “What’s their age range?”, “What’s your budget?”  
   *Source: OnboardingScreen, AboutScreen, FEATURES_LIST.md*

2. **Gift feed (Home)** — Swipeable feed of gift ideas per saved search; like/save/dismiss; “More like this” and similar items.  
   *Source: FeedScreen, MainTabs, FEATURES_LIST.md*

3. **Explore** — Search for gifts or people; trending topics/clusters; recommended for you; friend activity; full-screen item view with save/shop/copy.  
   *Source: ExploreScreen, MainTabs, FEATURES_LIST.md*

4. **Saved searches & collections** — Multiple saved searches (e.g. “Gifts for Mom”), each with its own feed; saved gifts per search; edit/delete searches.  
   *Source: FEATURES_LIST.md, FeedScreen, EditSearchScreen*

5. **Share & collaborate** — Share a search with friends via link or in-app; join search by invite; collaborators can add gifts and vote on items in shared searches.  
   *Source: FEATURES_LIST.md, JoinSearchScreen, ShareSearchModal*

6. **Friends** — Add friends, accept/decline requests, view friend activity and shared searches.  
   *Source: FEATURES_LIST.md, ProfileScreen*

7. **Multiple retailers** — Product results from eBay, Etsy, Walmart (and Amazon referenced in policy); marketplace logos in app.  
   *Source: GiftGiverApp/assets/marketplace-logos/ (eBay, Etsy, Walmart, Amazon, Best Buy, Canadian Tire, Michaels, Temu), PrivacySecurityScreen, ebay-fetch vendors*

8. **Account & preferences** — Sign in with Google, Apple, or guest; profile photo (camera/photo library); dark/light theme; in-app Privacy & Security and Terms.  
   *Source: AboutScreen, PrivacySecurityScreen, TermsOfServiceScreen*

---

## Assets & screenshots found

### Screenshots (monolith repo root)

| Path | Notes |
|------|--------|
| `Application/gift-giver/assets/PHOTO-2025-12-05-09-52-48-3c34d046-7e63-4fd4-b887-740b7330db8d.png` | Screenshot/photo |
| `Application/gift-giver/assets/Screenshot_2025-12-05_at_10.26.13_AM-a3211d6c-c7a3-4415-88ae-51e992ee1b4d.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-05_at_9.00.02_AM-8b2fd1a7-9f5f-4b69-81f3-c38e5e306685.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-06_at_12.39.59_PM-84fd2dec-0952-4b3c-b8c6-1ac4f2e0fead.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-07_at_1.39.58_AM-ea9501f3-6e8a-4aac-956b-c00fc9094c30.png` | Screenshot |
| `Application/gift-giver/assets/Screenshot_2025-12-07_at_1.51.25_AM-2b2fb448-3f43-40ca-9361-35556f08c31b.png` | Screenshot |

**Note:** Filenames do not describe content. Manually review each to choose 3–6 for Feed, Explore, saved searches, gift detail.

### Brand / UI assets (GiftGiverApp)

| Path | Notes |
|------|--------|
| `GiftGiverApp/assets/icon.png`, `app-icon-white-bg.png` | App icon |
| `GiftGiverApp/assets/app-logo.png`, `app-logo-white.png`, `logo.png` | Logos |
| `GiftGiverApp/assets/gradient-logo/grad-app-2.png` | Gradient logo (used on About screen) |
| `GiftGiverApp/assets/gradient-logo/rib/`, `ribbon-icon fill.png` | Ribbon assets |
| `GiftGiverApp/assets/marketplace-logos/` | eBay, Etsy, Walmart, Amazon, Best Buy, Canadian Tire, Michaels, Temu |

No promo images, gifs, or demo videos found in repo. No UI export paths beyond the above.

---

## Links/metadata found

| Field | Value | Source |
|-------|--------|--------|
| **Support email** | **support@giftedapp.io** | `GiftGiverApp/src/screens/AboutScreen.tsx` (handleOpenSupport, line 179) |
| **Privacy contact** | **privacy@giftedapp.io** | `GiftGiverApp/src/screens/PrivacySecurityScreen.tsx` (lines 279, 307) |
| **Legal contact** | **legal@giftedapp.io** | `GiftGiverApp/src/screens/TermsOfServiceScreen.tsx` (lines 227–228) |
| **Website** | **https://www.giftedapp.io** | AboutScreen (handleOpenWebsite), PrivacySecurityScreen, TermsOfServiceScreen |
| **Social links** | **UNKNOWN** | No social handles found in repo. |
| **App Store / Play Store / TestFlight** | **UNKNOWN** | TestFlight/upload docs exist (`GiftGiverApp/docs/TESTFLIGHT_*.md`, `EASIEST_UPLOAD_GUIDE.md`) but no public store or TestFlight URL in app or config. |

*Note: JoinSearchScreen uses `support@giftgiver.com` for join-search support; app-facing strings use giftedapp.io — use giftedapp.io for the landing page.*

---

## Privacy facts (what we can truthfully state)

Inferred from `GiftGiverApp/src/screens/PrivacySecurityScreen.tsx` and code:

- **Account info:** Name, email, profile image (Google/Apple); guest option.
- **Preferences:** Recipient, age range, budget, saved searches, saved gifts, interaction data (likes, saves, dismisses, view time).
- **Device/technical:** Device model, OS version, app version, unique device identifiers; platform (iOS/Android) stored on sign-in.
- **Usage/analytics:** In-app activity, session time, performance logs; “analytics and debugging”; opt-out for “personalized recommendations or analytics tracking” in settings.
- **Location:** Optional; usage: “detect your country for better gift recommendations” (Info.plist).
- **Camera/photo:** Profile photos only (camera + photo library); no contacts permission in app.
- **Storage:** Supabase (PostgreSQL), TLS, row-level security; auth tokens/cookies for app state and login.
- **Third parties (from policy screen):** Supabase (auth, DB, storage); Amazon Product Advertising API (product info, affiliate tracking); Stripe (if applicable, for “Gifted Premium”); “Analytics tools” (anonymous behavior/performance).  
  **Walmart/Rakuten** is used server-side for product data and affiliate links but is **not** named in the in-app policy text — add for partnership/landing transparency.
- **Retention:** “As long as necessary”; inactive user data may be anonymized or deleted after 12 months; product data refreshed every 24 hours.
- **Policy title & date:** “Gifted Privacy & Security Policy”, last updated October 27, 2025.

---

## Affiliate disclosure draft

Based on monolith code:

- **Source:** `supabase/functions/ebay-fetch/src/vendors/walmart.ts` — Walmart vendor uses Rakuten LinkSynergy; `linkurl` / `affiliateUrl` for outbound product links. `docs/WALMART_SETUP.md` describes Rakuten Advertising credentials and Product Search API.

**Draft options (use or adapt):**

- **Option A (short):** “Gifted helps you discover products from multiple retailers. When you tap through to buy, we may earn a commission from partners such as Walmart (including via Rakuten Advertising) and other program participants. This does not change the price you pay.”
- **Option B (explicit):** “Some links in Gifted are affiliate links. If you make a purchase after clicking through, we may receive a commission from the retailer or its affiliate network (e.g. Rakuten Advertising for Walmart Canada). We use these partnerships to keep the app free and to surface relevant gift ideas. Your use of the app is subject to our Privacy & Security Policy and Terms of Service.”

Do not claim partnership approval unless confirmed. Ensure disclosure appears near “Shop” or outbound links on the landing page (and in-app if required by Rakuten/Walmart).

---

## Missing info & questions

| Item | Status | What you must supply or confirm |
|------|--------|----------------------------------|
| **Company/legal name** | UNKNOWN | “Gifted” is product name only; legal entity not in repo — clarify for footer/copyright. |
| **Public TestFlight / App Store / Play Store URL** | UNKNOWN | Add when available; or use “Visit Website” / “Contact” only. |
| **Social handles** | UNKNOWN | Define if you want Twitter/Instagram/etc. on the page. |
| **Domain live** | UNKNOWN | Confirm giftedapp.io is live and www redirect works before linking. |
| **Walmart/Rakuten in in-app Privacy Policy** | Not in current text | Consider adding “Walmart (including via Rakuten Advertising)” under Third-Party Services. |
| **Screenshot content** | Filenames not descriptive | Manually review each `assets/Screenshot_*.png` to choose and order for landing. |
| **gifted-admin** | Internal only | Next.js admin; do not link or expose on public landing page. |
