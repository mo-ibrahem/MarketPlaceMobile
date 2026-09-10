import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react-native';
import { supabase } from '../src/services/lib/supabase';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Toast from 'react-native-toast-message';

const PAYMOB_IFRAME_ID = process.env.EXPO_PUBLIC_PAYMOB_IFRAME_ID || '957263';

// Paymob's browser redirect races its own server-to-server webhook, and the
// browser usually wins. These bound how long we wait for the backend to catch up
// before we stop waiting -- and we say "not confirmed yet", never "successful".
const VERIFY_INTERVAL_MS = 2000;
const VERIFY_TIMEOUT_MS = 40000;

/**
 * What a URL from the Paymob flow actually tells us.
 *
 * 'declined'  -- Paymob explicitly said the transaction failed.
 * 'returned'  -- the flow ended and the browser came back to our redirect URL.
 *                This is NOT proof of success: Paymob sends declines to the very
 *                same redirect URL (`https://egbay.shop/wallet?success=false&...`),
 *                and even an approved card can fail server-side afterwards. The
 *                only thing it proves is that the checkout is over, so go ask the
 *                database what really happened.
 * 'none'      -- still inside the checkout, keep the WebView going.
 *
 * Exported so the classification can be tested without a WebView.
 */
export type PaymobUrlOutcome = 'declined' | 'returned' | 'none';

export function classifyPaymobUrl(rawUrl: string): PaymobUrlOutcome {
  const url = (rawUrl || '').toLowerCase();
  if (!url) return 'none';

  // Failure is tested FIRST and biased to fail closed. Previously the success
  // branch ran first and matched on the bare host, so a declined redirect to
  // egbay.shop was reported to the user as "Payment Successful".
  if (
    url.includes('success=false') ||
    url.includes('declined') ||
    url.includes('error_occured=true') ||
    url.includes('is_voided=true') ||
    url.includes('is_refunded=true')
  ) {
    return 'declined';
  }

  if (
    url.includes('success=true') ||
    url.includes('txn_response_code=approved') ||
    url.includes('egbay.shop') ||
    url.includes('egbay.market') ||
    url.includes('/wallet') ||
    url.includes('callback/paymob')
  ) {
    return 'returned';
  }

  return 'none';
}

type Phase = 'paying' | 'verifying' | 'confirmed' | 'unconfirmed' | 'declined';
type BackendState = 'confirmed' | 'failed' | 'pending';

