# Egbay classifieds launch: security implementation handoff

Date: 2026-09-13. Source commit: `07850eac212b2fd8cc053a47dff74e7b9fd346aa`.
Supabase project: `fpqbocohjzwlfcmfropr`.

## Scope and evidence

Launch scope is listings, search, favourites, profiles and buyer–seller messaging. Production `eas.json` sets `EXPO_PUBLIC_PAYMENTS_ENABLED=false`; payments-preview sets it to true. Preserve this scope. Do not simulate payment success or enable payments for launch.

This handoff combines the production read-only inspection earlier in this session with the current source review. Production findings below describe that inspection, not a fresh deployment certification. Re-read deployed functions, policies, grants and migration history before implementation: another developer may have changed them. No backend fixes were deployed by this audit. Supabase MCP access was read-only.

Current source passes TypeScript and 47 security regression checks. The checks use mocked services and do not prove production authorization, complete classifieds route coverage or real-device behavior. The older `SECURITY-RELEASE-REVIEW.md` is a historical checkpoint: its MCP-unavailable and local unsigned-webhook statements have been superseded. This document is the implementation handoff.

Priority: P1 = fix before public classifieds launch; P2 = hardening or a required gate before the affected disabled feature is restored. No claim of active exploitation is made.

Audit self-review: 2026-09-13. Local replacements and the proposed migration were reread; production was not re-queried during this document review. Historical observations must be reconfirmed before marking current production vulnerable or fixed. Conditional deferral requires evidence that the operation is denied on the server, including direct database/API access; hiding a route is insufficient.

## SEC-01 — P1: Unauthorized product-image deletion

**Observed:** Deployed `delete-product-images` version 7 accepted image URLs in a caller-supplied record and used administrator storage access to remove objects without checking seller ownership. Gateway JWT verification is not an ownership check.

**Impact:** A caller reaching the function can target another seller's product images.

**Fix:** Deploy the reviewed local replacement in `supabase/functions/delete-product-images/index.ts` after validating it against the current webhook. Require a dedicated server-only `PRODUCT_IMAGES_WEBHOOK_SECRET`; accept the intended `DELETE` event for `public.products` using `old_record`; restrict URLs to this project's product-images bucket; verify actual storage ownership before deletion. Configure the webhook header and function secret together. The local implementation depends on service-only RPC `product_image_cleanup_paths` in the proposed security migration. Check how historical uploads populate storage ownership; missing ownership must fail closed, not permit arbitrary deletion.

**Acceptance:** Anonymous requests, ordinary user JWT requests without the webhook secret, forged events, foreign URLs, and another seller's objects cannot delete anything. A valid product-deletion webhook deletes only that seller's intended objects. Missing configuration fails closed. Verify the deployed version and run tests with disposable images belonging to two accounts.

## SEC-02 — P1: Blocking is bypassable through direct API calls

**Observed:** The client filters blocked conversations, while deployed room/message policies enforce membership but do not enforce the block relationship. The blocking RPC records the relationship only.

**Impact:** A blocked user can bypass the interface and create/send communications through the API.

**Fix:** Enforce bidirectional blocking on the server for new direct-message rooms and message INSERTs. Require exactly two distinct participants for direct rooms, including the caller, and active accounts. Cover existing rooms and all alternate send/create endpoints. Inspect Realtime and notification delivery so blocked messages cannot leak through another channel. Define which historical content remains readable for abuse evidence; do not indiscriminately delete conversations. The proposed migration contains a starting implementation of `can_interact_with` and restrictive policies, not a tested production fix.

**Acceptance:** With separate accounts A and B, A blocking B prevents both directions of new contact through the UI and direct authenticated API calls, including an existing room. Account C remains unaffected. Third parties cannot access either room. Unblocking restores only intended behavior. Check notifications and Realtime using separate sessions.

**Implementation caution:** Inspect UPDATE privileges on room participants and message ownership/content as well as INSERT. A user must not be able to change room membership to gain access or evade blocking. The proposed INSERT policies alone do not establish this. Decide explicitly how self-messaging and any legacy rooms are handled before enforcing a two-person invariant.

