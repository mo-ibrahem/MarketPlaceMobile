# Plan: launch Egbay without payments ("classifieds mode"), reversible with one flag

**Goal.** Ship to the App Store today with the money layer switched off. Buyers
find listings and message sellers; payment and handover happen between them,
off-platform. When Paymob approves the merchant account, flipping one constant
brings escrow, wallet, orders, boosts and live selling back exactly as they are.

**Non-goals.** Do not delete any screen, service, migration or table. Do not
touch the database, edge functions, `app.json`, `eas.json`, `.env`, or the
Paymob dashboard. Do not "clean up" money code — it is coming back.

**Rules that apply to every step** (standing project rules, not suggestions):
- Never show UI claiming a payment, refund, delivery, escrow hold, or transaction
  happened or is available when it is not. In classifieds mode that means the
  words *escrow*, *secure payment*, *wallet*, *Paymob*, *256-bit*, *held until
  you inspect* must not appear anywhere a user can see.
- Only Supabase project `fpqbocohjzwlfcmfropr`. Never print secrets.
- After each phase run `npx tsc --noEmit -p .` and `npx expo export --platform web`;
  both must exit 0. Then render the touched screens (see §9) — do not claim a
  screen works that you did not look at.
- Commit per phase on branch `chore/expo-sdk-57`, message explains *why*. Do not
  push to master; the human fast-forwards master and builds.

---

## 1. The switch

`src/services/lib/platformCommerce.ts` — add, keeping the existing two exports
untouched:

```ts
/**
 * Master switch for the money layer. false = classifieds mode: listings, chat,
 * profiles, wishlist, report/block, account deletion. No checkout, orders,
 * escrow, wallet, payouts, boosts, live booking, seller tiers, or reviews
 * (reviews require a completed order, so none can exist).
 *
 * Set to true when the Paymob merchant account is approved. Everything gated
 * on this constant is intact and was working on 2026-09-13 (build 21).
 */
export const PAYMENTS_ENABLED = false;
```

Every change below is `if (PAYMENTS_ENABLED) … else …` or a component prop
derived from it. **No file gets code deleted**; gated code stays in place. When
in doubt, gate more rather than delete.

Add one shared guard component, `src/components/NotAvailableYet.tsx`:
a full-screen SafeAreaView with the same look as the iOS guard already in
`app/boost/[productId].tsx` (title "Not available yet" / "غير متاح حالياً",
body "Payments inside Egbay are coming soon. For now, agree on price and
handover with the other person in chat.", a black "Go back" button that calls
`router.back()`, falling back to `router.replace('/(tabs)')` if there is
nothing to go back to). Bilingual via `useLanguage().isRTL`.

## 2. Navigation — `app/(tabs)/_layout.tsx`

Tab bar in classifieds mode: **Home · Sell · Chats · Profile** (4 tabs).

- `orders` and `live` tab screens: keep the `<Tabs.Screen>` entries but set
  `options={{ href: null }}` when `!PAYMENTS_ENABLED` (expo-router hides them
  from the bar while the route still resolves).
- Add a **Chats** tab. Create `app/(tabs)/chats.tsx` that renders the existing
  chat list. The list currently lives inside `app/(tabs)/explore.tsx` as
  `renderChatList()` (line ~388) using `getChatRooms()` from
  `src/services/lib/chatService.ts`. Extract that render function and its
  state/effects into a component `src/components/ChatList.tsx` used by both
  the new tab and Profile (Profile keeps its Chats sub-tab so nothing breaks
  when the flag flips back). Icon: `MessageCircle` from lucide. Labels:
  `Chats` / `الدردشات`. Position: between Sell and Profile.
- Tab labels object `L` gains `chats`. Keep the existing 50 + inset height
  and styles.
- In `app/_layout.tsx` nothing changes (Stack screens for wallet/order stay
  registered; they render the guard, see §5).

## 3. Product page — `app/products/[id].tsx`

- Sticky bottom bar (around line 640–660): when `!PAYMENTS_ENABLED` replace the
  price + black **Buy now** with price + black **Message seller** (`MessageCircle`
  icon), using the existing `handleMessageSeller` logic (opens the product-scoped
  room via `getOrCreateChatRoom(seller_id, product.id)`). For the owner's own
  listing the bar shows **Edit listing** (route `/products/edit/[id]`) instead.
