'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'

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
  weeklyRevenueTrend: { day: string; revenue: number }[]
  topSellers: { name: string; revenue: number }[]
  fastMovers: { name: string; unitsSold: number; revenue: number }[]
  slowMovers: { name: string; unitsSold: number; revenue: number }[]
  recentActivity: { user: string; action: string; time: string }[]
  lowStockProducts: { name: string; stock: number }[]
  outOfStockProducts: { name: string }[]
  highestMarginProduct: { name: string; margin: number } | null
  deadStock: { name: string; daysSinceSale: number }[]
  yesterdayRevenue: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmt = (n: number) => 'KSh ' + n.toLocaleString('en-KE')

const scoreLabel = (s: number): string => {
  if (s >= 80) return 'Excellent'
  if (s >= 60) return 'Good'
  if (s >= 40) return 'Fair'
  if (s >= 20) return 'Poor'
  return 'Critical'
}

/* ------------------------------------------------------------------ */
/*  Gradient variants                                                  */
/* ------------------------------------------------------------------ */
const gradients: Record<string, { from: string; to: string; icon: string }> = {
  crimson:  { from: '#DC2626', to: '#991B1B', icon: 'sales' },
  amber:    { from: '#F59E0B', to: '#D97706', icon: 'chart' },
  emerald:  { from: '#10B981', to: '#059669', icon: 'calendar' },
  blue:     { from: '#3B82F6', to: '#2563EB', icon: 'wallet' },
  purple:   { from: '#8B5CF6', to: '#6D28D9', icon: 'box' },
  teal:     { from: '#14B8A6', to: '#0D9488', icon: 'health' },
  pink:     { from: '#EC4899', to: '#DB2777', icon: 'trend' },
  orange:   { from: '#F97316', to: '#EA580C', icon: 'alert' },
}

/* ------------------------------------------------------------------ */
/*  Watermark icons (SVG, no emoji)                                    */
/* ------------------------------------------------------------------ */
function WatermarkIcon({ type }: { type: string }) {
  const cls = 'absolute -right-2 -bottom-2 opacity-10 pointer-events-none'
  const size = 80
  switch (type) {
    case 'sales':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/>
        </svg>
      )
    case 'chart':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
      )
    case 'calendar':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm2 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
        </svg>
      )
    case 'wallet':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      )
    case 'box':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V5c0-1.1-1-3-2-3zm-5 12H9v-2h6v2zm5-7H4V5h16v2z"/>
        </svg>
      )
    case 'health':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M19.5 9.5c-1.03 0-1.9.62-2.29 1.5h-2.92c-.39-.88-1.26-1.5-2.29-1.5s-1.9.62-2.29 1.5H6.79c-.39-.88-1.26-1.5-2.29-1.5C3.12 9.5 2 10.62 2 12s1.12 2.5 2.5 2.5c1.03 0 1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5s1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5 1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/>
        </svg>
      )
    case 'alert':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      )
    default:
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
  }
}