## SEC-03 — P1: Incomplete account deletion and inaccurate privacy promises

**Observed:** Deployed `delete_my_account()` anonymizes/bans the auth row and removes selected profile data. It does not demonstrate cleanup of uploaded objects, messages, reviews and shipping personal data. Previously issued access tokens may outlive session revocation. `app/privacy.tsx` promises immediate removal and permanent unlinking beyond what the implementation establishes; classifieds mode reuses those claims.

**Fix:** Inventory all personal-data locations, including storage, message attachments, backend records and external processors where applicable. Implement authenticated server-side deletion with retryable cleanup and actual auth-account deletion using the supported admin mechanism. Define justified retention separately from data that must be removed/anonymized; obtain the operator's retention requirements rather than inventing a legal period. Block further access immediately while cleanup runs, including already-issued JWTs. Ensure retained messages/transaction records do not retain unintended identifiers. Update Arabic and English app/privacy.tsx, PRIVACY.md and the published policy to describe actual behavior and timing. Remove absolute security guarantees and obsolete order wording from the classifieds policy.

**Acceptance:** A disposable account with listings, images, avatar, chats and relevant historical records can delete itself in-app. Its old token cannot read protected data or create new content. Uploaded personal objects are removed as intended. Search/public profiles no longer expose its identity. Retained records follow the documented retention design. Cleanup is safe to retry after a simulated partial failure. Another user's account cannot be deleted by changing a request ID.

**Implementation caution:** Do not delete the auth row first without checking foreign-key cascades, storage ownership and cleanup dependencies. Keep a durable, access-restricted cleanup job so partial failures can be retried. Immediate backend access denial is a security acceptance criterion; Apple permits deletion to take time when timing and completion are communicated. Mere anonymization of shared user content is not automatically sufficient: delete associated user-generated content unless a documented applicable retention requirement justifies keeping it. Check Sign in with Apple token revocation if that login method is offered. See the Apple deletion reference below.

## SEC-04 — P1: Email addresses exposed as public display names

**Observed:** Production aggregate inspection found 12 profiles whose full_name equals email. `public_profiles` exposes full_name; stripping email-looking names only in the app does not protect the API response.

**Fix:** Stop defaulting names to email during signup and profile creation. Make the public projection return a safe fallback for legacy email-valued names. Review all public profile/listing/seller projections for the same leak without exposing private profile fields. Preserve intended public access instead of blindly removing a SECURITY DEFINER view. A draft replacement view exists in the proposed security migration.

**Acceptance:** Anonymous and unrelated authenticated callers cannot obtain a private email through display-name fallback or other public projections. Legacy profiles show a neutral name. New signups with no chosen display name do not publish an email. Legitimate names and seller listings still render.

## SEC-05 — P1: Client payment flag does not disable backend financial endpoints

**Observed:** PAYMENTS_ENABLED is a client build-time flag. The deployed legacy `create-payment-key` version 9 still accepted client product price/profile input. The deployed webhook also differed from the hardened local replacement. Hiding screens does not prevent direct calls.

**Fix for classifieds launch:** Inventory payment/order creation, wallet top-up, payout, boosts and live-booking endpoints, including the sibling EgbayWeb API. Disable new unsupported financial operations on the server, or apply and verify their security fixes if another active client requires them. Retire the obsolete client-priced endpoint with the local HTTP 410 replacement after checking consumers. Preserve safe processing of legitimate historical callbacks, balances, disputes and withdrawals where they exist; do not indiscriminately turn off settlement or erase records. Add server-side configuration and explicit unavailable responses for disabled new operations.

**Acceptance:** A user calling the API directly cannot initiate a disabled purchase/top-up/booking. Manipulated prices cannot create valid payments. Existing financial obligations have a documented operational path. No unpaid order is marked paid. No ordinary launch screen or deep link enables financial actions.

## SEC-06 — P1: Potential private-credential exposure; rotation unverified

