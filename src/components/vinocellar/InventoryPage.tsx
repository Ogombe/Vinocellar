'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Product, Category, Supplier } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Filter,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

const SIZE_OPTIONS = ['750ml', '375ml', '1L', '500ml', '1.5L', '200ml'] as const

const formatKES = (amount: number): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stockStatus(stock: number, reorderLevel: number) {
  if (stock <= 0) return { label: 'Out of Stock', className: 'bg-red-100 text-red-700 border-red-200' }
  if (stock <= reorderLevel) return { label: 'Low Stock', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: 'In Stock', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
}

/* ------------------------------------------------------------------ */
/*  Empty form                                                         */
/* ------------------------------------------------------------------ */

interface ProductForm {
  name: string
  sku: string
  barcode: string
  size: string
  category_id: string
  supplier_id: string
  cost_price: string
  sell_price: string
  reorder_level: string
  opening_stock: string
}

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  barcode: '',
  size: '750ml',
  category_id: '',
  supplier_id: '',
  cost_price: '',
  sell_price: '',
  reorder_level: '5',
  opening_stock: '0',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const isMobile = useIsMobile()
  const { store, appUser } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)

  /* ── Data fetching ─────────────────────────────────────────────── */

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*), supplier:suppliers(*)')
        .eq('store_id', store!.id)
        .order('name')
      return (data as Product[]) || []
    },
    enabled: !!store?.id,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', store?.organisation_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('organisation_id', store!.organisation_id)
        .order('name')
      return (data as Category[]) || []
    },
    enabled: !!store?.organisation_id,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', store?.organisation_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organisation_id', store!.organisation_id)
        .order('name')
      return (data as Supplier[]) || []
    },
    enabled: !!store?.organisation_id,
  })

  /* ── Filtered list ─────────────────────────────────────────────── */

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  /* ── Mutations ─────────────────────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const row = {
        name: values.name,
        sku: values.sku,
        barcode: values.barcode,
        size: values.size,
        category_id: values.category_id || null,
        supplier_id: values.supplier_id || null,
        cost_price: parseFloat(values.cost_price) || 0,
        sell_price: parseFloat(values.sell_price) || 0,
        reorder_level: parseInt(values.reorder_level) || 0,
        organisation_id: store!.organisation_id,
        store_id: store!.id,
        updated_at: new Date().toISOString(),
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(row)
          .eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const openingStock = parseInt(values.opening_stock) || 0
        const { data, error } = await supabase
          .from('products')
          .insert({ ...row, opening_stock: openingStock, current_stock: openingStock })
          .select()
          .single()
        if (error) throw error

        if (openingStock > 0) {
          await supabase.from('stock_movements').insert({
            product_id: data.id,
            store_id: store!.id,
            organisation_id: store!.organisation_id,
            movement_type: 'opening',
            quantity: openingStock,
            reference_id: null,
            notes: 'Opening stock',
            created_by: appUser!.id,
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      handleCloseDialog()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  /* ── Dialog helpers ────────────────────────────────────────────── */

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      size: product.size,
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      cost_price: String(product.cost_price),
      sell_price: String(product.sell_price),
      reorder_level: String(product.reorder_level),
      opening_stock: '0',
    })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingProduct(null)
    setForm(emptyForm)
  }

  const handleDelete = (product: Product) => {
    if (window.confirm(`Delete "${product.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(product.id)
    }
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    saveMutation.mutate(form)
  }

  /* ── Loading skeleton ──────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-44" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  /* ── Render: Mobile cards ──────────────────────────────────────── */

  const renderMobileCards = () => (
    <div className="grid gap-3">
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">No products found</p>
          <p className="text-xs">Try adjusting your search or filter</p>
        </div>
      )}
      {filtered.map((product) => {
        const status = stockStatus(product.current_stock, product.reorder_level)
        return (
          <Card key={product.id} className="overflow-hidden border border-border/60 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {product.category && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: product.category.colour || ACCENT,
                          color: product.category.colour || ACCENT,
                          backgroundColor: `${product.category.colour || ACCENT}14`,
                        }}
                      >
                        {product.category.name}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{product.size}</span>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] font-medium ${status.className}`}>
                  {status.label}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/50 pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</p>
                  <p className="text-xs font-semibold">{formatKES(product.cost_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sell</p>
                  <p className="text-xs font-semibold">{formatKES(product.sell_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock</p>
                  <p className="text-xs font-bold">{product.current_stock} units</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => handleOpenEdit(product)}
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDelete(product)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  /* ── Render: Desktop table ─────────────────────────────────────── */

  const renderDesktopTable = () => (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost Price</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sell Price</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Stock</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Package className="mb-3 h-12 w-12 opacity-40" />
                      <p className="text-sm font-medium">No products found</p>
                      <p className="text-xs">Try adjusting your search or filter</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((product) => {
                const status = stockStatus(product.current_stock, product.reorder_level)
                return (
                  <TableRow key={product.id} className="border-border/40 transition-colors hover:bg-muted/30">
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{product.name}</span>
                        <span className="text-[11px] text-muted-foreground">{product.sku || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-medium"
                          style={{
                            borderColor: product.category.colour || ACCENT,
                            color: product.category.colour || ACCENT,
                            backgroundColor: `${product.category.colour || ACCENT}14`,
                          }}
                        >
                          {product.category.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.size}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatKES(product.cost_price)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatKES(product.sell_price)}</TableCell>
                    <TableCell className="text-center text-sm font-semibold tabular-nums">{product.current_stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[11px] font-medium ${status.className}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit {product.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {product.name}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  /* ── Main render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 ? 's' : ''} &middot;{' '}
            {filtered.length} shown
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="shrink-0 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10"
          />
        </div>
        <div className="relative w-full sm:w-52">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 pl-10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products list */}
      {isMobile ? renderMobileCards() : renderDesktopTable()}

      {/* ── Add / Edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="product-name" className="text-xs font-medium text-muted-foreground">
                Product Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-name"
                placeholder="e.g. Hennessy VS Cognac"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* SKU & Barcode row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="product-sku" className="text-xs font-medium text-muted-foreground">
                  SKU
                </Label>
                <Input
                  id="product-sku"
                  placeholder="SKU-001"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-barcode" className="text-xs font-medium text-muted-foreground">
                  Barcode
                </Label>
                <Input
                  id="product-barcode"
                  placeholder="6001234567890"
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                />
              </div>
            </div>

            {/* Size & Category row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost & Sell price row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost-price" className="text-xs font-medium text-muted-foreground">
                  Cost Price (KES)
                </Label>
                <Input
                  id="cost-price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.cost_price}
                  onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sell-price" className="text-xs font-medium text-muted-foreground">
                  Sell Price (KES)
                </Label>
                <Input
                  id="sell-price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.sell_price}
                  onChange={(e) => setForm((f) => ({ ...f, sell_price: e.target.value }))}
                />
              </div>
            </div>

            {/* Reorder Level & Opening Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reorder-level" className="text-xs font-medium text-muted-foreground">
                  Reorder Level
                </Label>
                <Input
                  id="reorder-level"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="5"
                  value={form.reorder_level}
                  onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                />
              </div>
              {!editingProduct && (
                <div className="grid gap-2">
                  <Label htmlFor="opening-stock" className="text-xs font-medium text-muted-foreground">
                    Opening Stock
                  </Label>
                  <Input
                    id="opening-stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.opening_stock}
                    onChange={(e) => setForm((f) => ({ ...f, opening_stock: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-3 pt-2 sm:justify-end">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={handleCloseDialog}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
              onClick={handleSave}
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}