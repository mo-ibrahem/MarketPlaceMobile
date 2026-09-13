/**
 * The one place the web API's origin lives.
 *
 * It must be the www host. https://egbay.shop answers every request with a
 * 307 to https://www.egbay.shop, and a cross-origin redirect drops the
 * Authorization header (fetch spec; iOS NSURLSession does the same). Every
 * call that used the apex domain reached the server with no token and got
 * 401 -- checkout, order actions, wallet, boosts and live booking all had
 * this bug. Found 2026-09-13 while verifying live booking against
 * production; fixed by routing everything through this constant.
 */
export const API_BASE = 'https://www.egbay.shop';
