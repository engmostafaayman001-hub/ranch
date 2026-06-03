import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { ROUTES } from '@/lib/constants'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const links = [
    { href: ROUTES.DASHBOARD, label: 'نظرة عامة', icon: '📊' },
    { href: ROUTES.DASHBOARD_ORDERS, label: 'الطلبات والتتبع', icon: '📦' },
    { href: ROUTES.DASHBOARD_PRODUCTS, label: 'المنتجات', icon: '🍔' },
    { href: ROUTES.DASHBOARD_CUSTOMERS, label: 'العملاء', icon: '👥' },
    { href: ROUTES.DASHBOARD_TEAM, label: 'الفريق', icon: '🧑‍🍳' },
    { href: ROUTES.DASHBOARD_DELIVERY, label: 'التوصيل', icon: '🛵' },
    { href: ROUTES.DASHBOARD_PAYMENTS, label: 'المدفوعات', icon: '💳' },
    { href: ROUTES.DASHBOARD_NOTIFICATIONS, label: 'العروض والإشعارات', icon: '🔔' },
    { href: ROUTES.DASHBOARD_POS, label: 'نقطة البيع', icon: '🧾' },
    { href: ROUTES.DASHBOARD_REPORTS, label: 'التقارير', icon: '📈' },
    { href: ROUTES.DASHBOARD_SETTINGS, label: 'الإعدادات', icon: '⚙' },
  ]

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden w-72 shrink-0 bg-slate-950 p-6 text-white lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <Logo size="md" />
          <div>
            <h2 className="text-xl font-bold">لوحة تحكم رانش</h2>
            <p className="text-xs text-slate-400">إدارة التطبيق كاملة</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" className="w-full justify-start text-white hover:bg-slate-800">
                <span className="ml-2">{link.icon}</span>
                {link.label}
              </Button>
            </Link>
          ))}
        </nav>

        <Link href="/">
          <Button variant="outline" className="w-full">
            ← العودة للتطبيق
          </Button>
        </Link>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">لوحة التحكم</h1>
            <div className="flex gap-2">
              <Link href="/track">
                <Button variant="outline">صفحة تتبع العميل</Button>
              </Link>
              <Link href="/">
                <Button>فتح التطبيق</Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
