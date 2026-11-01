# Smart place suggestions research, November 2026

The owner wants Moni to propose a real shop when a user edits a transaction's place by hand. The proposal uses the merchant name, the category, and the position. Default behaviour stays as it is today.

Each claim has a label. `[proven]` means read in code, in a primary source, or measured on 2 Nov 2026. `[inferred]` follows from proven facts. `[guess]` is a judgement with no measurement behind it.

## Short answer

- Moni has no place editor today, so v1 must build one. `[proven]`
- Saved places are permanent, synced to Supabase, and exported to CSV, so provider storage terms decide this more than price does. `[proven]`
- Google, Mapbox and pay as you go Foursquare all forbid keeping the shop name. `[proven]`
- Amazon Location with GrabMaps is the only checked commercial provider with a self serve storage right for POI results, at $4 per 1000 calls. Mapbox says to contact sales. `[proven]`
- Recommended path is own history on the device first, then GrabMaps through the Go gateway, about $15.60 a month in the middle scenario. `[guess on usage, proven on price]`
- GrabMaps quality in Malaysia is unmeasured, so a 30 merchant bake-off comes before any app code. `[proven gap]`

## 1. How location works today

**Capture on Type it.** `apps/mobile/app/transaction/new.tsx:197` calls `prefetchTransactionLocation`. That function reads a permission already granted, never asks, and uses Balanced accuracy (`lib/transactions/prefetch-location.ts:38-50`). It builds the name from `name, street, city, region` through the device reverse geocoder (`prefetch-location.ts:22-27`). `[proven]`

**Save on Type it.** `new.tsx:417-422` writes latitude, longitude and name. `new.tsx:169-173` drops them for transfers, for wallets with location off, and after the user removes the place. `[proven]` No date check exists there, so a backdated entry still gets today's phone position. `[inferred]`

**Notification capture.** `apps/mobile/index.js:107-124` takes a snapshot when the linked app allows location, then queues it. `lib/location/location-snapshot.ts:12-17` does the read. A routine payment writes the snapshot straight to the ledger (`lib/ai/run-extraction.ts:302-304`). Other captures keep it in MMKV by proposal id (`run-extraction.ts:327-328`, `lib/ai/proposal-location-cache.ts:4-5`) and write it on approval (`lib/supabase/proposed-transactions.ts:302-315`).  Chat capture also takes a snapshot (`lib/ai/chat/orchestrator.ts:120,153`). `[proven]`

**Columns.** `location_latitude`, `location_longitude` and `location_name` sit on `transactions` (`supabase/migrations/20260214000000_initial_schema.sql:116-118`). The check constraint requires both coordinates or neither, and the name is independent (`:133-136`). Zod caps the name at 200 characters (`packages/types/src/transaction.ts:81`). `wallets.record_location` is the per-app switch (`supabase/migrations/20261021000200_merchant_aliases_and_wallet_location.sql:23`). `[proven]`

**Where the name goes.** CSV export includes place, latitude and longitude (`lib/backup/moni-export.ts:169-171`). `groupPlaces` clusters rows within 150 m for the map (`lib/finance/places.ts:7,150`). `placeLabel` turns the stored string into a name and an area (`places.ts:108`). `[proven]`

**What a manual place edit does today.** Nothing, because no editor exists. `LocationField` is one button that removes the place or restores it (`components/capture/location-field.tsx:37-47`, `new.tsx:595`). The detail screen's place row opens the place page or the map (`app/transaction/[id].tsx:405-417`). A grep of `app` and `components` finds no other writer of these fields. `updateTransaction` already accepts all three (`lib/supabase/transactions.ts:135-137`). `[proven]`

**The place chip goes the other way.** `lib/capture/place-suggestion.ts:84` maps a position to a merchant the user has paid before, with no network (`new.tsx:174-190,503`). The new feature maps a merchant to a position.  The Android Maps key is embedded in the APK, recoverable, and meant to enable only Maps SDK for Android (`docs/SETUP.md:171-175`). `[proven]`

## 2. Candidate providers

Prices are first tier in USD. The storage column decides the choice.

