'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAppStore } from '@/lib/store'
import {
  Check, CreditCard, Crown, Zap, Building2, ArrowLeft,
  Loader2, CheckCircle2, XCircle, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlanDetail {
  name: string
  price: number
  currency: string
  features: string[]
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

  // Load plans
  useEffect(() => {
    fetch('/api/billing/subscribe')
      .then(r => r.json())
      .then(data => setPlans(data.plans || {}))
      .finally(() => setLoading(false))
  }, [])

  // Check for payment callback in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference')
    const trxref = params.get('trxref')

    if (reference || trxref) {
      const ref = reference || trxref
      verifyPayment(ref)
      // Clean URL
      window.history.replaceState({}, '', '/billing/complete')
    }
  }, [])

  const verifyPayment = async (reference: string) => {
    try {
      const token = session?.access_token
      const res = await fetch('/api/billing/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reference }),
      })
      const data = await res.json()
      setPaymentStatus({
        success: data.verified,
        plan: data.plan,
        message: data.verified
          ? `Successfully subscribed to ${data.plan} plan for ${formatKES(data.amount)}!`
          : 'Payment verification failed. Please contact support.',
      })
    } catch {
      setPaymentStatus({ success: false, message: 'Could not verify payment. Please contact support.' })
    }
  }

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
        // Redirect to Paystack
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
  const daysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

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
                {currentPlan === 'trial'
                  ? `Trial period — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                  : `Your ${plans[currentPlan]?.name || currentPlan} plan is active`}
              </p>
            </div>
            {currentPlan === 'trial' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Upgrade to continue</span>
              </div>
            )}
          </div>
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