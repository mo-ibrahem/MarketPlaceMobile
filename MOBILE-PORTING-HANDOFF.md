# MarketPlaceMobile — porting handoff from EgbayWeb

Written 2026-09-10, after a session of payment/reviews/notification work on the web app.
Repo: `/home/pc/dev/MarketPlaceMobile` (github: `mo-ibrahem/MarketPlaceMobile`, private)

## The single most important fact

**Mobile points at the same Supabase project as web** — `fpqbocohjzwlfcmfropr`
(confirmed in the app's env config). Everything that lives in Postgres or in an
edge function is *already live for mobile*. Nothing to port.

Everything that lives in the Next.js app is *not*, and mobile is a genuinely
different architecture: Expo + expo-router, Paymob rendered in a `react-native-webview`
and detected by URL interception. Do not assume web patterns transfer.

## Already applies to mobile — no work needed

Shipped to the shared database/edge function this session:

- Every user gets a `user_wallets` row at signup, plus a backfill of the 17 that
  had none. A seller without a wallet made `process_paymob_order_payment` raise,
  which rolled back the whole payment — the buyer was charged and the order stayed
  `pending_payment`. (commit `0276284`)
- `process_paymob_order_payment` now creates the seller's wallet rather than
  raising, because by the time it runs the money is already taken.
- `paymob_payment_attempts` records every declined *and* failed-to-process webhook.
  `cancel_abandoned_orders` reads it: it will never cancel an order Paymob says was
  paid, and it frees stock 15 minutes after a decline instead of an hour. (commit `6682556`)
- `paymob-webhook` edge function is at v5 with that recording.
- Reviews backend: `submit_review` / `edit_review` / `respond_to_review`, the
  `reviews` table, and the seller rating aggregate trigger.
- Notification triggers on `order_events`, `messages`, `wallet_transactions`, `reviews`.

## P0 — mobile claims payments succeeded when they did not

All in `app/payment.tsx`. This is the highest-priority item and it is a
truthfulness bug, not a cosmetic one.

### 1. A declined payment shows "Payment Successful"

`handleShouldStartLoadWithRequest` and `handleNavigationStateChange` both test
success *first*:

```ts
if (url.includes('success=true') || url.includes('txn_response_code=approved')
    || url.includes('egbay.shop') || url.includes('egbay.market')
    || url.includes('/wallet') || url.includes('callback/paymob')) {
  handleSuccess();
  return false;
}
if (url.includes('success=false') || url.includes('declined') || ...) { /* unreachable */ }
```

Paymob sends declines to the *same* redirect URL, as
`https://egbay.shop/wallet?success=false&txn_response_code=...`. That matches
`url.includes('egbay.shop')`, so `handleSuccess()` fires and the user sees
**"Payment Successful! 🎉 / Funds secured in Escrow."** The decline branch below
can never run for any egbay.shop URL.

This is not hypothetical: the web app saw a run of real declines on 2026-09-02
(`AUTHENTICATION_NOT_SUPPORTED`, every transaction on integration 5267608).

Fix: check `success=false` / `declined` **before** the success branch, and stop
treating a bare host match as proof of success.

### 2. Success is claimed without confirming the backend did anything

- Top-up polls `/api/wallet/topup/status` five times, `break`s on `paid` — but
  falls through and shows "EGP X Added to Wallet! 💳" even when it never turns paid.
- Orders call `confirmOrderPayment(orderId)` (which only refreshes, correctly
  mutating nothing) and then claim "Funds secured in Escrow" regardless of status.
- The catch comment reads *"Non-fatal: payment succeeded, webhook will handle as
  backup"*. That assumption is exactly what failed on web: the webhook arrived,
  passed HMAC, and the RPC raised `Seller wallet not found`.

Fix: mirror what web's `/orders/success` does now — re-read the real order status
(2s interval, ~40s ceiling), show a truthful pending state while it is still
`pending_payment`, and only claim escrow once the row actually says
`escrow_secured`. Never let the copy outrun the database.

## P0 — do not touch the Paymob dashboard Redirect URL

Mobile's WebView interception matches on `/wallet` and `egbay.shop`. That field is
shared by web and mobile, so changing it breaks both.

It is also independently dangerous: saving that integration form on 2026-09-02
took **all** card payments down with `AUTHENTICATION_NOT_SUPPORTED` until the URL
was reverted. The form renders only name/webhook/redirect and appears to drop the
3-D Secure config it does not render. Web now classifies order-vs-topup in code at
`/wallet` precisely so that field never has to change again.

## P1 — features that do not exist in mobile at all

Greps across `src/`, `app/`, `components/` return zero files for `submit_review`,
`getSellerReviews`, `rating_avg`. Notifications: one incidental match.

- **Reviews.** Backend is live and tested. Mobile needs: a review form on a
  `completed` order (buyer only), the seller's rating on listing cards and the
  seller profile, and item-level reviews on the product screen. Web's `lib/reviews.ts`
  (`getSellerReviews`, `getProductReviews`, shared `hydrateReviews`) is the reference —
  reviewer names come from `public_profiles` in a second query because `reviewer_id`
  references `auth.users`, which PostgREST cannot embed.
- **Notifications.** Table, triggers, and RPCs (`mark_notifications_read`,
  `mark_all_notifications_read`) are live. Mobile needs a bell/list UI. Web's
  `lib/notifications.ts` has the full copy switch including `review_received` and
  `rate_purchase`.

Who may review, enforced server-side in `submit_review` — worth matching in the UI
so it never offers an action that will be rejected: buyer of that order only,
status must be `completed`, one review per order, 90-day window, rating 1–5.

## P2 — UI honesty parity

Web fixed an order screen that said "Total Paid" and "You paid: EGP 188" directly
under a banner saying payment was unconfirmed, and showed sellers "Escrow holding"
when nothing had reached escrow. Check `app/order/[orderId].tsx` for the same.

## Notes

- `confirmOrderPayment` in `src/services/lib/orderService.ts` is safe — it performs
  no client-side mutation, only a refresh fetch. Leave it that way.
- Sibling dir `MarketPlaceMobileV2` is a bare Expo starter with **a live
  `github_pat_` token embedded in its git remote URL**, and its remote points at
  `mo-ibrahem/marketplace`. Rotate that token.
