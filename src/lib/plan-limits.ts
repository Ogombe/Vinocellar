/**
 * Plan limit enforcement.
 * Fetches org limits from DB and checks against current usage.
 */

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