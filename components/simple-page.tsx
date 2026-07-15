'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { AppSettings, useAppStore } from '@/lib/app-store'
import { useSharedAppData } from '@/lib/use-shared-app-data'

type PageKind = 'about' | 'contact' | 'faq' | 'privacy' | 'terms' | 'refund' | 'complaints'
type LocalizedSimplePage = {
  title: string
  sections: {
    title: string
    body?: string[]
    list?: string[]
  }[]
}

const pages: Record<PageKind, Record<'ar' | 'en', LocalizedSimplePage>> = {
  about: {
    ar: {
      title: 'عن رانش',
      sections: [
        {
          title: 'قصتنا',
          body: [
            'تأسست رانش برسالة بسيطة: تقديم طعام طازج ولذيذ يصل إلى بابك بسرعة وتجربة طلب سهلة.',
            'نمزج بين جودة المكونات، سرعة التحضير، وخدمة توصيل موثوقة لتكون كل وجبة تجربة مريحة وممتعة.',
          ],
        },
        {
          title: 'لماذا تختارنا؟',
          list: ['مكونات طازجة', 'توصيل سريع', 'أسعار مناسبة', 'تتبع فوري للطلب', 'خدمة عملاء ودودة'],
        },
      ],
    },
    en: {
      title: 'About Ranch',
      sections: [
        {
          title: 'Our Story',
          body: [
            'Ranch was built around a simple promise: fresh, delicious food delivered quickly through an effortless ordering experience.',
            'We combine quality ingredients, fast preparation, and reliable delivery so every order feels smooth from start to finish.',
          ],
        },
        {
          title: 'Why Choose Us?',
          list: ['Fresh ingredients', 'Fast delivery', 'Competitive prices', 'Real-time order tracking', 'Friendly support'],
        },
      ],
    },
  },
  contact: {
    ar: {
      title: 'اتصل بنا',
      sections: [
        { title: 'معلومات التواصل', body: ['الهاتف: 01000000000', 'البريد الإلكتروني: info@ranch.com', 'العنوان: القاهرة، مصر'] },
        { title: 'أوقات العمل', body: ['الاثنين إلى الجمعة: 10 صباحًا - 11 مساءً', 'السبت والأحد: 10 صباحًا - 12 منتصف الليل'] },
      ],
    },
    en: {
      title: 'Contact Us',
      sections: [
        { title: 'Contact Information', body: ['Phone: 01000000000', 'Email: info@ranch.com', 'Address: Cairo, Egypt'] },
        { title: 'Working Hours', body: ['Monday - Friday: 10 AM - 11 PM', 'Saturday - Sunday: 10 AM - 12 AM'] },
      ],
    },
  },
  faq: {
    ar: {
      title: 'الأسئلة الشائعة',
      sections: [
        { title: 'كم وقت التوصيل؟', body: ['وقت التوصيل القياسي 30 دقيقة أو أقل بعد تأكيد الطلب.'] },
        { title: 'ما طرق الدفع المتاحة؟', body: ['نقبل الدفع عند الاستلام وVodafone Cash وInstaPay.'] },
        { title: 'كيف أتتبع طلبي؟', body: ['يمكنك تتبع طلبك في الوقت الفعلي من صفحة الطلبات أو صفحة تتبع الطلب.'] },
      ],
    },
    en: {
      title: 'Frequently Asked Questions',
      sections: [
        { title: 'How long does delivery take?', body: ['Standard delivery takes 30 minutes or less after order confirmation.'] },
        { title: 'What payment methods are available?', body: ['We accept cash on delivery, Vodafone Cash, and InstaPay.'] },
        { title: 'How can I track my order?', body: ['You can track your order in real time from the orders or tracking page.'] },
      ],
    },
  },
  privacy: {
    ar: {
      title: 'سياسة الخصوصية',
      sections: [
        { title: '1. مقدمة', body: ['نحترم خصوصيتك ونوضح هنا كيف نجمع ونستخدم ونحمي بياناتك عند استخدام رانش.'] },
        { title: '2. البيانات التي نجمعها', list: ['بيانات التواصل', 'عنوان التوصيل', 'بيانات الاستخدام', 'معلومات الدفع الآمنة'] },
        { title: '3. تواصل معنا', body: ['لأي استفسار حول الخصوصية تواصل معنا على info@ranch.com.'] },
      ],
    },
    en: {
      title: 'Privacy Policy',
      sections: [
        { title: '1. Introduction', body: ['We respect your privacy and explain how Ranch collects, uses, and protects your data.'] },
        { title: '2. Data We Collect', list: ['Contact details', 'Delivery address', 'Usage data', 'Secure payment information'] },
        { title: '3. Contact Us', body: ['For privacy questions, contact us at info@ranch.com.'] },
      ],
    },
  },
  terms: {
    ar: {
      title: 'الشروط والأحكام',
      sections: [
        { title: '1. الشروط', body: ['باستخدام رانش، فإنك توافق على سياسات الطلب والدفع والتوصيل والاستخدام.'] },
        { title: '2. الاستخدام', body: ['يجب استخدام التطبيق للطلبات الشخصية والمشروعة فقط، مع تقديم بيانات طلب صحيحة.'] },
        { title: '3. تواصل معنا', body: ['لأي سؤال حول الشروط تواصل معنا على info@ranch.com.'] },
      ],
    },
    en: {
      title: 'Terms & Conditions',
      sections: [
        { title: '1. Terms', body: ['By using Ranch, you agree to our ordering, payment, delivery, and usage policies.'] },
        { title: '2. Usage', body: ['Use the app only for lawful personal orders and provide accurate order information.'] },
        { title: '3. Contact Us', body: ['For questions about these terms, contact us at info@ranch.com.'] },
      ],
    },
  },
  refund: {
    ar: {
      title: 'سياسة الاسترجاع',
      sections: [
        { title: '1. شروط الاسترجاع', list: ['تقديم الطلب خلال 48 ساعة', 'وجود سبب واضح', 'توفير رقم الطلب وصور المشكلة إن وجدت'] },
        { title: '2. المعالجة', body: ['تتم مراجعة طلبات الاسترجاع ومعالجتها خلال 5 إلى 7 أيام عمل.'] },
        { title: '3. تواصل معنا', body: ['للاستفسارات: refunds@ranch.com أو 01000000000.'] },
      ],
    },
    en: {
      title: 'Refund Policy',
      sections: [
        { title: '1. Refund Conditions', list: ['Submit within 48 hours', 'Provide a clear reason', 'Include order number and photos when available'] },
        { title: '2. Processing', body: ['Refund requests are reviewed and processed within 5-7 business days.'] },
        { title: '3. Contact Us', body: ['For refund questions: refunds@ranch.com or 01000000000.'] },
      ],
    },
  },
  complaints: {
    ar: {
      title: 'تقديم شكوى',
      sections: [
        { title: 'اختر نوع الشكوى', list: ['مشكلة في جودة الطلب', 'تأخير في التسليم', 'طلب استرجاع قيمة الطلب', 'مشكلة في الدفع أو الإيصال'] },
        { title: 'بيانات مطلوبة', list: ['رقم الطلب', 'رقم الهاتف', 'وصف واضح للمشكلة', 'صورة أو إيصال عند الحاجة'] },
        { title: 'المراجعة', body: ['يتم فحص الشكوى أولا، وإذا كان الحل المناسب هو الاسترجاع يتم تحويلها كطلب استرجاع ومتابعتها مع العميل.'] },
      ],
    },
    en: {
      title: 'Submit Complaint',
      sections: [
        { title: 'Choose Complaint Type', list: ['Order quality issue', 'Delivery delay', 'Refund request', 'Payment or receipt issue'] },
        { title: 'Required Details', list: ['Order number', 'Phone number', 'Clear issue description', 'Photo or receipt when needed'] },
        { title: 'Review', body: ['The complaint is reviewed first. If a refund is the right resolution, it is handled as a refund request and followed up with the customer.'] },
      ],
    },
  },
}

