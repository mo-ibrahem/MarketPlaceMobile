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
  ShieldCheck,
  FileText,
  AlertOctagon,
  Scale,
  Mail,
  Globe,
  MessageCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { PAYMENTS_ENABLED } from '../src/services/lib/platformCommerce';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const isRTL = lang === 'ar';

  const arSectionsFull = [
    {
      id: 'acceptance',
      title: '١. طبيعة المنصة والموافقة على الشروط',
      content: `مرحباً بكم في منصة وتطبيق إيجي باي (EgyBay). بالوصول إلى التطبيق أو تسجيل حساب أو إتمام عمليات شراء وبيع، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام الخاضعة لقوانين جمهورية مصر العربية (قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ والقانون المدني).

تعمل إيجي باي كمنصة تكنولوجية وسيطة لربط البائعين والمشترين، وتوفير نظام حماية الضمان المالي (Escrow)، وتنسيق الشحن السريع مع بوسطة، والوساطة في النزاعات. إيجي باي ليست مُصنّعاً أو مالكاً للمنتجات المعروضة من البائعين المستقلين.`,
    },
    {
      id: 'escrow',
      title: '٢. نظام الضمان المالي وآليات صرف الأرباح',
      content: `جميع المعاملات التي تتم عبر نظام الدفع في إيجي باي محمية بنظام الضمان المالي الإلزامي ١٠٠٪:

أ. حجز أموال المشتري:
عند قيام المشتري بالطلب، يتم تجميد المبلغ في حساب ضمان آمن ومحايد وإخطار البائع لتجهيز وشحن السلعة.

ب. التحقق عند التسليم (شحن أو تسليم يدوي):
• التوصيل عبر الشحن (بوسطة): يحصل المشتري على مهلة فحص لمدة ٢٤ ساعة للتأكد من مطابقة السلعة للوصف والصور.
• التسليم اليدوي: يعاين المشتري السلعة بنفسه، وعند الرضا التام يسلّم كود الـ PIN للبائع لتحرير المبلغ فوراً.

ج. تحويل مستحقات البائع:
بمجرد إدخال كود PIN أو انتهاء مهلة الفحص دون نزاع، يتم تحويل صافي أرباح البائع مباشرة عبر:
• إنستاباي (InstaPay IPA) — تحويل فوري
• فودافون كاش والمحافظ الذكية — في نفس اليوم
• الحساب البنكي (IBAN) — خلال يوم إلى يومي عمل

د. هيكل العمولات:
تخصم إيجي باي عمولة منصة شفافة (بين ٣٪ إلى ٦٪) تُقتطع تلقائياً من إجمالي مبلغ البيع دون أي رسوم خفية.`,
    },
    {
      id: 'disputes',
      title: '٣. مهلة الفحص وسياسة حل النزاعات والاسترجاع',
      content: `أ. مهلة الفحص (٢٤ ساعة):
يحق للمشتري فحص وتجربة السلعة المستلمة خلال ٢٤ ساعة من تاريخ الاستلام من مندوب الشحن.

ب. فتح نزاع رسمي:
إذا كانت السلعة مقلدة، تالفة، أو غير مطابقة للوصف، يجب على المشتري الضغط على "فتح نزاع" قبل انتهاء مهلة الفحص وإرفاق صور أو فيديو يوضح العيب.

ج. إجراءات الفصل والاسترداد:
• تظل أموال الضمان مجمدة طوال فترة مراجعة النزاع.
• يفحص فريق الامتثال الأدلة وسجلات الشحن خلال ٤٨ ساعة عمل.
• في حال إقرار حق الإرجاع، يتم استرجاع السلعة من المشتري ورد ١٠٠٪ من ثمن السلعة لحسابه فوراً.`,
    },
    {
      id: 'prohibited',
      title: '٤. قائمة السلع والمواد المحظورة قانوناً',
      content: `وفقاً لقانون العقوبات المصري وقوانين مكافحة جرائم تقنية المعلومات، يُحظر تماماً عرض أو تداول أي من السلع التالية، ويتم إيقاف الحساب فوراً وإبلاغ مباحث الإنترنت:

١. الأسلحة النارية والبيضاء، الذخائر، والمعدات العسكرية.
٢. المنتجات المقلدة أو المنسوخة (Fake / Replica) المنتهكة للملكية الفكرية.
٣. الإلكترونيات المهربة أو غير المسددة للجمارك والضرائب المصرية.
٤. المواد المخدرة، الأدوية والعقاقير الطبية، والمكملات غير المرخصة.
٥. الحسابات الرقمية المخترقة، والبرمجيات المقرصنة، والبيانات المسربة.
٦. المواد الكيميائية الخطرة والمفرقعات.`,
    },
    {
      id: 'seller-obligations',
      title: '٥. التزامات البائع والتحقق من الهوية (KYC)',
      content: `أ. التحقق من الهوية:
يلتزم البائع بإدخال بيانات بطاقة الرقم القومي المصري (١٤ رقماً) وتأكيد حساب السحب قبل استلام أرباح المبيعات.

ب. دقة وصحة بيانات الإعلان:
يلتزم البائع بتوضيح حالة السلعة، نسبة كفاءة البطارية، وحالة الضمان، وأي عيوب بوضوح. تقديم صور مضللة يعد مخالفة صريحة.

ج. سرعة الشحن:
يلتزم البائع بتسليم الطرد لمندوب الشحن خلال ٤٨ ساعة من تأكيد الطلب.`,
    },
    {
      id: 'live-terms',
      title: '٦. شروط البث المباشر (EgyBay Live)',
      content: `• ميزة البث المباشر متاحة للبائعين الموثقين عبر شراء باقات البث (Flash / Pro / Mega).
• رسوم الباقة تُخصم مسبقاً من محفظة البائع.
• يُحظر تماماً بث أي محتوى خادع أو غير لائق أو مخالف للآداب العامة.
• جميع المبيعات داخل البث تخضع لنظام الضمان المالي وحماية المشتري والبائع.`,
    },
    {
      id: 'liability',
      title: '٧. إخلاء المسؤولية والحد القانوني',
      content: `تقدم إيجي باي خدماتها وفق أعلى معايير الأمان التكنولوجي والضمان المالي. لا تتحمل المنصة مسؤولية أي تعاملات مالية أو اتفاقات تتم خارج نظام الضمان المالي الرسمي للتطبيق. المعاملات الخارجية تفقد كافة حقوق الحماية والتعويض.`,
    },
  ];

  const enSectionsFull = [
    {
      id: 'acceptance',
      title: '1. Platform Role & Acceptance of Agreement',
      content: `Welcome to EgyBay. By accessing the mobile application, registering an account, or conducting transactions, you enter into a legally binding agreement under the laws of the Arab Republic of Egypt (Consumer Protection Law No. 181/2018 and Civil Code).

EgyBay acts strictly as an intermediary technology platform providing peer-to-peer listing tools, integrated escrow payment safeguards, courier logistics coordination with Bosta, and dispute mediation. EgyBay is not the manufacturer, retailer, or physical owner of items listed by independent sellers.`,
    },
    {
      id: 'escrow',
      title: '2. Escrow Protection & Payout Mechanics',
      content: `All transactions conducted through EgyBay's checkout are protected by our mandatory 100% Escrow Protection System:

A. Buyer Payment Holding:
When a buyer purchases an item, funds are immediately secured in a neutral escrow holding ledger. The seller is notified to prepare and dispatch the item.

B. Courier & In-Person PIN Verification:
• Courier Delivery (Bosta): Upon delivery, the buyer receives a 24-hour inspection window to verify that the item matches the seller's photos and description.
• In-Person Meetup: The buyer inspects the item physically, and upon total satisfaction, provides the confidential PIN to the seller to authorize instantaneous fund release.

C. Seller Payout Execution:
Upon PIN confirmation or inspection window expiry without dispute, seller net proceeds are transferred directly to their registered Egyptian payout method:
• InstaPay (Instant Transfer via IPA)
• Vodafone Cash / Smart Wallet (Same-Day)
• Egyptian Bank IBAN (1–2 Business Days)

D. Fee Structure:
EgyBay charges a transparent marketplace platform commission (between 3% to 6%) automatically deducted from the seller's gross payout. There are no hidden fees.`,
    },
    {
      id: 'disputes',
      title: '3. Inspection Window & Dispute Resolution',
      content: `A. 24-Hour Buyer Inspection Window:
Buyers are entitled to thoroughly test and inspect delivered goods within 24 hours of package receipt.

B. Filing a Dispute:
If an item is counterfeit, damaged in transit, or significantly not as described, the buyer must click "Open Dispute" before the inspection window closes and upload clear photographic or video evidence.

C. Mediation & Refund Protocol:
• Escrow funds remain frozen during active dispute reviews.
• EgyBay's compliance team assesses courier weight logs, condition evidence, and chat records within 48 business hours.
• In the event of a justified return, a return courier pickup is scheduled, and 100% of the item price is refunded to the buyer.`,
    },
    {
      id: 'prohibited',
      title: '4. Prohibited & Illegal Goods Policy',
      content: `In strict compliance with Egyptian Penal Law and Trade Regulations, the listing or exchange of any of the following items is strictly prohibited and subject to immediate account termination and reporting to the Egyptian Cybercrime Department (مباحث الإنترنت):

1. Weapons, firearms, ammunition, and military equipment.
2. Counterfeit, replica, or unauthorized trademark knockoffs.
3. Smuggled or non-tax-paid electronics without official customs clearance.
4. Narcotics, pharmaceuticals, and uncertified supplements.
5. Stolen property, pirated software, and leaked credentials.
6. Hazardous chemicals and explosives.`,
    },
    {
      id: 'seller-obligations',
      title: '5. Seller Obligations & Identity Verification (KYC)',
      content: `A. Identity Verification:
Sellers must provide valid Egyptian National ID details (14 digits) and verified payout channels prior to receiving disbursements.

B. Listing Accuracy:
Sellers must disclose all cosmetic flaws, battery health, warranty status, and included accessories clearly.

C. Order Fulfillment:
Sellers must dispatch sold items via our integrated courier partner within 48 hours of order placement.`,
    },
    {
      id: 'live-terms',
      title: '6. Live Streaming Terms (EgyBay Live)',
      content: `• Live stream selling is available to verified merchants through Live Pass bookings (Flash / Pro / Mega).
• Pass fees are collected in advance from the seller wallet.
• Fraudulent, misleading, or inappropriate stream content is strictly prohibited and leads to immediate stream termination.
• All live sales are protected by our mandatory Escrow system.`,
    },
    {
      id: 'liability',
      title: '7. Limitation of Liability & Force Majeure',
      content: `EgyBay provides its marketplace platform on an "as-is" and "as-available" basis. While we enforce rigorous escrow safeguards and seller verification, all transactions conducted outside EgyBay's escrow checkout forfeit all platform buyer and seller protections.`,
    },
  ];

  // While PAYMENTS_ENABLED is false there is no escrow, no payout, no
  // Bosta-integrated shipping and no dispute process to describe -- so those
  // sections are replaced rather than left describing a system that is not
  // running (see PLAN-CLASSIFIEDS-MODE.md). The prohibited-goods policy is
  // untouched: it has nothing to do with payments.
  // Reused verbatim except renumbered: it's item 4 of 7 in the full terms
  // but item 3 of 4 here.
  const prohibitedAr = { ...arSectionsFull.find(s => s.id === 'prohibited')!, title: '٤. قائمة السلع والمواد المحظورة قانوناً' };
  const prohibitedEn = { ...enSectionsFull.find(s => s.id === 'prohibited')!, title: '4. Prohibited & Illegal Goods Policy' };

  const arSectionsClassifieds = [
    {
      id: 'acceptance',
      title: '١. طبيعة المنصة والموافقة على الشروط',
      content: `مرحباً بكم في منصة وتطبيق إيجي باي (EgyBay). بالوصول إلى التطبيق أو تسجيل حساب أو نشر إعلانات، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام الخاضعة لقوانين جمهورية مصر العربية (قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ والقانون المدني).

تعمل إيجي باي كمنصة تكنولوجية وسيطة لربط البائعين والمشترين عبر الإعلانات والدردشة داخل التطبيق. إيجي باي ليست مُصنّعاً أو مالكاً للمنتجات المعروضة من البائعين المستقلين.`,
    },
    {
      id: 'no-payments',
      title: '٢. لا تقوم إيجي باي بمعالجة المدفوعات حالياً',
      content: `إيجي باي لا تُجري أو تُعالج أي عملية دفع بين المستخدمين في الوقت الحالي. يتفق المشتري والبائع مباشرة على السعر وطريقة الدفع وتسليم السلعة خارج التطبيق.

إيجي باي ليست طرفاً في هذا الاتفاق ولا تتحمل مسؤولية أي خسارة مالية أو نزاع ينشأ عنه. راجع صفحة "نصائح الأمان" داخل التطبيق قبل إتمام أي صفقة.`,
    },
    {
      id: 'live',
      title: '٣. البث المباشر (EgyBay Live)',
      content: `• يمكن للبائعين عرض منتجاتهم في بث مباشر داخل التطبيق. البث مجاني حالياً؛ سنُعلم المستخدمين قبل أي تغيير في ذلك.
• يُحظر بث أي محتوى خادع أو غير لائق أو مخالف للآداب العامة أو يعرض سلعاً محظورة، ويُنهى البث ويُوقف الحساب عند المخالفة.
• المشاهدون يمكنهم الإبلاغ عن أي بث من زر الإبلاغ داخل شاشة البث.
• الاتفاق على أي سلعة تُعرض في البث يتم عبر الدردشة وخارج التطبيق، كما في باقي الإعلانات.`,
    },
    prohibitedAr,
    {
      id: 'liability',
      title: '٥. إخلاء المسؤولية',
      content: `تقدم إيجي باي أدوات الإعلان والتواصل فقط. جميع الاتفاقات المالية وعمليات التسليم تتم بالكامل خارج التطبيق وعلى مسؤولية طرفي الصفقة.`,
    },
  ];

  const enSectionsClassifieds = [
    {
      id: 'acceptance',
      title: '1. Platform Role & Acceptance of Agreement',
      content: `Welcome to EgyBay. By accessing the mobile application, registering an account, or posting a listing, you enter into a legally binding agreement under the laws of the Arab Republic of Egypt (Consumer Protection Law No. 181/2018 and Civil Code).

EgyBay acts strictly as an intermediary technology platform connecting buyers and sellers through listings and in-app chat. EgyBay is not the manufacturer, retailer, or physical owner of items listed by independent sellers.`,
    },
    {
      id: 'no-payments',
      title: '2. EgyBay Does Not Process Payments Right Now',
      content: `EgyBay does not run or process any payment between users at this time. The buyer and seller agree directly on price, payment method, and handover, outside the app.

EgyBay is not a party to that agreement and is not responsible for any financial loss or dispute arising from it. See the in-app "Safety tips" page before completing a deal.`,
    },
    {
      id: 'live',
      title: '3. Live Streaming (EgyBay Live)',
      content: `• Sellers may show their items in a live stream inside the app. Streaming is free at the moment; users will be told before that changes.
• Deceptive, inappropriate or indecent content, or the display of prohibited goods, is not allowed on a stream and ends it and the account.
• Viewers can report any stream from the report button on the stream screen.
• Any deal on an item shown in a stream is agreed in chat and completed outside the app, exactly like every other listing.`,
    },
    prohibitedEn,
    {
      id: 'liability',
      title: '5. Limitation of Liability',
      content: `EgyBay provides listing and messaging tools only. All financial agreements and handovers take place entirely outside the app and at the parties' own risk.`,
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
          {PAYMENTS_ENABLED
            ? (isRTL ? 'الشروط والأحكام والضمان' : 'Terms & Escrow Agreement')
            : (isRTL ? 'الشروط والأحكام' : 'Terms of Service')}
        </Text>
        {/* Language Switcher */}
        <TouchableOpacity
          onPress={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
          style={styles.langBtn}
        >
          <Globe color="#2563EB" size={14} />
          <Text style={styles.langBtnText}>{isRTL ? 'English' : 'عربي'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.badgeWrap}>
          <Scale color="#2563EB" size={32} />
          <Text style={styles.mainTitle}>
            {PAYMENTS_ENABLED
              ? (isRTL ? 'شروط استخدام منصة إيجي باي والضمان المالي' : 'EgyBay Terms of Service & Escrow Agreement')
              : (isRTL ? 'شروط استخدام منصة إيجي باي' : 'EgyBay Terms of Service')}
          </Text>
          <Text style={styles.dateText}>
            {isRTL ? 'آخر تحديث: أغسطس ٢٠٢٦' : 'Last updated: August 2026'}
          </Text>
        </View>

        {/* Highlights */}
        <View style={styles.highlightRow}>
          <View style={styles.highlightCard}>
            {PAYMENTS_ENABLED ? (
              <>
                <ShieldCheck color="#10B981" size={18} />
                <Text style={styles.highlightTitle}>
                  {isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow'}
                </Text>
                <Text style={styles.highlightSub}>
                  {isRTL ? 'حجز الأموال حتى الفحص' : 'Funds held safely'}
                </Text>
              </>
            ) : (
              <>
                <MessageCircle color="#2563EB" size={18} />
                <Text style={styles.highlightTitle}>
                  {isRTL ? 'دردشة مباشرة' : 'Direct chat'}
                </Text>
                <Text style={styles.highlightSub}>
                  {isRTL ? 'تواصل مباشر مع الطرف الآخر' : 'Talk to the other person directly'}
                </Text>
              </>
            )}
          </View>
          <View style={styles.highlightCard}>
            <FileText color="#2563EB" size={18} />
            <Text style={styles.highlightTitle}>
              {isRTL ? 'قانون ١٨١ لسنة ٢٠١٨' : 'Law 181/2018'}
            </Text>
            <Text style={styles.highlightSub}>
              {isRTL ? 'حماية المستهلك' : 'Consumer Protection'}
            </Text>
          </View>
          <View style={styles.highlightCard}>
            <AlertOctagon color="#F59E0B" size={18} />
            <Text style={styles.highlightTitle}>
              {isRTL ? 'منع التقليد' : 'Zero Fake'}
            </Text>
            <Text style={styles.highlightSub}>
              {isRTL ? 'مكافحة الغش' : 'Anti-Fraud'}
            </Text>
          </View>
        </View>

        {/* Sections */}
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

        {/* Legal Contact Box */}
        <View style={styles.supportCard}>
          <Text style={[styles.supportTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'الدعم القانوني وحل النزاعات' : 'Legal Support & Disputes'}
          </Text>
          <Text style={[styles.supportText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'لأي استفسارات قانونية أو متابعة نزاع، يرجى مراسلة فريق الامتثال القانوني مباشرة عبر:'
              : 'For legal questions or dispute follow-ups, contact our compliance team at:'}
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
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  langBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
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
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
    gap: 8,
  },
  supportTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF' },
  supportText: { fontSize: 12, color: '#3B82F6', lineHeight: 18 },
  mailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  mailBtnText: { fontSize: 13, fontWeight: '800', color: 'white' },
});
