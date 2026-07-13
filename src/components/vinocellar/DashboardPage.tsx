'use client'

import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wine,
  Users,
} from 'lucide-react'
import type { Sale, SaleItem, Product } from '@/lib/types'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatKES = (amount: number): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const paymentMethodStyles: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  card: 'bg-sky-100 text-sky-700 border-sky-200',
  mpesa: 'bg-green-100 text-green-700 border-green-200',
}

/* ------------------------------------------------------------------ */
/*  Query fetchers                                                     */
/* ------------------------------------------------------------------ */

function useTodaySales() {
  const { store } = useAuth()
  return useQuery({
    queryKey: ['dashboard', 'today-sales', store?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('sales')
        .select('total')
        .eq('store_id', store!.id)
        .gte('created_at', today)
        .lt('created_at', today + 'T23:59:59.999Z')
      const total = data?.reduce((sum: number, s: { total: number }) => sum + s.total, 0) ?? 0
      return total
    },
    enabled: !!store?.id,
  })
}

function useTotalProducts() {
  const { organisation } = useAuth()
  return useQuery({
    queryKey: ['dashboard', 'total-products', organisation?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', organisation!.id)
      return count ?? 0
    },
    enabled: !!organisation?.id,
  })
}

function useTotalStaff() {
  const { organisation } = useAuth()
  return useQuery({
    queryKey: ['dashboard', 'total-staff', organisation?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', organisation!.id)
        .eq('is_active', true)
      return count ?? 0
    },
    enabled: !!organisation?.id,
  })
}

function useLowStockCount() {
  const { organisation } = useAuth()
  return useQuery({
    queryKey: ['dashboard', 'low-stock-count', organisation?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', organisation!.id)
        .lte('current_stock', supabase.rpc ? 'reorder_level' : 'reorder_level')
      // Fallback: fetch and count client-side for lte comparison
      const { data } = await supabase
        .from('products')
        .select('id, current_stock, reorder_level')
        .eq('organisation_id', organisation!.id)
      if (!data) return 0
      return data.filter((p: Product) => p.current_stock <= p.reorder_level).length
    },
    enabled: !!organisation?.id,
  })
}

function useRecentSales() {
  const { store } = useAuth()
  return useQuery<(Sale & { sale_items: SaleItem[] })[]>({
    queryKey: ['dashboard-sales', store?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('store_id', store!.id)
        .gte('created_at', today)
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []) as (Sale & { sale_items: SaleItem[] })[]
    },
    enabled: !!store?.id,
  })
}

function useLowStockProducts() {
  const { organisation } = useAuth()
  return useQuery<Product[]>({
    queryKey: ['low-stock', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('organisation_id', organisation!.id)
        .order('current_stock', { ascending: true })
      if (!data) return []
      return (data as Product[]).filter((p) => p.current_stock <= p.reorder_level)
    },
    enabled: !!organisation?.id,
  })
}

/* ------------------------------------------------------------------ */
/*  Stat Card Skeleton                                                 */
/* ------------------------------------------------------------------ */

function StatCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  iconBg: string
  trend?: { value: number; label: string }
  isLoading: boolean
}

