import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سياسة الخصوصية • Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.badgeWrap}>
          <ShieldCheck color="#059669" size={32} />
          <Text style={styles.mainTitle}>سياسة الخصوصية وحماية البيانات</Text>
          <Text style={styles.dateText}>آخر تحديث: أغسطس 2026 • Last updated: August 2026</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. البيانات التي نجمعها (Data We Collect)</Text>
          <Text style={styles.bodyText}>
            لتقديم خدمات التجارة والشحن والضمان بكفاءة، نقوم بجمع البيانات التالية:{'\n'}
            • بيانات الحساب: الاسم الكامل، البريد الإلكتروني، رقم الهاتف.{'\n'}
            • بيانات الشحن والتوصيل: العنوان، المدينة، المحافظة (لتسليم الطرود عبر بوسطة).{'\n'}
            • بيانات التوثيق (KYC): صورة بطاقة الرقم القومي المصرية (للبائعين الموثقين فقط لحماية المشترين من الاحتيال).{'\n'}
            • بيانات المعاملات المالية: سجل المحفظة وأرقام المعاملات (لا نقوم بتخزين أرقام البطاقات البنكية السرية، حيث تتم المعالجة عبر بوابات Paymob المشفرة).
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. كيف نستخدم بياناتك (How We Use Data)</Text>
          <Text style={styles.bodyText}>
            • إنشاء الحسابات وإدارة تسجيل الدخول الآمن.{'\n'}
            • معالجة طلبات البيع والشراء وإصدار بوالص الشحن الرسمية.{'\n'}
            • إدارة حسابات الضمان والمحافظ وتحويل الأرباح للبائعين.{'\n'}
            • منع الاحتيال وحماية أمان المجتمع.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. مشاركة البيانات مع أطراف ثالثة (Third-Party Sharing)</Text>
          <Text style={styles.bodyText}>
            نحن لا نبيع بياناتك الشخصية لأي جهة إعلانية أو تجارية. نشارك فقط البيانات الضرورية لتنفيذ الخدمة مع الشركاء المعتمدين:{'\n'}
            • شركة بوسطة (Bosta): لعنوان ورقم هاتف التوصيل فقط.{'\n'}
            • بوابة الدفع Paymob: لمعالجة عمليات الدفع الآمنة وفق معايير البنك المركزي المصري.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. حقوق المستخدم وحذف الحساب (Account Deletion)</Text>
          <Text style={styles.bodyText}>
            وفقاً لإرشادات Apple وسياسات الخصوصية العالمية، لك كامل الحق في طلب حذف حسابك وبياناتك الشخصية بشكل نهائي في أي وقت من خلال خيار "حذف الحساب" في إعدادات الملف الشخصي داخل التطبيق أو بمراسلتنا على privacy@egbay.market.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5. أمان وتشفير البيانات (Security Standards)</Text>
          <Text style={styles.bodyText}>
            نستخدم أعلى معايير التشفير (SSL/TLS 256-bit) وتخزين مشفر وفقاً لمعايير ISO و GDPR لضمان حماية بياناتك وأموالك من أي وصول غير مصرح به.
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