export default function PaymentScreen() {
  const {
    paymentToken,
    orderId,
    totalEgp,
    // Phase 2: wallet top-up credit after confirmed payment
    topUpAmount,
  } = useLocalSearchParams<{
    paymentToken: string;
    orderId: string;
    totalEgp?: string;
    topUpAmount?: string;
  }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('paying');
  const [declineReason, setDeclineReason] = useState('');
  const phaseRef = useRef<Phase>('paying');

  const setPhaseOnce = useCallback((next: Phase) => {
    // The WebView fires both onShouldStartLoadWithRequest and
    // onNavigationStateChange for the same redirect; only the first wins.
    if (phaseRef.current !== 'paying') return;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;

  // Boosts never reach this screen: they are wallet-balance-only, because a
  // card-paid boost has no activation path on the webhook side. See
  // boostService.boostProduct and web's /api/paymob/session.
  const isTopUp = !!topUpAmount;

  /**
   * Ask the database what actually happened. Nothing here mutates anything --
   * it only reads the row the backend webhook is responsible for updating, so a
   * payment that never completed can never be reported as completed.
   */
  const readBackendState = useCallback(async (): Promise<BackendState> => {
    try {
      if (isTopUp) {
        if (!orderId) return 'pending';
        const { data, error } = await supabase
          .from('wallet_topups' as any)
          .select('status')
          .eq('id', orderId)
          .maybeSingle();
        if (error || !data) return 'pending';
        const status = (data as any).status;
        if (status === 'paid') return 'confirmed';
        if (status === 'failed' || status === 'cancelled') return 'failed';
        return 'pending';
      }

      if (orderId) {
        const { data, error } = await supabase
          .from('orders' as any)
          .select('status')
          .eq('id', orderId)
          .maybeSingle();
        if (error || !data) return 'pending';
        const status = (data as any).status;
        if (status === 'pending_payment') return 'pending';
        if (status === 'cancelled' || status === 'payment_failed') return 'failed';
        return 'confirmed';
      }
    } catch (err) {
      console.warn('[PaymentScreen] Verification read failed:', err);
    }
    return 'pending';
  }, [isTopUp, orderId]);

  // Poll the real status while we are verifying. The copy stays truthful the
  // whole time: "confirming", never "successful", until the row says so.
  useEffect(() => {
    if (phase !== 'verifying') return;

    let cancelled = false;
    let elapsed = 0;

    const tick = async () => {
      if (cancelled) return;
      const state = await readBackendState();
      if (cancelled) return;

      if (state === 'confirmed') {
        clearInterval(interval);
        phaseRef.current = 'confirmed';
        setPhase('confirmed');
        return;
      }
      if (state === 'failed') {
        clearInterval(interval);
        setDeclineReason('Your bank did not complete this payment.');
        phaseRef.current = 'declined';
        setPhase('declined');
        return;
      }

      elapsed += VERIFY_INTERVAL_MS;
      if (elapsed >= VERIFY_TIMEOUT_MS) {
        clearInterval(interval);
        phaseRef.current = 'unconfirmed';
        setPhase('unconfirmed');
      }
    };

    const interval = setInterval(tick, VERIFY_INTERVAL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, readBackendState]);

  // Only fires once the backend actually confirmed. This is the single place
  // allowed to make a success claim.
  useEffect(() => {
    if (phase !== 'confirmed') return;

    Toast.show({
      type: 'success',
      text1: isTopUp
        ? `EGP ${Number(topUpAmount).toLocaleString()} Added to Wallet! 💳`
        : 'Payment Confirmed! 🎉',
      text2: isTopUp
        ? 'Your spendable balance has been updated.'
        : 'Funds secured in Escrow. Track your order status below.',
    });

    if (isTopUp) {
      router.replace('/wallet' as any);
    } else if (orderId) {
      router.replace({ pathname: '/order/[orderId]', params: { orderId } } as any);
    } else {
      router.replace('/(tabs)');
    }
  }, [phase, isTopUp, topUpAmount, orderId, router]);

  const handleUrl = useCallback(
    (rawUrl: string): PaymobUrlOutcome => {
      const outcome = classifyPaymobUrl(rawUrl);
      if (outcome === 'declined') {
        setDeclineReason('The transaction was not completed. Please try another card or payment method.');
        setPhaseOnce('declined');
      } else if (outcome === 'returned') {
        setPhaseOnce('verifying');
      }
      return outcome;
    },
    [setPhaseOnce],
  );

  // Web iframe message listener. Previously any message containing the string
  // "true" was treated as a successful payment; now a message can at most send
  // us into verification, and the database decides.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMsg = (e: MessageEvent) => {
      const data =
        typeof e.data === 'string' ? e.data.toLowerCase() : JSON.stringify(e.data || {}).toLowerCase();
      if (data.includes('declined') || data.includes('success:false') || data.includes('"success":false')) {
        setDeclineReason('The transaction was not completed. Please try another card or payment method.');
        setPhaseOnce('declined');
      } else if (data.includes('approved') || data.includes('success')) {
        setPhaseOnce('verifying');
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [setPhaseOnce]);

  const handleShouldStartLoadWithRequest = (request: any) => {
    return handleUrl(request?.url || '') === 'none';
  };

  const handleNavigationStateChange = (navState: any) => {
    handleUrl(navState?.url || '');
  };

  if (!paymentToken) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Invalid payment session token.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Return to Checkout</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const headerTitle = isTopUp ? 'Wallet Deposit' : 'Secure Card Checkout';

  const renderStatusScreen = () => {
    if (phase === 'verifying') {
      return (
        <View style={styles.statusWrap}>
          <View style={[styles.statusIcon, styles.statusIconAmber]}>
            <ActivityIndicator size="large" color="#D97706" />
          </View>
          <Text style={styles.statusTitle}>Confirming your payment…</Text>
          <Text style={styles.statusBody}>
            Waiting for confirmation from your bank. This screen updates automatically — please don&apos;t
            close the app.
          </Text>
          <View style={styles.noteRow}>
            <Clock color="#64748B" size={14} />
            <Text style={styles.noteText}>Nothing is confirmed until your bank responds.</Text>
          </View>
        </View>
      );
    }

    if (phase === 'unconfirmed') {
      return (
        <View style={styles.statusWrap}>
          <View style={[styles.statusIcon, styles.statusIconAmber]}>
            <AlertCircle color="#D97706" size={34} />
          </View>
          <Text style={styles.statusTitle}>Not confirmed yet</Text>
          <Text style={styles.statusBody}>
            {isTopUp
              ? 'We could not confirm this deposit with your bank yet. If it went through, your balance will update on its own — check your wallet in a few minutes.'
              : 'We could not confirm this payment yet. Do not pay again — if it went through, your order will update on its own. You can track it in My Orders.'}
          </Text>
          <Text style={styles.statusWarn}>
            Do not treat this as a completed payment. Please check before retrying.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (isTopUp) router.replace('/wallet' as any);
              else if (orderId)
                router.replace({ pathname: '/order/[orderId]', params: { orderId } } as any);
              else router.replace('/(tabs)');
            }}
          >
            <Text style={styles.primaryBtnText}>
              {isTopUp ? 'Go to Wallet' : 'Track My Order'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('verifying')}>
            <Text style={styles.secondaryBtnText}>Check again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (phase === 'declined') {
      return (
        <View style={styles.statusWrap}>
          <View style={[styles.statusIcon, styles.statusIconRose]}>
            <XCircle color="#E11D48" size={34} />
          </View>
          <Text style={styles.statusTitle}>Payment declined</Text>
          <Text style={styles.statusBody}>
            {declineReason || 'The transaction was not completed.'}
          </Text>
          <Text style={styles.statusBody}>You have not been charged for this attempt.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Try Another Method</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 'confirmed' -- the redirect effect is already navigating away.
    return (
      <View style={styles.statusWrap}>
        <View style={[styles.statusIcon, styles.statusIconEmerald]}>
          <CheckCircle2 color="#059669" size={34} />
        </View>
        <Text style={styles.statusTitle}>Payment confirmed</Text>
        <Text style={styles.statusBody}>Taking you to the next step…</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.secureRow}>
            <ShieldCheck color="#10B981" size={13} />
            <Text style={styles.secureText}>256-Bit Encrypted Escrow</Text>
          </View>
        </View>
        {totalEgp && <Text style={styles.headerPrice}>EGP {Number(totalEgp).toLocaleString()}</Text>}
      </View>

      {/* Checkout, or the honest outcome of it */}
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        {phase !== 'paying' ? (
          renderStatusScreen()
        ) : Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>
            <iframe
              src={paymentUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Paymob Payment"
            />
            {/* Web testing aid: this can only start verification, never claim success. */}
            <View style={styles.webBar}>
              <View>
                <Text style={styles.webBarTitle}>
                  {isTopUp ? `Deposit: EGP ${Number(topUpAmount).toLocaleString()}` : 'Card Payment'}
                </Text>
                <Text style={styles.webBarSub}>Click below once the card payment completes</Text>
              </View>
              <TouchableOpacity onPress={() => setPhaseOnce('verifying')} style={styles.webBarBtn}>
                <Text style={styles.webBarBtnText}>Check Payment Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <WebView
            source={{ uri: paymentUrl }}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingLabel}>Loading secure Paymob portal…</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '700', marginBottom: 16 },
  backBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { color: 'white', fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBack: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { flex: 1, marginHorizontal: 10 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  headerPrice: { fontSize: 15, fontWeight: '900', color: '#2563EB' },

  statusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  statusIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statusIconAmber: { backgroundColor: '#FEF3C7' },
  statusIconRose: { backgroundColor: '#FFE4E6' },
  statusIconEmerald: { backgroundColor: '#D1FAE5' },
  statusTitle: { fontSize: 21, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  statusBody: { fontSize: 13, lineHeight: 20, color: '#64748B', textAlign: 'center' },
  statusWarn: { fontSize: 12, lineHeight: 18, color: '#B45309', fontWeight: '700', textAlign: 'center', marginTop: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  noteText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 14,
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  secondaryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  secondaryBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },

  webBar: {
    padding: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webBarTitle: { fontSize: 12, fontWeight: '700', color: 'white' },
  webBarSub: { fontSize: 11, color: '#94A3B8' },
  webBarBtn: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  webBarBtnText: { fontSize: 11, fontWeight: '800', color: 'white' },

  loadingWrap: {
    // Written out rather than spreading StyleSheet.absoluteFillObject, which
    // RN 0.86 no longer exposes on the StyleSheet type.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
});
