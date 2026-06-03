import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardCustomersPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">إدارة العملاء</h2>
      <Card>
        <CardHeader>
          <CardTitle>كل العملاء</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا توجد بيانات عملاء بعد. ستظهر هنا بيانات العملاء بعد وصول طلبات حقيقية من التطبيق أو POS API.
        </CardContent>
      </Card>
    </div>
  )
}