| Provider | Query shape | Malaysia evidence | Price and free tier | Attribution and storage |
| --- | --- | --- | --- | --- |
| Google Places (New) | `POST places:searchText` with `textQuery`, `locationBias`, `X-Goog-FieldMask`. `places:searchNearby` takes types and a circle, no text. `places:autocomplete` returns `distanceMeters` with `origin`, no coordinates. | Coverage page lists Malaysia for maps and geocoding, with no Places column `[proven]`. Strong POI data `[inferred]`. | Text or Nearby Pro $32, 5,000 free. Autocomplete $2.83, 10,000 free. IDs only is free. | Customer will not "copy and save business names, addresses, or user reviews". Latitude and longitude for 30 days. `place_id` indefinitely. Google logo needed without a Google map. |
| Mapbox Search Box | `GET /search/searchbox/v1/forward?q=&proximity=&types=poi&country=MY`, or `/category/{id}`. | No country POI figure found. | Requests free to 25,000, then $1.70. Sessions 500 free, then $3. Table layout was ambiguous, so check before use. | "All data returned by the Search Box API endpoints is only available for temporary use." |
| Foursquare | `GET places-api.foursquare.com/places/search?query=&ll=&radius=&fsq_category_ids=&sort=DISTANCE`, version header, bearer token. | 200+ countries, no Malaysia figure. | Pro $15, 500 free. The page also claims 10,000 sandbox calls and does not reconcile them. | Pay as you go gets "no caching permitted". Place IDs are exempt. Credit required. |
| HERE | `/discover?at=lat,lng&q=`. Own docs were not readable for this. | Not verified. | Pricing page did not render. Secondary sources give 1,000 a day or about 30,000 a month free. `[inferred, weak]` | Own terms not read. A third party guide says standard plans cannot store results. `[guess]` |
| Overpass and Nominatim | `nwr["name"~"..."](around:r,lat,lng)` on Overpass. Nominatim `search`. | 174 named food and shop POIs within 400 m of Bangsar, 263 within 800 m of Kota Kinabalu centre. 1,605 objects named 99 Speedmart against 3,151 outlets reported, so at most 51% for a large chain. `[proven]` A 2018 Putrajaya study found poor completeness. | Free, but Nominatim allows 1 request a second, bans autocomplete, and limits total app traffic. Overpass suggests dividing 10,000 a day by 100 and self hosting for commercial use. | ODbL, attribution, storage allowed. Self hosting adds cost and an operations burden. `[inferred]` |
| Amazon Location with GrabMaps (added, not in the brief) | `POST places.geo.ap-southeast-5.amazonaws.com/v2/search-text?key=` with `QueryText`, `BiasPosition`, `MaxResults`, `IntendedUse`. `/v2/search-nearby` has `QueryPosition`, `QueryRadius`, `Filter.IncludeCategories`. | Malaysia listed, 500+ cities across eight countries, Malaysia region exists, local language search. All vendor claims, not tested. | Core $0.50, Stored $4, Malaysia region price list dated 11 Sep 2026. 20,000 Core free for three months only. | "You can store the Places results indefinitely" with `intendedUse = Stored`. Attribution may sit in the app or product docs. See the caveat below. |
| On device | `Location.geocodeAsync` takes an address string. No POI search, no proximity input. | Not applicable. | Free. | Not applicable. Own history is the only useful on-device source. `[proven]` |

**AWS caveat.** Service Terms 82.4(a)(ii) names only "geocoding and reverse-geocoding results" as storable. The developer guide and the `SearchText` reference extend storage to Places results. `[proven]` `GetPlace` does not support `IntendedUse` on GrabMaps, while `SearchText` and `SearchNearby` carry no such note. `[proven]` Ask AWS Support to confirm in writing and read the `x-amz-geo-pricing-bucket` header in the bake-off.

**Bundled data.** Foursquare OS Places is Apache 2.0 with 100M+ POIs. `[proven]` Serving a Malaysia subset needs a data store, which the gateway lacks. Keep it as the fallback if GrabMaps fails the bake-off. `[inferred]`
**Why Google loses despite the free tier.** Google costs $0 at the middle volume. A compliant build could keep only `place_id`, then pay for a live lookup to show the name on every screen. That breaks offline display, the map, and CSV export. `[inferred]` Whether a single user confirmed save counts as "copy and save" is a legal reading. I read it as yes. `[inferred]` The same Google project could also run the spending map, so a suspension would reach that page. `[guess]`

**Privacy, all providers.** Each provider sees the query text and coordinates. Through the gateway it sees no user id and no phone IP. `[inferred]` With GrabMaps, Service Terms 82.1 lets AWS send request parameters to the provider, possibly outside the region. `[proven]`

## 3. Where the call should live

Use the Go gateway. `[inferred from the points below]`

