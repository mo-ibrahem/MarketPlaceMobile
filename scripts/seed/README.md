# Launch catalogue

Seeds the app with the listings in `catalogue.json`, posted by one seller
account, so the marketplace is not empty on day one.

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

The dry run checks every photo is present and prints what would post.

## What gets posted

Every listing goes up as `fulfilment = 'sourced_to_order'` with its lead
time, which renders a **SOURCED TO ORDER** badge on the card and an
AVAILABILITY row on the listing page. That is what keeps the catalogue
honest: the buyer is told plainly that the seller obtains the item after
they agree, rather than being left to assume it is sitting in a warehouse.

To sell something you physically have, post it through the app's normal
Sell flow, which defaults to `in_hand`.
