'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { MenuCategory, MenuProduct, useAppStore } from '@/lib/app-store'
import { imageFileToOptimizedDataUrl, isAcceptedImageFile, isDisplayableImage } from '@/lib/client-images'
import { saveSharedCatalog, useSharedAppData } from '@/lib/use-shared-app-data'

const emptyProduct = {
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  categoryId: '',
  price: 0,
  image: '',
  preparationTime: 15,
  available: true,
  bestSeller: false,
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function DashboardProductsPage() {
  useSharedAppData()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const { categories, products, setCatalog } = useAppStore()
  const [categoryForm, setCategoryForm] = useState({ nameAr: '', nameEn: '', active: true })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.[isArabic ? 'nameAr' : 'nameEn'] || (isArabic ? 'بدون قسم' : 'No category')

  const t = {
    title: isArabic ? 'إدارة المنتجات والأقسام' : 'Products & Categories',
    subtitle: isArabic ? 'أي منتج تضيفه أو تعدله هنا يتم حفظه على السيرفر ويظهر لكل المستخدمين.' : 'Products added or edited here are saved on the server and shown to all users.',
    saveOk: isArabic ? 'تم حفظ التغييرات وظهورها لجميع المستخدمين.' : 'Changes saved and published to all users.',
    saveLocal: isArabic ? 'تم حفظ التغيير محليًا فقط.' : 'Changes were saved locally only.',
    categoryForm: editingCategoryId ? (isArabic ? 'تعديل قسم' : 'Edit Category') : (isArabic ? 'إضافة قسم' : 'Add Category'),
    productForm: editingProductId ? (isArabic ? 'تعديل منتج' : 'Edit Product') : (isArabic ? 'إضافة منتج' : 'Add Product'),
  }

  const publishCatalog = async (nextCategories: MenuCategory[], nextProducts: MenuProduct[]) => {
    setCatalog({ categories: nextCategories, products: nextProducts })
    setSaving(true)
    setSaveStatus('')
    try {
      const data = await saveSharedCatalog(nextCategories, nextProducts)
      setCatalog({ categories: data.categories || nextCategories, products: data.products || nextProducts })
      setSaveStatus(t.saveOk)
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : t.saveLocal)
    } finally {
      setSaving(false)
      window.setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const resetProduct = () => {
    setEditingProductId(null)
    setProductForm({ ...emptyProduct, categoryId: activeCategories[0]?.id || '' })
    setUploadStatus('')
  }

  const submitCategory = (event: FormEvent) => {
    event.preventDefault()
    if (!categoryForm.nameAr.trim() || !categoryForm.nameEn.trim()) return

    if (editingCategoryId) {
      publishCatalog(categories.map((category) => (category.id === editingCategoryId ? { ...category, ...categoryForm } : category)), products)
      setEditingCategoryId(null)
    } else {
      publishCatalog([...categories, { ...categoryForm, id: createId('category') }], products)
    }
    setCategoryForm({ nameAr: '', nameEn: '', active: true })
  }

  const editCategory = (category: MenuCategory) => {
    setEditingCategoryId(category.id)
    setCategoryForm({ nameAr: category.nameAr, nameEn: category.nameEn, active: category.active })
  }

  const deleteCategory = (id: string) => {
    publishCatalog(categories.filter((category) => category.id !== id), products.filter((product) => product.categoryId !== id))
  }

  const submitProduct = (event: FormEvent) => {
    event.preventDefault()
    const categoryId = productForm.categoryId || activeCategories[0]?.id || categories[0]?.id || ''
    if (!productForm.nameAr.trim() || !productForm.nameEn.trim() || !categoryId) return

    const payload = {
      ...productForm,
      categoryId,
      price: Number(productForm.price),
      preparationTime: Number(productForm.preparationTime),
    }

    if (editingProductId) {
      publishCatalog(categories, products.map((product) => (product.id === editingProductId ? { ...product, ...payload } : product)))
    } else {
      publishCatalog(categories, [...products, { ...payload, id: createId('product'), rating: 0, reviews: 0 }])
    }
    resetProduct()
  }

  const editProduct = (product: MenuProduct) => {
    setEditingProductId(product.id)
    setProductForm({
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      descriptionAr: product.descriptionAr,
      descriptionEn: product.descriptionEn,
      categoryId: product.categoryId,
      price: product.price,
      image: product.image,
      preparationTime: product.preparationTime,
      available: product.available,
      bestSeller: product.bestSeller,
    })
    setUploadStatus('')
  }

  const deleteProduct = (id: string) => {
    publishCatalog(categories, products.filter((product) => product.id !== id))
  }

  const toggleProductAvailability = (id: string) => {
    publishCatalog(categories, products.map((product) => (product.id === id ? { ...product, available: !product.available } : product)))
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isAcceptedImageFile(file)) {
      setUploadStatus(isArabic ? 'اختر ملف صورة فقط.' : 'Choose an image file only.')
      return
    }

    setUploadStatus(isArabic ? 'جاري تجهيز الصورة...' : 'Preparing image...')
    try {
      const dataUrl = await imageFileToOptimizedDataUrl(file, { maxSize: 1400, quality: 0.86 })
      setProductForm((current) => ({ ...current, image: dataUrl }))
      setUploadStatus(isArabic ? `تم رفع الصورة وضبط مقاسها: ${file.name}` : `Image uploaded and resized: ${file.name}`)
    } catch {
      setUploadStatus(isArabic ? 'تعذر رفع الصورة. حاول مرة أخرى.' : 'Could not upload the image. Try again.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{t.title}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        {saveStatus && <p className="mt-2 text-sm font-medium text-green-600">{saveStatus}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.categoryForm}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitCategory} className="space-y-4">
              <Field id="category-ar" label={isArabic ? 'اسم القسم بالعربية' : 'Category name in Arabic'} value={categoryForm.nameAr} onChange={(value) => setCategoryForm({ ...categoryForm, nameAr: value })} />
              <Field id="category-en" label={isArabic ? 'اسم القسم بالإنجليزية' : 'Category name in English'} value={categoryForm.nameEn} onChange={(value) => setCategoryForm({ ...categoryForm, nameEn: value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm({ ...categoryForm, active: event.target.checked })} />
                {isArabic ? 'القسم ظاهر في القائمة' : 'Category is visible in the menu'}
              </label>
              <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">{editingCategoryId ? (isArabic ? 'حفظ القسم' : 'Save Category') : (isArabic ? 'إضافة قسم' : 'Add Category')}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{isArabic ? 'الأقسام الحالية' : 'Current Categories'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {categories.length === 0 ? (
              <p className="py-8 text-center text-slate-500">{isArabic ? 'أضف قسمًا أولًا قبل إضافة المنتجات.' : 'Add a category before adding products.'}</p>
            ) : categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="font-semibold">{isArabic ? category.nameAr : category.nameEn}</p>
                  <Badge className={category.active ? 'bg-green-600' : 'bg-slate-500'}>{category.active ? (isArabic ? 'ظاهر' : 'Visible') : (isArabic ? 'مخفي' : 'Hidden')}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => editCategory(category)}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                  <Button size="sm" variant="destructive" disabled={saving} onClick={() => deleteCategory(category.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t.productForm}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submitProduct} className="grid gap-4 lg:grid-cols-2">
            <Field id="name-ar" label={isArabic ? 'اسم المنتج بالعربية' : 'Product name in Arabic'} value={productForm.nameAr} onChange={(value) => setProductForm({ ...productForm, nameAr: value })} />
            <Field id="name-en" label={isArabic ? 'اسم المنتج بالإنجليزية' : 'Product name in English'} value={productForm.nameEn} onChange={(value) => setProductForm({ ...productForm, nameEn: value })} />
            <div>
              <Label htmlFor="description-ar">{isArabic ? 'الوصف بالعربية' : 'Description in Arabic'}</Label>
              <Textarea id="description-ar" value={productForm.descriptionAr} onChange={(event) => setProductForm({ ...productForm, descriptionAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="description-en">{isArabic ? 'الوصف بالإنجليزية' : 'Description in English'}</Label>
              <Textarea id="description-en" value={productForm.descriptionEn} onChange={(event) => setProductForm({ ...productForm, descriptionEn: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="category">{isArabic ? 'القسم' : 'Category'}</Label>
              <select id="category" value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                <option value="" disabled>{isArabic ? 'اختر قسمًا' : 'Choose a category'}</option>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{isArabic ? category.nameAr : category.nameEn}</option>)}
              </select>
            </div>
            <Field id="price" label={isArabic ? 'السعر' : 'Price'} value={String(productForm.price)} onChange={(value) => setProductForm({ ...productForm, price: Number(value) })} type="number" />
            <Field id="time" label={isArabic ? 'الدقائق' : 'Minutes'} value={String(productForm.preparationTime)} onChange={(value) => setProductForm({ ...productForm, preparationTime: Number(value) })} type="number" />
            <div>
              <Label htmlFor="image-upload">{isArabic ? 'رفع صورة المنتج' : 'Upload Product Image'}</Label>
              <FileInput id="image-upload" accept="image/*" onChange={handleImageUpload} className="mt-1" />
              <p className="mt-2 text-xs text-slate-500">
                {isArabic ? 'يمكن رفع أي مقاس، وسيتم ضبط الصورة تلقائيا لتظهر كاملة.' : 'Upload any size; the image will be adjusted automatically to show fully.'}
              </p>
              {uploadStatus && <p className="mt-2 text-sm text-slate-500">{uploadStatus}</p>}
            </div>
            <Field id="image" label={isArabic ? 'مسار الصورة أو الرمز' : 'Image path or emoji'} value={productForm.image} onChange={(value) => setProductForm({ ...productForm, image: value })} />
            <ProductImagePreview value={productForm.image} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={productForm.available} onChange={(event) => setProductForm({ ...productForm, available: event.target.checked })} />
              {isArabic ? 'متوفر للبيع' : 'Available for sale'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={productForm.bestSeller} onChange={(event) => setProductForm({ ...productForm, bestSeller: event.target.checked })} />
              {isArabic ? 'يظهر في الأكثر مبيعًا' : 'Show as best seller'}
            </label>
            <div className="lg:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">{editingProductId ? (isArabic ? 'حفظ المنتج' : 'Save Product') : (isArabic ? 'إضافة منتج' : 'Add Product')}</Button>
              {editingProductId && <Button type="button" variant="outline" onClick={resetProduct}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'كل المنتجات' : 'All Products'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد منتجات حتى الآن.' : 'No products yet.'}</p>
          ) : products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{isArabic ? product.nameAr : product.nameEn}</p>
                <p className="text-sm text-slate-500">{categoryName(product.categoryId)} - {product.price}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={product.available ? 'bg-green-600' : 'bg-slate-500'}>{product.available ? (isArabic ? 'متوفر' : 'Available') : (isArabic ? 'غير متوفر' : 'Unavailable')}</Badge>
                  {product.bestSeller && <Badge className="bg-red-600">{isArabic ? 'الأكثر مبيعًا' : 'Best Seller'}</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => toggleProductAvailability(product.id)}>{product.available ? (isArabic ? 'إخفاء' : 'Hide') : (isArabic ? 'إظهار' : 'Show')}</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => editProduct(product)}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                <Button size="sm" variant="destructive" disabled={saving} onClick={() => deleteProduct(product.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
function ProductImagePreview({ value }: { value: string }) {
  return (
    <div className="lg:col-span-2">
      <div className="flex h-56 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3 text-7xl dark:border-slate-800 dark:bg-slate-900">
        {isDisplayableImage(value) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Product preview" className="h-full w-full object-contain" />
        ) : (
          <span>{value || '🍽️'}</span>
        )}
      </div>
    </div>
  )
}
