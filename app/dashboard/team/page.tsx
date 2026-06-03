import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardTeamPage() {
  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">إدارة الفريق</h2>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>أعضاء الفريق</CardTitle>
          <Button>+ إضافة عضو</Button>
        </CardHeader>
        <CardContent className="py-12 text-center text-slate-500">
          لا يوجد أعضاء فريق محفوظون بعد. أضف الإيميلات المصرح لها من الإعدادات أو المتغيرات البيئية.
        </CardContent>
      </Card>
    </div>
  )
}
