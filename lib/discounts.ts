import { AppNotification } from '@/lib/notifications'

export type DiscountType = 'percent' | 'fixed'

export type DiscountValidation =
  | {
      valid: true
      code: string
      title: string
      discountType: DiscountType
      discountValue: number
      discountAmount: number
      minSubtotal: number
      subtotal: number
    }
  | {
      valid: false
      code: string
      reason: string
    }

export function normalizeDiscountCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function getNotificationDiscount(notification: AppNotification) {
  if (!notification.code) return null
  const discountType: DiscountType = notification.discountType === 'fixed' ? 'fixed' : 'percent'
  const rawValue = Number(notification.discountValue)
  const discountValue = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 10
  return {
    code: normalizeDiscountCode(notification.code),
    title: notification.title,
    discountType,
    discountValue,
    minSubtotal: Math.max(0, Number(notification.minSubtotal || 0)),
    active: notification.active !== false,
    expiresAt: notification.expiresAt,
  }
}

export function validateNotificationDiscount(
  notifications: AppNotification[],
  code: string,
  subtotal: number
): DiscountValidation {
  const normalizedCode = normalizeDiscountCode(code)
  const safeSubtotal = Math.max(0, Number(subtotal || 0))

  if (!normalizedCode) {
    return { valid: false, code: normalizedCode, reason: 'Discount code is required' }
  }

  const discount = notifications
    .map(getNotificationDiscount)
    .find((item) => item?.code === normalizedCode)

  if (!discount) {
    return { valid: false, code: normalizedCode, reason: 'Discount code was not found' }
  }

  if (!discount.active) {
    return { valid: false, code: normalizedCode, reason: 'Discount code is not active' }
  }

  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) {
    return { valid: false, code: normalizedCode, reason: 'Discount code has expired' }
  }

  if (safeSubtotal < discount.minSubtotal) {
    return {
      valid: false,
      code: normalizedCode,
      reason: `Minimum subtotal is ${discount.minSubtotal.toFixed(2)}`,
    }
  }

  const rawDiscount = discount.discountType === 'fixed'
    ? discount.discountValue
    : safeSubtotal * (Math.min(discount.discountValue, 100) / 100)
  const discountAmount = Math.min(safeSubtotal, Math.max(0, rawDiscount))

  return {
    valid: true,
    code: normalizedCode,
    title: discount.title,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    discountAmount,
    minSubtotal: discount.minSubtotal,
    subtotal: safeSubtotal,
  }
}