/* ------------------------------------------------------------------ */
/*  Health Score Ring                                                  */
/* ------------------------------------------------------------------ */
function HealthScoreRing({ score }: { score: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const label = scoreLabel(score)
  const color = score >= 60 ? '#10B981' : score >= 40 ? '#F59E0B' : '#DC2626'

  return (
    <div className="flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text
          x="50" y="46" textAnchor="middle" dominantBaseline="central"
          fill={color}
          fontSize="22" fontWeight="700" fontFamily="system-ui, sans-serif"
        >
          {score}
        </text>
        <text
          x="50" y="64" textAnchor="middle" dominantBaseline="central"
          fill="#9CA3AF"
          fontSize="9" fontWeight="500" fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */
function StatCardSkeleton() {
  return (
    <div className="rounded-[14px] p-5 animate-pulse" style={{ background: '#E5E7EB' }}>
      <div className="h-4 w-24 rounded bg-gray-300 mb-3" />
      <div className="h-7 w-32 rounded bg-gray-300 mb-2" />
      <div className="h-3 w-20 rounded bg-gray-300" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)] animate-pulse">
      <div className="h-5 w-40 rounded bg-gray-200 mb-4" />
      <div className="h-64 rounded bg-gray-100" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({
  gradient, label, value, sub, children
}: {
  gradient: string
  label: string
  value: string
  sub?: string
  children?: React.ReactNode
}) {
  const g = gradients[gradient]
  return (
    <div
      className="relative overflow-hidden rounded-[14px] p-5 text-white shadow-[0_4px_12px_rgba(31,17,41,.06)]"
      style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      <WatermarkIcon type={g.icon} />
      <p className="text-sm font-medium opacity-90 mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight leading-tight">{value}</p>
      {sub && <p className="text-xs opacity-80 mt-1">{sub}</p>}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Time ago helper                                                    */
/* ------------------------------------------------------------------ */
function timeAgo(t: string): string {
  const diff = Date.now() - new Date(t).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Page                                                */
/* ------------------------------------------------------------------ */
export function DashboardPage() {
  const storeId = useAppStore(s => s.storeId)
  const isManager = useAppStore(s => s.isManager)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .getDashboard(storeId ? 'storeId=' + storeId : '')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [storeId])

  /* ---- Staff view (simplified) ---- */
  if (!isManager) {
    return (
      <div className="p-4 md:p-6 space-y-6" style={{ background: '#FAF7F2', minHeight: '100vh' }}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your store at a glance</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard gradient="crimson" label="Today's Sales" value={fmt(data.todaySales)} sub={`${data.todaySalesCount || 0} sales`} />
              <StatCard gradient="orange" label="Low Stock" value={String(data.lowStock)} sub="items below threshold" />
              <StatCard gradient="crimson" label="Out of Stock" value={String(data.outOfStock)} sub="need restocking" />
            </div>

            {/* Staff activity list */}
            <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {data.recentActivity && data.recentActivity.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {data.recentActivity.slice(0, 8).map((a, i) => (
                    <li key={i} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                          {a.user?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.user}</p>
                          <p className="text-xs text-gray-500">{a.action}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(a.time)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No recent activity</p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-[14px] p-10 text-center shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <p className="text-gray-400">Unable to load dashboard data.</p>
          </div>
        )}
      </div>
    )
  }

  /* ---- Manager view (full) ---- */
  const insights: { title: string; items: string[] }[] = []

  if (data) {
    // Low stock alerts
    if (data.lowStockProducts && data.lowStockProducts.length > 0) {
      insights.push({
        title: 'Low Stock Alerts',
        items: data.lowStockProducts.slice(0, 3).map(
          (p) => `${p.name} has only ${p.stock} units remaining. Reorder soon to avoid stockouts.`
        ),
      })
    }

    // Day-over-day revenue
    if (data.yesterdayRevenue != null) {
      const diff = data.todaySales - data.yesterdayRevenue
      const pct = data.yesterdayRevenue > 0 ? ((diff / data.yesterdayRevenue) * 100).toFixed(1) : 'N/A'
      if (diff >= 0) {
        insights.push({
          title: 'Revenue Trend',
          items: [`Today's revenue is up ${pct}% compared to yesterday (${fmt(data.yesterdayRevenue)}). Sales momentum is strong.`],
        })
      } else {
        insights.push({
          title: 'Revenue Trend',
          items: [`Today's revenue is down ${Math.abs(Number(pct))}% compared to yesterday (${fmt(data.yesterdayRevenue)}). Consider running promotions.`],
        })
      }
    }

    // Highest margin
    if (data.highestMarginProduct) {
      insights.push({
        title: 'Top Margin Product',
        items: [`${data.highestMarginProduct.name} has the highest margin at ${data.highestMarginProduct.margin}%. Prioritize its placement.`],
      })
    }

    // Dead stock
    if (data.deadStock && data.deadStock.length > 0) {
      insights.push({
        title: 'Dead Stock Detected',
        items: data.deadStock.slice(0, 3).map(
          (p) => `${p.name} has not sold in ${p.daysSinceSale} days. Consider discounting or removing.`
        ),
      })
    }

    // Health score
    insights.push({
      title: 'Inventory Health',
      items: [
        data.healthScore >= 80
          ? 'Your inventory health is excellent. Keep up the great management.'
          : data.healthScore >= 60
          ? 'Inventory health is good but has room for improvement. Focus on reducing dead stock.'
          : data.healthScore >= 40
          ? 'Inventory health is fair. Address low stock and dead stock items urgently.'
          : data.healthScore >= 20
          ? 'Inventory health is poor. Significant restocking and dead stock clearance needed.'
          : 'Inventory health is critical. Immediate intervention required to prevent revenue loss.',
      ],
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6" style={{ background: '#FAF7F2', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Business performance overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Live data
        </div>
      </div>

      {/* Row 1: Main KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            gradient="crimson"
            label="Today's Sales"
            value={fmt(data.todaySales)}
            sub={`${data.todaySalesCount || 0} sales today`}
          />
          <StatCard
            gradient="amber"
            label="Weekly Sales"
            value={fmt(data.weeklySales)}
          />
          <StatCard
            gradient="emerald"
            label="Monthly Sales"
            value={fmt(data.monthlySales)}
          />
          <StatCard
            gradient="blue"
            label="Inventory Value"
            value={fmt(data.inventoryValue)}
          />
        </div>
      ) : null}

      {/* Row 2: Inventory KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            gradient="purple"
            label="Total Products"
            value={String(data.totalProducts)}
            sub="active SKUs"
          />
          <StatCard
            gradient="orange"
            label="Low Stock"
            value={String(data.lowStock)}
            sub="items below threshold"
          />
          <StatCard
            gradient="crimson"
            label="Out of Stock"
            value={String(data.outOfStock)}
            sub="need restocking"
          />
          <StatCard
            gradient="teal"
            label="Health Score"
            value=""
          >
            <div className="mt-2">
              <HealthScoreRing score={data.healthScore} />
            </div>
          </StatCard>
        </div>
      ) : null}

      {/* Row 3: Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Weekly Revenue Trend */}
          <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Weekly Revenue Trend</h2>
            <p className="text-xs text-gray-400 mb-4">Last 7 days performance</p>
            {data.weeklyRevenueTrend && data.weeklyRevenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.weeklyRevenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '13px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value: number) => [fmt(value), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    fill="url(#areaFill)"
                    dot={{ r: 4, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No trend data available</div>
            )}
          </div>

          {/* Top Sellers */}
          <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Top Sellers</h2>
            <p className="text-xs text-gray-400 mb-4">By revenue (top 5)</p>
            {data.topSellers && data.topSellers.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.topSellers}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '10px',
                      fontSize: '13px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value: number) => [fmt(value), 'Revenue']}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#DC2626"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No sales data available</div>
            )}
          </div>
        </div>
      ) : null}

      {/* Row 4: AI Business Insights */}
      {!loading && data && (
        <div
          className="rounded-[14px] p-5 md:p-6"
          style={{ background: '#1F1129' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B">
                <path d="M9.5 2a2.5 2.5 0 012.5 2.5V7h-5V4.5A2.5 2.5 0 019.5 2zM19 8h-1V6.5A2.5 2.5 0 0015.5 4h-2.16A4.48 4.48 0 009.5 1 4.48 4.48 0 006.16 4H4.5A2.5 2.5 0 002 6.5V8H1a1 1 0 00-1 1v1a5 5 0 005 5h1v6a1 1 0 001 1h1a1 1 0 001-1v-6h2v6a1 1 0 001 1h1a1 1 0 001-1v-6h1a5 5 0 005-5V9a1 1 0 00-1-1z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#F59E0B' }}>AI Business Insights</h2>
              <p className="text-xs" style={{ color: 'rgba(245,158,11,0.6)' }}>Automated analysis of your store data</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {insights.map((section, si) => (
              <div
                key={si}
                className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#F59E0B' }}>{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="flex gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 5: Fast Movers, Slow Movers, Recent Activity */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Fast Movers */}
          <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <h2 className="text-base font-semibold text-gray-900">Fast Movers</h2>
            </div>
            {data.fastMovers && data.fastMovers.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {data.fastMovers.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                        style={{
                          background: i === 0 ? '#10B981' : i === 1 ? '#3B82F6' : i === 2 ? '#F59E0B' : '#D1D5DB',
                          color: i >= 3 ? '#6B7280' : '#fff',
                        }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.unitsSold} units sold</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{fmt(item.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 py-4">No data available</p>
            )}
          </div>

          {/* Slow Movers */}
          <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              <h2 className="text-base font-semibold text-gray-900">Slow Movers</h2>
            </div>
            {data.slowMovers && data.slowMovers.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {data.slowMovers.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.unitsSold} units sold</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{fmt(item.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 py-4">No data available</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_12px_rgba(31,17,41,.06)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            </div>
            {data.recentActivity && data.recentActivity.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {data.recentActivity.slice(0, 8).map((a, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                        {a.user?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.user}</p>
                        <p className="text-xs text-gray-400 truncate">{a.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{timeAgo(a.time)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 py-4">No recent activity</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Empty state when no data and not loading */}
      {!loading && !data && (
        <div className="bg-white rounded-[14px] p-10 text-center shadow-[0_4px_12px_rgba(31,17,41,.06)]">
          <svg className="mx-auto mb-3 text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          <p className="text-gray-400">Unable to load dashboard data. Please try again later.</p>
        </div>
      )}
    </div>
  )
}