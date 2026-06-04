'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface MenuCategory {
  id: string
  nameAr: string
  nameEn: string
  active: boolean
}

export interface MenuProduct {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string
  descriptionEn: string
  categoryId: string
  price: number
  image: string
  rating: number
  reviews: number
  preparationTime: number
  available: boolean
  bestSeller: boolean
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
}

export interface DeliveryDriver {
  id: string
  name: string
  phone: string
  area: string
  status: 'active' | 'inactive'
}

export interface AppSettings {
  restaurantNameAr: string
  restaurantNameEn: string
  email: string
  phone: string
  addressAr: string
  addressEn: string
  heroTitleAr: string
  heroTitleEn: string
  heroSubtitleAr: string
  heroSubtitleEn: string
  heroImage: string
  offerImages: string[]
  workingHoursAr: string
  workingHoursEn: string
  deliveryFee: number
  taxRate: number
  deliveryTime: number
  defaultLanguage: 'ar' | 'en'
  printerMethod: 'browser' | 'usb' | 'bluetooth' | 'network'
  printerName: string
  printerIp: string
  printerPaperWidth: '58mm' | '80mm'
}

interface AppStore {
  categories: MenuCategory[]
  products: MenuProduct[]
  cart: CartItem[]
  team: TeamMember[]
  drivers: DeliveryDriver[]
  favoriteProductIds: string[]
  settings: AppSettings
  setCatalog: (catalog: { categories: MenuCategory[]; products: MenuProduct[] }) => void
  setSettings: (settings: AppSettings) => void
  addCategory: (category: Omit<MenuCategory, 'id'>) => void
  updateCategory: (id: string, updates: Partial<MenuCategory>) => void
  deleteCategory: (id: string) => void
  addProduct: (product: Omit<MenuProduct, 'id' | 'rating' | 'reviews'>) => void
  updateProduct: (id: string, updates: Partial<MenuProduct>) => void
  deleteProduct: (id: string) => void
  toggleProductAvailability: (id: string) => void
  toggleFavoriteProduct: (productId: string) => void
  addToCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void
  deleteTeamMember: (id: string) => void
  addDriver: (driver: Omit<DeliveryDriver, 'id'>) => void
  updateDriver: (id: string, updates: Partial<DeliveryDriver>) => void
  deleteDriver: (id: string) => void
  updateSettings: (updates: Partial<AppSettings>) => void
}

export const defaultCategories: MenuCategory[] = []

export const defaultProducts: MenuProduct[] = []

export const defaultSettings: AppSettings = {
  restaurantNameAr: 'رانش',
  restaurantNameEn: 'Ranch',
  email: 'info@ranch.app',
  phone: '01000000000',
  addressAr: 'القاهرة، مصر',
  addressEn: 'Cairo, Egypt',
  heroTitleAr: 'اطلب وجبتك المفضلة من رانش',
  heroTitleEn: 'Order your favorite meal from Ranch',
  heroSubtitleAr: 'وجبات طازجة، توصيل سريع، وتتبع مباشر من لحظة الطلب حتى الاستلام.',
  heroSubtitleEn: 'Fresh meals, fast delivery, and live tracking from order to doorstep.',
  heroImage: '/favicon.png',
  offerImages: [],
  workingHoursAr: 'يوميا من 10 صباحا إلى 12 منتصف الليل',
  workingHoursEn: 'Daily from 10 AM to 12 AM',
  deliveryFee: 29.99,
  taxRate: 0.1,
  deliveryTime: 30,
  defaultLanguage: 'ar',
  printerMethod: 'browser',
  printerName: '',
  printerIp: '',
  printerPaperWidth: '80mm',
}
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      categories: defaultCategories,
      products: defaultProducts,
      cart: [],
      team: [],
      drivers: [],
      favoriteProductIds: [],
      settings: defaultSettings,
      setCatalog: (catalog) =>
        set({
          categories: catalog.categories,
          products: catalog.products,
        }),
      setSettings: (settings) => set({ settings: { ...defaultSettings, ...settings } }),
      addCategory: (category) =>
        set((state) => ({ categories: [...state.categories, { ...category, id: createId('category') }] })),
      updateCategory: (id, updates) =>
        set((state) => ({ categories: state.categories.map((category) => (category.id === id ? { ...category, ...updates } : category)) })),
      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((category) => category.id !== id),
          products: state.products.filter((product) => product.categoryId !== id),
        })),
      addProduct: (product) =>
        set((state) => ({ products: [...state.products, { ...product, id: createId('product'), rating: 0, reviews: 0 }] })),
      updateProduct: (id, updates) =>
        set((state) => ({ products: state.products.map((product) => (product.id === id ? { ...product, ...updates } : product)) })),
      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
          cart: state.cart.filter((item) => item.productId !== id),
        })),
      toggleProductAvailability: (id) =>
        set((state) => ({ products: state.products.map((product) => (product.id === id ? { ...product, available: !product.available } : product)) })),
      toggleFavoriteProduct: (productId) =>
        set((state) => ({
          favoriteProductIds: state.favoriteProductIds.includes(productId)
            ? state.favoriteProductIds.filter((id) => id !== productId)
            : [...state.favoriteProductIds, productId],
        })),
      addToCart: (productId) =>
        set((state) => {
          const existing = state.cart.find((item) => item.productId === productId)
          if (existing) {
            return { cart: state.cart.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)) }
          }
          return { cart: [...state.cart, { productId, quantity: 1 }] }
        }),
      updateCartQuantity: (productId, quantity) =>
        set((state) => ({
          cart:
            quantity <= 0
              ? state.cart.filter((item) => item.productId !== productId)
              : state.cart.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
        })),
      removeFromCart: (productId) => set((state) => ({ cart: state.cart.filter((item) => item.productId !== productId) })),
      clearCart: () => set({ cart: [] }),
      addTeamMember: (member) => set((state) => ({ team: [...state.team, { ...member, id: createId('member') }] })),
      updateTeamMember: (id, updates) =>
        set((state) => ({ team: state.team.map((member) => (member.id === id ? { ...member, ...updates } : member)) })),
      deleteTeamMember: (id) => set((state) => ({ team: state.team.filter((member) => member.id !== id) })),
      addDriver: (driver) => set((state) => ({ drivers: [...state.drivers, { ...driver, id: createId('driver') }] })),
      updateDriver: (id, updates) =>
        set((state) => ({ drivers: state.drivers.map((driver) => (driver.id === id ? { ...driver, ...updates } : driver)) })),
      deleteDriver: (id) => set((state) => ({ drivers: state.drivers.filter((driver) => driver.id !== id) })),
      updateSettings: (updates) => set((state) => ({ settings: { ...state.settings, ...updates } })),
    }),
    {
      name: 'ranch-app-data',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppStore> | undefined
        const sampleIds = new Set(['classic-burger', 'cheese-pizza', 'grilled-chicken', 'shawarma-wrap'])
        return {
          ...state,
          categories: state?.categories || [],
          products: state?.products || [],
          settings: { ...defaultSettings, ...(state?.settings || {}) },
          cart: state?.cart?.filter((item) => !sampleIds.has(item.productId)) || [],
          drivers: state?.drivers || [],
          favoriteProductIds: state?.favoriteProductIds || [],
        }
      },
      partialize: (state) => ({
        categories: state.categories,
        products: state.products,
        settings: state.settings,
        cart: state.cart,
        team: state.team,
        drivers: state.drivers,
        favoriteProductIds: state.favoriteProductIds,
      }),
    }
  )
)
