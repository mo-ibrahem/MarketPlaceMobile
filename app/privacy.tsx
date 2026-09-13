import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Shield,
  Eye,
  Trash2,
  FileText,
  Building2,
  Mail,
  Globe,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const isRTL = lang === 'ar';

  const arSectionsFull = [
    {
      id: 'scope',
      title: '١. النطاق والإطار القانوني',
      content: `أهلاً بك في منصة إيجي باي (EgyBay). نحن نلتزم بأعلى معايير حماية البيانات والخصوصية لجميع مستخدمينا في جمهورية مصر العربية.

تتوافق هذه السياسة بشكل كامل مع:
• قانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠.
• قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ وقواعد التجارة الإلكترونية المصرية.
• إرشادات متجر آبل (Apple App Store Guidelines Section 5.1).
• سياسات حماية بيانات المستخدمين في Google Play.

باستخدامك للتطبيق أو تسجيل حساب أو إتمام عمليات شراء وبيع، فإنك توافق على الممارسات الموضحة في هذه الوثيقة.`,
    },
    {
      id: 'collection',
      title: '٢. البيانات التي نقوم بجمعها',
      content: `لضمان حماية أموالك بنظام الضمان المالي (Escrow) والتحقق من هوية البائعين وتوصيل الشحنات عبر بوسطة، نقوم بجمع:

أ. البيانات الشخصية وبيانات الاتصال:
• الاسم الكامل، البريد الإلكتروني، ورقم الهاتف المصري (فودافون، أورنج، اتصالات، وي).
• عنوان الشحن والاستلام (المحافظة، المدينة، اسم الشارع، رقم العقار).

ب. بيانات تسجيل الدخول والأمان:
• بيانات الحساب المشفرة عبر Supabase Authentication بنظام حماية Row-Level Security.
• عنوان البروتوكول (IP) ونوع الجهاز لضمان أمان الحساب ومنع الاختراق.

ج. بيانات المعاملات ونظام الضمان المالي:
• سجل الطلبات، حالة حجز المبالغ، وسجل تسليم كود الاستلام (PIN).
• وجهات استلام الأرباح للبائعين: عنوان إنستاباي (InstaPay IPA)، رقم محفظة فودافون كاش، أو الآيبان البنكي (IBAN).
• تنبيه: بيانات البطاقات البنكية يتم معالجتها مباشرة عبر بوابة دفع معتمدة من البنك المركزي المصري (Paymob) ولا يتم تخزين أي أرقام بطاقات أو رموز أمان على خوادمنا نهائياً.

د. توثيق هوية البائع (KYC):
• صورة بطاقة الرقم القومي المصري للبائعين الموثقين، تُحفظ في مساحات تخزين مشفرة لا يطلع عليها إلا مسؤولو الامتثال والرقابة.`,
    },
    {
      id: 'usage',
      title: '٣. كيف نستخدم بياناتك ونحميها',
      content: `نستخدم بياناتك للأغراض المشروعة التالية فقط:
• تنفيذ الضمان المالي: حجز أموال المشتري حتى فحص المنتج واستلامه، ثم تحويل الأرباح للبائع فور تأكيد كود PIN أو انقضاء مهلة الفحص.
• الشحن والتوصيل: مشاركة بيانات العنوان ورقم الهاتف مع شركة الشحن المعتمدة (بوسطة Bosta) لتوصيل الطلب.
• مكافحة الغش والاحتيال: فحص الإعلانات المخالفة ومنع الحسابات الوهمية والسلع المقلدة.
• البث المباشر: إدارة غرف البث والدردشة التفاعلية بين البائع والمشاهدين.
• الإشعارات الفورية: إرسال تحديثات حالة الطلب والرسائل عبر البريد الإلكتروني والرسائل النصية.`,
    },
    {
      id: 'sharing',
      title: '٤. مشاركة البيانات مع أطراف ثالثة',
      content: `منصة إيجي باي لا تقوم نهائياً ببيع أو تأجير أو مشاركة بياناتك الشخصية مع شركات الإعلانات أو الوسطاء.

تتم مشاركة الحد الأدنى من البيانات الضرورية مع الجهات المعتمدة التالية فقط:
• شركات الشحن والخدمات اللوجستية (بوسطة مصر Bosta): لغرض تسليم الشحنة للعنوان المحدد.
• بوابات الدفع الإلكتروني (Paymob): لمعالجة عمليات الدفع المتوافقة مع معايير PCI-DSS والبنك المركزي المصري.
• البنية التحتية السحابية (خوادم Supabase / AWS المعتمدة): لحفظ قواعد البيانات بتشفير AES-256.
• الجهات القضائية المصرية: فقط في حال وجود طلب رسمي وملزم قانوناً وفق التشريعات المصرية.`,
    },
    {
      id: 'rights',
      title: '٥. حقوقك وحذف الحساب نهائياً (Account Deletion)',
      content: `وفقاً لقانون حماية البيانات الشخصية رقم ١٥١ وإرشادات آبل:

• حق الوصول والتعديل: يمكنك تعديل بياناتك الشخصية وإعلاناتك في أي وقت عبر صفحة الملف الشخصي.
• حق نقل البيانات: يمكنك طلب نسخة كاملة من سجل معاملاتك وبياناتك المسجلة.
• حق الحذف النهائي للحساب والبيانات:
  ١. عبر التطبيق: الملف الشخصي ← الإعدادات ← "حذف الحساب نهائياً". يتم حذف ملفك الشخصي وإعلاناتك وبياناتك المحفوظة فوراً.
  ٢. عبر البريد الإلكتروني: مراسلتنا على info@egbay.shop من البريد المسجل، ويتم التنفيذ خلال ٧٢ ساعة.
  تُحتفظ سجلات الطلبات المكتملة كما يقتضي قانون التجارة المصري، لكنها تُفصل نهائياً عن أي بيانات تعريفية.`,
    },
    {
      id: 'security',
      title: '٦. معايير الأمان والتشفير',
      content: `• يتم تشفير جميع الاتصالات عبر شهادات SSL/TLS 256-bit عالية الأمان.
• المحادثات الخاصة بين المشترين والبائعين محمية بقواعد الأمان الصارمة على مستوى الصفوف (RLS).
• مستندات إثبات الشخصية تخضع لمستويات حماية مشددة مع روابط مؤقتة ومنتهية الصلاحية.`,
    },
  ];

  const enSectionsFull = [
    {
      id: 'scope',
      title: '1. Scope & Legal Framework',
      content: `Welcome to EgyBay. We are dedicated to maintaining the highest standards of data privacy and security for all users in Egypt.

This Privacy Policy complies with:
• Egyptian Personal Data Protection Law No. 151 of 2020 (قانون حماية البيانات الشخصية).
• Egyptian Consumer Protection Law No. 181 of 2018.
• Apple App Store Review Guidelines (Section 5.1 - Privacy and Data Security).
• Google Play Developer Policy on User Data.`,
    },
    {
      id: 'collection',
      title: '2. Information We Collect',
      content: `To provide safe marketplace transactions, escrow payment protection, and courier fulfillment across Egypt, we collect:

A. Personal & Contact Information:
• Full name, email address, Egyptian mobile number.
• Delivery & shipping addresses (Governorate, City, Street address).

B. Authentication & Security Data:
• Passwords securely hashed via Supabase Auth with Row-Level Security (RLS).
• Session tokens, device IP address for fraud prevention.

C. Transaction & Escrow Ledger Data:
• Purchase and sale orders, escrow holding status, and PIN release timestamps.
• Verified seller payout destinations: InstaPay Address (IPA), Mobile Wallet, or Bank IBAN.
• Note: Credit/debit card numbers are processed directly by our Central Bank of Egypt-compliant payment gateway (Paymob). We never store credit card numbers on our servers.

D. Optional KYC Verification Data:
• Egyptian National ID images for seller verification to safeguard buyers against fraud.`,
    },
    {
      id: 'usage',
      title: '3. Purpose & Legal Basis of Processing',
      content: `We process personal data strictly for legitimate transactional purposes:
• Executing Escrow Transactions: Holding buyer funds safely until doorstep inspection or PIN confirmation.
• Logistics & Order Delivery: Sharing delivery addresses with Bosta Express.
• Fraud Prevention: Detecting prohibited items and unauthorized accounts.
• Live Selling: Managing live interactive streams and real-time chat.
• Direct Communication: Sending transactional receipts and order updates.`,
    },
    {
      id: 'sharing',
      title: '4. Data Sharing & Third-Party Processors',
      content: `EgyBay NEVER sells or rents your personal data to marketing brokers.

Data is shared strictly with authorized partners necessary for platform operations:
• Courier Logistics (Bosta Egypt): For parcel dispatch and doorstep delivery.
• Payment Processing (Paymob): For card checkout and automated payouts.
• Cloud Infrastructure (Supabase / AWS): Encrypted database storage.
• Legal Authorities: Only when mandated by an official court warrant under Egyptian Law.`,
    },
    {
      id: 'rights',
      title: '5. Your Rights & Account Deletion',
      content: `Under Law No. 151 of 2020 and Apple App Store guidelines:

• Right to Access & Rectify: Edit your profile details at any time in Profile Settings.
• Right to Data Portability: Request an export of your order history.
• Right to Permanent Erasure (Account Deletion):
  1. In-App: Profile → Settings → "Delete Account". Your profile, listings and saved data are removed immediately.
  2. By Email: Send a deletion request to info@egbay.shop from your registered address; we act within 72 hours.
  Completed order records are retained as required by Egyptian commercial law but are permanently unlinked from any personal identifiers.`,
    },
    {
      id: 'security',
      title: '6. Security Architecture & Encryption',
      content: `• 256-bit TLS/SSL encryption for all data in transit.
• Database Row-Level Security (RLS) guarantees chat and order privacy.
• National ID documents stored in isolated private storage with expiring URLs.`,
    },
  ];

  // While PAYMENTS_ENABLED is false, EgyBay does not collect escrow ledger
  // data, payout destinations, or KYC documents, and does not share anything
  // with Paymob or Bosta -- so this policy should not claim it does (see
  // PLAN-CLASSIFIEDS-MODE.md). "scope", "rights" (account deletion) and the
  // core of "security" are unaffected by payments and are reused as-is.
  const scopeAr = arSectionsFull.find(s => s.id === 'scope')!;
  const rightsAr = arSectionsFull.find(s => s.id === 'rights')!;
  const scopeEn = enSectionsFull.find(s => s.id === 'scope')!;
  const rightsEn = enSectionsFull.find(s => s.id === 'rights')!;

  const arSectionsClassifieds = [
    scopeAr,
    {
      id: 'collection',
      title: '٢. البيانات التي نقوم بجمعها',
      content: `لتشغيل الإعلانات والدردشة داخل التطبيق، نقوم بجمع:

أ. البيانات الشخصية وبيانات الاتصال:
• الاسم الكامل، البريد الإلكتروني، ورقم الهاتف المصري.
• صورة الملف الشخصي، إن وُجدت.

ب. بيانات تسجيل الدخول والأمان:
• بيانات الحساب المشفرة عبر Supabase Authentication بنظام حماية Row-Level Security.
• عنوان البروتوكول (IP) ونوع الجهاز لضمان أمان الحساب ومنع الاختراق.

ج. بيانات الإعلانات والدردشة والبث:
• عناوين الإعلانات، الصور، الأسعار، ورسائل المحادثة بين المشترين والبائعين.
• عند البث المباشر: الصوت والصورة أثناء البث (لا يتم تخزينهما)، ورسائل دردشة البث.

لا تقوم إيجي باي حالياً بجمع أو معالجة أي بيانات دفع أو حسابات بنكية، لأن التطبيق لا يُجري أي عملية دفع بين المستخدمين.`,
    },
    {
      id: 'usage',
      title: '٣. كيف نستخدم بياناتك ونحميها',
      content: `نستخدم بياناتك للأغراض المشروعة التالية فقط:
• تشغيل الإعلانات والدردشة بين المشترين والبائعين.
• مكافحة الغش والاحتيال: فحص الإعلانات المخالفة ومنع الحسابات الوهمية والسلع المقلدة.
• الإشعارات: إعلامك بالرسائل الجديدة وتحديثات الإعلانات.`,
    },
    {
      id: 'sharing',
      title: '٤. مشاركة البيانات مع أطراف ثالثة',
      content: `منصة إيجي باي لا تقوم نهائياً ببيع أو تأجير أو مشاركة بياناتك الشخصية مع شركات الإعلانات أو الوسطاء.

تتم مشاركة الحد الأدنى من البيانات الضرورية مع الجهات المعتمدة التالية فقط:
• البنية التحتية السحابية (خوادم Supabase / AWS المعتمدة): لحفظ قواعد البيانات بتشفير AES-256.
• الجهات القضائية المصرية: فقط في حال وجود طلب رسمي وملزم قانوناً وفق التشريعات المصرية.`,
    },
    rightsAr,
    {
      id: 'security',
      title: '٦. معايير الأمان والتشفير',
      content: `• يتم تشفير جميع الاتصالات عبر شهادات SSL/TLS 256-bit عالية الأمان.
• المحادثات الخاصة بين المشترين والبائعين محمية بقواعد الأمان الصارمة على مستوى الصفوف (RLS).`,
    },
  ];

  const enSectionsClassifieds = [
    scopeEn,
    {
      id: 'collection',
      title: '2. Information We Collect',
      content: `To run listings and in-app chat, we collect:

A. Personal & Contact Information:
• Full name, email address, Egyptian mobile number.
• Profile photo, if provided.

B. Authentication & Security Data:
• Passwords securely hashed via Supabase Auth with Row-Level Security (RLS).
• Session tokens, device IP address for fraud prevention.

C. Listings, Chat & Live Data:
• Listing titles, photos, prices, and messages exchanged between buyers and sellers.
• When you go live: your camera and microphone during the stream (not recorded), and the stream's chat messages.

EgyBay does not currently collect or process any payment or bank account data, because the app does not run any payment between users.`,
    },
    {
      id: 'usage',
      title: '3. Purpose & Legal Basis of Processing',
      content: `We process personal data strictly for legitimate purposes:
• Running listings and chat between buyers and sellers.
• Fraud Prevention: Detecting prohibited items and unauthorized accounts.
• Notifications: Letting you know about new messages and listing updates.`,
    },
    {
      id: 'sharing',
      title: '4. Data Sharing & Third-Party Processors',
      content: `EgyBay NEVER sells or rents your personal data to marketing brokers.

Data is shared strictly with authorized partners necessary for platform operations:
• Cloud Infrastructure (Supabase / AWS): Encrypted database storage.
• Legal Authorities: Only when mandated by an official court warrant under Egyptian Law.`,
    },
    rightsEn,
    {
      id: 'security',
      title: '6. Security Architecture & Encryption',
      content: `• 256-bit TLS/SSL encryption for all data in transit.
• Database Row-Level Security (RLS) guarantees chat and order privacy.`,
    },
  ];

  const sections = PAYMENTS_ENABLED
    ? (isRTL ? arSectionsFull : enSectionsFull)
    : (isRTL ? arSectionsClassifieds : enSectionsClassifieds);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
        </Text>
        {/* Language Switcher */}
        <TouchableOpacity
          onPress={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
          style={styles.langBtn}
        >
          <Globe color="#059669" size={14} />
          <Text style={styles.langBtnText}>{isRTL ? 'English' : 'عربي'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.badgeWrap}>
          <ShieldCheck color="#059669" size={32} />
          <Text style={styles.mainTitle}>
            {isRTL
              ? 'سياسة الخصوصية وحماية البيانات الشخصية'
              : 'Privacy Policy & Data Protection'}
          </Text>
          <Text style={styles.dateText}>
            {isRTL ? 'آخر تحديث: أغسطس ٢٠٢٦' : 'Last updated: August 2026'}
          </Text>
        </View>

        {/* Highlights Ribbon */}
        <View style={styles.highlightRow}>
          <View style={styles.highlightCard}>
            <Building2 color="#059669" size={18} />
            <Text style={styles.highlightTitle}>
              {isRTL ? 'قانون ١٥١ لسنة ٢٠٢٠' : 'Law 151/2020'}
            </Text>
            <Text style={styles.highlightSub}>
              {isRTL ? 'حماية البيانات' : 'Data Protection'}
            </Text>
          </View>
          <View style={styles.highlightCard}>
            <Lock color="#2563EB" size={18} />
            <Text style={styles.highlightTitle}>
              {isRTL ? 'معايير Apple 5.1' : 'Apple 5.1 Ready'}
            </Text>
            <Text style={styles.highlightSub}>
              {isRTL ? 'حذف فوري للحساب' : 'Instant Deletion'}
            </Text>
          </View>
          <View style={styles.highlightCard}>
            <Shield color="#7C3AED" size={18} />
            <Text style={styles.highlightTitle}>
              {isRTL ? 'تشفير AES-256' : 'AES-256 TLS'}
            </Text>
            <Text style={styles.highlightSub}>
              {isRTL ? 'أمان مصرفي' : 'Bank-Grade'}
            </Text>
          </View>
        </View>

        {/* Main Content Sections */}
        {sections.map(sec => (
          <View key={sec.id} style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {sec.title}
            </Text>
            <Text style={[styles.bodyText, { textAlign: isRTL ? 'right' : 'left' }]}>
              {sec.content}
            </Text>
          </View>
        ))}

        {/* Support Box */}
        <View style={styles.supportCard}>
          <Text style={[styles.supportTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'التواصل بخصوص الخصوصية والبيانات' : 'Privacy Inquiries & Data Requests'}
          </Text>
          <Text style={[styles.supportText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'لممارسة حقوقك أو طلب حذف بياناتك أو لأي استفسار متعلق بالخصوصية، تواصل مع مسؤول حماية البيانات عبر:'
              : 'To exercise your data rights or request account deletion, contact our Data Protection Officer at:'}
          </Text>
          <TouchableOpacity
            style={styles.mailBtn}
            onPress={() => Linking.openURL('mailto:info@egbay.shop')}
          >
            <Mail color="white" size={14} />
            <Text style={styles.mailBtnText}>info@egbay.shop</Text>
          </TouchableOpacity>
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
  headerTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  langBtnText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  content: { padding: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },

  badgeWrap: { alignItems: 'center', marginVertical: 14 },
  mainTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 8, textAlign: 'center' },
  dateText: { fontSize: 11, color: '#64748B', marginTop: 4 },

  highlightRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  highlightCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highlightTitle: { fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  highlightSub: { fontSize: 11, color: '#64748B', textAlign: 'center' },

  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  bodyText: { fontSize: 12, color: '#475569', lineHeight: 19 },

  supportCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 4,
    gap: 8,
  },
  supportTitle: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  supportText: { fontSize: 12, color: '#047857', lineHeight: 18 },
  mailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  mailBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },
});
