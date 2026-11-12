# Maps, Places and sign-in costs at 10,000 users, November 2026

The owner asked what Google Maps, Google Places and Google sign-in would cost at about 10,000 users, and whether Places API shop search is affordable. Prices were read on 12 Nov 2026 from the current Google Maps Platform price list, which has used per-SKU free caps since 1 March 2025. USD to MYR is 4.06, the reference rate for 1 Nov 2026 ([exchangerate.guru](https://exchangerate.guru/usd/myr/)).

Each claim has a label. `[proven]` means read in code or in a primary source on 12 Nov 2026. `[inferred]` follows from proven facts. `[guess]` is a usage assumption with no measurement behind it.

## Answer

Monthly cost at 10,000 installed users. The scenarios are defined under [Assumptions](#assumptions).

| Line | Low | Expected | High |
| --- | --- | --- | --- |
| Google Maps SDK (map page, place page, Home teaser, place sheet) | $0 | $0 | $0 |
| Geocoding (device geocoder) | $0 | $0 | $0 |
| Google sign-in at Google | $0 | $0 | $0 |
| Supabase Auth MAU (10k is under the free 50k) | $0 | $0 | $0 |
| **(a) Maps, geocoding and auth in today's app** | **$0** | **$0** | **$0** |
| Places search, recommended design C (Autocomplete on submit, Place Details Essentials on pick) | $0 | $2 (RM9) | $462 (RM1,877), or about $94 with a 1,000 call daily cap |
| Same flow on Amazon Location GrabMaps, Stored, if Google's storage terms rule Google out | $4 (RM18) | $43 (RM175) | $376 (RM1,528) |
| **(b) Today's app plus recommended Places search** | **$0** | **$2 (RM9)** | **$94 capped (RM385)** |
| Supabase Pro plan, needed at this size for database, storage, egress and realtime, not for auth | $25 | $25 | $25 plus overage |
| OpenRouter AI on `deepseek-v4.1-flash` | $23 | $96 (RM390) | $461 (RM1,872) |

Main cost drivers, in order:

1. **OpenRouter AI.** This is the only line that grows in step with users. The expected scenario costs about $96 a month. On `qwen3.7-flash` the same traffic costs about $25. `[inferred from docs/AI.md prices]`
2. **The Supabase plan.** Auth stays free, but the free plan's 500 MB database, 1 GB storage, 5 GB egress and 200 realtime connections will not hold 10,000 users. Pro costs $25. `[inferred]`
3. **Places search, only if it is built badly.** Nearby Search on every sheet open costs about $800 a month in the expected scenario. Text Search costs $186. As-you-type Autocomplete costs $74. Autocomplete on submit costs $2. The SKU choice matters about 400 times more than the user count. `[inferred]`
4. **A map ID would make maps billable.** Maps stay free only because no map ID is set. With a map ID they bill as Dynamic Maps, about $1,190 a month in the expected scenario. `[proven SKU rule, guess on loads]`

The price is not the main obstacle to Google Places. The terms are. Google forbids keeping business names permanently and allows Places coordinates for 30 days only. The app already keeps the names of Google map POIs that a user taps. Settle that question once, for both features. See [Terms](#terms-what-moni-may-keep).

## What the app uses today

### Maps

- `react-native-maps` with `PROVIDER_GOOGLE` draws four maps, so the map SDK is the Maps SDK for Android and iOS. `[proven]`
  - The full map page is `apps/mobile/app/map.tsx:132-160`.
  - The place page uses `liteMode` (`apps/mobile/app/place/[id].tsx:124-126`).
  - The Home teaser uses `liteMode` and renders whenever the month has transactions (`components/map/map-teaser.tsx:134-136`, `app/(tabs)/index.tsx:261-262`).
  - The place sheet uses `onPoiClick` (`components/capture/place-sheet.tsx:204-229`).
- Keys come from `ANDROID_GOOGLE_MAPS_API_KEY` and `IOS_GOOGLE_MAPS_API_KEY` through `app.config.ts:31-46`. `[proven]`
- No code sets a map ID. A grep for `googleMapId`, `mapId` and `cloudMapId` in `apps/mobile` finds nothing. Styling uses JSON `customMapStyle`. `[proven]`
- **SKU.** Google merged Mobile Native Dynamic Maps and Mobile Native Static Maps into one SKU called **Maps SDK** ([SKU index](https://developers.google.com/maps/billing-and-pricing/sku-details)). `[proven]`
  - On Android it bills one "Map load" on `onCreate()` of a `MapView` "not loaded with a map ID". Panning and zooming do not add loads ([Maps SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details/maps)). `[proven]`
  - Its free usage cap is **Unlimited**, with no paid tiers ([price list](https://developers.google.com/maps/billing-and-pricing/pricing#maps-sdk)). `[proven]`
  - Lite mode is still a `MapView` without a map ID, so it falls under the same free SKU. iOS ignores `liteMode`, which does not matter at a price of $0. `[inferred]`
- **Trap.** On the Maps SDK for Android and iOS, a load *with* a map ID is a Dynamic Maps load. Dynamic Maps has 10,000 free loads, then costs $7.00 per 1,000 and $5.60 per 1,000 above 100,000 (same two pages). `[proven]` Cloud styling and advanced markers need a map ID. Treat adding one as a billing change. `[inferred]`

### Geocoding

- `placeName` (`lib/transactions/prefetch-location.ts:16-32`), `captureLocationSnapshot` (`lib/location/location-snapshot.ts:21`) and the place sheet's pin and address search (`components/capture/place-sheet.tsx:41-75,139-147`) call expo-location's `reverseGeocodeAsync` and `geocodeAsync`. `[proven]`
- **Android.** The installed expo-location 57.0.4 calls the platform `android.location.Geocoder`. Forward search calls `Geocoder(...).getFromLocationName(address, 1)` (`expo-location/android/.../LocationModule.kt:762-767`). No API key is passed, so nothing bills to Moni's Google Cloud project. `[proven code, inferred billing]`
  - The platform Geocoder needs a backend on the device (`isPresent()`). Its results are "a best guess" with "no guarantees on availability or accuracy" ([Android Geocoder](https://developer.android.com/reference/android/location/Geocoder)). `[proven]`
  - Google publishes no price or quota for the platform Geocoder. `[proven absence, not verified further]`
  - The place sheet asks for 3 results (`GEOCODE_RESULTS`), but on Android expo-location returns at most 1. `[proven]`
  - Do not confuse it with Google's separate "Android Geocoder SDK (Restricted GA)", which has its own Maps Platform terms ([Service Specific Terms §3](https://cloud.google.com/maps-platform/terms/maps-service-terms)). Moni does not use it. `[proven]`
- **iOS.** expo-location uses `CLGeocoder` (`expo-location/ios/Geocoder.swift:8,28`), which is Apple's free network service. Apple states that "Geocoding requests are rate-limited for each app" and advises one request per user action ([CLGeocoder](https://developer.apple.com/documentation/corelocation/clgeocoder)). `[proven]`
  - Apple's documentation marks `CLGeocoder` deprecated in iOS 26 with "Use MapKit". It still works, but expo-location will have to move to MapKit for the iOS build. `[proven deprecation, inferred impact]`
- **Google geocoding path in expo-location.** `setGoogleApiKey` and `useGoogleMaps` are absent from the installed 57.0.4 type declarations and from the current SDK 58 docs ([expo-location](https://docs.expo.dev/versions/latest/sdk/location/)). The Google Geocoding API is therefore not reachable through expo-location. `[proven absence]`

### Sign-in

- Native Google sign-in uses `@react-native-google-signin/google-signin` to get an ID token. The app then calls `supabase.auth.signInWithIdToken` (`lib/auth/google-signin.ts:20-67`). `[proven]`
- Google runs the OAuth client and Supabase Auth owns the session. Moni does not use Firebase Auth or Identity Platform. `[proven]`
- Google publishes no per-user fee for OAuth or Sign in with Google. Google's audience page describes limits only and names no fee ([Manage app audience](https://support.google.com/cloud/answer/15549945)). `[proven absence]`
- The real limit is publishing status. A project in **Testing** is "limited to up to 100 test users". The OAuth consent screen must move to **In production** before launch. `docs/SETUP.md` still says Testing. `[proven]`
  - An app that asks only for name, email and profile is exempt from the unverified-app warning and from the 7-day token expiry. `[proven]`
- **Supabase Auth.** Supabase defines MAUs as "distinct users who sign in or refresh their token during the billing cycle" ([MAU usage](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)). The Free plan includes 50,000. The Pro plan includes 100,000, then charges $0.00325 per MAU ([pricing](https://supabase.com/pricing)). `[proven]`
  - Google login through `signInWithIdToken` is a Supabase Auth login, so it counts as a normal MAU. The separate "Third-Party MAU" line covers Clerk, Firebase Auth, Auth0 or Cognito tokens ([third-party MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party)). `[inferred]`
  - At 10,000 users, auth costs $0 on either plan. `[inferred]`

## Assumptions

Every number below is a `[guess]` until analytics exist.

| Input | Low | Expected | High |
| --- | --- | --- | --- |
| Monthly active share of 10,000 installs | 30% (3,000) | 50% (5,000) | 80% (8,000) |
| Place sheet opens per MAU per month | 2 | 6 | 20 |
| Opens where the user types a search | 30% | 50% | 70% |
| Searches answered by own places or the device geocoder, no provider call | 50% | 40% | 30% |
| Provider searches a month | 900 | 9,000 | 78,400 |
| Submits per provider search (retypes) | 1.2 | 1.2 | 1.2 |
| Debounced as-you-type requests per search (600 ms, 3+ chars) | 4 | 4 | 4 |
| Searches that end in a pick | 70% | 70% | 70% |
| App opens per MAU per month (Home teaser loads, for the map ID trap) | 30 | 30 | 30 |
| AI extractions per MAU per day | 2 | 5 | 15 |

`docs/AI.md` assumed 30 extractions a day per user, which looks high for a personal finance app. The table uses lower figures. The formula script is in this session's scratchpad. Rerun it with real analytics before acting on the high scenario.

## Places API (New) prices

From the [global price list](https://developers.google.com/maps/billing-and-pricing/pricing), USD per 1,000 billable events, monthly. All projects on one billing account share the volume tiers. `[proven]`

| SKU | Category | Free a month | Cap to 100k | 100k to 500k |
| --- | --- | --- | --- | --- |
| Text Search Essentials (IDs Only) | Essentials | Unlimited | | |
| Text Search Pro | Pro | 5,000 | $32.00 | $25.60 |
| Text Search Enterprise | Enterprise | 1,000 | $35.00 | $28.00 |
| Text Search Enterprise + Atmosphere | Enterprise | 1,000 | $40.00 | $32.00 |
| Nearby Search Pro | Pro | 5,000 | $32.00 | $25.60 |
| Nearby Search Enterprise | Enterprise | 1,000 | $35.00 | $28.00 |
| Autocomplete Requests | Essentials | 10,000 | $2.83 | $2.27 |
| Autocomplete Session Usage | Essentials | Unlimited | | |
| Place Details Essentials (IDs Only) | Essentials | Unlimited | | |
| Place Details Essentials | Essentials | 10,000 | $5.00 | $4.00 |
| Place Details Pro | Pro | 5,000 | $17.00 | $13.60 |
| Place Details Enterprise | Enterprise | 1,000 | $20.00 | $16.00 |
| Place Details Enterprise + Atmosphere | Enterprise | 1,000 | $25.00 | $20.00 |
| Geocoding (web service, not used) | Essentials | 10,000 | $5.00 | $4.00 |
| Dynamic Maps (only with a map ID) | Essentials | 10,000 | $7.00 | $5.60 |
| Maps SDK (used today) | Essentials | Unlimited | | |

**Field masks set the SKU.** A request bills "at the highest SKU applicable to your request" ([usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)). Tiers per field come from [data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields). `[proven]`

- Text Search: `id` alone is IDs Only and free. `displayName`, `formattedAddress`, `shortFormattedAddress`, `location`, `types`, `primaryType` and `businessStatus` make it Pro. `rating`, `priceLevel`, `websiteUri`, `nationalPhoneNumber` and `regularOpeningHours` make it Enterprise.
- Nearby Search: every field is at least Pro, including `id`.
- Place Details: `location`, `formattedAddress` and `types` are Essentials. `displayName` and `primaryType` are Pro. Rating, hours, phone and website are Enterprise.
- A free IDs-only Text Search is useless for a shop list, because it returns no name. `[inferred]`

**Autocomplete sessions** ([session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing)). `[proven]`

- A session that ends in Place Details **Essentials** bills the first 12 Autocomplete requests and the Details call. Requests 13 and later are free.
- A session that ends in Details **Pro or higher** makes every Autocomplete request free, but bills the Details call at **Enterprise + Atmosphere**, $25 per 1,000 after 1,000 free.
- An abandoned session, or a request with no token, bills each Autocomplete request.
- A search under 12 requests that ends in Essentials therefore costs the same with or without a session token. Send the token anyway, because it is free and keeps billing correct. `[inferred]`

## Places designs priced

Monthly USD, from the assumptions above. MYR at 4.06.

| Design | Calls in the expected scenario | Low | Expected | High |
| --- | --- | --- | --- | --- |
| 1. Text Search Pro on submit (`id, displayName, shortFormattedAddress, location`) | 10,800 | $0 | $186 (RM754) | $2,851 |
| 1b. Same, plus `rating` or opening hours (Enterprise) | 10,800 | $3 | $343 | $3,258 |
| 2a. Autocomplete as you type, no session, then Details Essentials on pick | 36,000 + 6,300 | $0 | $74 (RM299) | $964 |
| 2b. Autocomplete as you type, session ended with Details Pro (`displayName`) | 6,300 Details + abandoned requests | $0 | $135 | $1,585 |
| **2c. Autocomplete on submit, then Details Essentials (`location, formattedAddress`) on pick, recommended Google design** | 10,800 + 6,300 | **$0** | **$2 (RM9)** | **$462 (RM1,877)** |
| 3. Nearby Search Pro on every sheet open | 30,000 | $32 | $800 (RM3,248) | $4,576 |
| 4a. Amazon Location GrabMaps `SearchText`, Stored, on submit, $4 per 1,000 with no free tier | 10,800 | $4 | $43 (RM175) | $376 |
| 4b. Foursquare Pro on submit, 500 free, then $15 per 1,000 | 10,800 | $9 | $155 | $1,404 |
| 4c. Mapbox Search Box requests on submit, 25,000 free, then $1.70 per 1,000 | 10,800 | $0 | $0 | $117 |

Notes on the designs:

- **Nearby Search on open (3) is redundant.** The place sheet's Google basemap already draws nearby shops, and tapping one returns its name, place ID and coordinate through `onPoiClick` at no cost under the Maps SDK SKU. `[proven code, proven price]` Nearby Search would pay $32 per 1,000 for a list the map already shows.
- **Autocomplete on submit (2c) is the cheapest Google design.** Each submit is one Autocomplete request, and the prediction's `structuredFormat.mainText` supplies the row title. Only the pick pays for a Details call, which gets the coordinate. Debounce and a minimum length help per-keystroke designs, but they still cost about 4 times as much as calling on submit. `[inferred]`
- **Caching results across users is not an option for Google.** The terms forbid caching beyond place IDs and 30 days of coordinates (next section). Within one sheet session, keep the last query's results in memory so a retype does not call again. `[inferred]`
- **Alternatives, prices and terms.**
  - Mapbox Search Box: 25,000 requests free, then $1.70 per 1,000 ([Mapbox pricing](https://www.mapbox.com/pricing)). Its results are for "temporary use" only ([Search Box docs](https://docs.mapbox.com/api/search/search-box/)). Mapbox's Permanent Geocoding allows storage at $5.00 per 1,000, but it covers addresses, not shop search. `[proven]`
  - Foursquare: Pro is $15 per 1,000 after 500 free ([Foursquare pricing](https://foursquare.com/pricing/)). Pay-as-you-go does not allow caching ([usage guidelines](https://docs.foursquare.com/fsq-developers-places/reference/usage-guidelines.md), cited in `smart-place-suggestions-2026-11.md`). `[proven]`
  - Amazon Location `intendedUse = Stored` allows storing "the Places results indefinitely" ([AWS places pricing](https://docs.aws.amazon.com/location/latest/developerguide/places-pricing.html)). It costs $4.00 per 1,000 for `searchText` in Malaysia ([price list, published 11 Sep 2026](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLocationService/current/ap-southeast-5/index.json)). The free tier is 20,000 Core calls for 3 months only ([AWS pricing](https://aws.amazon.com/location/pricing/)). `[proven]`
  - Nominatim allows "an absolute maximum of 1 request per second" for the whole app, bans autocomplete, and accepts end-user traffic only if "your number of users is moderate" ([policy](https://operations.osmfoundation.org/policies/nominatim/)). It does not fit 10,000 users. `[proven]`
  - Photon's public API: "extensive usage will be throttled" and availability is not guaranteed ([photon.komoot.io](https://photon.komoot.io/)). Self-hosting either service moves the cost to a server. `[proven]`
  - HERE: the pricing page did not render, as in the earlier research. `[not verified]`
  - OSM POI coverage in Malaysia was measured at no more than 51% for a large chain in `smart-place-suggestions-2026-11.md`. `[proven there]`

## Terms: what Moni may keep

Sources are the [Maps Platform Terms §3.2.3](https://cloud.google.com/maps-platform/terms), the [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) (last modified 28 Oct 2026) and the [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). `[proven]`

- **Names and addresses.** §3.2.3(a): Customer will not "(iii) copy and save business names, addresses, or user reviews". §3.2.3(b) forbids caching "except as expressly permitted" in the Service Specific Terms.
- **Places coordinates.** Places API (Legacy and New) §14.3 allows only this: "temporarily cache latitude and longitude values from the Places API for up to 30 consecutive calendar days, after which Customer must delete" them.
- **Place IDs.** "Place IDs are exempt from the caching restrictions. You can therefore store place ID values indefinitely." Google tells developers to "Store exempt identifiers such as the place ID to fetch fresh details when a user interacts with a place."
- **No per-user exception for Places.** The Geocoding API (§6.3.2) and the Android Geocoder SDK (§3.3.2) let a customer keep addresses and coordinates indefinitely "solely to support the direct, End User facing functionality". The terms give "associating location data with a photograph" as an example, and the data must be "logically isolated to the specific End User". Places has no such clause.
- **Google map only.** §14.2: Places content "must not" be used "in conjunction with a non-Google map". Moni's maps are Google maps, so this is met. `[inferred]`
- **Attribution.** None is needed when results show over a visible Google map. A list shown without a map needs the "Google Maps" logo or text.

**Checking the earlier claim.** `smart-place-suggestions-2026-11.md` says Google forbids keeping the shop name. The claim holds on the plain text. `[proven]` It also understates the problem: a Places coordinate saved into `location_latitude` and `location_longitude` must be deleted after 30 days. `[proven]` A user picking the place does not create an exception, because only Geocoding and the Android Geocoder SDK have the per-user clause. `[inferred]` This is a reading of contract text, not legal advice.

**Today's app already keeps Google content.** The place sheet's `onPoiClick` takes the POI name and coordinate from the Google basemap. Approving the entry saves them permanently as `location_name`, `location_latitude` and `location_longitude`, which sync to Supabase and appear in the CSV export (`place-sheet.tsx:211-220`). `[proven]` Those are Google Maps Content, and the Service Specific Terms give the Maps SDK no caching exception. `[proven absence]` The same question applies whether or not Places search is added.

**What a Google build could keep, on the strict reading.** `[inferred]`

- The place ID, permanently.
- The phone's own GPS position, which is the user's data and not Google content.
- Text the user typed or confirmed in Shop or note, if that counts as end-user content. That is the legal question.
- A Places coordinate only with a 30-day purge or a refresh by place ID. A refresh with `location` is a Place Details Essentials call, $5 per 1,000 after 10,000.

**Device geocoder names.** The reverse-geocoded street names come from the Android platform Geocoder and Apple's `CLGeocoder`, not from a Maps Platform API. The Maps Platform terms do not cover them. Neither platform's storage terms for these results were checked. `[not verified]`

## Calling from the phone or the Go backend

Use the Go backend for any Places call. `[inferred from the points below]`

- Google's key guide says to call Places from mobile through the native Places SDKs, or through a proxy that works "without exposing your API key". It warns that "Android and iOS application restrictions may not be fully supported" on some web services ([API security best practices](https://developers.google.com/maps/api-security-best-practices)). `[proven]`
- Places API (New) appears in that guide's server-side table, not in the guidance on the `X-Android-Package` header. `[proven]`
- The Android Maps key is recoverable from the APK. Keep it restricted to package plus SHA-1 and to the Maps SDK for Android only (`docs/SETUP.md`). Never enable Places on it, because anyone who extracts it could spend up to the daily quota. `[inferred]`
- The backend already verifies Supabase JWTs and rate-limits each user. A `POST /v1/places/search` behind it keeps the key off the phone. It can enforce a global daily cap and lets Moni switch provider without an app release. Cloud Run cannot pin an egress IP without extra networking, so restrict the server key by API, to Places API (New) only, and keep it in an env secret. `[inferred]`
- **Caps.** "Setting a budget does not automatically cap Google Cloud or Google Maps Platform usage or spending." Budget alerts only send email. "To put a hard cap on usage of an API, lower its per-day quota". Requests then fail until midnight Pacific time ([manage costs](https://developers.google.com/maps/billing-and-pricing/manage-costs)). `[proven]`
- **Suggested limits.** Set the Autocomplete (New) and Place Details daily quotas in Cloud Console. Add a budget alert at $20. Mirror the cap in the backend so the app gets a clean `unavailable` instead of a Google error. `[guess on numbers]`
  - 1,000 Autocomplete calls a day is about 30,000 a month. At 70% picks that bounds design 2c near **$94 a month** (RM385): $57 Autocomplete plus $38 Details.

## Recommendation

1. **Change nothing in today's maps, geocoding or sign-in for cost reasons.** All four cost $0 at 10,000 users. Do not add a map ID without pricing it first. Move the OAuth consent screen to In production before launch. `[proven]`
2. **Places search flow.** `[inferred]`
   1. Search own places on every keystroke. This is already built.
   2. Then search the device geocoder for addresses. This is already built.
   3. Keep the map POI tap. It is free, and it replaces any Nearby Search.
   4. Add a provider call only when the user submits, as design 2c. Call Autocomplete (New) with `includedRegionCodes: ["my"]`, a `locationBias` circle around the pin and a session token. On a pick, call Place Details with only `id,location,formattedAddress`, which stays Essentials. Never request `displayName` or rating fields in Details.
   5. Route both calls through the Go backend with a daily cap.
   6. Expected cost is about $2 a month, with a ceiling near $94.
3. **Settle the storage question first.** It covers the existing `onPoiClick` save as well as the new search. `[inferred]`
   - If the answer is "store only the place ID and user-confirmed text", design 2c is affordable and compliant enough to ship.
   - If Moni must keep provider names and coordinates permanently, as the CSV export implies, put Amazon Location GrabMaps `Stored` behind the same backend endpoint, as the earlier research recommends. That costs about $43 a month in the expected scenario, with no Google terms risk.
   - Run the GrabMaps bake-off from that research before choosing the provider.

## Other costs at 10,000 users

| Item | Limit | Effect at 10k users |
| --- | --- | --- |
| Supabase database | Free 500 MB; Pro 8 GB, then $0.125 per GB ([pricing](https://supabase.com/pricing)) | 5,000 MAU × 60 entries a month at about 1 KB with indexes is about 300 MB a month. The free tier fills in under 2 months. `[guess]` |
| Supabase storage (receipts) | Free 1 GB; Pro 100 GB, then $0.0213 per GB | Receipts are 1024 px JPEGs at 0.88 quality (`lib/receipts/images.ts:12,65`). 5,000 MAU × 4 receipts × about 200 KB is about 4 GB a month. `[guess on size and count]` |
| Supabase egress | Free 5 GB; Pro 250 GB, then $0.09 per GB | Every new device pages the full history, and realtime sends every change. Likely over 5 GB, likely under 250 GB. `[guess]` |
| Supabase realtime | Free 200 concurrent connections and 2M messages; Pro 500, then $10 per 1,000 ([realtime limits](https://supabase.com/docs/guides/realtime/limits)) | 16 synced tables use `realtime: true` (`lib/store/index.ts:141`). Over the limit, "the join is refused" with `too_many_connections`. 200 is tight at peak for 5,000 MAU. `[proven limit, guess on peak]` |
| Supabase plan | Free pauses after a week of inactivity. Pro is $25 and includes $10 of compute credit, enough for one Micro instance | Expect Pro at $25. Whether Micro is enough at 10k users was not measured. `[inferred]` |
| OpenRouter | $0.128 per 1,000 calls on `deepseek-v4.1-flash`, $0.033 on `qwen3.7-flash` (`docs/AI.md` benchmark) | $23, $96 or $461 a month across the scenarios on DeepSeek, or $6, $25 or $119 on Qwen. `[inferred]` |
| Cloud Run | Request-based free tier: 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million requests a month ([Cloud Run pricing](https://cloud.google.com/run/pricing)) | Expected traffic is about 750,000 requests, inside the request allowance. LLM calls take about 2 s each, so billed CPU time may pass 180,000 vCPU-seconds. Expect a few tens of dollars at most. `--max-instances 1` will also limit throughput in the high scenario. `[guess, per-second price not verified]` |

## Not verified

- No official price or terms exist for the Android platform `Geocoder` backend. Calling it free and unbilled rests on no API key being passed.
- Google publishes no price page for OAuth or Sign in with Google, so $0 rests on the absence of any fee in Google's OAuth documentation.
- That Supabase counts `signInWithIdToken` Google logins as normal MAU and not Third-Party MAU. Both lines include 50,000 on Free, so the cost is $0 either way.
- Whether Places API (New) honours Android app restrictions sent through `X-Android-Package` headers.
- HERE pricing and terms, and Cloud Run per-second prices for `asia-southeast3`.
- Every usage number in Assumptions, receipt sizes and the realtime peak.
- The legal reading of "copy and save business names" for a place one user picks for their own ledger.

## Sources

- Google Maps Platform: [global price list](https://developers.google.com/maps/billing-and-pricing/pricing), [March 2025 changes](https://developers.google.com/maps/billing-and-pricing/march-2025), [SKU index](https://developers.google.com/maps/billing-and-pricing/sku-details), [Maps SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details/maps), [Places usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [Places data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields), [Autocomplete session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Terms of Service §3.2.3](https://cloud.google.com/maps-platform/terms), [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), [API security best practices](https://developers.google.com/maps/api-security-best-practices), [Manage costs](https://developers.google.com/maps/billing-and-pricing/manage-costs)
- Google OAuth: [Manage app audience](https://support.google.com/cloud/answer/15549945)
- Platform geocoders: [Android Geocoder](https://developer.android.com/reference/android/location/Geocoder), [Apple CLGeocoder](https://developer.apple.com/documentation/corelocation/clgeocoder), [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- Supabase: [pricing](https://supabase.com/pricing), [MAU usage](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users), [Third-party MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party), [Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- Google Cloud: [Cloud Run pricing](https://cloud.google.com/run/pricing)
- Alternatives: [Mapbox pricing](https://www.mapbox.com/pricing), [Mapbox Search Box](https://docs.mapbox.com/api/search/search-box/), [Foursquare pricing](https://foursquare.com/pricing/), [AWS Location pricing](https://aws.amazon.com/location/pricing/), [AWS Places pricing buckets](https://docs.aws.amazon.com/location/latest/developerguide/places-pricing.html), [AWS ap-southeast-5 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLocationService/current/ap-southeast-5/index.json), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Photon](https://photon.komoot.io/)
- Exchange rate: [exchangerate.guru USD/MYR, 1 Nov 2026](https://exchangerate.guru/usd/myr/)
- Earlier research: `docs/research/smart-place-suggestions-2026-11.md`
