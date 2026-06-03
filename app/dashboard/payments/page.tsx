import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPaymentsPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">إدارة المدفوعات</h2>
      <Card>
        <CardHeader>
          <CardTitle>المدفوعات والإيصالات</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا توجد مدفوعات بعد. ستظهر المدفوعات عند إرسال طلبات حقيقية أو إيصالات من النظام.
        </CardContent>
      </Card>
    </div>
  )
}