- Google's security guide says web service keys "are not expected to be publicly exposed" and recommends a proxy that requires client authentication. `[proven]` Do not enable Places on the Android Maps key, because it is recoverable from the APK. `[inferred]`
- Every `/v1` route already has JWT checks and per-IP and per-user limits (`apps/backend/cmd/server/router.go:42-43`). `[proven]`
- The existing bucket is 20 a minute with burst 8, shared with AI calls (`cmd/server/main.go:38`). Give places its own group and limiter, about 10 a minute with burst 4, and a 4 KiB body limit. `[guess on numbers]`
- `--max-instances 1` keeps in-memory limits correct (`apps/backend/README.md:80`). `[proven]` Add a global daily counter of 500 calls that returns `unavailable`, which caps spend near $60 a month. `[guess on the number]`
- AWS allows 100 `SearchText` calls a second by default. `[proven]` The AWS key travels in the URL unless the code signs with SigV4. Never log outbound URLs or raw HTTP client errors. `[inferred]`
- Send coordinates in the POST body, because `gin.Logger` records the request line (`router.go:32`). `[inferred]` Round to 3 decimals, about 110 m, then sort by exact distance on the phone. `[guess that bias survives this, check in the bake-off]`

**What is additive.** A push to `main` under `apps/backend/**` deploys automatically and keeps env vars (`apps/backend/README.md:82`). `[proven]`

- A new `internal/places` package and `POST /v1/places/search` change no existing contract. `newRouter` gains a parameter, so router tests change with it. `[inferred]`
- `config.Load` returns an error on missing required vars (`internal/config/config.go:33-38`). Keep `AWS_LOCATION_API_KEY` optional, or an auto-deploy could fail to start. `[inferred]` Without the key, return 200 with `unavailable`, matching the backend convention in `.cursor/rules/backend-go.mdc`. `[proven convention]`
- Old apps never call the route. A new app on an old backend gets 404 and treats it as `unavailable`. `[inferred]`
- No migration is needed for v1. `[inferred]` Docs to update in the same change are `apps/backend/README.md`, `docs/ARCHITECTURE.md:33`, `docs/SETUP.md`, `docs/REDESIGN.md:113`, and `.cursor/rules/backend-go.mdc`. Put the shape in `packages/types` first. `[proven rule]`

## 4. Matching logic

**Trigger.** Only opening the editor starts matching. Save, routine auto-add and the keypad never call the network. This follows the owner's request.

**Step 1, own places, always, no network.** Reuse `groupPlaces`, `merchantName`, `merchantKey`, `distanceM` and `placeLabel`, and drop wallets with location off as `placeSuggestion` does. Typing filters this list on every keystroke. A strong own match skips the automatic provider call, which also lowers cost as history grows. `[inferred]`

**Step 2, provider call, at most once on open.** It runs once if a merchant or a mapped category exists and step 1 found no strong match. After that, only the keyboard's search key calls again. There is no per keystroke call, because the price is per request. `[proven price, guess on UX]`

- With a merchant, use `SearchText` with the cleaned name and `BiasPosition`. With only a mapped category, use `SearchNearby` with `IncludeCategories` and a 1 km radius, because AWS allows category filters only there. `[proven]` With neither, make no call.
- Never send `description` automatically. Moni's free text can name people, as the detail screen placeholder "Who it was with, what it was for" shows (`app/transaction/[id].tsx:612`). `[proven placeholder, inferred risk]`

**Ranking.** This is a pure function, tested with Malaysian fixtures. Thresholds are `[guess]` until tuned.

1. Normalise with `merchantKey`, drop words such as `sdn bhd`, `enterprise`, `trading`, `restoran` and `kedai`, then remove spaces so `KKMART` meets `KK Mart`.
2. Score the name with a trigram Dice coefficient, which needs about 15 lines and no dependency.
3. Sort into tiers: strong name at 0.75 or more, weak name at 0.4 or more, then category only. Drop the rest.
4. Inside a tier, sort by distance in 10 m bands, as `place-suggestion.ts:32` does. A category match breaks ties.

This returns the nearest branch of a chain, which is what the owner described. Own places sit above provider results at equal tier. `[guess]`

**Category mapping.** IDs are from the AWS list with no GrabMaps exclusion mark. `[proven]` The mapping is `[guess]`. Key it to system category names from `20260721000000_refresh_category_catalog.sql:57-70` and `20261101000100_malaysian_categories.sql:48-52`.

| Moni category | AWS categories |
| --- | --- |
| Food & Dining | `restaurant`, `coffee_shop`, `fast_food` |
| Shopping | `shopping_mall`, `department_store`, `grocery`, `convenience_store`, `clothing_and_accessories`, `consumer_electronics_store` |
| Transportation | `fueling_station`, `parking` |
| Transit | `train_station`, `bus_station` |
| Healthcare | `hospital`, `pharmacy`, `drugstore` |
| Entertainment | `cinema`, `karaoke`, `amusement_park` |
| Education | `school`, `bookstore` |
| Travel | `hotel`, `airport` |
| Housing, Work, Gifts & Donations, Other Expenses, custom categories | No filter. Name search only. |
| Subscriptions, Fees & Charges, Tolls, TNG Reloads, PTPTN, Takaful | No automatic call. These are rarely a shop visit. |