function StatCard({ title, value, icon, iconBg, trend, isLoading }: StatCardProps) {
  if (isLoading) return <StatCardSkeleton />

  return (
    <Card className="gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 pt-1">
                {trend.value >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Recent Sales Skeleton                                              */
/* ------------------------------------------------------------------ */

function RecentSalesSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ShoppingCart className="h-5 w-5 text-[#7C3AED]" />
          Recent Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Low Stock Skeleton                                                 */
/* ------------------------------------------------------------------ */

function LowStockSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { organisation, store } = useAuth()

  const { data: todaySales, isLoading: salesLoading } = useTodaySales()
  const { data: totalProducts, isLoading: productsLoading } = useTotalProducts()
  const { data: totalStaff, isLoading: staffLoading } = useTotalStaff()
  const { data: lowStockCount, isLoading: lowStockCountLoading } = useLowStockCount()
  const { data: recentSales, isLoading: recentSalesLoading } = useRecentSales()
  const { data: lowStockProducts, isLoading: lowStockLoading } = useLowStockProducts()

  const isLoading =
    salesLoading || productsLoading || staffLoading || lowStockCountLoading

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back! Here&apos;s an overview of {store?.name ?? 'your store'}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={formatKES(todaySales ?? 0)}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          iconBg="bg-[#7C3AED]"
          trend={{ value: 12.5, label: 'vs yesterday' }}
          isLoading={salesLoading}
        />
        <StatCard
          title="Total Products"
          value={(totalProducts ?? 0).toLocaleString()}
          icon={<Package className="h-6 w-6 text-white" />}
          iconBg="bg-blue-600"
          isLoading={productsLoading}
        />
        <StatCard
          title="Total Staff"
          value={(totalStaff ?? 0).toString()}
          icon={<Users className="h-6 w-6 text-white" />}
          iconBg="bg-emerald-600"
          isLoading={staffLoading}
        />
        <StatCard
          title="Low Stock Items"
          value={(lowStockCount ?? 0).toString()}
          icon={<AlertTriangle className="h-6 w-6 text-white" />}
          iconBg="bg-amber-500"
          isLoading={lowStockCountLoading}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Sales - Left (wider) */}
        <div className="lg:col-span-3">
          {recentSalesLoading ? (
            <RecentSalesSkeleton />
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <ShoppingCart className="h-5 w-5 text-[#7C3AED]" />
                    Recent Sales
                  </CardTitle>
                  {recentSales && recentSales.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(), 'MMM d, yyyy')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {recentSales && recentSales.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Time</TableHead>
                        <TableHead className="text-muted-foreground">Items</TableHead>
                        <TableHead className="text-right text-muted-foreground">Total</TableHead>
                        <TableHead className="text-right text-muted-foreground">Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentSales.map((sale) => (
                        <TableRow key={sale.id} className="group">
                          <TableCell className="font-medium text-foreground">
                            {format(new Date(sale.created_at), 'HH:mm')}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Wine className="h-3.5 w-3.5 text-[#7C3AED]/60" />
                              <span>{sale.sale_items?.length ?? 0} item{(sale.sale_items?.length ?? 0) !== 1 ? 's' : ''}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatKES(sale.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={`border capitalize ${
                                paymentMethodStyles[sale.payment_method] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {sale.payment_method}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#7C3AED]/10">
                      <TrendingUp className="h-6 w-6 text-[#7C3AED]" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No sales today</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sales will appear here as they come in.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Low Stock Alerts - Right (narrower) */}
        <div className="lg:col-span-2">
          {lowStockLoading ? (
            <LowStockSkeleton />
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Low Stock Alerts
                  </CardTitle>
                  {lowStockProducts && lowStockProducts.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="bg-red-100 text-red-700 text-xs hover:bg-red-100"
                    >
                      {lowStockProducts.length} item{lowStockProducts.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {lowStockProducts && lowStockProducts.length > 0 ? (
                  <ScrollArea className="max-h-96 overflow-y-auto">
                    <div className="space-y-1">
                      {lowStockProducts.map((product) => {
                        const isOut = product.current_stock === 0
                        const isCritical = !isOut && product.current_stock <= product.reorder_level * 0.5

                        return (
                          <div
                            key={product.id}
                            className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
                          >
                            {/* Status indicator */}
                            <div
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                isOut
                                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                  : isCritical
                                    ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.3)]'
                                    : 'bg-amber-400'
                              }`}
                            />

                            {/* Product info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku}
                              </p>
                            </div>

                            {/* Stock level badge */}
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs ${
                                isOut
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : isCritical
                                    ? 'border-red-200 bg-red-50 text-red-600'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isOut ? 'Out' : `${product.current_stock} / ${product.reorder_level}`}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                      <Package className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-foreground">All stocked up</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No products are below their reorder level.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}