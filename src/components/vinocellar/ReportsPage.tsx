'use client'

import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Sale, SaleItem, Expense } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CalendarIcon } from 'lucide-react'
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Receipt,
  BarChart3,
  Trophy,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

type DateRange = '7d' | '30d' | 'month' | 'custom'

const formatKES = (amount: number): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function getDateRange(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  let start: Date
  switch (range) {
    case '7d': {
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      break
    }
    case '30d': {
      start = new Date(now)
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      break
    }
    case 'custom': {
      start = customStart ? new Date(customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const customEndDate = customEnd ? new Date(customEnd + 'T23:59:59') : end
      return { start, end: customEndDate }
    }
  }
  return { start, end }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const isMobile = useIsMobile()
  const { store, organisation } = useAuth()

  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState(todayISO())

  const { start, end } = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  )

  /* ── Fetch sales for the period ─────────────────────────────────── */

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['report-sales', store?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', store!.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
      return (data as Sale[]) || []
    },
    enabled: !!store?.id,
  })

  /* ── Fetch sale items for the period ────────────────────────────── */

  const { data: saleItems = [], isLoading: itemsLoading } = useQuery<SaleItem[]>({
    queryKey: ['report-sale-items', store?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      // Get all sale IDs
      const saleIds = sales.map((s) => s.id)
      if (saleIds.length === 0) return []

      const { data } = await supabase
        .from('sale_items')
        .select('*')
        .in('sale_id', saleIds)
      return (data as SaleItem[]) || []
    },
    enabled: !!store?.id && sales.length > 0,
  })

  /* ── Fetch expenses for the period ──────────────────────────────── */

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['report-expenses', store?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', store!.id)
        .gte('date', start.toISOString().split('T')[0])
        .lte('date', end.toISOString().split('T')[0])
      return (data as Expense[]) || []
    },
    enabled: !!store?.id,
  })

  const isLoading = salesLoading || itemsLoading || expensesLoading

  /* ── Computed stats ─────────────────────────────────────────────── */

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const totalTransactions = sales.length
  const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  // Revenue by payment method
  const revenueByMethod: Record<string, number> = { cash: 0, card: 0, mpesa: 0 }
  for (const s of sales) {
    revenueByMethod[s.payment_method] = (revenueByMethod[s.payment_method] || 0) + s.total
  }
  const maxMethodRevenue = Math.max(...Object.values(revenueByMethod), 1)

  // Top products by quantity sold
  const productMap: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {}
  for (const item of saleItems) {
    if (!productMap[item.product_id]) {
      productMap[item.product_id] = { name: item.name, qty: 0, revenue: 0, cogs: 0 }
    }
    productMap[item.product_id].qty += item.qty
    productMap[item.product_id].revenue += item.price * item.qty
    productMap[item.product_id].cogs += item.cost * item.qty
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  // Expense total
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Total COGS
  const totalCogs = saleItems.reduce((sum, item) => sum + (item.cost * item.qty), 0)

  // Profit estimate
  const profitEstimate = totalRevenue - totalCogs - totalExpenses

  const PAYMENT_METHOD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    cash: { label: 'Cash', color: '#16A34A', bg: '#F0FDF4' },
    card: { label: 'Card', color: '#2563EB', bg: '#EFF6FF' },
    mpesa: { label: 'M-Pesa', color: '#059669', bg: '#ECFDF5' },
  }

  /* ── Stat Card Skeleton ─────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  /* ── Main render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales analytics and performance insights
          </p>
        </div>
      </div>

      {/* Date range filter */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="h-10 w-full sm:w-44">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-10 w-full sm:w-44"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-10 w-full sm:w-44"
                  />
                </div>
              </>
            )}

            <div className="hidden sm:block">
              <Badge variant="outline" className="text-xs">
                {start.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} —{' '}
                {end.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sales Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {/* Total Revenue */}
        <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md" style={{ borderLeftWidth: '4px', borderLeftColor: ACCENT }}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums" style={{ color: ACCENT }}>
                  {formatKES(totalRevenue)}
                </p>
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}14` }}
              >
                <DollarSign className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md" style={{ borderLeftWidth: '4px', borderLeftColor: '#2563EB' }}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Transactions</p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {totalTransactions.toLocaleString()}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Sale Value */}
        <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md col-span-2 lg:col-span-1" style={{ borderLeftWidth: '4px', borderLeftColor: '#D97706' }}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg. Sale Value</p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums text-amber-600">
                  {formatKES(avgSaleValue)}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue by Payment Method ──────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-5 w-5" style={{ color: ACCENT }} />
            Revenue by Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(revenueByMethod).map(([method, revenue]) => {
            const config = PAYMENT_METHOD_CONFIG[method]
            const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
            return (
              <div key={method} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatKES(revenue)}
                    </span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${maxMethodRevenue > 0 ? (revenue / maxMethodRevenue) * 100 : 0}%`,
                      backgroundColor: config.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
          {totalRevenue === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period</p>
          )}
        </CardContent>
      </Card>

      {/* ── Top Products ───────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Products by Quantity Sold
            </CardTitle>
            {topProducts.length > 0 && (
              <Badge variant="secondary" className="text-xs">Top {topProducts.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isMobile ? (
            /* Mobile cards */
            <div className="grid gap-2 p-4">
              {topProducts.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Trophy className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">No sales data</p>
                  <p className="text-xs">Top products will appear here.</p>
                </div>
              ) : (
                topProducts.map((product, idx) => (
                  <div
                    key={product.name + idx}
                    className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: idx < 3 ? `${ACCENT}14` : 'bg-muted',
                          color: idx < 3 ? ACCENT : 'text-muted-foreground',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatKES(product.revenue)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
                        {product.qty}
                      </p>
                      <p className="text-[10px] text-muted-foreground">units</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Desktop table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="pl-4 w-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty Sold</TableHead>
                    <TableHead className="text-right pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center">
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Trophy className="mb-3 h-10 w-10 opacity-40" />
                          <p className="text-sm font-medium">No sales data</p>
                          <p className="text-xs">Top products will appear here.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    topProducts.map((product, idx) => (
                      <TableRow key={product.name + idx} className="border-border/40 transition-colors hover:bg-muted/30">
                        <TableCell className="pl-4">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: idx < 3 ? `${ACCENT}14` : 'bg-muted',
                              color: idx < 3 ? ACCENT : 'text-muted-foreground',
                            }}
                          >
                            {idx + 1}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">{product.name}</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
                          {product.qty}
                        </TableCell>
                        <TableCell className="pr-4 text-right text-sm font-medium tabular-nums">
                          {formatKES(product.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Financial Summary ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Expenses */}
        <Card className="border-border/60 shadow-sm" style={{ borderLeftWidth: '4px', borderLeftColor: '#EA580C' }}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                <Receipt className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Expenses</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-orange-600">
                  {formatKES(totalExpenses)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
            </p>
          </CardContent>
        </Card>

        {/* Profit Estimate */}
        <Card
          className="border-border/60 shadow-sm"
          style={{
            borderLeftWidth: '4px',
            borderLeftColor: profitEstimate >= 0 ? '#16A34A' : '#DC2626',
          }}
        >
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: profitEstimate >= 0 ? '#F0FDF4' : '#FEF2F2' }}
              >
                {profitEstimate >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Profit Estimate
                </p>
                <p
                  className="mt-0.5 text-xl font-bold tabular-nums"
                  style={{ color: profitEstimate >= 0 ? '#16A34A' : '#DC2626' }}
                >
                  {formatKES(profitEstimate)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Revenue ({formatKES(totalRevenue)}) − COGS ({formatKES(totalCogs)}) − Expenses ({formatKES(totalExpenses)})
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}