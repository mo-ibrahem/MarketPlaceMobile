import { Platform } from 'react-native';

/**
 * What may be sold for money inside the iOS build.
 *
 * App Store Review Guideline 3.1.1: unlocking features or functionality within
 * the app must use in-app purchase. 3.1.3(g) names the case directly: "buying
 * advertisements to display in the same app (such as sales of 'boosts' for
 * posts in a social media app) must use in-app purchase." 3.1.3(d): one-to-
 * many real-time services must use in-app purchase.
 *
 * Egbay sells three digital things -- listing boosts, live-broadcast passes,
 * and (formerly) seller tiers -- and none of them go through StoreKit. Until
 * they do, the iOS build must not offer them at all. It also may not point
 * users at buying them elsewhere: 3.1.3 forbids in-app calls to action for
 * other purchase methods outside the US storefront.
 *
 * What stays: buying a physical item from another seller through escrow.
 * 3.1.3(e) requires that to use a method *other than* IAP -- Paymob is the
 * correct choice there, and IAP would be the violation. Wallet top-ups are
 * fine as long as the balance can only ever be spent on those physical goods,
 * which is what gating the digital items achieves.
 */
export const DIGITAL_PURCHASES_ENABLED = Platform.OS !== 'ios';

/** Physical-goods checkout is allowed everywhere and must not use IAP. */
export const PHYSICAL_CHECKOUT_ENABLED = true;

/**
 * Master switch for the money layer. false = classifieds mode: listings,
 * chat, profiles, wishlist, report/block, and account deletion work; there is
 * no checkout, no orders, no escrow, no wallet, no payouts, no boosts, no
 * live booking, no seller tiers, and no reviews (reviews require a completed
 * order, so none can exist while this is off).
 *
 * This exists because Paymob's merchant verification is taking longer than
 * the App Store submission can wait for. Rather than submit an escrow app
 * that cannot actually process a payment, or delete the payment code and
 * rebuild it later, every money surface in the app is gated on this one
 * constant. See PLAN-CLASSIFIEDS-MODE.md for the full list of what is gated
 * and how it was verified.
 *
 * Set to true when the Paymob merchant account is approved. Everything
 * gated on this constant is intact and was working on 2026-09-13 (build 21)
 * -- flipping this flag and rebuilding is the entire re-launch process.
 */
export const PAYMENTS_ENABLED = false;
