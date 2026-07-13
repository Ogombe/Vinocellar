import { db } from '@/lib/db'
import { SessionPayload } from './auth'

// ==================== AUTH HELPERS ====================

export async function getSessionUser(token: string): Promise<{ user: any; org: any; storeId: string | null } | null> {
  const { verifyToken } = await import('./auth')
  const payload = verifyToken(token)
  if (!payload) return null

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { organisation: true, store: true }
  })

  if (!user || !user.isActive || user.organisationId !== payload.organisationId) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pin: user.pin,
      storeId: user.storeId,
      organisationId: user.organisationId
    },
    org: {
      id: user.organisation.id,
      name: user.organisation.name,
      slug: user.organisation.slug,
      plan: user.organisation.plan,
      isActive: user.organisation.isActive
    },
    storeId: user.storeId
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader.match(/vinocellar_session=([^;]+)/)
  return match ? match[1] : null
}

export function createSessionCookie(token: string): string {
  return `vinocellar_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
}

export function createLogoutCookie(): string {
  return 'vinocellar_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
}

// ==================== AUDIT LOGGING ====================

export async function auditLog(params: {
  action: string
  entity: string
  entityId?: string
  beforeValue?: any
  afterValue?: any
  userId: string
  organisationId: string
}) {
  await db.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      beforeValue: params.beforeValue ? JSON.stringify(params.beforeValue) : null,
      afterValue: params.afterValue ? JSON.stringify(params.afterValue) : null,
      userId: params.userId,
      organisationId: params.organisationId
    }
  })
}

// ==================== INVENTORY HEALTH ====================

export function calculateHealthScore(products: { currentStock: number; reorderLevel: number }[]): number {
  if (products.length === 0) return 100
  let lowStockCount = 0
  let outOfStockCount = 0
  let totalCoverageDays = 0

  for (const p of products) {
    if (p.currentStock === 0) outOfStockCount++
    else if (p.currentStock <= p.reorderLevel) lowStockCount++
    totalCoverageDays += p.reorderLevel > 0 ? (p.currentStock / p.reorderLevel) * 7 : 7
  }

  const lowStockPct = (lowStockCount / products.length) * 100
  const outOfStockPct = (outOfStockCount / products.length) * 100
  const avgCoverageDays = totalCoverageDays / products.length

  let score = 100
  score -= lowStockPct * 0.3
  score -= outOfStockPct * 0.4
  score -= Math.max(0, (7 - avgCoverageDays) / 7) * 20

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ==================== DATE HELPERS ====================

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

// ==================== CATEGORIES ====================

export const DEFAULT_CATEGORIES = [
  { name: 'Wine', colour: '#DC2626' },
  { name: 'Whisky', colour: '#92400E' },
  { name: 'Vodka', colour: '#3B82F6' },
  { name: 'Gin', colour: '#10B981' },
  { name: 'Rum', colour: '#F97316' },
  { name: 'Champagne', colour: '#F59E0B' },
  { name: 'Beer', colour: '#FBBF24' },
  { name: 'Cognac', colour: '#78350F' },
  { name: 'Tequila', colour: '#059669' },
  { name: 'Liqueur', colour: '#8B5CF6' },
  { name: 'Brandy', colour: '#B91C1C' },
  { name: 'Other', colour: '#6B7280' }
]

export const CATEGORY_COLOURS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map(c => [c.name, c.colour])
)

export function getCategoryColour(name: string): string {
  return CATEGORY_COLOURS[name] || '#6B7280'
}