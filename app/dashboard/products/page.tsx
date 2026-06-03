'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MenuProduct, useAppStore } from '@/lib/app-store'

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

export default function DashboardProductsPage() {
  const {
    categories,
    products,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductAvailability,
  } = useAppStore()
  const [categoryForm, setCategoryForm] = useState({ nameAr: '', nameEn: '', active: true })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.nameAr || 'بدون قسم'

  const resetProduct = () => {
    setEditingProductId(null)
    setProductForm({ ...emptyProduct, categoryId: activeCategories[0]?.id || '' })
    setUploadStatus('')
  }

  const submitCategory = (event: FormEvent) => {
    event.preventDefault()
    if (!categoryForm.nameAr.trim() || !categoryForm.nameEn.trim()) return
    if (editingCategoryId) {
      updateCategory(editingCategoryId, categoryForm)
      setEditingCategoryId(null)
    } else {
      addCategory(categoryForm)
    }
    setCategoryForm({ nameAr: '', nameEn: '', active: true })
  }

  const editCategory = (id: string) => {
    const category = categories.find((item) => item.id === id)
    if (!category) return
    setEditingCategoryId(id)
    setCategoryForm({ nameAr: category.nameAr, nameEn: category.nameEn, active: category.active })
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadStatus('اختر ملف صورة فقط.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadStatus('حجم الصورة يجب أن يكون أقل من 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const imagePath = String(reader.result)
      setProductForm((current) => ({ ...current, image: imagePath }))
      setUploadStatus(`تم رفع الصورة بنجاح: ${file.name}`)
    }
    reader.onerror = () => setUploadStatus('تعذر رفع الصورة. حاول مرة أخرى.')
    reader.readAsDataURL(file)
  }

  const submitProduct = (event: FormEvent) => {
    event.preventDefault()
    const categoryId = productForm.categoryId || activeCategories[0]?.id
    if (!productForm.nameAr.trim() || !productForm.nameEn.trim() || !categoryId) return

    const payload = {
      ...productForm,
      categoryId,
      price: Number(productForm.price),
      preparationTime: Number(productForm.preparationTime),
      image: productForm.image.trim() || '🍽️',
    }

    if (editingProductId) {
      updateProduct(editingProductId, payload)
    } else {
      addProduct(payload)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">إدارة المنتجات والأقسام</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">ارفع صورة المنتج أو ضع رابط صورة، وستظهر مباشرة في القائمة والصفحة الرئيسية.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{editingCategoryId ? 'تعديل قسم' : 'إضافة قسم'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitCategory} className="space-y-4">
                <div>
                  <Label htmlFor="category-ar">اسم القسم بالعربي</Label>
                  <Input id="category-ar" value={categoryForm.nameAr} onChange={(event) => setCategoryForm({ ...categoryForm, nameAr: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor="category-en">Category name in English</Label>
                  <Input id="category-en" value={categoryForm.nameEn} onChange={(event) => setCategoryForm({ ...categoryForm, nameEn: event.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm({ ...categoryForm, active: event.target.checked })} />
                  القسم ظاهر في القائمة
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-red-600 hover:bg-red-700">{editingCategoryId ? 'حفظ القسم' : 'إضافة القسم'}</Button>
                  {editingCategoryId && <Button type="button" variant="outline" onClick={() => setEditingCategoryId(null)}>إلغاء</Button>}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>الأقسام الحالية</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {categories.length === 0 ? (
                <p className="py-8 text-center text-slate-500">أضف قسمًا أولًا قبل إضافة المنتجات.</p>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{category.nameAr}</p>
                        <p className="text-sm text-slate-500">{category.nameEn}</p>
                      </div>
                      <Badge className={category.active ? 'bg-green-600' : 'bg-slate-500'}>{category.active ? 'ظاهر' : 'مخفي'}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editCategory(category.id)}>تعديل</Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => deleteCategory(category.id)}>حذف</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{editingProductId ? 'تعديل منتج' : 'إضافة منتج'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitProduct} className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name-ar">اسم المنتج بالعربي</Label>
                  <Input id="name-ar" value={productForm.nameAr} onChange={(event) => setProductForm({ ...productForm, nameAr: event.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="name-en">Product name in English</Label>
                  <Input id="name-en" value={productForm.nameEn} onChange={(event) => setProductForm({ ...productForm, nameEn: event.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="description-ar">الوصف بالعربي</Label>
                  <Textarea id="description-ar" value={productForm.descriptionAr} onChange={(event) => setProductForm({ ...productForm, descriptionAr: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor="description-en">Description in English</Label>
                  <Textarea id="description-en" value={productForm.descriptionEn} onChange={(event) => setProductForm({ ...productForm, descriptionEn: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor="category">القسم</Label>
                  <select id="category" value={productForm.categoryId || activeCategories[0]?.id || ''} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <option value="" disabled>اختر قسمًا</option>
                    {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.nameAr} / {category.nameEn}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="price">السعر</Label>
                    <Input id="price" type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) })} />
                  </div>
                  <div>
                    <Label htmlFor="time">الدقائق</Label>
                    <Input id="time" type="number" min="1" value={productForm.preparationTime} onChange={(event) => setProductForm({ ...productForm, preparationTime: Number(event.target.value) })} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="image-upload">رفع صورة المنتج</Label>
                  <FileInput id="image-upload" accept="image/*" onChange={handleImageUpload} className="mt-1" />
                  {uploadStatus && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{uploadStatus}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="image">مسار الصورة أو الرمز</Label>
                  <Input id="image" value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} placeholder="/images/product.png أو رابط صورة أو رمز" />
                </div>
                <div className="md:col-span-2">
                  <Label>معاينة الصورة</Label>
                  <div className="mt-2 h-44 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                    <ProductPreview value={productForm.image} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={productForm.available} onChange={(event) => setProductForm({ ...productForm, available: event.target.checked })} />
                    متوفر للبيع
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={productForm.bestSeller} onChange={(event) => setProductForm({ ...productForm, bestSeller: event.target.checked })} />
                    يظهر في الأكثر مبيعًا
                  </label>
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="submit" className="bg-red-600 hover:bg-red-700">{editingProductId ? 'حفظ المنتج' : 'إضافة المنتج'}</Button>
                  {editingProductId && <Button type="button" variant="outline" onClick={resetProduct}>إلغاء</Button>}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>كل المنتجات</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {products.length === 0 ? (
                <p className="py-8 text-center text-slate-500">لا توجد منتجات حتى الآن.</p>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="grid gap-4 rounded-md border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[80px_1fr_auto]">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-red-50 text-4xl dark:bg-red-950">
                      <ProductPreview value={product.image} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{product.nameAr}</h3>
                        <Badge className={product.available ? 'bg-green-600' : 'bg-slate-500'}>{product.available ? 'متوفر' : 'غير متوفر'}</Badge>
                        {product.bestSeller && <Badge className="bg-red-600">الأكثر مبيعًا</Badge>}
                      </div>
                      <p className="text-sm text-slate-500">{product.nameEn}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{product.descriptionAr}</p>
                      <p className="mt-2 text-sm font-semibold text-red-600">{product.price} ج.م · {categoryName(product.categoryId)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:flex-col">
                      <Button size="sm" variant="outline" onClick={() => editProduct(product)}>تعديل</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleProductAvailability(product.id)}>{product.available ? 'غير متوفر' : 'متوفر'}</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteProduct(product.id)}>حذف</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ProductPreview({ value }: { value: string }) {
  const isImage = value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={value} alt="Product preview" className="h-full w-full object-cover" />
  }
  return <div className="flex h-full w-full items-center justify-center text-5xl">{value || '🍽️'}</div>
}
