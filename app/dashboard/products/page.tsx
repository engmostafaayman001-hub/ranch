'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
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
import { ROUTES } from '@/lib/constants'
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
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return products
    return products.filter((product) =>
      `${product.nameAr} ${product.nameEn}`.toLowerCase().includes(term)
    )
  }, [productSearch, products])
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.[isArabic ? 'nameAr' : 'nameEn'] ||
    (isArabic ? 'بدون قسم' : 'No category')

  const publishCatalog = async (nextCategories: MenuCategory[], nextProducts: MenuProduct[]) => {
    setCatalog({ categories: nextCategories, products: nextProducts })
    setSaving(true)
    setSaveStatus('')

    try {
      const data = await saveSharedCatalog(nextCategories, nextProducts)
      setCatalog({ categories: data.categories || nextCategories, products: data.products || nextProducts })
      setSaveStatus(isArabic ? 'تم حفظ المنتجات وظهورها لجميع المستخدمين.' : 'Products saved and published to all users.')
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : isArabic ? 'تم حفظ التغيير محليا فقط.' : 'Changes were saved locally only.')
    } finally {
      setSaving(false)
      window.setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const openNewProduct = () => {
    setEditingProductId(null)
    setProductForm({ ...emptyProduct, categoryId: activeCategories[0]?.id || '' })
    setUploadStatus('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setEditingProductId(null)
    setProductForm({ ...emptyProduct, categoryId: activeCategories[0]?.id || '' })
    setUploadStatus('')
    setFormOpen(false)
  }

  const submitProduct = (event: FormEvent) => {
    event.preventDefault()
    const categoryId = productForm.categoryId || activeCategories[0]?.id || ''
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
    closeForm()
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
    setFormOpen(true)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'إدارة المنتجات' : 'Products'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'اعرض المنتجات أولا، وافتح نموذج الإضافة عند الحاجة فقط.' : 'View products first, and open the add form only when needed.'}
          </p>
          {saveStatus && <p className="mt-2 text-sm font-medium text-green-600">{saveStatus}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.DASHBOARD_CATEGORIES}>
            <Button variant="outline">{isArabic ? 'إدارة الأقسام' : 'Manage Categories'}</Button>
          </Link>
          <Button onClick={openNewProduct} disabled={activeCategories.length === 0} className="bg-red-600 hover:bg-red-700">
            {isArabic ? 'إضافة منتج' : 'Add Product'}
          </Button>
        </div>
      </div>

      {activeCategories.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {isArabic ? 'أضف قسما ظاهرا أولا حتى تتمكن من إضافة المنتجات.' : 'Add a visible category first before creating products.'}
            </p>
            <Link href={ROUTES.DASHBOARD_CATEGORIES}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                {isArabic ? 'فتح الأقسام' : 'Open Categories'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingProductId ? (isArabic ? 'تعديل منتج' : 'Edit Product') : (isArabic ? 'إضافة منتج' : 'Add Product')}</CardTitle>
          </CardHeader>
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
                  <option value="" disabled>{isArabic ? 'اختر قسما' : 'Choose a category'}</option>
                  {activeCategories.map((category) => <option key={category.id} value={category.id}>{isArabic ? category.nameAr : category.nameEn}</option>)}
                </select>
              </div>
              <Field id="price" label={isArabic ? 'السعر' : 'Price'} value={String(productForm.price)} onChange={(value) => setProductForm({ ...productForm, price: Number(value) })} type="number" />
              <Field id="time" label={isArabic ? 'الدقائق' : 'Minutes'} value={String(productForm.preparationTime)} onChange={(value) => setProductForm({ ...productForm, preparationTime: Number(value) })} type="number" />
              <div>
                <Label htmlFor="image-upload">{isArabic ? 'رفع صورة المنتج' : 'Upload Product Image'}</Label>
                <FileInput id="image-upload" accept="image/*" onChange={handleImageUpload} className="mt-1" />
                <p className="mt-2 text-xs text-slate-500">{isArabic ? 'يمكن رفع أي مقاس، وسيتم ضبط الصورة تلقائيا لتظهر كاملة.' : 'Upload any size; the image will be adjusted automatically to show fully.'}</p>
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
                {isArabic ? 'يظهر في الأكثر مبيعا' : 'Show as best seller'}
              </label>
              <div className="flex gap-2 lg:col-span-2">
                <Button type="submit" disabled={saving || activeCategories.length === 0} className="bg-red-600 hover:bg-red-700">
                  {editingProductId ? (isArabic ? 'حفظ المنتج' : 'Save Product') : (isArabic ? 'إضافة منتج' : 'Add Product')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>{isArabic ? 'كل المنتجات' : 'All Products'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {isArabic ? `${filteredProducts.length} من ${products.length} منتج` : `${filteredProducts.length} of ${products.length} products`}
            </p>
            <div className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 md:max-w-sm dark:border-slate-800 dark:bg-slate-950">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder={isArabic ? 'بحث باسم المنتج' : 'Search by product name'}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          {products.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد منتجات حتى الآن.' : 'No products yet.'}</p>
          ) : filteredProducts.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 py-8 text-center text-slate-500 dark:border-slate-800">
              {isArabic ? 'لا توجد منتجات مطابقة لهذا البحث.' : 'No products match this search.'}
            </p>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{isArabic ? product.nameAr : product.nameEn}</p>
                  <p className="text-sm text-slate-500">{categoryName(product.categoryId)} - {product.price}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className={product.available ? 'bg-green-600' : 'bg-slate-500'}>{product.available ? (isArabic ? 'متوفر' : 'Available') : (isArabic ? 'غير متوفر' : 'Unavailable')}</Badge>
                    {product.bestSeller && <Badge className="bg-red-600">{isArabic ? 'الأكثر مبيعا' : 'Best Seller'}</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => toggleProductAvailability(product.id)}>{saving ? (isArabic ? '...' : '...') : (product.available ? (isArabic ? 'إخفاء' : 'Hide') : (isArabic ? 'إظهار' : 'Show'))}</Button>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => editProduct(product)}>{saving ? (isArabic ? '...' : '...') : (isArabic ? 'تعديل' : 'Edit')}</Button>
                  <Button size="sm" variant="destructive" disabled={saving} onClick={() => deleteProduct(product.id)}>{saving ? (isArabic ? '...' : '...') : (isArabic ? 'حذف' : 'Delete')}</Button>
                </div>
              </div>
            ))
          )}
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
  const [failedValue, setFailedValue] = useState('')
  const failed = failedValue === value
  return (
    <div className="lg:col-span-2">
      <div className="flex h-56 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3 text-3xl font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
        {isDisplayableImage(value) && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Product preview" className="h-full w-full object-contain" onError={() => setFailedValue(value)} />
        ) : (
          <span>{value || 'IMG'}</span>
        )}
      </div>
    </div>
  )
}
