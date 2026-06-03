'use client'

import { createContext, useContext, useState, useEffect } from 'react'
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
    backHome: '← الصفحة الرئيسية',
    lightMode: '☀️ الوضع الفاتح',
    darkMode: '🌙 الوضع الداكن',
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
    featured: 'أكثر المنتجات مبيعًا',
    loginToAccount: 'تسجيل الدخول إلى حسابك',
    email: 'عنوان البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'هل لديك حساب بالفعل؟',
    createAccount: 'إنشاء الحساب',
    signUpHere: 'قم بالتسجيل هنا',
    signInHere: 'تسجيل الدخول هنا',
    downloadApp: 'نزّل التطبيق الآن',
    installApp: 'ثبّت التطبيق الآن',
    installNow: 'ثبّت التطبيق',
    notNow: 'ليس الآن',
    installing: 'جاري التثبيت...',
    getBestExperience: 'احصل على أفضل تجربة مع التطبيق المثبت',
    instantAccess: 'وصول فوري بضغطة واحدة',
    offlineSupport: 'يعمل بدون إنترنت جزئيًا',
    notifications: 'اشعارات فورية للطلبات',
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
    backHome: '← Back Home',
    lightMode: '☀️ Light Mode',
    darkMode: '🌙 Dark Mode',
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
  toggleLanguage: () => void
  t: (key: keyof typeof translations.ar) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('language') as Language | null
    if (stored) {
      setLanguage(stored)
      document.documentElement.lang = stored
      document.documentElement.dir = stored === 'ar' ? 'rtl' : 'ltr'
    }
  }, [])

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    localStorage.setItem('language', newLang)
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
  }

  const t = (key: keyof typeof translations.ar): string => {
    return translations[language][key] || translations.ar[key]
  }
  const appName = language === 'ar' ? APP_NAME_AR : APP_NAME_EN

  return (
    <LanguageContext.Provider value={{ language, appName, toggleLanguage, t }}>
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
