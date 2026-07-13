'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Product } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ClipboardCheck,
  Plus,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  History,
  Package,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

interface StockTake {
  id: string
  status: 'in_progress' | 'pending' | 'approved' | 'rejected'
  started_by: string
  approved_by: string | null
  approved_at: string | null
  organisation_id: string
  store_id: string
  started_at: string
  submitted_at: string | null
}

interface StockTakeItem {
  id: string
  expected: number
  counted: number | null
  stock_take_id: string
  product_id: string
  product?: Product
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  in_progress: <Clock className="h-3.5 w-3.5" />,
  pending: <AlertTriangle className="h-3.5 w-3.5" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StockCountPage() {
  const isMobile = useIsMobile()
  const { store, appUser, organisation } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedTake, setSelectedTake] = useState<StockTake | null>(null)

  const isManager = appUser?.role === 'manager' || appUser?.role === 'super_admin'

  /* ── Fetch active stock take ────────────────────────────────────── */

  const { data: activeTake, isLoading: activeLoading } = useQuery<StockTake>({
    queryKey: ['stock-take-active', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_takes')
        .select('*')
        .eq('store_id', store!.id)
        .eq('status', 'in_progress')
        .maybeSingle()
      return data as StockTake | null
    },
    enabled: !!store?.id,
  })

  /* ── Fetch active stock take items ──────────────────────────────── */

  const { data: activeItems = [], isLoading: itemsLoading } = useQuery<(StockTakeItem & { product: Product })[]>({
    queryKey: ['stock-take-items', activeTake?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_take_items')
        .select('*, product:products!inner(id, name, sku, current_stock)')
        .eq('stock_take_id', activeTake!.id)
      return (data as (StockTakeItem & { product: Product })[]) || []
    },
    enabled: !!activeTake?.id,
  })

