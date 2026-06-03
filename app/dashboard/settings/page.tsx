import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function DashboardSettingsPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Settings</h2>

      <div className="grid gap-6">
        {/* Restaurant Information */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="restaurant-name">Restaurant Name</Label>
              <Input
                id="restaurant-name"
                defaultValue="Ranch Restaurant"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="restaurant-email">Email</Label>
              <Input
                id="restaurant-email"
                type="email"
                defaultValue="info@ranch.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="restaurant-phone">Phone</Label>
              <Input
                id="restaurant-phone"
                type="tel"
                defaultValue="+1 234 567 8900"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="restaurant-address">Address</Label>
              <Input
                id="restaurant-address"
                defaultValue="123 Main Street, City, State 12345"
                className="mt-1"
              />
            </div>
            <Button className="bg-red-600 hover:bg-red-700">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Delivery Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="delivery-fee">Delivery Fee</Label>
              <Input
                id="delivery-fee"
                type="number"
                defaultValue="2.99"
                step="0.01"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="min-order">Minimum Order Amount</Label>
              <Input
                id="min-order"
                type="number"
                defaultValue="10.00"
                step="0.01"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="delivery-time">Estimated Delivery Time (minutes)</Label>
              <Input
                id="delivery-time"
                type="number"
                defaultValue="30"
                className="mt-1"
              />
            </div>
            <Button className="bg-red-600 hover:bg-red-700">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span>Cash on Delivery</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span>Vodafone Cash</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span>InstaPay</span>
            </label>
            <Button className="bg-red-600 hover:bg-red-700">Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
