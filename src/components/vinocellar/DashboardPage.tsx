'use client'

import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Coins,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wine,
  Zap,
  Snail,
  Skull,
  Sparkles,
  Activity,
  Clock,
  Heart,
  Trophy,
  BarChart3,
  Eye,
} from 'lucide-react'
import { formatKSh } from '@/lib/currency'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatKES = formatKSh

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardData {
  todaySales: number
  todaySalesCount: number
  weeklySales: number
  monthlySales: number
  inventoryValue: number
  totalProducts: number
  lowStock: number
  outOfStock: number
  healthScore: number
  yesterdayRevenue: number
  pendingStockTakes: number
  weeklyRevenueTrend: Array<{ date: string; day: string; revenue: number; count: number }>
  topSellers: Array<{ name: string; revenue: number; qty: number }>
  fastMovers: Array<{ name: string; unitsSold: number; revenue: number }>
  slowMovers: Array<{ name: string; unitsSold: number; revenue: number }>
  deadStock: Array<{ name: string; daysSinceSale: number }>
  lowStockProducts: Array<{ name: string; stock: number }>
  outOfStockProducts: Array<{ name: string }>
  highestMarginProduct: { name: string; margin: number; revenue: number } | null
  recentActivity: Array<{ user: string; action: string; time: string }>
}

