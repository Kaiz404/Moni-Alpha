# receipts

Receipt-image extraction cases for `/v1/extract/image`. `evals/scripts/build-receipts.mjs` writes `items.jsonl`, `images/` and `.cache/`. Run the script before you sync this suite, because the SROIE images are not in git.

```sh
node evals/scripts/build-receipts.mjs          # skips images that already exist
node evals/scripts/build-receipts.mjs --force  # downloads and renders every image again
```

The script needs network access to `datasets-server.huggingface.co`, `sharp` from the repo's `node_modules`, and Playwright's `chromium_headless_shell`.

## Slices

| Slice | Items | Region | Source | Licence | Trainable | Images |
| --- | --- | --- | --- | --- | --- | --- |
| `sroie` | 27 | MY | ICDAR 2019 SROIE test split, via the HF mirror `jsdnrs/ICDAR2019-SROIE` | unclear | no | `.cache/` (gitignored) |
| `cord-v2` | 10 | ID | `naver-clova-ix/cord-v2` test split | CC BY 4.0 | yes | `images/` |
| `synthetic-render` | 20 | US 4, UK 3, AU 3, CA 3, IN 3, SG 2, PH 2 | HTML templates in the build script | own | yes | `images/` |
| `moni-bench` | 5 | MY | `apps/backend/internal/extract/testdata/bench/*.png` | own | yes | `images/` |
| negatives | 3 | global | rendered menu, blank page and product photo, `expected: { status: "skipped" }` | own | yes | `images/` |

Total: 65 items. `images/` is about 1.8 MB and `.cache/` is about 2 MB. Every image is a JPEG with a longest side of 1280 px or less, at quality 80.

## Labels

- **SROIE.** The amount, date and merchant were checked by eye against each image. The dataset's `company` field is the legal entity, so `merchant` is the name a person would use: "McDonald's" instead of "Gerbang Alaf Restaurants", and "Caltex" instead of "Biru Petroleum". Dates are converted to `YYYY-MM-DD`. `clientNow` is two days after the receipt date, with `timezone` set to `Asia/Kuala_Lumpur`.
- **CORD.** The shop names and dates are blurred in the source, so these items score only `amount`, `itemCount` and `type`. `currency: "IDR"` is set only on `cord-test-024`, the one receipt that prints "Rp". Every receipt picked has quantity 1 on each product line, or prints a total quantity, so the number of product lines equals the sum of `cnt`. These items use the `SG` wallets, as instructed. Expect the backend to output wallet currency for them.
- **Synthetic.** Totals are computed in integer cents from the template slots, so the labels are exact. The renders vary the font, the layout, rotation, blur, crumple shading and the background. Two receipts are deliberately tricky: `us-pharmacy-coupon` has a coupon, so the total differs from the subtotal, and `us-diner-tip-tax` has both sales tax and a tip. Other variations include service charges (UK, SG, PH), inclusive VAT and GST (UK, AU, SG, PH), GST plus PST (CA), CGST/SGST with round-off and lakh formatting (IN), and a member discount (SG). Merchants are fictional.
- **itemCount** follows the backend prompt: use the count the receipt prints, otherwise count the product lines. For SROIE it is omitted wherever the count is ambiguous, for example a single line with quantity 2, or meal sub-lines.
- **moni-bench.** The labels come from `benchCases` in `bench_test.go`, plus dates and item counts read from the images. `cmd/server/testdata/receipt.png` is byte-identical to `bench/familymart.png`, so it appears once, tagged `live-test`.

## Labels I could not confirm, and items I left out

- `sroie-x51006334927` (Caltex): a redaction dot covers the date, so `date` is not set. The dataset gives `11/11/16`.
- `sroie-x51005433556` and `sroie-x51005442388` are small receipts on full A4 scans. `sroie-x51005442388` prints "ITEMS 50", which does not match its 4 product lines, so `itemCount` is not set.
- `sroie-x51006414715` prints its date month-first (`4/22/2018`), unlike the rest of the slice.
- Dropped: SROIE `X51005337867` (OldTown, marked "Guest Check – THIS IS NOT A RECEIPT"), and CORD test rows 29 and 74 (promo and set-meal sub-lines make the item count ambiguous).

## Licences and attribution

- **CORD v2.** Park et al., "CORD: A Consolidated Receipt Dataset for Post-OCR Parsing", NAVER Clova, 2019. Released under CC BY 4.0: https://huggingface.co/datasets/naver-clova-ix/cord-v2. The images in `images/cord-test-*.jpg` are resized JPEGs of the test split rows with the same index.
- **SROIE.** ICDAR 2019 Robust Reading Challenge on Scanned Receipts OCR and Information Extraction. The terms of use are not clear, so these images are not committed and the items carry `trainable: false`.
- **Synthetic, moni-bench and negatives.** Our own work.
