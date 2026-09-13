# Handoff to the Codex session: what happened to your work

Written 2026-09-13 ~21:45 by the Claude session that shares this repo with
you. You stopped mid-task (usage limit) with ~1,100 lines of SQL, two edge
functions, an app change and a PGlite harness sitting uncommitted in the
working tree of `master`. This file is so you can pick up without
re-deriving anything or undoing what was done in the meantime.

## 1. Where your work is now

**Branch `security/codex-hardening`, commit `72bfc12`, pushed to origin.**
Every file you touched, committed byte-for-byte as you left it. Nothing
was edited, reformatted, or dropped. The commit message attributes the
work to you and explains why it was branched.

**`master` is untouched at `07850ea`.** Your edits were removed from
master's working tree by the branch switch only -- they are tracked on the
branch, not deleted. iOS build 23 (`c5c2af8b`) was built from `07850ea`
and is the App Store submission; it uses the deployed `delete_my_account`
RPC, not your edge function.

**Nothing of yours is deployed.** Verified against the live project after
you stopped: no `private` schema, no `account_deletion_jobs`, no
`guard_new_commerce` triggers, no `active_account_required` policies, none
of the new functions, `public_profiles` unchanged, migration history ends
at `20260912152921 schema_audit_safe_cleanup`. Your MCP was read-only and
that held.

**Your checkpoint was coherent.** At `72bfc12`: `tsc` clean;
`scripts/test-security.cjs` 47/47; `scripts/test-database-security.cjs`
24/24. You were not mid-edit on any file.

## 2. What I concluded about it

The findings are correct and the harness is better than anything I built.
SEC-01 (`delete-product-images` deletes any URL a user JWT sends, no
ownership check) is a real hole I had missed. Your deletion design fixes
two things mine did not: uploaded objects left in storage, and issued
JWTs staying valid for their lifetime after "deletion". I was wrong
earlier to characterise the work as mostly disposable; it is mostly right.

Five things make it undeployable as written. None is a judgment problem;
they are scope and coordination problems.

### 2.1 The commerce kill switch is platform-wide; the platform is not in classifieds mode

`private.launch_settings.payments_enabled` defaults `false`.
`guard_new_commerce` triggers on `orders`, `wallet_topups`,
`live_sessions` fire regardless of role. `require_commerce_enabled()` is
called inside `create_marketplace_order`, `checkout_with_wallet`,
`purchase_boost`, `request_wallet_payout`, `book_live_session`,
`process_paymob_order_payment`, `process_paymob_topup`.

Only the iOS build is in classifieds mode. **egbay.shop is live in
payments mode** and calls every one of those RPCs from
`app/api/orders/route.ts`, `app/api/wallet/action/route.ts`,
`app/api/boost/route.ts`, `app/api/live/book/route.ts`,
`app/api/paymob/session/route.ts` and `supabase/functions/paymob-webhook`.
Applying migration 1 stops web checkout, boosts, top-ups, payouts, live
booking and webhook settlement at once. `PAYMENTS_ENABLED=false` was
always a client build flag for one app; the server was never meant to
enforce it for everyone.

### 2.2 Revokes that break the live web client

Migration 1 lines 122-126:
- `REVOKE INSERT ... ON live_chat_messages FROM authenticated` -- web
  inserts from the browser (`EgbayWeb/lib/liveService.ts:341`).
- `REVOKE UPDATE ... ON live_sessions FROM authenticated` -- web sets
  `status`/`started_at`/`ended_at` from the browser
  (`EgbayWeb/lib/liveService.ts:199-217`). Your SEC-08 intent (stop
  price/channel tampering) is right; the tool is column-level `GRANT
  UPDATE (title, title_ar, description, thumbnail_url, category, status,
  scheduled_at, started_at, ended_at)`, which your earlier draft
  `migrations-proposed/20260913090000_blocking_and_live_permissions.sql`
  already had.
- `REVOKE INSERT ... ON seller_verification_requests FROM authenticated`
  -- web KYC inserts from the browser
  (`EgbayWeb/app/seller-verification/page.tsx:111`). Keep your
  `verification_starts_pending` RESTRICTIVE policy; drop the revoke.
- `REVOKE SELECT ON live_* FROM anon` -- unverified whether web live
  discovery is viewable signed-out; not worth the risk for no gain.

### 2.3 Revoking `delete_my_account()` from `authenticated` breaks every shipped build

Migration 1 redefines `delete_my_account()` to enqueue via
`begin_account_deletion()` and then `REVOKE ALL ... FROM authenticated`.
Builds 17-23 -- including the one under review -- call that RPC. They
would get 42501, fall back to "temporarily unavailable, email us", and
fail App Review 5.1.1(v). Keep the GRANT. The redefined body already does
the right thing (enqueue, deny access, withdraw listings, kill sessions),
so old clients get correct behaviour through the old entry point.

### 2.4 `purge_account_data()` destroys other users' data

Migration 2 lines 830-888. For a deleting user it hard-deletes: every
order where they were buyer **or seller or the product's owner**; every
review on those orders; every `chat_rooms` row they were in, i.e. the
other participant's side of the conversation too; and it debits
counterparties' wallets by reversing `delta_available`/`delta_pending`
(`UPDATE user_wallets ... WHERE w.user_id <> p_user_id`).

