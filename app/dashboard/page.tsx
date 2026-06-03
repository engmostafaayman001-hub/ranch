import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">نظرة عامة</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          ['إجمالي الطلبات', '0'],
          ['الإيرادات', '0 ج.م'],
          ['طلبات نشطة', '0'],
          ['العملاء', '0'],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ربط POS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            أرسل الطلبات إلى endpoint التالي لتظهر مباشرة في لوحة الطلبات والتتبع:
          </p>
          <code className="block rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">POST /api/pos/orders</code>
          <Link href="/dashboard/orders">
            <Button className="bg-red-600 hover:bg-red-700">فتح الطلبات</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
