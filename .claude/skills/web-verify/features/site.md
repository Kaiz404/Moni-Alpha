# The public site: landing, privacy policy, terms

## Sub-features

The landing page `/` (W2-LandingFinal and W2-LandingFinalPhone): the hero with the web window and the phone, the bento of five moments, the map with pins lit from the list, "Your data stays yours." with the working AI switch, Questions, the closing and the footer. Every fact the owner hasn't confirmed shows as a marked "[CONFIRM: …]" (`data-confirm` names it). Signed out the header has Sign in and Open the web app; signed in it has Open Moni, and `/` no longer redirects. The privacy policy and the terms at `/privacy`, `/terms` (English) and `/privacy/ms`, `/terms/ms` (Malay), with the language switch, the contents list and "Draft, not yet reviewed" while `LEGAL_REVIEWED` is false. Sign in, the landing footer and Settings link both.

## How to get to it (user POV)

Open the site's root. The footer's Privacy policy and Terms, the privacy block's "Read the privacy policy", sign in's Terms and Privacy Policy, and Settings' Privacy policy and Terms rows open the documents. The pill at the top of a document switches language.

## Driving it with Playwright

- `scripts/verify/site.mjs` (`--only site`). Signed out at every width in both themes: `/` and each document answer 200 on their own path, the H1 or title, the ground colour, no sideways scroll; the landing page marks every [CONFIRM] fact in `LANDING_FACTS` and says nothing about the iPhone or the App Store.
- The landing screenshot grows the viewport to the page's height and waits 6 s, so every moment has played to its end. Pairs: `site-landing-1440` (full height) against `land/W2-LandingFinal.png`; `site-landing-390-hero` and `site-landing-390-privacy` (one viewport each) against `land/W2-LandingFinalPhone.png`.
- The language switch is the `Language` (English page) or `Bahasa` (Malay page) navigation; the current language has `aria-current="page"`, and `<article class="legal">` carries `lang`.
- Signed in (the shared storage state): `/` shows `header.lp-top`'s Open Moni, which goes to `/home`; `/settings` has `main a[href="/privacy"]` and `[href="/terms"]`.
- The AI switch is the page's only `role="switch"`; Replay keeps focus (`Replay the opening`).

## Gotchas

- Dark screenshots set `localStorage['moni-theme'] = 'system'` before load; the theme script defaults to light, so `colorScheme` alone renders light.
- Moments play when scrolled into view and rest at their end state before that, so a viewport-height screenshot of a section not yet reached still shows the finished picture.