All of it gated on `financial_records_are_test_data`, default `true`, with
the comment "The operator confirmed existing financial records are test
data." The operator did not confirm that. Your own SEC-02 says "do not
indiscriminately delete conversations" and SEC-03 says retention must come
from the operator "rather than inventing a legal period". The default
does both.

It also cannot work once payments are real: with the flag `false`, any
account with financial history raises 'Financial retention review
required' and deletion fails -- back to a 5.1.1(v) problem for exactly the
users most likely to have data.

`orders.product_id` and `payments.product_id` are `ON DELETE RESTRICT`
(applied 2026-09-12, `app_review_compliance`), so `DELETE FROM products`
for a seller with orders fails regardless.

### 2.5 The app change only works if three layers ship together

`moderationService.deleteMyAccount()` -> `functions.invoke('delete-account')`
-> `begin_account_deletion` / `claim_account_deletions` /
`account_storage_objects` -> cron -> edge function. Migration, function
deploy, and app rebuild must land in that order. As uncommitted edits on
master it was one `git add -A` from shipping an app whose Delete Account
calls a function that does not exist.

## 3. What I am changing on the branch (next commit)

Working only on `security/codex-hardening`. Master is not touched.

1. Remove the kill switch: `launch_settings` table, `commerce_is_enabled`,
   `require_commerce_enabled`, `guard_new_commerce` + its three triggers,
   `live_read_enabled` / `live_chat_read_enabled` policies, and the seven
   `PERFORM public.require_commerce_enabled();` lines in migrations 2-3.
   Client-side gating stays as it is; the server does not need to know
   which app is in which mode.
2. Replace the live/verification revokes with column-level UPDATE grants
   on `live_sessions`; keep INSERT on `live_chat_messages` and
   `seller_verification_requests`; keep `verification_starts_pending`.
3. Keep `delete_my_account()` granted to `authenticated`.
4. Rewrite `purge_account_data()` to the retention rule the privacy policy
   already states and the earlier migration already implements:
   financial records stay (orders, reviews, wallet_transactions,
   payments, user_wallets); the user's PII goes. Concretely: anonymise
   `user_profiles` instead of deleting it; products with no orders are
   deleted, products with orders are `status='removed'` + images/
   description cleared; the user's own messages get content replaced
   with a deleted marker, rooms and the other side's messages stay;
   wishlists, notifications, payout_methods, blocked_users,
   seller_verification_requests, own live sessions/chat, and storage
   objects go; no counterparty wallet is touched; `content_reports` left
   as moderation evidence. Remove `financial_records_are_test_data` and
   the retention-review exception. The edge function anonymises + bans
   the auth row (the pattern in `app_review_compliance`) instead of
   `auth.admin.deleteUser`, because `orders.buyer_id/seller_id` are
   `ON DELETE RESTRICT` and the delete would fail for any real user.
5. Update the two harness tests that assert the old purge behaviour
   ("Test financial history is cleaned without leaving auth foreign
   keys", "Account cleanup is retryable and permits real auth deletion")
   to assert the new one. Everything else in both harnesses should still
   pass; if it does not, that is a bug in my changes, not yours.
6. Move the four migrations to `supabase/migrations-proposed/` in this
   repo. Migration history is kept in `EgbayWeb/supabase/migrations/`;
   they will be copied there when applied. A `supabase/migrations/`
   directory in the mobile repo invites an accidental `db push`.

Not changing: the audit document, the PGlite harness and fixtures, the
`delete-product-images` rewrite (except that its `product_image_cleanup_paths`
dependency moves with the migrations), `generate-agora-token`,
`paymob-webhook`, `config.toml`, the pglite dependency.

## 4. Decisions that are the operator's, not ours

- **Rollout timing.** None of this is required for App Review; build 23
  passes 5.1.1(v) and 1.2 as-is. Recommended: submit 23, then ship this
  as v1.1.1 after review, in the order migrations -> edge functions ->
  app rebuild, verified with your harness at each step.
- **Purge policy.** Section 3.4 is my reading of the privacy policy and
  the earlier migration. If the operator wants hard deletion of financial
  records for accounts that predate real payments, that is a separate,
  explicit data-cleanup script run once, not a default inside the
  deletion path.
- **Agora certificate rotation** (your SEC-06) remains the operator's
  final step; the removal from `.env` is not rotation.

## 5. Working alongside each other

- Do not edit `master`'s working tree. Master is the build source; every
  change to it should be a commit with a build behind it.
- Work on `security/codex-hardening`. `git log` on that branch is the
  record of who changed what; commit messages say which session wrote it.
- Before editing a file, `git status` -- if the tree is dirty with
  changes you did not make, the other session is mid-edit. Wait.
- Run both harnesses before every commit on this branch:
  `node scripts/test-security.cjs && node scripts/test-database-security.cjs`.
- Never `supabase db push` from this repo. Applying to production goes
  through the operator with a named migration, recorded in EgbayWeb.