**Observed:** Agora App Certificate and Paymob API key had been stored under EXPO_PUBLIC_ names and were identified as exposed in the earlier handoff. They were removed locally. An EXPO_PUBLIC_ name alone does not prove inclusion in a shipped bundle; this audit has not demonstrated artifact inclusion or independently verified current credential validity. Treat the reported exposure as requiring rotation unless its scope is conclusively resolved. Local removal does not revoke credentials.

**Fix:** Inventory affected provider keys and where they are used without printing secret values. Rotate/revoke exposed credentials, update server-only secret stores and verify old credentials no longer work. Scan tracked history, build artifacts and public environment configuration for private credentials. Do not put secrets in EXPO_PUBLIC_ variables or source control. Public Supabase publishable/anon keys are not equivalent to service-role secrets.

**Acceptance:** Old private credentials are rejected; required server operations use replacement credentials; production app artifacts contain no private keys. Check any previously shared reviewer credentials separately.

**User constraint:** Agora certificate rotation is the final security implementation step before release. Keep it last, but do not treat removal from .env as completed rotation. No purchases, credit consumption, paid project creation or card charges are authorized by this audit.

## SEC-07 — P1 while financial mutation remains reachable: Webhook fulfillment binding

**Observed:** Deployed webhook version 5 used unsigned `order.merchant_order_id` for routing, included an extra HMAC field and acknowledged persistence errors with HTTP 200. The marketplace payment RPC accepted a currency parameter without validating it. Existing locking/idempotency protections are useful but do not replace correct binding.

**Fix:** Review the current local webhook, which verifies the signed transaction through Paymob's server API and compares transaction/order/amount/currency/integration before selecting the canonical merchant reference. Alternatively bind signed provider order IDs to server-created payment records. Enforce currency, amount, transaction uniqueness and allowed state transitions inside the transactional database operation. Preserve failed-attempt recording needed by cancellation handling and safe retry behavior. Audit authoritative EgbayWeb payment creation as well.

**Acceptance:** Forged merchant references, wrong amount/currency/integration, pending/refunded/void transactions and cross-order replays cannot fulfill. Concurrent callbacks credit once. Provider/database outages remain retryable. Legitimate retries succeed without double credit or lost settlement. Current mocked tests are a starting point, not provider integration evidence.

**Deferral rule:** This is P2 only after proving that the affected fulfillment path cannot mutate financial state and that disabling it does not strand legitimate settlements. Stopping new payment creation alone is insufficient: callbacks for existing transactions may still reach the webhook. If settlement remains enabled, fix and validate this before launch.

## SEC-08 — P2 if inaccessible / otherwise P1: Excessive live and verification privileges

**Observed:** Authenticated users had table-wide UPDATE privileges on live_sessions, subject to row policies. Verification request INSERTs could supply status/reviewer fields. Live-chat INSERT policies did not adequately constrain host/system metadata. Deployed Agora token generation did not verify that a requested host owned the session.

**Fix:** Revoke broad column privileges and grant only intended user-editable columns; make verification submissions pending with reviewer fields unset. Restrict live chat types, lengths and host identity. Deploy/review the local Agora function requiring authenticated ownership, valid active session, permitted role and blocking checks. Its audience protection requires actual provider co-host authentication configuration as well as the server acknowledgment flag. If live is disabled, enforce that on the server and defer enabling it until these checks pass.

**Acceptance:** A user cannot alter billing/channel/privileged session fields, forge a reviewed verification request or system/host chat message, or mint a host token for another seller. Disabled live endpoints reject callers. When later enabled, legitimate host/audience permissions work and audience cannot publish.

## SEC-09 — Launch verification gate: Moderation and operational abuse handling

Report/block buttons alone do not establish a complete moderation system. Verify a functioning report intake, restricted moderator access, timely handling process, objectionable-content filtering, prohibited-listing enforcement and visible support contact. This audit has not proven that operational coverage. Inspect authorization on moderator endpoints as well as UI visibility.