- The two ghost buttons beside the seller (line ~440–450): keep **Make an offer**
  (it already sends a prefilled offer message into chat) and change the first
  one from "Message seller" to **Share** (uses the existing share handler in the
  header). Do not show two identical CTAs.
- Remove from view when `!PAYMENTS_ENABLED`: `EscrowTrustModal` trigger and any
  "escrow"/"buyer protection" row; `showEscrow` on similar-item cards; the
  boost CTA (already gated on `DIGITAL_PURCHASES_ENABLED` — additionally gate on
  `PAYMENTS_ENABLED`); the reviews section (`ReviewList`, line ~524) and the
  `StarRating` in the seller card (line ~417). In their place the seller card
  shows: display name, `is_verified_seller` badge if true, "N listings" (count
  from `productService.getProductsBySeller`), "Member since {month year}" from
  `public_profiles`… (`created_at` is not on the view — use `user_profiles`
  only if the row is the viewer's own; otherwise omit member-since. Do not add
  a column.)
- Add a small **Safety tips** link under the seller card that opens
  `app/safety.tsx` (§7).

## 4. Home — `app/(tabs)/index.tsx`

- Hero priority currently: live → buyer order shipped → seller escrow_secured →
  listing carousel. When `!PAYMENTS_ENABLED`, skip the three order/live states
  and always show the listing carousel. Do not call `getUserOrders` or
  `getActiveLiveSessions` in that mode (avoids two network calls and the 400
  risk).
- Search modal strip (line ~429, "Every purchase is held in escrow…"): replace
  with "Chat with the seller, agree on a price, meet safely." / Arabic
  equivalent, only when `!PAYMENTS_ENABLED`.
- `ProductCard` usages: pass `showEscrow={PAYMENTS_ENABLED}`; the component's
  default is already `false`.
- The in-lane black "Sell something today" card stays.

## 5. Money screens get the guard

At the top of each screen's component, before any data loading effect fires
(pattern: early `return <NotAvailableYet />` **before** `if (loading)`), gate on
`!PAYMENTS_ENABLED`:

`app/checkout.tsx`, `app/payment.tsx`, `app/wallet.tsx`, `app/payout-settings.tsx`,
`app/seller-verification.tsx`, `app/boost/[productId].tsx`, `app/live/book.tsx`,
`app/live/studio.tsx`, `app/live/index.tsx`, `app/live/[channelId].tsx`,
`app/orders.tsx`, `app/(tabs)/orders.tsx`, `app/(tabs)/live.tsx`,
`app/order/[orderId].tsx`.

Effects that fetch on mount must be inside the gated branch or check the flag,
so a guarded screen makes zero requests.

## 6. Profile — `app/(tabs)/explore.tsx`

When `!PAYMENTS_ENABLED`:
- Remove the "EgyBay Wallet & Escrow" widget (line ~657–690) and the
  seller-verification/tier CTA (line ~694). Do not call `getUserWallet` or
  `getSellerTier` in `loadUserData` in this mode (leave the calls in the
  `PAYMENTS_ENABLED` branch).
- Stats row: replace "Sold" count with "Listings" count.
- Settings sub-tab: keep Edit profile, Change password, Language, Privacy,
  Terms, Sign out, **Delete Account** (unchanged — App Review 5.1.1(v)).
  Add a row **Safety tips** → `/safety`.
- Sub-tabs stay `Listings · Saved · Chats · Settings`.

## 7. Copy and legal

- New `app/safety.tsx` (register in `app/_layout.tsx` Stack): bilingual
  "Buying and selling safely on Egbay" — meet in a public place, inspect the
  item before paying, never send money in advance, keep the conversation in
  Egbay chat, report suspicious listings (link to the report action wording).
  Plain, short, no legal tone. Reachable from product page and Settings.
