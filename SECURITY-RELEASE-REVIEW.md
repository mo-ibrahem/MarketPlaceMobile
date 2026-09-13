# Egbay security and Apple release review

Checkpoint: 2026-09-13. **Not approved for submission.** This review has found and
fixed local code issues, but production verification and native device testing
are still outstanding. The earlier handoff's build 20 recommendation does not
cover these changes; a fresh build will be needed after release blockers close.

## Local changes

- Retired the obsolete client-priced create-payment-key function with HTTP 410.
  The mobile app already uses the authenticated egbay.shop API for order checkout.
  Confirm any external consumers before deploying this retirement.
- Image cleanup now requires PRODUCT_IMAGES_WEBHOOK_SECRET in an x-webhook-secret
  header, validates the public.products DELETE event, reads old_record (the
  documented Supabase DELETE payload), and accepts only this project's product
  image bucket URLs. Configure the database webhook header and Edge Function
  secret together before deployment. Missing configuration fails closed (503).
- Payment UI accepts return signals only from exact trusted HTTPS origins.
  Web messages must also originate from its own payment iframe. Backend states
  require an explicit confirmation allowlist. Verification has a real 40-second
  deadline, serial polling and network failure recovery. Decline copy no longer
  promises the bank made no charge. Direct iOS top-up links are rejected.
- SecureStore writes/removals now return their promises so auth can await them.
- Live WebView script parameters are JSON-serialized and HTML-escaped to prevent
  script injection through channel names or token values.
- Paymob webhook uses the documented 20 POST signature fields, validates
  signatures, rejects pending/refund/void/authorization events for fulfillment,
  validates currency/amount, and returns 503 on persistence failure.
- Removed unused EXPO_PUBLIC_AGORA_APP_CERT and EXPO_PUBLIC_PAYMOB_API_KEY
  from the local untracked environment without displaying their values.
  **This does not revoke previously exposed credentials.**
- Added a public-variable preflight, regression tests, Node version selection,
  compatible dependency security updates, Expo package alignment, and several
  React compiler/JSX corrections.
- Disabled the image-picker plugin's default microphone permission. Native live
  broadcasting permission requirements need separate validation if enabled later.

## Verified at this checkpoint

- TypeScript check passed.
- Security tests execute actual TS modules and Edge Function handlers with mocked
  network/database adapters. They cover forged URL signals, unknown order states,
  inline script injection, auth storage promises, retired payments, unauthorized
  storage deletion, webhook signatures, unsettled payments and persistence errors.
  They do not establish live RLS or payment RPC behavior.
- iOS JavaScript bundle and static web export succeeded with Expo SDK 57.
  This is not an Xcode archive, signing check, or native iPhone test.
- Expo dependency compatibility check passed.
- Initial production dependency audit: 26 findings, including 1 critical and
  4 high. After compatible fixes: 18 moderate, 0 high, 0 critical.
  Remaining root advisories: decode-uri-component through query-string/navigation,
  and uuid through xcode/build tooling. No forced SDK downgrade or unverified
  major dependency override was applied.
- Lint reduced from 32 errors to 11 errors (with existing warnings remaining).
  Remaining errors involve async loading effects and live reaction compiler
  analysis. release:check intentionally remains failing until these are resolved.

## Required before release

1. **Reconnect the authenticated Supabase MCP by restarting Codex.** The connection
   is project-scoped to fpqbocohjzwlfcmfropr and read-only. It was authenticated
   successfully but cannot be called by the current task runtime.
2. Compare deployed functions, RLS, grants, SECURITY DEFINER RPCs, storage policies,
   auth settings and migration history to these files. Do not assume
   migrations-proposed reflects the live database. Obtain schema evidence before
   writing further migrations. Never deploy the earlier destructive cleanup
   migration solely because it appears on the old checklist.
3. Audit the authoritative egbay.shop API and payment RPCs. The local webhook still
   selects fulfillment using order.merchant_order_id, which is NOT among the
   HMAC-signed fields. Before deployment, bind the signed Paymob order ID to a
   server-created payment record and enforce matching amount/currency, ownership,
   integration ID, and transactional idempotency. Verify retries and concurrent
   duplicate callbacks do not credit twice. This is an unresolved high-risk item.
4. Account deletion is not proven compliant. The checked-in RPC bans/anonymizes the
   auth row and removes some profile data; it does not demonstrate deletion of
   uploaded objects, messages, reviews, shipping details, or all other personal
   data. Already-issued JWT access can also outlive refresh-session revocation.
   Define and implement lawful financial retention, actual content cleanup and
   access revocation, then test on disposable accounts. Update both languages of
   app/privacy.tsx and PRIVACY.md; their current immediate-erasure claims exceed
   what this SQL proves.
5. Blocking currently filters the inbox in the client. Verify server-side blocking
   of messages and room creation in both directions, direct links, realtime
   events, live chat, listings and reviews. Verify reporting and moderation
   coverage for live content. Test as two isolated accounts, including denied API
   calls; UI-only hiding is insufficient.
6. Finish lint, remaining dependency review, UI accessibility/RTL/loading-state
   checks, native device tests, and backend error handling. No signed-in UI
   rendering or real-device testing was completed in this checkpoint.
7. Validate current App Store Connect privacy answers, age rating, support/privacy
   URLs, screenshots, reviewer account and notes, distribution signing and
   developer entity information. The financial-services classification and
   licensing must be confirmed by the operator; earlier notes are not legal
   verification. Test physical-goods payment approval, decline, pending, timeout,
   cancellation, disputes, payouts, report/block and account deletion on iPhone.
8. **Final security step, per user preference:** rotate the Agora certificate and
   exposed Paymob API key in provider consoles, update server secrets, revoke the
   old credentials, and verify live token issuance and test-mode checkout. Check
   past reviewer credentials for rotation too. Build afresh after this step and
   confirm no private credentials appear in the bundle. Do not paste secrets in
   chat, source control or EXPO_PUBLIC_ variables.

No backend changes were deployed and no App Store submission was made.

## Sources

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://supabase.com/docs/guides/database/webhooks
- https://supabase.com/docs/guides/ai-tools/mcp
- https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/skills/paymob-integration/references/code-python.md
