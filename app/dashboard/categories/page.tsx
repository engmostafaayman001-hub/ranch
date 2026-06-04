'use client'

import { FormEvent, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { MenuCategory, MenuProduct, useAppStore } from '@/lib/app-store'
import { saveSharedCatalog, useSharedAppData } from '@/lib/use-shared-app-data'

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function DashboardCategoriesPage() {
  useSharedAppData()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const { categories, products, setCatalog } = useAppStore()
  const [form, setForm] = useState({ nameAr: '', nameEn: '', active: true })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const publishCatalog = async (nextCategories: MenuCategory[], nextProducts: MenuProduct[]) => {
    setCatalog({ categories: nextCategories, products: nextProducts })
    setSaving(true)
    setSaveStatus('')

    try {
      const data = await saveSharedCatalog(nextCategories, nextProducts)
      setCatalog({ categories: data.categories || nextCategories, products: data.products || nextProducts })
      setSaveStatus(isArabic ? 'تم حفظ الأقسام وظهورها لجميع المستخدمين.' : 'Categories saved and published to all users.')
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : isArabic ? 'تم حفظ التغيير محليا فقط.' : 'Changes were saved locally only.')
    } finally {
      setSaving(false)
      window.setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const openNewCategory = () => {
    setEditingId(null)
    setForm({ nameAr: '', nameEn: '', active: true })
    setFormOpen(true)
  }

  const closeForm = () => {
    setEditingId(null)
    setForm({ nameAr: '', nameEn: '', active: true })
    setFormOpen(false)
  }

  const submitCategory = (event: FormEvent) => {
    event.preventDefault()
    if (!form.nameAr.trim() || !form.nameEn.trim()) return

    if (editingId) {
      publishCatalog(categories.map((category) => (category.id === editingId ? { ...category, ...form } : category)), products)
    } else {
      publishCatalog([...categories, { ...form, id: createId('category') }], products)
    }
    closeForm()
  }

  const editCategory = (category: MenuCategory) => {
    setEditingId(category.id)
    setForm({ nameAr: category.nameAr, nameEn: category.nameEn, active: category.active })
    setFormOpen(true)
  }

  const deleteCategory = (id: string) => {
    publishCatalog(
      categories.filter((category) => category.id !== id),
      products.filter((product) => product.categoryId !== id)
    )
  }

  const productCount = (categoryId: string) => products.filter((product) => product.categoryId === categoryId).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'إدارة الأقسام' : 'Categories'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'اعرض الأقسام الحالية وافتح نموذج الإضافة عند الحاجة.' : 'View current categories and open the form only when needed.'}
          </p>
          {saveStatus && <p className="mt-2 text-sm font-medium text-green-600">{saveStatus}</p>}
        </div>
        <Button onClick={openNewCategory} className="bg-red-600 hover:bg-red-700">
          {isArabic ? 'إضافة قسم' : 'Add Category'}
        </Button>
      </div>

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? (isArabic ? 'تعديل قسم' : 'Edit Category') : (isArabic ? 'إضافة قسم' : 'Add Category')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCategory} className="grid gap-4 md:grid-cols-2">
              <Field id="category-ar" label={isArabic ? 'اسم القسم بالعربية' : 'Category name in Arabic'} value={form.nameAr} onChange={(value) => setForm({ ...form, nameAr: value })} />
              <Field id="category-en" label={isArabic ? 'اسم القسم بالإنجليزية' : 'Category name in English'} value={form.nameEn} onChange={(value) => setForm({ ...form, nameEn: value })} />
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                {isArabic ? 'القسم ظاهر في القائمة' : 'Category is visible in the menu'}
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">
                  {editingId ? (isArabic ? 'حفظ القسم' : 'Save Category') : (isArabic ? 'إضافة قسم' : 'Add Category')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'الأقسام الحالية' : 'Current Categories'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد أقسام حتى الآن.' : 'No categories yet.'}</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{isArabic ? category.nameAr : category.nameEn}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className={category.active ? 'bg-green-600' : 'bg-slate-500'}>
                      {category.active ? (isArabic ? 'ظاهر' : 'Visible') : (isArabic ? 'مخفي' : 'Hidden')}
                    </Badge>
                    <Badge variant="outline">{productCount(category.id)} {isArabic ? 'منتج' : 'products'}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => editCategory(category)}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                  <Button size="sm" variant="destructive" disabled={saving} onClick={() => deleteCategory(category.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