- `app/terms.tsx` and `app/privacy.tsx`: when `!PAYMENTS_ENABLED`, the sections
  about escrow, Paymob, wallets, payouts, Bosta shipping and dispute resolution
  are **not rendered**; a replacement section says: "Egbay does not process
  payments. Buyers and sellers agree on price, payment and handover directly.
  Egbay is not a party to that transaction." Privacy: remove "payment data"
  from the data-collected list in this mode. Keep the sections in the file
  inside the gated branch. Both languages.
- `app/(tabs)/sell.tsx`: the tier ribbon (line ~314–322: "{tier}: N listings ·
  x% fee · Payout setup →") is hidden when `!PAYMENTS_ENABLED`; do not call
  `getSellerTier`. The pricing step keeps its price input; any copy about fees,
  escrow or "get paid" is gated out. Listing creation itself is unchanged.
- `app/chat/[roomId].tsx`: product bar and offer quick-replies stay (they are
  the core flow now). Change the accept template text from "Let's arrange
  delivery or meetup" to "Let's agree where to meet and how you'll pay" (both
  languages). Any escrow mention in the header/verified badge tooltip is gated.
- `src/services/lib/notificationService.ts` — `getNotificationCopy`: no change
  needed (order/wallet types cannot fire without orders). `notificationRoute`
  for order/wallet links: return `/(tabs)` when `!PAYMENTS_ENABLED` so an old
  notification cannot open a guarded screen.
- `src/components/EscrowTrustModal.tsx`: untouched; simply never opened.
- `app/live/index.tsx` header "with full escrow protection": screen is guarded
  anyway (§5); no edit needed.
- Grep gate: after the copy pass, `grep -rniE "escrow|paymob|256-bit|secure
  payment|wallet" app src/components` must return hits **only inside
  `PAYMENTS_ENABLED` branches, guarded screens, comments, or
  `src/services/lib`**. List the remaining hits in the commit message.

## 8. Things that must keep working unchanged

Sign up / login / forgot password · listing create / edit / delete-or-withdraw ·
home feed, search, categories, masonry · wishlist · product-scoped chat with
image bar, offer quick-replies, report user, block user (chat header) ·
report listing (product page) · notifications for messages · profile edit
(`update_my_profile`) · change password · language switch · Privacy / Terms
pages · **Delete Account** (`delete_my_account`) · blocked users hidden from
feed and inbox.

## 9. Verification (do all of it; report what you saw)

1. `npx tsc --noEmit -p .` → 0. `npx expo export --platform web` → 0.
2. Sign in as the reviewer account (credentials from the human; never paste
   them into a file that is committed) and render at 390 px: Home, Sell step 1,
   Chats, Profile (all four sub-tabs), a product page (someone else's listing),
   a product page (own listing), a chat room, Safety, Terms, Privacy, and every
   guarded route from §5 by direct URL. Attach screenshots.
3. Confirm by grep that no visible string contains the banned words (§7).
4. Confirm a deep link to `/wallet`, `/checkout`, `/orders`, `/order/abc`,
   `/live`, `/boost/abc` shows the guard and makes no network request
   (watch the console for Supabase calls).
5. **Flip test:** set `PAYMENTS_ENABLED = true`, run `tsc` + export, render
   Home / product page / Profile / Orders / Wallet once to prove the money UI
   comes back intact, then set it back to `false` before committing. The plan
   is only done if this passes.

## 10. Hand-off to the human

- Commits on `chore/expo-sdk-57`; final commit subject
  `launch: classifieds mode behind PAYMENTS_ENABLED (off)`.
- Then the human: fast-forward master → `eas build -p ios --profile production`
  → `eas submit`.
- App Store Connect (human): description/subtitle must not mention escrow or
  secure payments; "In-App Purchases: none"; reviewer notes: *"Egbay is a
  marketplace for listing items and messaging sellers. Payments and handover
  are arranged between users outside the app. Test account: apple.review@…"*

## What is deliberately not in this plan

- Turning the flag into a remote config. A constant is enough today; a remote
  flag can be added when Paymob answers, without touching any of the gates.
- Deleting reviews, orders, wallet code or tables. They come back with the flag.
- Applying `supabase/migrations-proposed/20260912130000_schema_audit_drop_legacy.sql`
  or `20260913090000_blocking_and_live_permissions.sql`. Separate decisions.
