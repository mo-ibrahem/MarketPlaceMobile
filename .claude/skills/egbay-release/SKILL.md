---
name: egbay-release
description: Pre-submission checklist for the Egbay iOS app against the App Store Review Guidelines and this project's own honesty rules. Run before any `eas build`/`eas submit`.
---

# Egbay App Store release check

Egbay is an escrow marketplace for physical goods in Egypt with a seller
wallet, boosts, and live selling. Apple treats those three differently, and
the app has a history of screens that announced things the backend never did.
Work through every section; do not submit while any item is open.

## 1. Payments — what may and may not use Paymob (3.1.1, 3.1.3)

- Physical goods checkout MUST go through Paymob, never IAP (3.1.3(e)).
- Anything digital sold to the user of the app must use IAP or be absent on
  iOS: listing boosts (3.1.3(g) names "boosts" explicitly), live-pass booking,
  seller tier purchases, and wallet deposits when the balance can only buy
  those. Gate on `DIGITAL_PURCHASES_ENABLED` from
  `src/services/lib/platformCommerce.ts`; grep for new call sites of
  `purchase_boost`, `/boost/`, `/live/book`, `topup/create` and confirm each is
  gated.
- Tiers are unlocked by ID verification, not payment. If a paid tier is ever
  introduced, it is IAP on iOS or not on iOS.
- No screen may mention IAP alternatives, "cheaper on the web", or link out
  to buy digital items (3.1.1 anti-steering).

## 2. Nothing claimed that did not happen (project rule + 2.3.1, 5.1.1)

For every success toast / banner grep the handler: it must follow an awaited
call whose result was checked. Known past offenders, all fixed — do not let
them back in: payment success before webhook confirmation, "payout
processed", demo ledger rows, default payout accounts, manual-deposit
instructions with placeholder numbers, express-payout / schedule promises,
"Report submitted" / "User blocked" / "Account deleted" with no write.
Payouts are manual review: never say "instant".

## 3. User-generated content (1.2)

Listings, chat, live chat and reviews are UGC. Required and present:
report (listing, user), block (chat header), contact (`info@egbay.shop` on
Privacy/Terms). Backed by `report_content`, `block_user`, `blocked_users`
in `supabase/migrations-proposed/20260912090000_app_review_compliance.sql`;
confirm the migration is applied before submission or the buttons show the
honest "temporarily unavailable" fallback, which reviewers will exercise.

## 4. Account (5.1.1(v), 4.8)

- In-app Delete Account must really delete: `delete_my_account` RPC, Profile
  → Settings. Test with a throwaway account, then confirm sign-in fails.
- Privacy policy text must describe exactly what deletion does.
- If any third-party sign-in (Google, Facebook) is ever added, Sign in with
  Apple becomes mandatory (4.8). Today there is email/password only.

## 5. Review account and data hygiene

- Provide a working reviewer account in App Store Connect → App Review
  Information. The account must be able to buy (Paymob test card), see an
  order, chat, review, and delete itself. Rotate its password if it has
  ever been in a transcript or git history (it has: commit 34c0ecf).
- Remove or hide test listings ("Test Product", "123", screenshots of
  desktop error dialogs) — reviewers see the live catalogue.
- Reviewer notes must explain escrow, that live selling is viewing-only on
  iOS, and give the test-card numbers.

## 6. Legal entity (5.1.1(ix))

Apps offering escrow/wallet/payout are financial services and "should be
submitted by the entity providing the service", not an individual developer.
The Apple team is currently an Individual account; expect a metadata
rejection or a request for licensing details. Have the company registration
and Paymob merchant agreement ready.

## 7. Build

- `npx tsc --noEmit -p .` clean; `expo export --platform web` clean.
- `app.json`: version bumped, `ITSAppUsesNonExemptEncryption` false,
  permission strings present for photos/camera only (no location, no
  tracking → no ATT prompt needed; do not add a tracking SDK).
- Splash/icon are the plain logo (no stray text).
- `eas build -p ios --profile production` then a real-device pass of:
  Paymob WebView happy path AND declined card, order tracker, chat with
  keyboard, tab bar inset, report/block/delete.
- `eas submit -p ios` only from a terminal the operator controls.
