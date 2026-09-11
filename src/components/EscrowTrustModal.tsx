import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Lock,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface EscrowTrustModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EscrowTrustModal({ visible, onClose }: EscrowTrustModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerBadgeWrap}>
              <ShieldCheck color="#2563EB" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>ضمان إيجي باي لحماية أموالك 🛡️</Text>
              <Text style={styles.headerSub}>EgyBay 100% Buyer & Seller Escrow Protection</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
              <X color="#64748B" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
            {/* Hero Trust Callout */}
            <LinearGradient
              colors={['#1E3A8A', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCallout}
            >
              <Text style={styles.heroCalloutBadge}>🔒 أمانك أولويتنا المطلقة</Text>
              <Text style={styles.heroCalloutTitle}>
                البائع لا يستلم جنيهاً واحداً إلا بعد استلامك ومعاينتك للمنتج والتأكيد!
              </Text>
              <Text style={styles.heroCalloutSub}>
                أموالك تظل محفوظة في خزنة إيجي باي المعتمدة ولا تُحوّل للبائع حتى تتأكد بنفسك أن المنتج مطابق للمواصفات 100%.
              </Text>
            </LinearGradient>

            {/* 3 Step Visual Guarantee Timeline */}
            <Text style={styles.sectionTitle}>كيف يعمل نظام الحماية؟ (3 خطوات بسيطة)</Text>
            
            <View style={styles.timeline}>
              {/* Step 1 */}
              <View style={styles.stepCard}>
                <View style={[styles.stepIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Lock color="#2563EB" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepNumber}>الخطوة 1</Text>
                  <Text style={styles.stepTitle}>حفظ المبلغ في خزنة آمنة 🏦</Text>
                  <Text style={styles.stepDesc}>
                    عند الدفع (فيزا، فودافون كاش، إنستاباي)، يتم تجميد المبلغ في حساب وسيط آمن (Escrow Vault) لحمايتك من أي محاولة احتيال.
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.stepCard}>
                <View style={[styles.stepIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <PackageCheck color="#059669" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepNumber, { color: '#059669' }]}>الخطوة 2</Text>
                  <Text style={styles.stepTitle}>حق المعاينة والتجربة 100% 📦</Text>
                  <Text style={styles.stepDesc}>
                    المندوب يسلمك الشحنة في منزلك. لك كامل الحق في فتح الطرد ومعاينة المنتج والتأكد من حالته ومطابقته للصور والمواصفات.
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.stepCard}>
                <View style={[styles.stepIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <CheckCircle2 color="#D97706" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepNumber, { color: '#D97706' }]}>الخطوة 3</Text>
                  <Text style={styles.stepTitle}>الإفراج عن المبلغ أو الاسترجاع الفوري 💸</Text>
                  <Text style={styles.stepDesc}>
                    إذا كنت راضياً، نرسل الأرباح للبائع. وإذا كان المنتج غير مطابق، ترفض الاستلام وتسترد 100% من أموالك فوراً إلى محفظتك أو حسابك!
                  </Text>
                </View>
              </View>
            </View>

            {/* 4 Pillars Grid */}
            <Text style={styles.sectionTitle}>مزايا الضمان الحصرية في مصر 🇪🇬</Text>
            <View style={styles.pillarsGrid}>
              <View style={styles.pillarItem}>
                <Truck color="#2563EB" size={22} />
                <Text style={styles.pillarTitle}>شحن معتمد مع بوسطة</Text>
                <Text style={styles.pillarSub}>توصيل رسمي مع رقم تتبع لجميع محافظات مصر الـ 27</Text>
              </View>

              <View style={styles.pillarItem}>
                <RotateCcw color="#059669" size={22} />
                <Text style={styles.pillarTitle}>استرجاع مجاني 100%</Text>
                <Text style={styles.pillarSub}>استرداد كامل للمبلغ في حال وجود أي عيب خفي أو تلف</Text>
              </View>

              <View style={styles.pillarItem}>
                <ShieldAlert color="#D97706" size={22} />
                <Text style={styles.pillarTitle}>فريق دعم وفض نزاعات</Text>
                <Text style={styles.pillarSub}>فريق مصري متاح 24/7 للتدخل الفوري وحل أي استفسار</Text>
              </View>

              <View style={styles.pillarItem}>
                <Lock color="#4F46E5" size={22} />
                <Text style={styles.pillarTitle}>بوابات دفع مشفرة</Text>
                <Text style={styles.pillarSub}>متوافقة مع معايير البنك المركزي المصري وPaymob</Text>
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Bottom Close Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.okBtn} onPress={onClose} activeOpacity={0.9}>
              <Text style={styles.okBtnText}>فهمت، تسوق بأمان تام 🛡️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerBadgeWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: { paddingHorizontal: 20, paddingTop: 16 },

  heroCallout: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  heroCalloutBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  heroCalloutTitle: { fontSize: 15, fontWeight: '800', color: 'white', lineHeight: 22, marginBottom: 8 },
  heroCalloutSub: { fontSize: 12, color: '#CBD5E1', lineHeight: 18 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12 },

  timeline: { gap: 12, marginBottom: 20 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  stepIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: { fontSize: 11, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' },
  stepTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2, marginBottom: 4 },
  stepDesc: { fontSize: 11.5, color: '#64748B', lineHeight: 17 },

  pillarsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pillarItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  pillarTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  pillarSub: { fontSize: 11, color: '#64748B', lineHeight: 15 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: 'white',
  },
  okBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
});
