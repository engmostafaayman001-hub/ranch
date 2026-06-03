import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardReportsPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">التقارير والتحليلات</h2>
      <Card>
        <CardHeader>
          <CardTitle>ملخص الأداء</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا توجد بيانات تقارير بعد. ستظهر التحليلات بعد وصول طلبات حقيقية إلى النظام.
        </CardContent>
      </Card>
    </div>
  )
}
