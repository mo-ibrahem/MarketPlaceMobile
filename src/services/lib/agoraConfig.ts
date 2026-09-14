/**
 * Agora App ID for the live studio and viewer WebViews.
 *
 * The App ID is public (it ships in every client bundle and in the web app),
 * so it is safe as a build-time constant. It is read from
 * EXPO_PUBLIC_AGORA_APP_ID with the project's ID as the fallback: build 26
 * shipped with an empty ID because the variable only existed in the
 * gitignored local .env, which EAS never sees -- hosting failed with Agora's
 * "Invalid appid" while watching still worked because the viewer had this
 * fallback and the studio did not. The variable now also lives in EAS
 * environments (production/preview/development), so the fallback is a second
 * line of defence, not the source of truth.
 *
 * What the ID does NOT do: it does not authorise anything. Publishing and
 * subscribing are gated by tokens minted server-side by generate-agora-token.
 */
export const AGORA_APP_ID: string =
  process.env.EXPO_PUBLIC_AGORA_APP_ID?.trim() || 'f9fd0dadb9674b698d234f4551d6100b';