  /* ── Fetch all products (for creating new stock take) ───────────── */

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['products-stock-take', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store!.id)
        .order('name')
      return (data as Product[]) || []
    },
    enabled: !!store?.id,
  })

  /* ── Fetch stock take history ───────────────────────────────────── */

  const { data: history = [], isLoading: historyLoading } = useQuery<(StockTake & {
    stock_take_items: (StockTakeItem & { product: Product })[]
  })[]>({
    queryKey: ['stock-take-history', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_takes')
        .select('*, stock_take_items(*, product:products!inner(id, name, current_stock))')
        .eq('store_id', store!.id)
        .neq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(20)
      return (data as (StockTake & {
        stock_take_items: (StockTakeItem & { product: Product })[]
      })[]) || []
    },
    enabled: !!store?.id,
  })

  /* ── Start new stock take mutation ──────────────────────────────── */

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!store || !appUser) throw new Error('Missing store or user')

      // Create the stock take
      const { data: take, error: takeError } = await supabase
        .from('stock_takes')
        .insert({
          status: 'in_progress',
          started_by: appUser.id,
          organisation_id: organisation!.id,
          store_id: store.id,
        })
        .select()
        .single()

      if (takeError) throw takeError

      // Create items for each product
      const items = allProducts.map((p) => ({
        expected: p.current_stock,
        counted: null,
        stock_take_id: take.id,
        product_id: p.id,
      }))

      const { error: itemsError } = await supabase
        .from('stock_take_items')
        .insert(items)

      if (itemsError) throw itemsError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take-active'] })
      queryClient.invalidateQueries({ queryKey: ['stock-take-items'] })
      setCounts({})
    },
  })

  /* ── Save single counted value ──────────────────────────────────── */

  const saveCountMutation = useMutation({
    mutationFn: async ({ itemId, counted }: { itemId: string; counted: number | null }) => {
      const { error } = await supabase
        .from('stock_take_items')
        .update({ counted })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take-items'] })
    },
  })

  /* ── Submit stock take mutation ─────────────────────────────────── */

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!activeTake) throw new Error('No active stock take')
      const { error } = await supabase
        .from('stock_takes')
        .update({
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', activeTake.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take-active'] })
      queryClient.invalidateQueries({ queryKey: ['stock-take-items'] })
      queryClient.invalidateQueries({ queryKey: ['stock-take-history'] })
      setSubmitDialogOpen(false)
      setCounts({})
    },
  })

  /* ── Approve / Reject mutation ──────────────────────────────────── */

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('stock_takes')
        .update({
          status,
          approved_by: appUser!.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take-history'] })
      setApproveDialogOpen(false)
      setRejectDialogOpen(false)
      setSelectedTake(null)
    },
  })

  /* ── Update counted value ───────────────────────────────────────── */

  const handleCountChange = useCallback(
    (itemId: string, value: string) => {
      setCounts((prev) => ({ ...prev, [itemId]: value }))
      const num = value === '' ? null : parseInt(value, 10)
      if (num !== null && !isNaN(num) && num >= 0) {
        saveCountMutation.mutate({ itemId, counted: num })
      }
    },
    [saveCountMutation]
  )

  /* ── Computed: variance stats for active take ───────────────────── */

  const totalItems = activeItems.length
  const countedItems = activeItems.filter((i) => i.counted !== null).length
  const variances = activeItems
    .filter((i) => i.counted !== null)
    .map((i) => ({
      name: i.product?.name ?? 'Unknown',
      expected: i.expected,
      counted: i.counted!,
      variance: (i.counted ?? 0) - i.expected,
    }))
  const totalVariance = variances.reduce((s, v) => s + v.variance, 0)
  const positiveVariance = variances.filter((v) => v.variance > 0)
  const negativeVariance = variances.filter((v) => v.variance < 0)

  /* ── Filtered active items ──────────────────────────────────────── */

  const filteredItems = activeItems.filter((i) =>
    !search.trim() ||
    i.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.product?.sku?.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Loading skeleton ──────────────────────────────────────────── */

  if (activeLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  /* ── Render: Active Stock Take ──────────────────────────────────── */

  const renderActiveTake = () => (
    <div className="space-y-5">
      {/* Progress bar */}
      <Card className="border-border/60 shadow-sm" style={{ borderLeftWidth: '4px', borderLeftColor: ACCENT }}>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}14` }}
              >
                <ClipboardCheck className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Stock Count in Progress</p>
                <p className="text-xs text-muted-foreground">
                  Started {formatDateTime(activeTake!.started_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums" style={{ color: ACCENT }}>
                  {countedItems} <span className="text-sm font-normal text-muted-foreground">/ {totalItems}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">items counted</p>
              </div>
              <Button
                onClick={() => setSubmitDialogOpen(true)}
                disabled={countedItems === 0 || submitMutation.isPending}
                className="shadow-md transition-all hover:shadow-lg"
                style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Items table / cards */}
      {isMobile ? (
        <div className="grid gap-3">
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">No products found</p>
            </div>
          )}
          {filteredItems.map((item) => {
            const variance = item.counted !== null ? item.counted - item.expected : null
            return (
              <Card key={item.id} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.product?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                    </div>
                    {variance !== null && (
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[11px] font-medium ${
                          variance === 0
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : variance > 0
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {variance === 0 ? 'Match' : `${variance > 0 ? '+' : ''}${variance}`}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">Expected</p>
                      <p className="text-base font-semibold tabular-nums">{item.expected}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">Counted</p>
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="—"
                        value={counts[item.id] ?? (item.counted?.toString() ?? '')}
                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                        className="mt-0.5 h-8 text-base tabular-nums"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SKU</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Counted</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Search className="mb-3 h-10 w-10 opacity-40" />
                          <p className="text-sm font-medium">No products found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredItems.map((item) => {
                    const variance = item.counted !== null ? item.counted - item.expected : null
                    return (
                      <TableRow key={item.id} className="border-border/40 transition-colors hover:bg-muted/30">
                        <TableCell className="pl-4 text-sm font-medium text-foreground">
                          {item.product?.name ?? 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.product?.sku}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium">
                          {item.expected}
                        </TableCell>
                        <TableCell className="text-right pr-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={counts[item.id] ?? (item.counted?.toString() ?? '')}
                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                            className="ml-auto h-8 w-20 text-right text-sm tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {variance !== null && (
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'
                              }`}
                            >
                              {variance === 0 ? '✓' : `${variance > 0 ? '+' : ''}${variance}`}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  /* ── Render: No active take ─────────────────────────────────────── */

  const renderNoActiveTake = () => (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${ACCENT}14` }}
        >
          <ClipboardCheck className="h-8 w-8" style={{ color: ACCENT }} />
        </div>
        <p className="text-base font-semibold text-foreground">No Stock Count in Progress</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Start a new stock take to verify your physical inventory against recorded stock levels.
        </p>
        <Button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="mt-4 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          {startMutation.isPending ? (
            'Starting…'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Start New Stock Count
            </>
          )}
        </Button>
        {startMutation.isError && (
          <p className="mt-3 text-xs text-red-600">
            {startMutation.error instanceof Error ? startMutation.error.message : 'Failed to start stock count'}
          </p>
        )}
      </CardContent>
    </Card>
  )

  /* ── Render: History ────────────────────────────────────────────── */

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Stock Take History</h2>
        {history.length > 0 && (
          <Badge variant="secondary" className="text-xs">{history.length}</Badge>
        )}
      </div>

      {historyLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No stock take history</p>
            <p className="text-xs text-muted-foreground">Completed stock takes will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {history.map((take) => {
            const items = take.stock_take_items || []
            const countedCount = items.filter((i) => i.counted !== null).length
            const totalVar = items.reduce(
              (s, i) => s + ((i.counted ?? 0) - i.expected),
              0
            )
            const hasVariance = totalVar !== 0

            return (
              <Card key={take.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: take.status === 'approved'
                            ? '#ECFDF5'
                            : take.status === 'rejected'
                              ? '#FEF2F2'
                              : '#FFFBEB',
                        }}
                      >
                        {STATUS_ICONS[take.status]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">Stock Take</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${STATUS_STYLES[take.status]}`}
                          >
                            {take.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(take.started_at)}
                          {take.submitted_at && (
                            <> &middot; Submitted {formatDateTime(take.submitted_at)}</>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pl-13 sm:pl-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {countedCount} / {items.length} items
                        </p>
                        <p className={`text-sm font-semibold tabular-nums ${
                          hasVariance ? (totalVar > 0 ? 'text-blue-600' : 'text-red-600') : 'text-emerald-600'
                        }`}>
                          {totalVar === 0 ? 'No variance' : `${totalVar > 0 ? '+' : ''}${totalVar} units`}
                        </p>
                      </div>

                      {take.status === 'pending' && isManager && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              setSelectedTake(take)
                              setApproveDialogOpen(true)
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedTake(take)
                              setRejectDialogOpen(true)
                            }}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  /* ── Main render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock Count</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify physical inventory against recorded stock levels
        </p>
      </div>

      {/* Active stock take or start new */}
      {activeTake ? renderActiveTake() : renderNoActiveTake()}

      <Separator className="my-2" />

      {/* History */}
      {renderHistory()}

      {/* ── Submit confirmation dialog ────────────────────────────── */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Stock Count</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You have counted <strong>{countedItems} of {totalItems}</strong> items.
                  {countedItems < totalItems && (
                    <span className="mt-1 block text-amber-600 font-medium">
                      {totalItems - countedItems} items are still uncounted.
                    </span>
                  )}
                </p>

                {variances.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs font-semibold text-foreground">Variance Summary</p>
                    {positiveVariance.length > 0 && (
                      <p className="text-xs text-blue-600">
                        Surplus in {positiveVariance.length} item(s): +{positiveVariance.reduce((s, v) => s + v.variance, 0)} units
                      </p>
                    )}
                    {negativeVariance.length > 0 && (
                      <p className="text-xs text-red-600">
                        Shortage in {negativeVariance.length} item(s): {negativeVariance.reduce((s, v) => s + v.variance, 0)} units
                      </p>
                    )}
                    {totalVariance === 0 && positiveVariance.length === 0 && negativeVariance.length === 0 && (
                      <p className="text-xs text-emerald-600">All counted items match expected stock.</p>
                    )}
                  </div>
                )}

                <p>Once submitted, this stock count will require manager approval.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Approve dialog ────────────────────────────────────────── */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Stock Take</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve the stock take and update product stock levels accordingly. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTake) statusMutation.mutate({ id: selectedTake.id, status: 'approved' })
              }}
              disabled={statusMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {statusMutation.isPending ? 'Approving…' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject dialog ─────────────────────────────────────────── */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Stock Take</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this stock take? The stock levels will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTake) statusMutation.mutate({ id: selectedTake.id, status: 'rejected' })
              }}
              disabled={statusMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {statusMutation.isPending ? 'Rejecting…' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}