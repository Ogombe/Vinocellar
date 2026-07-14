import { supabaseServer } from '@/lib/supabase-server'

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
  await supabaseServer.from('audit_logs').insert({
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId || null,
    before_value: params.beforeValue ? JSON.stringify(params.beforeValue) : null,
    after_value: params.afterValue ? JSON.stringify(params.afterValue) : null,
    user_id: params.userId,
    organisation_id: params.organisationId
  })
}

// ==================== INVENTORY HEALTH ====================

export function calculateHealthScore(products: { current_stock: number; reorder_level: number }[]): number {
  if (products.length === 0) return 100
  let lowStockCount = 0
  let outOfStockCount = 0
  let totalCoverageDays = 0

  for (const p of products) {
    if (p.current_stock === 0) outOfStockCount++
    else if (p.current_stock <= p.reorder_level) lowStockCount++
    totalCoverageDays += p.reorder_level > 0 ? (p.current_stock / p.reorder_level) * 7 : 7
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