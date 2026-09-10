# Web-side reference for the mobile port

Written 2026-09-10 by the session that did the work on `/home/pc/dev/EgbayWeb`.
Corrected after re-reading this repo at commit `c5cf9f8`.

**This is reference material, not a task list.** Another session is actively
working in this repo. Nothing here is an instruction to change code.

An earlier version of this file claimed the top priority was that declined payments
show "Payment Successful". **That was already fixed in `c5cf9f8`** — `classifyPaymobUrl`
now tests failure first and fails closed. Disregard any memory of that claim.

---

## 1. Same Supabase project — do not port any backend work

Mobile and web both point at `fpqbocohjzwlfcmfropr`. Everything in Postgres or in an
edge function is already live here. **Do not copy migrations or edge functions across.**
Already applied and shared:

- **Every user gets a `user_wallets` row at signup**, plus a backfill of the 17 that had
  none. A seller with no wallet made `process_paymob_order_payment` raise, which rolled
  the whole payment back: buyer charged, order stuck at `pending_payment`. That RPC now
  creates the wallet instead of raising, because by the time it runs the money is already
  taken.
- **`paymob_payment_attempts`** records every declined *and* failed-to-process webhook.
  Previously a processing failure existed only as a `console.error`, so
  `cancel_abandoned_orders` cancelled the order an hour later on age alone and orphaned
  the payment. That cron now never cancels an order Paymob says was paid, and frees stock
  15 minutes after a decline instead of an hour.
- **`paymob-webhook`** edge function is at v5 with that recording. `verify_jwt` is and
  must remain `false`.
- **Reviews backend**: `submit_review`, `edit_review`, `respond_to_review`, the `reviews`
  table, the seller rating aggregate trigger.
- **Notification triggers** on `order_events`, `messages`, `wallet_transactions`, `reviews`.

## 2. Do not change the Paymob dashboard Redirect URL

It is a single static field per integration, shared by web and mobile, and this app's
WebView matches on `/wallet` and `egbay.shop`.

It is also independently dangerous. Editing and saving that integration form on
2026-09-02 took **every** card payment down with `AUTHENTICATION_NOT_SUPPORTED`,
including Paymob's own test card, until the URL was reverted. The form renders only
name / webhook / redirect and appears to drop the 3-D Secure config it does not render.
Web now classifies order-vs-topup in code at `/wallet` specifically so that field never
has to be touched again.

## 3. What `submit_review` enforces server-side

Worth matching in the UI so it never offers an action the server will reject. All of
these are enforced in the RPC and were verified against the live database:

| Guard | Error |
|---|---|
| caller is not the order's buyer | `Only the buyer of this order can review it` |
| order status is not `completed` | `Order must be completed before it can be reviewed` |
| more than 90 days since completion | `The review window for this order has closed` |
| second review on same order | `You have already reviewed this order` |
| rating outside 1-5 | `Rating must be between 1 and 5` |
| comment over 1000 chars | rejected |

`seller_id` and `product_id` are read off the order row, never taken from the client.
Reviewer display names need a **second query to `public_profiles`** — `reviews.reviewer_id`
references `auth.users`, which PostgREST cannot embed.

`reviews.product_id` is populated, so item-level reviews are queryable, not just
per-seller. A listing with `stock > 1` can collect several.

## 4. The webhook races the browser — poll, never assume

Paymob's redirect and its server-to-server webhook fire near-simultaneously and the
client usually wins. Web's `/orders/success` originally read the order once on mount, so
on a genuinely successful payment the buyer saw "Payment Pending..." as the final state
until they thought to refresh.

It now re-reads the real order status every 2s for 40s, flips to confirmed the moment the
row says so, and after 40s stops promising an automatic update and points at a refresh.
It only ever re-reads status — a payment that never completes never flips to confirmed.

## 5. Copy must not outrun the database

Web's order screen said "Total Paid" and "You paid: EGP 188" directly under a banner
saying payment was unconfirmed, and told sellers "Escrow holding" when nothing had
reached escrow. Those now switch on `status === 'pending_payment'`.

It also told buyers to "complete payment to secure your order" with no way to do it —
there is no resume-payment path — so that copy now explains the order cancels itself and
the item returns to stock instead.

## 6. Current live data, for expectation-setting

As of 2026-09-10: **0 reviews exist**, and exactly **1 order has ever reached
`completed`** — its buyer was a throwaway test account, and `mohamed.iibrahimm3@gmail.com`
is the *seller* on it, so that account cannot review it. Review UI will correctly show
empty everywhere until an order owned by a real buyer account is walked through to
`completed`.

`/courier-simulator` on the web app drives an order `out_for_delivery -> delivered ->
completed`.
