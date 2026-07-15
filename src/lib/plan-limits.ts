/**
 * Plan limits — single source of truth for the entire app.
 * Used by billing/verify, billing/webhook, super-admin, and plan-limits enforcement.
 */

export interface PlanLimitConfig {
  max_stores: number
  max_staff: number
  max_products: number
  price: number        // Price in KES per month
  label: string        // Display name
}

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = {
  trial:        { max_stores: 3,   max_staff: 10,  max_products: 200,  price: 0,    label: 'Trial' },
  starter:      { max_stores: 2,   max_staff: 5,   max_products: 100,  price: 2999, label: 'Starter' },
  professional: { max_stores: 5,   max_staff: 20,  max_products: 500,  price: 4999, label: 'Professional' },
  enterprise:   { max_stores: 999, max_staff: 999, max_products: 9999, price: 9999, label: 'Enterprise' },
}

/** Get limits for a plan, falling back to trial */
export function getPlanLimits(plan: string): PlanLimitConfig {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.trial
}

/** Get just the numeric limit fields (for DB updates) */
export function getPlanLimitFields(plan: string) {
  const limits = getPlanLimits(plan)
  return { max_stores: limits.max_stores, max_staff: limits.max_staff, max_products: limits.max_products }
}

/* ------------------------------------------------------------------ */
/*  Plan limit enforcement                                             */
/* ------------------------------------------------------------------ */

interface LimitCheck {
  passed: boolean
  error?: string
}

/**
 * Check if the org can create more of a resource type.
 * Fetches org limits from DB automatically.
 */
export async function checkPlanLimit(
  db: any,
  orgId: string,
  resourceType: 'stores' | 'staff' | 'products'
): Promise<LimitCheck> {
  // Fetch org limits
  const { data: org, error: orgError } = await db
    .from('organisations')
    .select('plan, max_stores, max_staff, max_products')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return { passed: false, error: 'Could not verify plan limits' }
  }

  // Enterprise has no limits
  if (org.max_stores >= 999) return { passed: true }

  const maxLimit = org[`max_${resourceType}`] as number

  const tableMap: Record<string, string> = {
    stores: 'stores',
    staff: 'users',
    products: 'products',
  }

  const { count, error } = await db
    .from(tableMap[resourceType])
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  if (error) {
    return { passed: false, error: `Failed to check ${resourceType} count` }
  }

  if ((count || 0) >= maxLimit) {
    const label = resourceType === 'staff' ? 'staff members' : resourceType
    return {
      passed: false,
      error: `You've reached the ${label} limit for your ${org.plan} plan (${maxLimit}). Upgrade to add more.`,
    }
  }

  return { passed: true }
}