# Security implementation status — 2026-09-14

This is the current status. SECURITY-AUDIT-CLASSIFIEDS-LAUNCH.md, HANDOFF-TO-CODEX.md,
and older sections of MOBILE-VERIFICATION-STATUS.md are historical evidence.
They are not current deployment instructions or Apple approval guarantees.

## Scope and branch reconciliation

Mobile remains classifieds plus free live. Web payments remain enabled.
No global commerce kill switch is present. No card charge, purchase, paid project,
EAS build, App Store submission, or credential rotation was performed by this implementation.

Work was isolated in security/codex-hardening worktrees. Claude's mobile master
commit 0760ad9 and web main commit ff85e3c were reconciled into those worktrees
before the final main-branch consolidation. Preserve the canonical
https://www.egbay.shop API base: the apex redirects and can strip Authorization.

The receipt-based account deletion flow is retained. Do not replace it with a
success toast that promises deletion within a fixed number of minutes.
The worker retries each minute; completion time depends on service availability.

## Closure table

| Finding | Implemented / deployed | Verification and limits |
|---|---|---|
| SEC-01 image deletion | delete-product-images v8; private worker authentication, ownership checks, durable queue | Actual user JWT attack rejected. Actual worker removed an owned unused upload and preserved an image reused by another listing. |
| SEC-02 blocking | Restrictive direct-room/message policies; member/ownership updates revoked | Real distinct users tested in both directions, including an existing room; unrelated reads and sender forgery denied. Dedicated realtime-client delivery test remains part of the device pass. |
| SEC-03 account deletion | delete-account v1, old delete_my_account RPC supported, storage purge, access denial, nullable financial identity FKs | Real auth deletion, old-token denial, upload removal, receipt and legacy cron path passed. Counterparty messages/balance and transaction rows preserved. Mobile and web privacy source updated; updated web policy still needs publishing. |
| SEC-04 email display leak | Signup fallback fixed and public_profiles masks email-valued names | Database harness verifies anonymous projection and new signup. The public view deliberately exposes only approved profile fields, not auth columns. |
| SEC-05 unsupported financial endpoint | create-payment-key v10 returns 410; mobile financial flag stays false; web payments preserved | Local retirement test and deployed version checked. No real provider purchase was attempted. |
| SEC-06 exposed credentials | Client secret references removed; public-name build guards; local web env uses server-only names | 99 built files scanned for five configured private credential literal values: none found. Historical artifact exposure is not disproved. Paymob API key and Agora certificate rotation are STILL REQUIRED. Agora is last. |
| SEC-07 webhook binding | paymob-webhook v6 verifies signed transaction against provider; amount/currency/idempotency checks in SQL | Mocked signature/provider/outage/replay tests and transactional database tests passed. No Paymob sandbox or real-card end-to-end transaction was run. |
| SEC-08 live/KYC privileges | Server live transition, safe columns, host-message/pin ownership, pending-only verification policies | Real free booking, audience chat, host forgery and reopen denial passed. Claude deployed Agora v3 with owner checks but a warning-only co-host flag. Audience publish prevention remains UNVERIFIED. |
| SEC-09 moderation | Deployed report action RPC, removal policies and baseline text filter; web /admin/reports queue built | Five HTTP checks against the local production web build + deployed Supabase passed, including admin-only access and no seller republish. Queue UI still needs web deployment. Owners must staff report review, image/live review and support; a phrase filter is not comprehensive media moderation. |
| SEC-10 hardening | Fixed search paths; web Next 15.5.24 / React 19.3.0 and PostCSS 8.5.28; dependency audit clean on web | Web audit: 0 findings. Mobile production audit earlier in this implementation: 18 moderate, 0 high/critical. Supabase Postgres patch upgrade and available leaked-password protection remain operator tasks; no paid upgrade authorized. |

## Deployed Supabase history

Project: fpqbocohjzwlfcmfropr. Exact history is recorded in EgbayWeb/supabase/migrations.

- 20260913200608 classifieds_security
- 20260913200614 guard_rpcs_and_delete_data
- 20260913200615 cleanup_queue
- 20260913200634 live_security
- 20260913200635 account_erasure
- 20260913200644 cleanup_scheduler
- 20260913200747 auth_compatible_deletion_ban
- 20260914052523 moderation_controls

