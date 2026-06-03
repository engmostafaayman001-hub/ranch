'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { APP_NAME_AR, APP_NAME_EN } from '@/lib/constants'

type Language = 'ar' | 'en'

const translations = {
  ar: {
    home: 'الرئيسية',
    menu: 'القائمة',
    cart: 'السلة',
    profile: 'الملف الشخصي',
    orders: 'الطلبات',
    trackOrder: 'تتبع الطلب',
    logout: 'تسجيل الخروج',
    login: 'دخول',
    register: 'تسجيل',
    backHome: 'العودة للرئيسية',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
    aboutUs: 'من نحن',
    contactUs: 'اتصل بنا',
    faq: 'الأسئلة الشائعة',
    privacy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
    refund: 'سياسة الاسترجاع',
    order: 'اطلب الآن',
    hungry: 'جوعان؟',
    startOrder: 'ابدأ الطلب الآن',
    whyChoose: 'لماذا تختار',
    fastDelivery: 'توصيل سريع',
    freshFood: 'طعام طازج',
    greatPrices: 'أسعار رائعة',
    featured: 'الأكثر مبيعًا',
    loginToAccount: 'تسجيل الدخول إلى حسابك',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب بالفعل؟',
    createAccount: 'إنشاء حساب',
    signUpHere: 'سجل هنا',
    signInHere: 'ادخل هنا',
    downloadApp: 'نزّل التطبيق الآن',
    installApp: 'ثبّت التطبيق الآن',
    installNow: 'ثبّت التطبيق',
    notNow: 'ليس الآن',
    installing: 'جاري التثبيت...',
    getBestExperience: 'احصل على أفضل تجربة مع التطبيق المثبت',
    instantAccess: 'وصول فوري بضغطة واحدة',
    offlineSupport: 'يعمل جزئيًا بدون إنترنت',
    notifications: 'إشعارات فورية للطلبات',
    smallSize: 'لا يشغل مساحة كبيرة',
    aboutTitle: 'عن رانش',
    contactTitle: 'اتصل بنا',
    faqTitle: 'الأسئلة الشائعة',
  },
  en: {
    home: 'Home',
    menu: 'Menu',
    cart: 'Cart',
    profile: 'Profile',
    orders: 'Orders',
    trackOrder: 'Track Order',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    backHome: 'Back Home',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    aboutUs: 'About Us',
    contactUs: 'Contact Us',
    faq: 'FAQ',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    refund: 'Refund Policy',
    order: 'Order Now',
    hungry: 'Hungry?',
    startOrder: 'Start Order Now',
    whyChoose: 'Why Choose',
    fastDelivery: 'Fast Delivery',
    freshFood: 'Fresh Food',
    greatPrices: 'Great Prices',
    featured: 'Best Sellers',
    loginToAccount: 'Login to Your Account',
    email: 'Email Address',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    createAccount: 'Create Account',
    signUpHere: 'Sign Up Here',
    signInHere: 'Sign In Here',
    downloadApp: 'Download App Now',
    installApp: 'Install App Now',
    installNow: 'Install App',
    notNow: 'Not Now',
    installing: 'Installing...',
    getBestExperience: 'Get the best experience with the installed app',
    instantAccess: 'Instant access with one tap',
    offlineSupport: 'Works partially without internet',
    notifications: 'Instant notifications for orders',
    smallSize: "Doesn't take much space",
    aboutTitle: 'About Ranch',
    contactTitle: 'Contact Us',
    faqTitle: 'Frequently Asked Questions',
  },
}

interface LanguageContextType {
  language: Language
  appName: string
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  t: (key: keyof typeof translations.ar) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function applyLanguage(language: Language) {
  localStorage.setItem('language', language)
  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar')

  useEffect(() => {
    const stored = localStorage.getItem('language') as Language | null
    const initial = stored || 'ar'
    applyLanguage(initial)
    queueMicrotask(() => setLanguageState(initial))
  }, [])

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    applyLanguage(nextLanguage)
  }

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar')
  }

  const t = (key: keyof typeof translations.ar): string => translations[language][key] || translations.ar[key]
  const appName = language === 'ar' ? APP_NAME_AR : APP_NAME_EN

  return (
    <LanguageContext.Provider value={{ language, appName, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