**Offline.** Own places still work and the user can type a name. A typed name with a null position saves, because the constraint covers only coordinates. It shows on the detail row but not on the map (`places.ts:85-93`). The list reads "Can't search right now. Your places still work." `[proven constraint, guess on copy]`

**How a notification capture differs.**

- The search centre is the stored snapshot, never the phone's position at review time. The snapshot is taken at receipt, even if the queue then waits for days (`index.js:107-116`). `[proven]`
- The app declares no background location permission (`app.json:25-26`), and the code calls headless location best effort (`index.js:113`). Snapshots may often be null. Measure on the device. `[inferred]`
- With no snapshot and a payment that is not from today, do not use the phone silently. Show "Near you now" so the user knows the centre is a guess. The same applies to backdated Type it entries. `[guess]`
- Banks often report legal or acquirer names, and online payments capture the user's home. Results stay proposals and never apply automatically. `[guess on frequency]`
- The proposal snapshot is local to one phone until approval, so edit a proposal's place only on that device in v1. `[inferred]`

## 5. Recommendation

**Provider.** Amazon Location with GrabMaps in `ap-southeast-5`, subject to the bake-off. Cloud Run is in Bangkok, so the call stays regional. `[proven regions]`

**Call path.** Phone, then `POST /v1/places/search`, then AWS with `IntendedUse=Storage` and an API key held only on the gateway. Limit that key to the two search actions if AWS key settings allow it. `[not verified, the AWS page did not load]` Every search uses the stored price. Searching at $0.50 and repeating at $4 on pick saves about $6 a month, but it adds a second call and a mismatch risk. That saving does not pay for the code at this volume. `[guess]`

**V1 scope, in order.**

1. Bake-off script. Run 30 real merchants across KL, Penang and Kota Kinabalu through GrabMaps and Google, and record whether the right shop is in the top 3. Suggested pass is 70%. `[guess on bar]` Rerunnable, cost under $1. `[inferred]`
2. `rankPlaces` and own place matching as pure functions with fixtures.
3. Gateway route, optional key, limiter, daily cap.
4. Editor sheet on Type it and transaction detail, checked on the phone with `moni-device`.

Out of v1 are new columns, opening hours, map pins for candidates, and any suggestion outside the editor.
**UX.** No board covers this, so it needs one before build under the design fidelity rule. The default stays as today, the current position with its reverse geocoded name. `[guess on layout]`

- The body of `LocationField` opens the editor, and its trailing icon still removes the place in one tap. `PlaceChip` already splits two targets this way (`components/capture/place-chip.tsx:34-61`).
- On the detail screen, the place row keeps opening the map and gains an explicit Change control. A row that silently changes its tap target would be a hidden gesture.
- The sheet (`components/ui/sheet`) opens with a search field filled with the merchant. **Your places** has up to 3 rows: "Mamak Ali, 40 m, paid 6 times".
- **Nearby**, up to 5 rows: "ZUS Coffee, Jalan Telawi 3, 120 m". The header states the centre, "Near where you paid" or "Near you now". Skeletons here must not move the rows above.
- Fixed rows: "Use my position" and "Save '<typed text>' as the name".
- Nothing is selected by default. One tap saves and closes. A pick fills the merchant only when it is empty. A small attribution line sits at the foot, per Service Terms 82.10.

**Cost at 1000 users.** The usage model is a `[guess]`. All users are active, each makes 1, 3 or 10 editor opens a month, and each open makes 1.3 calls. Own place hits would lower this. Calls are therefore 1 × 1000 × 1.3 = 1,300, then 3 × 1000 × 1.3 = 3,900, then 10 × 1000 × 1.3 = 13,000.

| Option | 1,300 calls | 3,900 calls | 13,000 calls |
| --- | --- | --- | --- |
| GrabMaps Stored, recommended, $4 per 1000 | $5.20 | $15.60 | $52.00 |
| GrabMaps Core search, plus a Stored repeat when 60% of opens end in a pick | 1.3 × $0.50 + 0.6 × $4 = $3.05 | 3.9 × $0.50 + 1.8 × $4 = $9.15 | 13 × $0.50 + 6 × $4 = $30.50 |
| Google Text Search Pro, cannot keep names | $0 | $0 | 8 × $32 = $256, after 5,000 free |
| Foursquare Pro, cannot keep names | 0.8 × $15 = $12, after 500 free | 3.4 × $15 = $51 | 12.5 × $15 = $187.50 |

