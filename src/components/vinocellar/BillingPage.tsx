'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAppStore } from '@/lib/store'
import {
  Check, CreditCard, Crown, Zap, Building2,
  Loader2, CheckCircle2, XCircle, RefreshCw,
  Receipt, Clock, ArrowUpRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

interface PlanDetail {
  name: string
  price: number
  currency: string
  features: string[]
}

interface PaymentRecord {
  id: string
  reference: string
  plan: string
  amount: number
  currency: string
  status: string
  payment_method: string | null
  paid_at: string | null
  created_at: string
}

const PLAN_CONFIG: Record<string, { icon: React.ElementType; color: string; gradient: string; highlight: boolean; description: string }> = {
  starter: {
    icon: Zap,
    color: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-700',
    highlight: false,
    description: 'Perfect for small shops just getting started',
  },
  professional: {
    icon: CreditCard,
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-indigo-600',
    highlight: true,
    description: 'For growing businesses that need more power',
  },
  enterprise: {
    icon: Crown,
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-600',
    highlight: false,
    description: 'Full power for large operations',
  },
}

import { formatKSh as formatKES } from '@/lib/currency'

export default function BillingPage() {
  const { session, appUser, organisation } = useAuth()
  const { setCurrentPage } = useAppStore()
  const [plans, setPlans] = useState<Record<string, PlanDetail>>({})
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<{ success: boolean; plan?: string; message?: string } | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  // Load plans
  useEffect(() => {
    fetch('/api/billing/subscribe')
      .then(r => r.json())
      .then(data => setPlans(data.plans || {}))
      .finally(() => setLoading(false))
  }, [])

  // Load payment history
  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    fetch('/api/payments', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setPayments(data.payments || []))
      .catch(() => {})
      .finally(() => setPaymentsLoading(false))
  }, [session])

  // Check for payment callback in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref')
    if (reference) {
      window.location.href = `/billing/complete?reference=${reference}`
    }
  }, [])

  const handleSubscribe = async (planKey: string) => {
    setSubscribing(planKey)
    try {
      const token = session?.access_token
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()

      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        alert(data.error || 'Failed to initialize payment')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setSubscribing(null)
    }
  }

  const currentPlan = organisation?.plan || 'trial'
  const trialEnd = organisation?.trial_ends_at
  const periodEnd = organisation?.current_period_end
  const isPaid = currentPlan !== 'trial'

  const daysLeft = isPaid
    ? (periodEnd ? Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0)
    : (trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0)

  const periodLabel = isPaid
    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in billing cycle`
    : `Trial period — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Billing & Subscription</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your subscription plan and payment methods</p>
      </div>

      {/* ── Current Status ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900">Current Plan</h3>
                <Badge className={currentPlan === 'trial' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}>
                  {currentPlan.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {isPaid
                  ? `Your ${plans[currentPlan]?.name || currentPlan} plan is active — ${periodLabel}`
                  : periodLabel
                }
              </p>
            </div>
            {currentPlan === 'trial' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Upgrade to continue</span>
              </div>
            )}
          </div>
          {/* Usage limits */}
          {organisation && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{organisation.max_stores === 999 ? 'Unlimited' : organisation.max_stores}</p>
                <p className="text-xs text-slate-500 mt-0.5">Stores</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{organisation.max_staff === 999 ? 'Unlimited' : organisation.max_staff}</p>
                <p className="text-xs text-slate-500 mt-0.5">Staff</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{organisation.max_products === 9999 ? 'Unlimited' : organisation.max_products}</p>
                <p className="text-xs text-slate-500 mt-0.5">Products</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Result ── */}
      {paymentStatus && (
        <Alert className={paymentStatus.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          {paymentStatus.success
            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            : <XCircle className="h-4 w-4 text-red-600" />
          }
          <AlertDescription className={paymentStatus.success ? 'text-emerald-800' : 'text-red-800'}>
            {paymentStatus.message}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Plans Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(plans).map(([key, plan]) => {
          const config = PLAN_CONFIG[key]
          if (!config) return null
          const Icon = config.icon
          const isCurrent = currentPlan === key
          const isSubscribing = subscribing === key

          return (
            <Card
              key={key}
              className={`relative border-0 shadow-sm overflow-hidden ${config.highlight ? 'ring-2 ring-purple-500' : ''}`}
            >
              {config.highlight && (
                <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                  POPULAR
                </div>
              )}
              <CardHeader className="pb-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${config.gradient}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-lg mt-2">{plan.name}</CardTitle>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">{formatKES(plan.price)}</span>
                  <span className="text-sm text-slate-500">/month</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Current Plan
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${config.highlight ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    onClick={() => handleSubscribe(key)}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><CreditCard className="h-4 w-4 mr-2" /> Subscribe</>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* ── Payment History ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {paymentsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No payments yet</p>
              <p className="text-xs text-slate-400 mt-1">When you subscribe to a plan, your payment history will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      p.status === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {p.status === 'success'
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 capitalize">{p.plan} Plan</p>
                      <p className="text-xs text-slate-500 truncate">
                        {p.paid_at
                          ? new Date(p.paid_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
                          : new Date(p.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
                        }
                        {p.payment_method && ` · ${p.payment_method}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{formatKES(p.amount / 100)}</p>
                    <Badge variant={p.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Info ── */}
      <Card className="border-0 shadow-sm bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Payments powered by Paystack</p>
              <p className="mt-0.5">Securely pay with M-Pesa, card, or bank transfer. Your payment details are encrypted and never stored on our servers.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}