function buildSimplePage(kind: PageKind, language: 'ar' | 'en', settings: AppSettings, appName: string): LocalizedSimplePage {
  const isArabic = language === 'ar'
  const restaurantName = isArabic ? settings.restaurantNameAr || appName : settings.restaurantNameEn || appName
  const address = isArabic ? settings.addressAr : settings.addressEn
  const workingHours = isArabic ? settings.workingHoursAr : settings.workingHoursEn
  const contactLines = [
    `${isArabic ? 'الهاتف' : 'Phone'}: ${settings.phone || '-'}`,
    `${isArabic ? 'البريد الإلكتروني' : 'Email'}: ${settings.email || '-'}`,
    `${isArabic ? 'العنوان' : 'Address'}: ${address || '-'}`,
  ]
  const paymentLines = [
    isArabic ? 'الدفع عند الاستلام' : 'Cash on delivery',
    settings.vodafoneCashNumber ? `${isArabic ? 'فودافون كاش' : 'Vodafone Cash'}: ${settings.vodafoneCashNumber}` : '',
    settings.instapayNumber ? `${isArabic ? 'إنستاباي' : 'InstaPay'}: ${settings.instapayNumber}` : '',
  ].filter(Boolean)

  const dynamicPages: Record<PageKind, LocalizedSimplePage> = isArabic
    ? {
        about: {
          title: `عن ${restaurantName}`,
          sections: [
            { title: 'من نحن', body: [`${restaurantName} يقدم تجربة طلب واضحة وسريعة من بيانات المطعم الحالية.`] },
            { title: 'ما نوفره', list: ['قائمة محدثة من لوحة التحكم', 'طلبات موثقة من السيرفر', 'توصيل ومتابعة حالة الطلب'] },
          ],
        },
        contact: {
          title: 'اتصل بنا',
          sections: [
            { title: 'معلومات التواصل', body: contactLines },
            { title: 'ساعات العمل', body: [workingHours || '-'] },
          ],
        },
        faq: {
          title: 'الأسئلة الشائعة',
          sections: [
            { title: 'كم يستغرق التوصيل؟', body: [`متوسط وقت التوصيل ${settings.deliveryTime || 30} دقيقة بعد تأكيد الطلب.`] },
            { title: 'ما طرق الدفع المتاحة؟', list: paymentLines },
            { title: 'كيف أتابع طلبي؟', body: ['يمكن متابعة الطلب من صفحة الطلبات باستخدام بيانات الطلب المسجلة.'] },
          ],
        },
        privacy: {
          title: 'سياسة الخصوصية',
          sections: [
            { title: 'البيانات التي نجمعها', list: ['بيانات التواصل', 'عنوان التوصيل', 'تفاصيل الطلب', 'إيصال الدفع عند رفعه'] },
            { title: 'استخدام البيانات', body: ['تستخدم البيانات لتنفيذ الطلبات، التواصل مع العميل، وتحسين الخدمة فقط.'] },
            { title: 'التواصل', body: contactLines },
          ],
        },
        terms: {
          title: 'الشروط والأحكام',
          sections: [
            { title: 'استخدام الخدمة', body: [`باستخدام ${restaurantName} أنت توافق على سياسات الطلب والدفع والتوصيل الخاصة بالمطعم.`] },
            { title: 'الطلبات والدفع', body: ['يجب إدخال بيانات صحيحة، وتأكيد الدفع عند اختيار طريقة دفع تتطلب إيصالا.'] },
            { title: 'التواصل', body: contactLines },
          ],
        },
        refund: {
          title: 'سياسة الاسترجاع',
          sections: [
            { title: 'الشروط', list: ['وجود رقم طلب صحيح', 'توضيح سبب الاسترجاع', 'إرفاق صورة أو إيصال عند الحاجة'] },
            { title: 'المعالجة', body: ['تتم مراجعة طلبات الاسترجاع حسب حالة الطلب وطريقة الدفع المسجلة.'] },
            { title: 'التواصل', body: contactLines },
          ],
        },
        complaints: {
          title: 'تقديم شكوى',
          sections: [
            { title: 'نوع الشكوى', list: ['مشكلة في جودة الطلب', 'تأخير في التسليم', 'طلب استرجاع قيمة الطلب', 'مشكلة في الدفع أو الإيصال'] },
            { title: 'طريقة التقديم', body: [`تواصل معنا على ${settings.phone || '-'} مع رقم الطلب وتفاصيل المشكلة. سيتم تحويل الشكوى لاسترجاع إذا كانت الحالة تستدعي ذلك.`] },
            { title: 'بيانات التواصل', body: contactLines },
          ],
        },
      }
    : {
        about: {
          title: `About ${restaurantName}`,
          sections: [
            { title: 'Who We Are', body: [`${restaurantName} provides a clear, fast ordering experience using the current restaurant settings.`] },
            { title: 'What We Offer', list: ['Dashboard-managed menu', 'Server-backed orders', 'Delivery and order tracking'] },
          ],
        },
        contact: {
          title: 'Contact Us',
          sections: [
            { title: 'Contact Information', body: contactLines },
            { title: 'Working Hours', body: [workingHours || '-'] },
          ],
        },
        faq: {
          title: 'Frequently Asked Questions',
          sections: [
            { title: 'How long does delivery take?', body: [`Average delivery time is ${settings.deliveryTime || 30} minutes after confirmation.`] },
            { title: 'What payment methods are available?', list: paymentLines },
            { title: 'How can I track my order?', body: ['You can track your order from the orders page using the saved order details.'] },
          ],
        },
        privacy: {
          title: 'Privacy Policy',
          sections: [
            { title: 'Data We Collect', list: ['Contact details', 'Delivery address', 'Order details', 'Uploaded payment receipts'] },
            { title: 'How We Use Data', body: ['Data is used to fulfill orders, contact customers, and improve service.'] },
            { title: 'Contact', body: contactLines },
          ],
        },
        terms: {
          title: 'Terms & Conditions',
          sections: [
            { title: 'Using the Service', body: [`By using ${restaurantName}, you agree to the restaurant ordering, payment, and delivery policies.`] },
            { title: 'Orders and Payment', body: ['Please provide accurate details and confirm payment when a receipt-based method is selected.'] },
            { title: 'Contact', body: contactLines },
          ],
        },
        refund: {
          title: 'Refund Policy',
          sections: [
            { title: 'Conditions', list: ['Valid order number', 'Clear refund reason', 'Photo or receipt when needed'] },
            { title: 'Processing', body: ['Refund requests are reviewed according to the order status and recorded payment method.'] },
            { title: 'Contact', body: contactLines },
          ],
        },
        complaints: {
          title: 'Submit Complaint',
          sections: [
            { title: 'Complaint Type', list: ['Order quality issue', 'Delivery delay', 'Refund request', 'Payment or receipt issue'] },
            { title: 'How to Submit', body: [`Contact us at ${settings.phone || '-'} with the order number and issue details. The complaint will be converted to a refund request if the case requires it.`] },
            { title: 'Contact Details', body: contactLines },
          ],
        },
      }

  return dynamicPages[kind] || pages[kind][language]
}

export function SimplePage({ kind }: { kind: PageKind }) {
  useSharedAppData()
  const { language, appName, t } = useLanguage()
  const settings = useAppStore((state) => state.settings)
  const page = buildSimplePage(kind, language, settings, appName)

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
              <span className="text-xl font-bold text-red-600">{appName}</span>
            </Link>
            <Link href="/">
              <Button variant="ghost">{t('backHome')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-4xl font-bold">{page.title}</h1>
        <div className="space-y-6">
          {page.sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-600 dark:text-slate-400">
                {section.body?.map((line) => <p key={line}>{line}</p>)}
                {section.list && (
                  <ul className="space-y-2">
                    {section.list.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="text-red-600">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
