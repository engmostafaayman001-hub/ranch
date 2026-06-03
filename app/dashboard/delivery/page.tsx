import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardDeliveryPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">إدارة التوصيل</h2>
      <Card>
        <CardHeader>
          <CardTitle>السائقون والتسليم</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا توجد رحلات توصيل نشطة بعد. ستظهر هنا الطلبات عند وصولها إلى حالة “في الطريق”.
        </CardContent>
      </Card>
    </div>
  )
}