The initial public-view replacement rolled back because it omitted the existing
varchar(255) typmod; the fixture now preserves it. A same-second MCP migration
history collision committed live_security before its history insert failed;
the migration was then reapplied idempotently and recorded at 20260913200634.
No migration should be blindly rerun or sent through mobile supabase db push.

Production Auth cannot scan PostgreSQL infinity into banned_until. The finite
100-year ban migration fixes that while the deletion job independently denies
access. The live smoke test, not the local database harness, caught this issue.

Current deployed functions: delete-account v1, delete-product-images v8,
create-payment-key v10, paymob-webhook v6, generate-agora-token v3.

## IMPORTANT: Agora source and deployment differ deliberately

The release source in both repositories refuses tokens unless
AGORA_CO_HOST_AUTH_ENABLED=true. It supports zero-price passes without a wallet
charge. The currently deployed v3 function warns instead of enforcing that flag,
as deployed by Claude while live was restored.

**Do not redeploy generate-agora-token or all functions until the actual Agora
co-host authentication setting is enabled and verified.** Merely setting the
environment flag does not enable the provider control. Leaving it unset in the
strict release source returns 503 and would stop live joins.

The Agora console was opened in Codex's browser, but is signed out. The owner
must sign in so the project setting can be checked. No password or certificate
should be pasted into chat. Rotate the exposed Agora certificate only at the
final provider step, update the server secret, and verify the old certificate
can no longer mint accepted tokens and an audience token cannot publish.

## Verification evidence

- 56 security harness checks.
- 29 PGlite database checks against schema/grants fixtures.
- 15 actual Supabase smoke checks with disposable accounts and uploads.
- 5 moderation HTTP checks against the local production web build and Supabase.
- Mobile TypeScript passes; lint has 0 errors and 121 warnings. Narrow lint
  exceptions document event-only randomness and request loading-state updates.
- Web TypeScript and production build pass after the supported framework upgrade.
- Local iOS export passes, producing a Hermes bundle. This is not an IPA,
  provisioning/signing check, or iPhone camera/microphone test.
- Test auth accounts, unfinished deletion jobs and image jobs: all zero after cleanup.
- No API keys, passwords or certificates are printed in test output.

Scripts in the mobile repository: test-security.cjs, test-database-security.cjs,
verify-live-security.cjs --run, verify-moderation-security.cjs --run.
The latter two create explicitly marked disposable users in the named Supabase
project. The moderation test expects the web production server at localhost:3200.
Use the local secret stores; never put service credentials in client bundles.

## Release and operating steps still required

1. Publish the web branch only after verifying hosted PAYMOB_API_KEY exists as a
   server-only variable. Remove hosted NEXT_PUBLIC_PAYMOB_API_KEY and
   NEXT_PUBLIC_AGORA_APP_CERT; the prebuild guard rejects private public names.
   Only local .env.local names were migrated here; hosted settings were not changed.
2. Assign an existing authorized moderator and test /admin/reports on the hosted
   deployment. Triage reports promptly, including image/live content. Removal and
   suspension actions are recorded. Restoring content/suspensions requires a
   reviewed service-role operation; do not grant private-table access to clients.
3. Rotate the reported exposed Paymob API key and validate provider verification
   using the replacement. Do not initiate card charges without explicit approval.
4. Complete the Agora provider setting and final certificate rotation described above.
5. Build a new iOS artifact from the reconciled source. Test login, listing upload,
   messaging/block/report, deletion/receipt, free live host + audience, camera/mic,
   and financial deep-link gates on an iPhone. Older EAS builds do not contain all
   these changes. Do not claim build 24/25 or c5c2af8b is this verified source.
6. Align App Store metadata/privacy/reviewer access with the shipped build.
   No App Store approval or complete production certification is asserted.

Supabase advisories for the bounded public_profiles owner view and service-only
queue tables require interpretation: changing the view to security_invoker would
hide other sellers behind user_profiles owner RLS. Do not grant public access to
private profile/auth columns just to clear the advisor. Remaining platform items:
[Postgres updates](https://supabase.com/docs/guides/platform/upgrading) and
[password protections](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Dependency upgrade reference: [Next 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15).
