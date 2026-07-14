'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Product } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  Package,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

import { formatKSh as formatKES } from '@/lib/currency'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CartItem {
  productId: string
  name: string
  qty: number
  price: number
  cost: number
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function POSPage() {
  const { store, appUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash')
  const [successOpen, setSuccessOpen] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<string>('')
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store!.id)
        .gt('current_stock', 0)
        .order('name')
      return (data || []) as Product[]
    },
    enabled: !!store?.id,
  })

  /* ---------------------------------------------------------------- */
  /*  Filtered products                                                */
  /* ---------------------------------------------------------------- */

  const filteredProducts = (products || []).filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    )
  })

  /* ---------------------------------------------------------------- */
  /*  Cart helpers                                                     */
  /* ---------------------------------------------------------------- */

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        if (existing.qty >= product.current_stock) return prev
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          price: product.sell_price,
          cost: product.cost_price,
        },
      ]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i
          const newQty = i.qty + delta
          if (newQty < 1) return null
          return { ...i, qty: newQty }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const clearCart = () => setCart([])

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  /* ---------------------------------------------------------------- */
  /*  Complete sale mutation                                           */
  /* ---------------------------------------------------------------- */

  const completeSaleMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('complete_sale', {
        p_store_id: store!.id,
        p_staff_id: appUser!.id,
        p_payment_method: paymentMethod,
        p_items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          price: i.price,
          cost: i.cost,
        })),
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      const saleId =
        typeof data === 'string'
          ? data
          : data?.id ?? data?.sale_id ?? 'Unknown'
      setLastSaleId(saleId)
      setSuccessOpen(true)
      setCart([])
      toast({
        title: 'Sale completed!',
        description: `Sale #${typeof saleId === 'string' ? saleId.slice(0, 8).toUpperCase() : saleId} recorded successfully.`,
      })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
    },
    onError: (error) => {
      toast({
        title: 'Sale failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Point of Sale
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ring up sales quickly and efficiently.
          </p>
        </div>
        {cartCount > 0 && (
          <Badge
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {cartCount} item{cartCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 lg:hidden">
        <button
          onClick={() => setMobileTab('products')}
          className={`relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            mobileTab === 'products'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Products
          <Package className="ml-1.5 inline h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            mobileTab === 'cart'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Cart
          <ShoppingCart className="ml-1.5 inline h-3.5 w-3.5" />
          {cartCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Two-column Layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ====== LEFT PANEL — Products (2/3) ====== */}
        <div
          className={`${
            mobileTab === 'products' ? 'block' : 'hidden'
          } lg:block lg:col-span-2`}
        >
          <Card className="gap-0 overflow-hidden p-0">
            {/* Search Bar */}
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Product Grid */}
            <CardContent className="p-4">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-36 animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div
                    className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${ACCENT}15` }}
                  >
                    <Package className="h-6 w-6" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-sm font-medium">
                    {search ? 'No products match your search' : 'No products in stock'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {search
                      ? 'Try a different search term.'
                      : 'Add inventory from the Inventory page first.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const isLowStock =
                      product.current_stock > 0 &&
                      product.current_stock <= product.reorder_level
                    const cartItem = cart.find(
                      (i) => i.productId === product.id
                    )
                    const maxedOut =
                      cartItem && cartItem.qty >= product.current_stock

                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={maxedOut}
                        className={`group relative flex flex-col justify-between rounded-xl border bg-background p-3 text-left transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                          maxedOut ? 'ring-1' : ''
                        }`}
                        style={
                          maxedOut
                            ? { borderColor: `${ACCENT}40`, ringColor: `${ACCENT}40` }
                            : undefined
                        }
                      >
                        {/* Badges row */}
                        <div className="flex items-center justify-between">
                          {isLowStock && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-700"
                            >
                              Low Stock
                            </Badge>
                          )}
                          {cartItem && (
                            <Badge
                              className="ml-auto text-[10px] font-bold text-white"
                              style={{ backgroundColor: ACCENT }}
                            >
                              {cartItem.qty}
                            </Badge>
                          )}
                        </div>

                        {/* Name */}
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">
                          {product.name}
                        </h3>

                        {/* Size & stock */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{product.size}</span>
                          <span>·</span>
                          <span>{product.current_stock} left</span>
                        </div>

                        {/* Price & add button */}
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className="text-base font-bold"
                            style={{ color: ACCENT }}
                          >
                            {formatKES(product.sell_price)}
                          </span>
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white opacity-0 transition-all group-hover:opacity-100"
                            style={{ backgroundColor: ACCENT }}
                          >
                            <Plus className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ====== RIGHT PANEL — Cart (1/3) ====== */}
        <div
          className={`${
            mobileTab === 'cart' ? 'block' : 'hidden'
          } lg:block lg:col-span-1`}
        >
          <Card className="sticky top-4 flex flex-col gap-0 overflow-hidden p-0">
            {/* Cart Header */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ShoppingCart className="h-5 w-5" style={{ color: ACCENT }} />
                  Current Sale
                  {cartCount > 0 && (
                    <Badge
                      className="ml-1 text-[11px] font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {cartCount}
                    </Badge>
                  )}
                </CardTitle>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Cart Items */}
            <div className="flex-1">
              <ScrollArea className="max-h-80">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                    <div
                      className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${ACCENT}10` }}
                    >
                      <ShoppingCart
                        className="h-6 w-6"
                        style={{ color: `${ACCENT}40` }}
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Cart is empty
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Click a product to add it
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 px-4">
                    {cart.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        {/* Item info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatKES(item.price)} each
                          </p>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-0.5 rounded-lg border">
                          <button
                            onClick={() => updateQty(item.productId, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="flex h-7 w-8 items-center justify-center border-x text-xs font-bold">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.productId, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Line total */}
                        <span className="w-16 text-right text-sm font-semibold">
                          {formatKES(item.price * item.qty)}
                        </span>

                        {/* Remove */}
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {cart.length > 0 && (
              <>
                <Separator />

                {/* Totals & Checkout */}
                <div className="flex-shrink-0 p-4">
                  {/* Subtotal */}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-medium">
                      {cart.length} item{cart.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Spacer to push payment down */}
                  <div className="h-4" />

                  {/* Payment method selector */}
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Payment Method
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                          paymentMethod === 'cash'
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                        }`}
                        style={
                          paymentMethod === 'cash'
                            ? { backgroundColor: ACCENT, borderColor: ACCENT }
                            : undefined
                        }
                      >
                        <Banknote className="h-4 w-4" />
                        Cash
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                          paymentMethod === 'card'
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                        }`}
                        style={
                          paymentMethod === 'card'
                            ? { backgroundColor: ACCENT, borderColor: ACCENT }
                            : undefined
                        }
                      >
                        <CreditCard className="h-4 w-4" />
                        Card
                      </button>
                      <button
                        onClick={() => setPaymentMethod('mpesa')}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                          paymentMethod === 'mpesa'
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                        }`}
                        style={
                          paymentMethod === 'mpesa'
                            ? { backgroundColor: ACCENT, borderColor: ACCENT }
                            : undefined
                        }
                      >
                        <Smartphone className="h-4 w-4" />
                        M-Pesa
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-base font-medium">Total</span>
                    <span
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: ACCENT }}
                    >
                      {formatKES(cartTotal)}
                    </span>
                  </div>

                  {/* Complete Sale Button */}
                  <Button
                    onClick={() => completeSaleMutation.mutate()}
                    disabled={completeSaleMutation.isPending || cart.length === 0}
                    className="w-full py-6 text-base font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {completeSaleMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processing...
                      </span>
                    ) : (
                      <>
                        Complete Sale
                        <span className="ml-2 text-sm font-medium opacity-80">
                          {formatKES(cartTotal)}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ====== SUCCESS DIALOG ====== */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            {/* Animated checkmark */}
            <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full">
              <div
                className="absolute flex h-20 w-20 animate-ping items-center justify-center rounded-full opacity-20"
                style={{ backgroundColor: ACCENT }}
              />
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg"
                style={{ backgroundColor: ACCENT }}
              >
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold">
              Sale Completed!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-center">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sale ID
              </p>
              <p
                className="mt-1 text-lg font-mono font-bold"
                style={{ color: ACCENT }}
              >
                {typeof lastSaleId === 'string'
                  ? lastSaleId.slice(0, 8).toUpperCase()
                  : lastSaleId}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Payment:{' '}
              <span className="font-semibold capitalize text-foreground">
                {paymentMethod}
              </span>
            </p>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setSuccessOpen(false)}
              className="px-8 font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}