interface Insight {
  type: 'positive' | 'negative' | 'warning'
  text: string
  icon: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  AI Insight Generator                                               */
/* ------------------------------------------------------------------ */

function generateInsights(data: DashboardData): Insight[] {
  const insights: Insight[] = []

  // Sales trend vs yesterday
  if (data.yesterdayRevenue > 0) {
    const change = Math.round(((data.todaySales - data.yesterdayRevenue) / data.yesterdayRevenue) * 100)
    if (change > 10) {
      insights.push({ type: 'positive', text: `Sales are up ${change}% compared to yesterday. Strong momentum — keep it going!`, icon: <TrendingUp className="h-4 w-4" /> })
    } else if (change > 0) {
      insights.push({ type: 'positive', text: `Sales are up ${change}% vs yesterday. Steady growth.`, icon: <ArrowUpRight className="h-4 w-4" /> })
    } else if (change < -10) {
      insights.push({ type: 'negative', text: `Sales dropped ${Math.abs(change)}% compared to yesterday. Consider running a happy hour promotion or bundle deal to boost traffic.`, icon: <ArrowDownRight className="h-4 w-4" /> })
    } else if (change < 0) {
      insights.push({ type: 'warning', text: `Sales are slightly down ${Math.abs(change)}% vs yesterday. Monitor trends throughout the day.`, icon: <TrendingUp className="h-4 w-4" /> })
    }
  } else if (data.todaySales > 0) {
    insights.push({ type: 'positive', text: `Today's first sales are in — ${formatKES(data.todaySales)} so far with ${data.todaySalesCount} transaction(s).`, icon: <ShoppingCart className="h-4 w-4" /> })
  }

  // Top seller
  if (data.topSellers.length > 0) {
    const top = data.topSellers[0]
    const weekTotal = data.weeklySales
    const pct = weekTotal > 0 ? Math.round((top.revenue / weekTotal) * 100) : 0
    insights.push({ type: 'positive', text: `"${top.name}" is your best seller this week — ${formatKES(top.revenue)} revenue (${pct}% of weekly sales) with ${top.qty} units sold.`, icon: <Trophy className="h-4 w-4" /> })
  }

  // Dead stock
  if (data.deadStock.length > 0) {
    const names = data.deadStock.slice(0, 2).map(d => `"${d.name}"`).join(', ')
    insights.push({ type: 'warning', text: `You have ${data.deadStock.length} product(s) with zero sales in 30 days (${names}). Consider discounting or running a promotion to free up capital.`, icon: <Skull className="h-4 w-4" /> })
  }

  // Low stock
  if (data.lowStock > 0 && data.lowStockProducts.length > 0) {
    insights.push({ type: 'warning', text: `${data.lowStock} products are at or below reorder level. Prioritize restocking "${data.lowStockProducts[0].name}" (${data.lowStockProducts[0].stock} units left).`, icon: <AlertTriangle className="h-4 w-4" /> })
  }

  // Out of stock
  if (data.outOfStock > 0) {
    const names = data.outOfStockProducts.slice(0, 2).map(p => `"${p.name}"`).join(', ')
    insights.push({ type: 'negative', text: `${data.outOfStock} product(s) are completely out of stock (${names}). You are losing potential sales — reorder immediately.`, icon: <Package className="h-4 w-4" /> })
  }

  // Health score
  if (data.healthScore < 40) {
    insights.push({ type: 'negative', text: `Inventory health score is ${data.healthScore}/100 — critical. Focus on clearing dead stock and restocking your top sellers.`, icon: <Heart className="h-4 w-4" /> })
  } else if (data.healthScore < 70) {
    insights.push({ type: 'warning', text: `Inventory health is ${data.healthScore}/100. There is room for improvement — review slow movers and consolidate inventory.`, icon: <Heart className="h-4 w-4" /> })
  } else {
    insights.push({ type: 'positive', text: `Inventory health is strong at ${data.healthScore}/100. Your stock management is on track.`, icon: <Heart className="h-4 w-4" /> })
  }

  // Highest margin product
  if (data.highestMarginProduct) {
    insights.push({ type: 'positive', text: `"${data.highestMarginProduct.name}" has the highest profit margin at ${data.highestMarginProduct.margin}%. Consider featuring it more prominently or training staff to upsell it.`, icon: <BarChart3 className="h-4 w-4" /> })
  }

  // Fast mover
  if (data.fastMovers.length > 0) {
    insights.push({ type: 'positive', text: `"${data.fastMovers[0].name}" is your fastest mover with ${data.fastMovers[0].unitsSold} units in 30 days. Ensure you always have adequate stock to avoid missed sales.`, icon: <Zap className="h-4 w-4" /> })
  }

  // Slow mover
  if (data.slowMovers.length > 0) {
    const slow = data.slowMovers[0]
    insights.push({ type: 'warning', text: `"${slow.name}" is moving slowly with only ${slow.unitsSold} unit(s) sold in 30 days. Consider bundling it with a popular item or adjusting the price.`, icon: <Snail className="h-4 w-4" /> })
  }

  // Weekly performance
  if (data.weeklySales > 0) {
    const dailyAvg = data.weeklySales / 7
    insights.push({ type: 'positive', text: `Weekly revenue: ${formatKES(data.weeklySales)}. Daily average is ${formatKES(dailyAvg)}. ${data.todaySales >= dailyAvg ? 'Today is above average — great job!' : 'Today is below the daily average — the day is still young.'}`, icon: <BarChart3 className="h-4 w-4" /> })
  }

  // Pending stock takes
  if (data.pendingStockTakes > 0) {
    insights.push({ type: 'warning', text: `You have ${data.pendingStockTakes} pending stock take(s) that need attention. Regular stock counts help maintain accuracy and reduce shrinkage.`, icon: <Eye className="h-4 w-4" /> })
  }

  return insights.slice(0, 8)
}

/* ------------------------------------------------------------------ */
/*  Dashboard data fetcher                                             */
/* ------------------------------------------------------------------ */

function useDashboardData() {
  const { store, organisation } = useAuth()
  return useQuery<DashboardData>({
    queryKey: ['dashboard-full', store?.id, organisation?.id],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token || !store?.id) throw new Error('Not authenticated')

      const res = await fetch('/api/dashboard?storeId=' + store.id, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load dashboard')
      return res.json()
    },
    enabled: !!store?.id && !!organisation?.id,
    refetchInterval: 60_000,
  })
}

/* ------------------------------------------------------------------ */
/*  Skeleton Loaders                                                   */
/* ------------------------------------------------------------------ */

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="gap-0 overflow-hidden p-0">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-28" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <Skeleton className="h-56 w-full" />
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ title, value, icon, iconBg, trend, sub }: {
  title: string; value: string; icon: React.ReactNode; iconBg: string
  trend?: { value: number; label: string }; sub?: string
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-xl font-bold tracking-tight md:text-2xl">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 pt-0.5">
                {trend.value >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-[11px] text-muted-foreground">{trend.label}</span>
              </div>
            )}
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Health Score Ring                                                  */
/* ------------------------------------------------------------------ */

