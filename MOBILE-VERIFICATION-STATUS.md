# Verification status — MarketPlaceMobile

Written 2026-09-10, closing out the porting work on branch
`fix/payment-verify-before-claiming` (PR #1).

This document exists because "it compiles" was doing too much work in earlier
reports. **Typechecking and bundling do not tell you a screen isn't blank or
crashing.** They cannot catch a query that returns zero rows under RLS, a
component that throws on mount, a layout that renders off-screen, or copy that
reads wrong. One such bug did ship into this branch and was only caught by
rendering: every listing card said "Unknown Seller", and the seller ratings
added alongside would have been permanently blank, because seller profiles were
read from `user_profiles` — whose only SELECT policy is `auth.uid() = id`.
`tsc` and the bundler were both perfectly happy with it.

---

## 1. What has never been rendered

**These five screens have never been rendered by anything — not a device, not a
browser, not once.** No screenshot exists of any of them. They are known only
to typecheck and to be included in a successful bundle.

| Screen | Why it could not be rendered here |
|---|---|
| **Header notification bell** (`app/(tabs)/index.tsx`) | Signed out, `/` redirects to the login screen, so the home header never mounts |
| **Order screen** (`app/order/[orderId].tsx`) | Requires a signed-in buyer or seller on a real order |
| **Review form in situ** (on the order screen) | Same; only reachable on an order with `status = 'completed'` |
| **Populated notifications** (`app/notifications.tsx`) | Requires a signed-in user with rows in `notifications` |
| **Boost screen** (`app/boost/[productId].tsx`) | Loads the user's wallet on mount; signed out it sits on a spinner forever |

Everything in the table above is unverified beyond compilation. That includes
the wallet-only payment section and top-up hint added when card-paid boosts
were removed, and the truthful pending/cancelled banners added to the order
screen.

## 2. What is verified, and by what method

The method matters: *verified in an isolated harness* and *verified on a real
screen* are different claims and are not interchangeable.

| Thing | Method | Strength |
|---|---|---|
| Product detail screen | Rendered in headless Chrome against the **live database** — real seller name, "No ratings yet", empty item-reviews section | Real screen, real data, signed out |
| Listing cards | Same. Confirmed real seller names render, and that the removed hardcoded "4.9" is gone | Real screen, real data, signed out |
| Notifications screen | Rendered in headless Chrome, **signed-out state only** — header, back button, empty state | Real screen, one state only |
| `StarRating`, `ReviewList`, `ReviewForm` | Rendered in a **throwaway harness** with fabricated props (deleted before commit). Covers half-stars, seller-response block, "(edited)" marker, submit disabled until a rating is picked | Isolated components, never on their real screens |
| Order-screen banners | Same harness, as standalone `View`s — **not** the order screen itself | Isolated markup only |
| `classifyPaymobUrl` | 16/16 unit cases: 7 decline shapes, 5 approval shapes, 4 mid-checkout URLs | Pure function, never met a real redirect |
| `canReviewOrder`, `notificationRoute` | 14/14 unit cases incl. the 89-vs-91-day boundary | Pure functions |
| Grants / RLS assumptions | Queried directly against `fpqbocohjzwlfcmfropr` | Configuration, not behaviour |

Note the rendering was done via `expo export --platform web` served locally and
driven by headless Chrome. That is **react-native-web**, not the native
runtime: layout, fonts and native modules differ. It is good evidence a screen
mounts and its data layer works. It is not evidence of how it looks on a phone.

## 3. What a device pass should exercise, in order

**1. The WebView Paymob payment flow — first, and by a distance.**
It is the only path where money moves, it exists *only* natively
(`react-native-webview`), and headless Chrome cannot touch it at all. The
redirect interception in `app/payment.tsx` was rewritten so a declined payment
can no longer report success, and `classifyPaymobUrl` is well-reasoned and unit
tested — **but it has never met a real Paymob redirect.** Test both:

- a **declined** card, which must land on "Payment declined" and never on a
  success claim; and
- an **approved** card, which must go through the verifying state and only
  claim escrow once the order row actually leaves `pending_payment`.

Also worth watching: the 40s verification timeout, which should end on
"Not confirmed yet" and never fall through to success.

**2. The signed-in screens** — the bell and its unread badge, the notifications
list with real rows, the order screen's pending / cancelled / escrow banners,
and the review form on a `completed` order. With 0 reviews in the database and
1 completed order whose buyer is a test account, `/courier-simulator` on the
web app walks an order `out_for_delivery → delivered → completed` to produce a
reviewable one.

**3. The boost screen** — that the wallet-only section renders and that an
insufficient balance shows the top-up route rather than a dead card option.

## 4. Still missing as a feature: seller verification

Not built, deliberately. Mobile currently saves payout details and states
plainly that ID verification is unavailable; it no longer grants a tier.
(It previously wrote `tier` and `is_verified_seller: true` straight from the
client after nothing but a 14-digit length check, then reported "Verification
Approved!" regardless.)

Porting it properly needs a real image-picker flow:
`seller_verification_requests` requires **both** `national_id_front_url` and
`national_id_back_url` as `NOT NULL`, so no stub will do. Web's
`app/seller-verification/page.tsx` is the reference — it uploads to a private
bucket and files a `pending` row for human review. It also wants a handset to
review properly, which is why it was held rather than half-built.

## 5. Credential note

`scripts/create_apple_test_account.js` no longer contains a literal password or
inline anon key; both now come from the environment and the script refuses to
run without them.

**Removing the literal does not purge it from git history.** It was first
committed in `34c0ecf` and remains recoverable from any existing clone or fork.
**Rotation is the actual fix**, not the file change.

---

## 6. App Store submission — what blocks it (2026-09-12)

The App Store Review Guidelines were read in full and applied in commit
`ef8946e`. What the code now does on iOS: boosts, live-pass booking and wallet
deposits are hidden (3.1.1 / 3.1.3(g)); Report, Block and Delete Account call
real RPCs and refuse to claim success otherwise (1.2, 5.1.1(v)); the wallet
shows only real rows. The full checklist lives in
`.claude/skills/egbay-release/SKILL.md`.

Still open, in order of who can do it:

| # | Blocker | State |
|---|---------|-------|
| 1 | Migration `20260912090000_app_review_compliance.sql` | ✅ applied 2026-09-12 after a rolled-back dry run; verified through PostgREST as the review user (report, block, unblock, RLS denials, cascade guard). Recorded in `EgbayWeb` commit `66cce36`. |
| 2 | Migration `20260911100000_allow_users_to_edit_own_profile.sql` | ✅ applied; `profileService.updateProfile` now calls `update_my_profile`. |
| 3 | Review account `apple.review@egbay.market` | ⚠️ **needs restoring.** My verification probe called `delete_my_account` on it by mistake (a thenable `rpc()` builder was awaited unintentionally). The function worked exactly as designed: the account is anonymised, banned and its two test listings withdrawn. Restoring it (email, password, identity row, listings) needs `auth.users` writes the permission classifier refuses me. **Owner:** Supabase dashboard → Authentication → Users → the row whose email is `deleted+4e1994d8-…@egbay.invalid` → set email back to `apple.review@egbay.market`, set a new password, un-ban; or create a fresh reviewer account with `scripts/create_apple_test_account.js`. Either way the password is rotated, which was required anyway. |
| 4 | Test listings | ✅ "Test Product" withdrawn (status `removed`; it has an order so it cannot be deleted). "123" was the reviewer's own listing and went with the account. |
| 5 | Device pass on a real iPhone | ⏳ user — nothing here has run on iOS. |
| 6 | `eas submit` build 17 (v1.1.0, `60ad1db1`) | ⏳ user — needs Apple ID password + 2FA. |
| 7 | 5.1.1(ix) individual developer account for a financial-services app | ⏳ not fixable in code. |
| 8 | **Agora App Certificate was shipped inside the app** (`src/services/lib/agoraToken.ts`, now deleted; also `EXPO_PUBLIC_AGORA_APP_CERT` in `.env`) | ⚠️ **Rotate the certificate in the Agora console** and update the `generate-agora-token` edge function secret. Every build up to 18 contains the old one and can mint host tokens for any channel. Remove the `EXPO_PUBLIC_AGORA_APP_CERT` line from `.env` too (unused now, but `EXPO_PUBLIC_` means "bundle me"). |

Judgment calls made, not blockers: the login wall stays (the app has
significant account-based features — escrow, wallet, chat — which 5.1.1(v)
allows); live *viewing* stays on iOS (nothing is sold to the viewer);
tiers are KYC-gated, not purchased, so no IAP question arises.

---

## Clean stopping point

Restore the review account (dashboard) → enter its new password in App Store
Connect → device pass, payment flow first → `eas submit`.