**Acceptance:** Report a disposable listing/user/message, verify it reaches the authorized moderation queue, and verify a moderator can take the intended action. Ordinary users cannot access reports or moderator actions. Test the chosen filtering controls and support path. Do not claim these tests already passed.

## SEC-10 — P2: Platform and dependency hardening

Earlier production advisors identified an older PostgreSQL patch level, disabled leaked-password protection and functions lacking a fixed search_path. Confirm current state, fix SECURITY DEFINER/search_path risks, and schedule supported database patching. Enable available password protections where supported by the current plan; request operator input before any paid upgrade. Re-run dependency audit and assess reachable advisories without forced incompatible upgrades. The previous dependency check had zero high/critical production findings and 18 moderate findings; this is not a current vulnerability guarantee.

## Implementation and release evidence

1. Snapshot current function versions, schema, policies, grants and migrations; inspect active consumers. Do not expose real user records or secrets in reports.
2. Review `supabase/migrations-proposed/20260913090000_blocking_and_live_permissions.sql` as a draft. Do not apply the whole migrations-proposed directory or old destructive cleanup scripts. Validate dependencies, grants and policy composition against the actual schema.
3. Test on a local database or an existing approved staging project with disposable users. Do not create a paid project. Provide scoped migrations, deployment/configuration instructions and rollback notes.
4. Apply/verify production changes through an authorized write-capable connection. A local file edit is not deployment. Record deployed versions and executed migration identifiers.
5. Run the adversarial checks above, TypeScript, security tests and relevant lint/build checks. Previously lint still had errors; inspect current state. Report failures explicitly.
6. Verify the production iOS artifact uses payments=false, including checkout/wallet/order/live deep links and notification routes. Test signup/login, listing upload, contact seller, report/block and deletion on an iPhone/TestFlight build.
7. Complete the final credential rotation, validate replacements and inspect final artifacts for secrets. Confirm the exact EAS build contains the reviewed changes; build ID `c5c2af8b-f844-4837-a647-880bf634025c` has not been matched to this commit by this audit.
8. Align App Store screenshots, description, privacy disclosures and reviewer notes with classifieds behavior. Restore financial features only in an appropriately reviewed release. Do not submit a build merely because unit tests pass.

Deliver a closure table for SEC-01 through SEC-10 showing: code change, migration/function deployment, verification evidence, and remaining limitations. Do not label a finding resolved solely because a draft exists.

### Specific gaps to address before using the local drafts

- Image cleanup currently returns HTTP 400 for caught database/storage failures and may acknowledge skipped unowned paths. Distinguish malformed requests from transient failures and make retry/reconciliation explicit. A successful webhook response does not prove all expected cleanup occurred. Validate gateway authentication alongside the dedicated webhook secret, and test the real DELETE payload.
- The live-session draft still grants client UPDATE of status and timestamps. Check whether those fields confer access or bypass scheduling/payment rules; restrict transitions server-side where necessary. Removing price-column privileges alone does not establish a safe state machine.
- Restrictive policies must be checked with all existing permissive policies, effective grants (including inherited/PUBLIC grants), triggers, SECURITY DEFINER functions and service-role API paths. Test through actual non-admin identities; service-role tests bypass RLS and cannot prove it works.
- Current CREATE POLICY statements are not rerunnable as-is. Reconcile existing policy names/migration history before applying, preserve public-view grants deliberately, and verify failed transactions leave no partial deployment. Do not enable live merely to test its replacement for a classifieds release.
- The public-name draft masks any name containing '@'. Verify that this is an acceptable display fallback and does not mutate a user's chosen name. Avoid publishing account emails through any alternate projection.

## Apple references

- [App Review Guidelines: user-generated content, accurate metadata and review access](https://developer.apple.com/app-store/review/guidelines/)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
> Current status (2026-09-14): see [SECURITY-IMPLEMENTATION-STATUS.md](SECURITY-IMPLEMENTATION-STATUS.md). This file contains historical findings and release instructions that may be superseded.
