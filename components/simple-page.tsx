'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { useAppStore } from '@/lib/app-store'
import { useSharedAppData } from '@/lib/use-shared-app-data'

type PageKind = 'about' | 'contact' | 'faq' | 'privacy' | 'terms' | 'refund'
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
}

export function SimplePage({ kind }: { kind: PageKind }) {
  useSharedAppData()
  const { language, appName, t } = useLanguage()
  const settings = useAppStore((state) => state.settings)
  const page = pages[kind][language]
  const contactPage = kind === 'contact'
    ? {
        ...page,
        sections: [
          {
            title: language === 'ar' ? 'معلومات التواصل' : 'Contact Information',
            body: [
              `${language === 'ar' ? 'الهاتف' : 'Phone'}: ${settings.phone}`,
              `${language === 'ar' ? 'البريد الإلكتروني' : 'Email'}: ${settings.email}`,
              `${language === 'ar' ? 'العنوان' : 'Address'}: ${language === 'ar' ? settings.addressAr : settings.addressEn}`,
            ],
          },
          {
            title: language === 'ar' ? 'أوقات العمل' : 'Working Hours',
            body: [language === 'ar' ? settings.workingHoursAr : settings.workingHoursEn],
          },
        ],
      }
    : page

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
        <h1 className="mb-8 text-4xl font-bold">{contactPage.title}</h1>
        <div className="space-y-6">
          {contactPage.sections.map((section) => (
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