function HealthScoreRing({ score }: { score: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="72" height="72" className="-rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Health</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Insight colors                                                     */
/* ------------------------------------------------------------------ */

const INSIGHT_STYLES: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconColor: 'text-emerald-600' },
  negative: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconColor: 'text-amber-600' },
}

/* ------------------------------------------------------------------ */
/*  Chart tooltip                                                      */
/* ------------------------------------------------------------------ */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold" style={{ color: ACCENT }}>{formatKES(payload[0].value)}</p>
      {payload[0].payload.count > 0 && (
        <p className="text-[11px] text-muted-foreground">{payload[0].payload.count} sale(s)</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { store } = useAuth()
  const { data, isLoading } = useDashboardData()

  const insights = useMemo(() => (data ? generateInsights(data) : []), [data])

  /* ── Loading state ──────────────────────────────────────────────── */

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <KpiGridSkeleton />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3"><ChartSkeleton /></div>
          <div className="lg:col-span-2"><CardSkeleton /></div>
        </div>
        <CardSkeleton />
        <div className="grid gap-6 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  /* ── Computed values ────────────────────────────────────────────── */

  const yesterdayChange = data.yesterdayRevenue > 0
    ? Math.round(((data.todaySales - data.yesterdayRevenue) / data.yesterdayRevenue) * 100)
    : null

  const weeklyAvg = data.weeklySales / 7

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back! Here&apos;s an overview of {store?.name ?? 'your store'}.
        </p>
      </div>

      {/* ── Row 1: KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Today's Sales"
          value={formatKES(data.todaySales)}
          icon={<Coins className="h-5 w-5 text-white" />}
          iconBg="bg-[#7C3AED]"
          trend={yesterdayChange !== null ? { value: yesterdayChange, label: 'vs yesterday' } : undefined}
          sub={`${data.todaySalesCount} transaction(s)`}
        />
        <StatCard
          title="This Week"
          value={formatKES(data.weeklySales)}
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          iconBg="bg-blue-600"
          sub={`Avg ${formatKES(weeklyAvg)}/day`}
        />
        <StatCard
          title="This Month"
          value={formatKES(data.monthlySales)}
          icon={<BarChart3 className="h-5 w-5 text-white" />}
          iconBg="bg-indigo-600"
        />
        <StatCard
          title="Inventory Value"
          value={formatKES(data.inventoryValue)}
          icon={<Package className="h-5 w-5 text-white" />}
          iconBg="bg-teal-600"
          sub={`${data.totalProducts} products`}
        />
        <StatCard
          title="Low / Out of Stock"
          value={`${data.lowStock} / ${data.outOfStock}`}
          icon={<AlertTriangle className="h-5 w-5 text-white" />}
          iconBg="bg-amber-500"
          sub={data.outOfStock > 0 ? 'Needs attention' : 'Looking good'}
        />
        <StatCard
          title="Pending Stock Takes"
          value={String(data.pendingStockTakes)}
          icon={<Eye className="h-5 w-5 text-white" />}
          iconBg="bg-slate-600"
          sub={data.pendingStockTakes > 0 ? 'Awaiting completion' : 'All clear'}
        />
      </div>

      {/* ── Row 2: Revenue Trend + Top Sellers ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Revenue Trend Chart */}
        <Card className="gap-0 overflow-hidden p-0 lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-5 w-5" style={{ color: ACCENT }} />
                Revenue Trend (Last 7 Days)
              </CardTitle>
              <Badge variant="secondary" className="text-xs">Weekly</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.weeklyRevenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.weeklyRevenueTrend} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                  <Bar dataKey="revenue" fill={ACCENT} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No sales data for the past 7 days
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Sellers + Health Score */}
        <Card className="gap-0 overflow-hidden p-0 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Trophy className="h-5 w-5" style={{ color: ACCENT }} />
                Top Sellers This Week
              </CardTitle>
              <HealthScoreRing score={data.healthScore} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.topSellers.length > 0 ? (
              <div className="space-y-3">
                {data.topSellers.map((seller, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{seller.name}</p>
                      <p className="text-[11px] text-muted-foreground">{seller.qty} units sold</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold" style={{ color: ACCENT }}>
                      {formatKES(seller.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Trophy className="mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No sales this week yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: AI Business Insights ────────────────────────────── */}
      <Card
        className="gap-0 overflow-hidden p-0"
        style={{ borderLeftWidth: '4px', borderLeftColor: ACCENT }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}14` }}>
              <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">AI Business Insights</CardTitle>
              <p className="text-[11px] text-muted-foreground">Smart analysis based on your store data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          {insights.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((insight, i) => {
                const style = INSIGHT_STYLES[insight.type]
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${style.bg} ${style.border}`}>
                    <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>{insight.icon}</div>
                    <p className={`text-[13px] leading-relaxed ${style.text}`}>{insight.text}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add sales data to receive personalized business insights.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Row 4: Fast Movers + Slow Movers + Dead Stock ─────────── */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Fast Movers */}
        <Card className="gap-0 overflow-hidden p-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-emerald-500" />
              Fast Movers (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.fastMovers.length > 0 ? (
              <div className="space-y-2.5">
                {data.fastMovers.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.unitsSold} units</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-emerald-600">{formatKES(item.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">No sales data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Slow Movers */}
        <Card className="gap-0 overflow-hidden p-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Snail className="h-4 w-4 text-amber-500" />
              Slow Movers (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.slowMovers.length > 0 ? (
              <div className="space-y-2.5">
                {data.slowMovers.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.unitsSold} unit(s) sold</p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-amber-600">{formatKES(item.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">All products moving well</p>
            )}
          </CardContent>
        </Card>

        {/* Dead Stock + Highest Margin */}
        <Card className="gap-0 overflow-hidden p-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Skull className="h-4 w-4 text-red-500" />
              Dead Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.deadStock.length > 0 ? (
              <>
                <div className="space-y-2.5">
                  {data.deadStock.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">0 sales in 30+ days</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-[10px] text-red-600">
                        Dead
                      </Badge>
                    </div>
                  ))}
                </div>
                {data.highestMarginProduct && (
                  <>
                    <Separator className="my-3" />
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Highest Margin</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{data.highestMarginProduct.name}</p>
                      <p className="text-xs text-emerald-700">{data.highestMarginProduct.margin}% profit margin</p>
                    </div>
                  </>
                )}
              </>
            ) : (
              data.highestMarginProduct ? (
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Highest Margin Product</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{data.highestMarginProduct.name}</p>
                  <p className="text-xs text-emerald-700">{data.highestMarginProduct.margin}% profit margin &middot; {formatKES(data.highestMarginProduct.revenue)} revenue</p>
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">No dead stock — well managed!</p>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 5: Low Stock Alerts + Recent Activity ─────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Stock Alerts */}
        <Card className="gap-0 overflow-hidden p-0 lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Stock Alerts
              </CardTitle>
              <div className="flex gap-2">
                {data.outOfStock > 0 && (
                  <Badge variant="destructive" className="bg-red-100 text-red-700 text-[11px] hover:bg-red-100">
                    {data.outOfStock} out of stock
                  </Badge>
                )}
                {data.lowStock > 0 && (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700 text-[11px]">
                    {data.lowStock} low
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {(data.lowStockProducts.length > 0 || data.outOfStockProducts.length > 0) ? (
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {data.outOfStockProducts.map((p, i) => (
                    <div key={`out-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-[11px] text-red-700">Out</Badge>
                    </div>
                  ))}
                  {data.lowStockProducts.map((p, i) => (
                    <div key={`low-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[11px] text-amber-700">
                        {p.stock} left
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="mb-2 h-10 w-10 text-emerald-500/40" />
                <p className="text-sm font-medium text-foreground">All stocked up</p>
                <p className="text-xs text-muted-foreground">No products below reorder level</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="gap-0 overflow-hidden p-0 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-5 w-5" style={{ color: ACCENT }} />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            {data.recentActivity.length > 0 ? (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {data.recentActivity.slice(0, 10).map((log, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs capitalize text-foreground">
                          <span className="font-medium">{log.user}</span>{' '}
                          <span className="text-muted-foreground">{log.action}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(log.time), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}