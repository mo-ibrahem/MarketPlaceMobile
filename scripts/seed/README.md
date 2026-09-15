# Launch catalogue

Seeds the app with the listings in `catalogue.csv`, posted by one seller
account, so the marketplace is not empty on day one.

`catalogue.csv` opens in Excel or Google Sheets — edit prices, add rows,
delete what you don't want to stock. Columns: `title`, `category`,
`condition` (New/Used), `price_egp`, `lead_time_days` (1–30), `photos`
(filenames separated by `|`), `description`.

## On scraping

Pulling **facts** off other marketplaces — which models sell, what they
go for — is research, and the prices here came from exactly that. Pulling
**listings** is a different thing: the photos and the wording belong to
the sellers who wrote them, and republishing either is a takedown risk
and an App Store rejection risk (5.2.1). So the sheet carries our own
copy, and photos come from you.

## Before you run it

1. **Create the seller account in the app** (sign up normally, real email,
   a name buyers will see). Do not hand the password to anyone; the script
   takes it as an argument and never stores it.

2. **Put your own photos in `photos/`.** `catalogue.json` lists the exact
   filenames each listing expects. The script refuses to post a listing
   whose photos are missing, and it never downloads an image.

   Photos must be ones you have the right to use — shots you took of the
   actual units, or images you have licensed. Screenshots of other
   sellers' listings belong to those sellers, and manufacturer marketing
   renders are trademarked; either is an App Store rejection risk (5.2.1)
   and a takedown risk.

3. **Check the prices.** They are researched mid-market figures for Egypt
   in September 2026, but the currency moves — confirm each one is a price
   you would actually honour before posting.

## Running

```
node scripts/seed/seed-listings.cjs --dry-run
node scripts/seed/seed-listings.cjs --email seller@example.com --password '…'
```

The dry run checks every photo is present and prints what would post. The
CSV is validated on load — a bad price, a lead time outside 1–30, or a
condition that isn't New/Used stops the run before anything is posted.

## Clearing test listings

`withdraw-junk.cjs` sets `status = 'removed'` on the placeholder listings
("asd", an iPhone at 25 EGP, a car at 5,000,000). They leave the
catalogue immediately but nothing is destroyed — ten products are
referenced by orders and four by chat rooms, so a hard delete would fail
or break history. `backup/products-before-cleanup.json` holds every row
as it was.

## What gets posted

Every listing goes up as `fulfilment = 'sourced_to_order'` with its lead
time, which renders a **SOURCED TO ORDER** badge on the card and an
AVAILABILITY row on the listing page. That is what keeps the catalogue
honest: the buyer is told plainly that the seller obtains the item after
they agree, rather than being left to assume it is sitting in a warehouse.

To sell something you physically have, post it through the app's normal
Sell flow, which defaults to `in_hand`.
