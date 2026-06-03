import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardProductsPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">إدارة المنتجات</h2>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>كل المنتجات</CardTitle>
          <Button>+ إضافة منتج</Button>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا توجد منتجات إدارية محفوظة بعد. أضف منتجاتك الحقيقية من هنا عند ربط قاعدة البيانات.
        </CardContent>
      </Card>
    </div>
  )
}
