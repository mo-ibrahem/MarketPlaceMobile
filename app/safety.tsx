import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, Eye, Flag, MapPin, MessageCircle, ShieldAlert, Wallet } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../src/i18n/LanguageContext';

/**
 * Buying and selling safely on Egbay.
 *
 * Added while PAYMENTS_ENABLED is false (see PLAN-CLASSIFIEDS-MODE.md):
 * with no in-app escrow, price and handover are arranged directly between
 * buyer and seller, so the app owes them plain safety guidance instead of
 * a payment guarantee it cannot back right now. App Review expects this on
 * a classifieds-style app. Left in place regardless of the flag; it is
 * useful advice either way.
 */

const TIPS_AR = [
  { icon: MapPin, title: 'قابل البائع في مكان عام', body: 'اختر مكاناً مزدحماً ونهاراً كلما أمكن -- محطة مترو، مول، أو أمام قسم شرطة.' },
  { icon: Eye, title: 'افحص المنتج قبل الدفع', body: 'تأكد أن الحالة والمواصفات مطابقة لما تم الاتفاق عليه في المحادثة قبل تسليم أي مبلغ.' },
  { icon: Wallet, title: 'لا تُرسل أموالاً مقدماً', body: 'لا تحوّل أي مبلغ قبل رؤية المنتج شخصياً، مهما بدا البائع موثوقاً.' },
  { icon: MessageCircle, title: 'ابقَ داخل دردشة إيجي باي', body: 'الاتفاق المكتوب في المحادثة يبقى مرجعاً لك إذا حدث خلاف لاحقاً.' },
  { icon: Flag, title: 'أبلغ عن أي شيء مريب', body: 'إعلان أو رسالة تبدو احتيالية؟ استخدم زر الإبلاغ على الإعلان أو في المحادثة.' },
];

const TIPS_EN = [
  { icon: MapPin, title: 'Meet in a public place', body: 'Pick somewhere busy and well-lit when you can -- a metro station, a mall, or outside a police station.' },
  { icon: Eye, title: 'Inspect before you pay', body: 'Confirm the item matches what was agreed in chat before any money changes hands.' },
  { icon: Wallet, title: 'Never send money in advance', body: "Don't transfer anything before you've seen the item in person, no matter how trustworthy the seller seems." },
  { icon: MessageCircle, title: 'Keep it in Egbay chat', body: 'A written agreement in the app gives you something to point back to if a disagreement comes up later.' },
  { icon: Flag, title: 'Report anything suspicious', body: 'A listing or message that looks like a scam? Use the report button on the listing or in the chat.' },
];

export default function SafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const tips = isRTL ? TIPS_AR : TIPS_EN;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'الأمان عند البيع والشراء' : 'Safety tips'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.badgeWrap}>
          <ShieldAlert color="#2563EB" size={32} />
          <Text style={styles.mainTitle}>
            {isRTL ? 'البيع والشراء بأمان على إيجي باي' : 'Buying and selling safely on Egbay'}
          </Text>
          <Text style={styles.subTitle}>
            {isRTL
              ? 'السعر والاستلام يتم الاتفاق عليهما مباشرة بينك وبين الطرف الآخر. باتباع هذه النصائح تحمي نفسك.'
              : 'Price and handover are arranged directly between you and the other person. These tips keep that safe.'}
          </Text>
        </View>

        {tips.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <tip.icon color="#2563EB" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.warnCard}>
          <AlertTriangle color="#B45309" size={18} />
          <Text style={styles.warnText}>
            {isRTL
              ? 'إيجي باي ليست طرفاً في عملية الدفع أو التسليم بين المستخدمين حالياً، ولا تتحمل مسؤولية الخسائر الناتجة عنها.'
              : 'Egbay is not a party to payment or handover between users right now, and is not responsible for losses arising from them.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  content: { padding: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },

  badgeWrap: { alignItems: 'center', marginVertical: 14, paddingHorizontal: 12 },
  mainTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 10, textAlign: 'center' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', lineHeight: 19 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  tipIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 3 },
  tipBody: { fontSize: 12.5, color: '#64748B', lineHeight: 18 },

  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 6,
  },
  warnText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
});
