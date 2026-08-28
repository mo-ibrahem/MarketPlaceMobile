import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الشروط والأحكام • Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.badgeWrap}>
          <FileText color="#2563EB" size={32} />
          <Text style={styles.mainTitle}>شروط استخدام منصة إيجي باي (EgyBay)</Text>
          <Text style={styles.dateText}>آخر تحديث: أغسطس 2026 • Last updated: August 2026</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. مقدمة وقبول الشروط</Text>
          <Text style={styles.bodyText}>
            مرحباً بك في تطبيق إيجي باي (EgyBay). باستخدامك للتطبيق أو تسجيلك لحساب، فإنك توافق صراحة وبشكل كامل على الالتزام بجميع بنود هذه الاتفاقية وقوانين جمهورية مصر العربية المنظمة للتجارة الإلكترونية وحماية المستهلك.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. نظام الضمان وحفظ الأموال (Escrow Protection)</Text>
          <Text style={styles.bodyText}>
            • تعمل المنصة كوسيط مالي موثوق لحماية الطرفين (المشتري والبائع).{'\n'}
            • عند قيام المشتري بالدفع، تُحفظ الأموال في حساب الضمان الآمن ولا تُحول للبائع إلا بعد استلام المشتري للطرد ومعاينته والتأكد من مطابقته للمواصفات.{'\n'}
            • في حال عدم مطابقة المنتج أو رفض الاستلام، يتم استرداد المبلغ كاملاً إلى محفظة المشتري دون أي خصومات تعسفية.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. سلوك المستخدمين والمحتوى المحظور (User Conduct & Safety)</Text>
          <Text style={styles.bodyText}>
            يُحظر تماماً نشر أو تداول أي من العناصر التالية على المنصة:{'\n'}
            • أي بضائع غير قانونية أو مقلدة أو مسروقة.{'\n'}
            • الأسلحة، المواد الخطرة، الأدوية غير المرخصة.{'\n'}
            • المحتوى المسيء أو الخادع أو الاحتيالي.{'\n'}
            تحتفظ المنصة بالحق الكامل في إيقاف أو حذف أي حساب أو إعلان ينتهك هذه القواعد بشكل فوري ودون إشعار مسبق.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. الشحن والتوصيل مع بوسطة (Logistics)</Text>
          <Text style={styles.bodyText}>
            يتم التوصيل عبر شركة الشحن الرسمية المعتمدة (Bosta) بموجب بوليصة شحن مسجلة ورقم تتبع رسمي يغطي كافة محافظات مصر الـ 27 مع إتاحة حق الفحص والمعاينة عند الاستلام.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5. الرسوم والعمولات</Text>
          <Text style={styles.bodyText}>
            تفرض المنصة عمولة نجاح خدمة محددة وفقاً لمستوى البائع (Tier) عند إتمام عملية البيع والتسليم بنجاح، كما تُتاح خدمات إعلانية اختيارية لترقية الإعلانات (Promoted Listings).
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>6. حذف الحساب وإنهاء الخدمة</Text>
          <Text style={styles.bodyText}>
            يحق لأي مستخدم حذف حسابه نهائياً في أي وقت من خلال إعدادات التطبيق (Delete Account)، وسيتم مسح كافة البيانات الشخصية المرتبطة بالحساب وفقاً لسياسة الخصوصية.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>7. الاتصال بالدعم القانوني</Text>
          <Text style={styles.bodyText}>
            لأي استفسارات قانونية أو نزاعات، يرجى التواصل مع فريق الدعم القانوني عبر البريد: info@egbay.shop أو عبر خدمة العملاء داخل التطبيق.
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
  content: { padding: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },

  badgeWrap: { alignItems: 'center', marginVertical: 16 },
  mainTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 10, textAlign: 'center' },
  dateText: { fontSize: 11, color: '#64748B', marginTop: 4 },

  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  bodyText: { fontSize: 12.5, color: '#475569', lineHeight: 20 },
});