Cloud Run stays inside its current free tier for this traffic. `[inferred from docs/ARCHITECTURE.md:95]` The first three months have no reliable discount, because the AWS free tier names Core calls only. `[inferred]`

**Data shape.** Existing columns store the pick. `location_name` becomes `Title, Street, City, Region`, with commas removed from the title and cut to 200 characters. `placeLabel` then reads the title as the name and the city as the area (`places.ts:108-117`). `[proven by reading]` Coordinates move to the shop. If that row anchors a place, its map group may change. `[inferred]`

```ts
type PlaceSearchRequest = {
  query: string | null;
  categoryIds: readonly string[];
  near: { latitude: number; longitude: number }; // 3 decimals
};
type ProviderPlace = {
  id: string;
  title: string;
  street: string | null; city: string | null; region: string | null;
  latitude: number; longitude: number;
  categoryIds: readonly string[];
};
type PlaceSearchResult =
  | { status: 'ok'; places: readonly ProviderPlace[] }
  | { status: 'unavailable'; reason: string };
type SearchCentre = { kind: 'captured' | 'here'; at: LatLng } | { kind: 'unknown' };
```

**The owner must decide.**

1. Open an AWS account for this, or accept weaker options. No AWS account exists in this repo's setup docs. `[proven by grep of docs/SETUP.md]`
2. Accept the reading that Google, Mapbox and Foursquare cannot keep shop names, or get a legal view.
3. Set the bake-off pass bar and supply the 30 merchants.
4. Approve the monthly cap, recommended at 500 calls a day.
5. Automatic search on open, as recommended, or only after tapping a Search row. The second is more private and costs less, with one more tap.
6. Whether a pick moves the pin to the shop, as recommended, or keeps the phone position and only renames.
7. Approve a design board for the sheet and the detail screen control.
8. Update the privacy text and the Play Data safety form, because a place search sends position and shop text off the phone. A grep of `docs` and `apps/web` found no privacy policy text on location. `[proven grep, legal view not given]`
9. Ask AWS Support to confirm Stored rights for `SearchText` with GrabMaps.

## Sources

- Google [pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), [Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Platform Terms 3.2.3](https://cloud.google.com/maps-platform/terms), [Service Specific Terms 3 and 14](https://cloud.google.com/maps-platform/terms/maps-service-terms), [key security](https://developers.google.com/maps/api-security-best-practices), [coverage](https://developers.google.com/maps/coverage)
- Mapbox [Search Box API](https://docs.mapbox.com/api/search/search-box/), [pricing](https://www.mapbox.com/pricing)
- Foursquare [place search](https://docs.foursquare.com/fsq-developers-places/reference/place-search), [pricing](https://foursquare.com/pricing/), [usage guidelines](https://docs.foursquare.com/fsq-developers-places/reference/usage-guidelines.md), [OS Places](https://opensource.foursquare.com/os-places/)
- HERE [pricing page, did not render](https://www.here.com/get-started/pricing), [third party guide, weak](https://mapscaping.com/guide-to-geocoding-api-pricing/)
- OpenStreetMap [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), [Putrajaya study](https://isprs-archives.copernicus.org/articles/XLII-4-W9/291/2018/isprs-archives-XLII-4-W9-291-2018.pdf). Counts came from `overpass-api.de` on 2 Nov 2026, using a bounding box for the chain count, so a few matches may fall outside Malaysia.
- [99 Speed Mart Q2 FY2026 release](https://99speedmart.com.my/wp-content/uploads/2026/08/Press-Release-Second-Quarter-Results-FY2026_260819_185354-1.pdf), seen through search results, 3,151 outlets at 30 June 2026
- AWS [GrabMaps](https://docs.aws.amazon.com/location/latest/developerguide/GrabMaps.html), [Places pricing buckets](https://docs.aws.amazon.com/location/latest/developerguide/places-pricing.html), [pricing](https://aws.amazon.com/location/pricing/), [price list for ap-southeast-5](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLocationService/current/ap-southeast-5/index.json), [SearchText](https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_SearchText.html), [SearchNearby](https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_SearchNearby.html), [GetPlace](https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_GetPlace.html), [categories and filters](https://docs.aws.amazon.com/location/latest/developerguide/places-filtering.html), [endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/location.html), [Service Terms 82](https://aws.amazon.com/service-terms/)
- Expo [Location](https://docs.expo.dev/versions/latest/sdk/location/)
