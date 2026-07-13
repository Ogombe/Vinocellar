'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'

// --- Constants ---
const CATEGORY_COLORS: Record<string, string> = {
  Wine: '#DC2626',
  Whisky: '#92400E',
  Vodka: '#3B82F6',
  Gin: '#10B981',
  Rum: '#F97316',
  Champagne: '#F59E0B',
  Beer: '#FBBF24',
  Cognac: '#78350F',
  Tequila: '#059669',
  Liqueur: '#8B5CF6',
  Other: '#6B7280',
}

const CATEGORIES = ['All', 'Wine', 'Whisky', 'Vodka', 'Gin', 'Rum', 'Champagne', 'Beer', 'Cognac', 'Tequila', 'Liqueur']

const PAYMENT_METHODS = ['Cash', 'Card', 'M-Pesa'] as const

const fmt = (n: number) => 'KSh ' + n.toLocaleString('en-KE')

// --- Types ---
interface CartItem {
  id: string
  productId: string
  name: string
  qty: number
  price: number
  cost: number
  maxStock: number
  category?: string
  size?: string
}

// --- Component ---
export function POSPage() {
  const { user, org, storeId, setStoreId, setData, products } = useAppStore()

  // Local state
  const [localProducts, setLocalProducts] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash')
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Modals
  const [confirmModal, setConfirmModal] = useState(false)
  const [receiptModal, setReceiptModal] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const params = storeId ? `storeId=${storeId}` : ''
      const data = await api.getProducts(params)
      const list = Array.isArray(data) ? data : (data.products || data.data || [])
      setLocalProducts(list)
      setData('products', list)
    } catch {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [storeId, setData])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Toast
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Cart actions
  const addToCart = (product: any) => {
    if (!product.stock || product.stock <= 0) return
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        if (existing.qty >= existing.maxStock) return prev
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, qty: i.qty + 1 }
            : i
        )
      }
      return [...prev, {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        qty: 1,
        price: product.sellPrice ?? product.price ?? 0,
        cost: product.costPrice ?? product.cost ?? 0,
        maxStock: product.stock ?? 0,
        category: product.category,
        size: product.size,
      }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
  }

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) {
      removeFromCart(id)
      return
    }
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i
      const clampedQty = Math.min(qty, i.maxStock)
      return { ...i, qty: clampedQty }
    }))
  }

  const clearCart = () => {
    setCart([])
    setConfirmModal(false)
  }

  // Cart totals
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  // Filter products
  const filteredProducts = localProducts.filter(p => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return
    setCheckoutLoading(true)
    try {
      const sale = await api.createSale({
        items: cart.map(i => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          cost: i.cost,
          productId: i.productId,
        })),
        paymentMethod,
        storeId: storeId || undefined,
      })
      setLastSale(sale)
      setConfirmModal(false)
      setReceiptModal(true)
      setCart([])
      showToast('Sale completed successfully', 'success')
      fetchProducts()
    } catch (err: any) {
      showToast(err.message || 'Checkout failed', 'error')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']

  return (
    <div className="h-full flex flex-col" style={{ background: '#FAF7F2' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div
            className={`px-4 py-3 rounded-[10px] shadow-lg text-white text-sm font-medium ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Mobile Tabs */}
      <div className="md:hidden flex border-b" style={{ borderColor: '#E5E1DB' }}>
        <button
          onClick={() => setMobileTab('products')}
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors"
          style={{
            background: mobileTab === 'products' ? '#FFFFFF' : 'transparent',
            color: mobileTab === 'products' ? '#DC2626' : '#9CA3AF',
            borderBottom: mobileTab === 'products' ? '2px solid #DC2626' : '2px solid transparent',
          }}
        >
          Products
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors relative"
          style={{
            background: mobileTab === 'cart' ? '#FFFFFF' : 'transparent',
            color: mobileTab === 'cart' ? '#DC2626' : '#9CA3AF',
            borderBottom: mobileTab === 'cart' ? '2px solid #DC2626' : '2px solid transparent',
          }}
        >
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-1 right-4 min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs text-white font-bold px-1"
              style={{ background: '#DC2626' }}>
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Grid - Left (70%) */}
        <div className={`${mobileTab === 'products' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[70%] overflow-hidden`}>
          {/* Filters */}
          <div className="px-4 pt-4 pb-2 space-y-3 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border text-sm focus:outline-none focus:ring-2 focus:ring-red-200 transition-shadow"
                style={{ background: '#FFFFFF', borderColor: '#E5E1DB' }}
              />
            </div>

            {/* Category Chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => {
                const color = cat === 'All' ? '#6B7280' : getCategoryColor(cat)
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: isActive ? color : 'transparent',
                      color: isActive ? '#FFFFFF' : color,
                      border: `1.5px solid ${color}`,
                      opacity: isActive ? 1 : 0.8,
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#DC2626', borderTopColor: 'transparent' }} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No products found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filteredProducts.map(product => {
                  const inStock = product.stock > 0
                  const catColor = getCategoryColor(product.category)
                  return (
                    <button
                      key={product.id}
                      onClick={() => inStock && addToCart(product)}
                      disabled={!inStock}
                      className="bg-white rounded-[14px] p-3 text-left transition-all hover:shadow-md relative group"
                      style={{
                        borderLeft: `4px solid ${catColor}`,
                        opacity: inStock ? 1 : 0.45,
                        cursor: inStock ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {/* Category Label */}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: catColor + '15', color: catColor }}
                      >
                        {product.category || 'Other'}
                      </span>

                      {/* Name */}
                      <h3 className="mt-1.5 text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                        {product.name}
                      </h3>

                      {/* Size */}
                      {product.size && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{product.size}</p>
                      )}

                      {/* Stock */}
                      <p className="text-[11px] mt-1" style={{ color: inStock ? '#059669' : '#DC2626' }}>
                        {inStock ? `${product.stock} in stock` : 'Out of stock'}
                      </p>

                      {/* Price */}
                      <p className="text-sm font-bold mt-1.5" style={{ color: '#DC2626' }}>
                        {fmt(product.sellPrice ?? product.price ?? 0)}
                      </p>

                      {/* Add indicator on hover */}
                      {inStock && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: catColor + '20', color: catColor }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel - Right (30%) */}
        <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[30%] border-l overflow-hidden`}
          style={{ background: '#FFFFFF', borderColor: '#E5E1DB' }}>
          {/* Cart Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E5E1DB' }}>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-800">Cart</h2>
              {cartCount > 0 && (
                <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs text-white font-bold px-1"
                  style={{ background: '#DC2626' }}>
                  {cartCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 px-4">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F3F0EB' }}>
                {cart.map(item => {
                  const lineTotal = item.price * item.qty
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmt(item.price)} each</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-0 rounded-lg overflow-hidden border" style={{ borderColor: '#E5E1DB' }}>
                          <button
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-sm font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 h-8 flex items-center justify-center text-sm font-bold text-gray-800 border-x" style={{ borderColor: '#E5E1DB' }}>
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            disabled={item.qty >= item.maxStock}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="text-sm font-bold text-gray-800">{fmt(lineTotal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="border-t px-4 py-4 space-y-3 flex-shrink-0" style={{ borderColor: '#E5E1DB' }}>
              {/* Payment Method */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
                <div className="flex gap-1.5">
                  {PAYMENT_METHODS.map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all border"
                      style={{
                        background: paymentMethod === method ? '#DC2626' : '#FFFFFF',
                        color: paymentMethod === method ? '#FFFFFF' : '#6B7280',
                        borderColor: paymentMethod === method ? '#DC2626' : '#E5E1DB',
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Total</span>
                <span className="text-xl font-bold" style={{ color: '#DC2626' }}>
                  {fmt(cartTotal)}
                </span>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => setConfirmModal(true)}
                disabled={checkoutLoading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: '#DC2626' }}
              >
                {checkoutLoading ? 'Processing...' : 'Checkout'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-[14px] shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#E5E1DB' }}>
              <h3 className="text-lg font-bold text-gray-800">Confirm Sale</h3>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              {/* Items */}
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-400 ml-1">x{item.qty}</span>
                    </span>
                    <span className="font-semibold text-gray-800">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3" style={{ borderColor: '#E5E1DB' }}>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-800">Total</span>
                  <span className="text-xl font-bold" style={{ color: '#DC2626' }}>{fmt(cartTotal)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-semibold text-gray-800">{paymentMethod}</span>
              </div>
            </div>

            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: '#E5E1DB' }}>
              <button
                onClick={() => setConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#E5E1DB', color: '#6B7280' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#DC2626' }}
              >
                {checkoutLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-[14px] shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: '#E5E1DB' }}>
              <h3 className="text-lg font-bold text-gray-800">Receipt</h3>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              {/* Store & Receipt Info */}
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-gray-800">{org?.name || 'VinoCellar Pro'}</p>
                <p className="text-xs text-gray-400 font-mono">
                  Receipt #{typeof lastSale.id === 'string' ? lastSale.id.slice(0, 8).toUpperCase() : '---'}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}{' '}
                  {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-gray-500">Cashier: {user?.name || 'N/A'}</p>
              </div>

              <div className="border-t border-dashed" style={{ borderColor: '#D1D5DB' }} />

              {/* Items */}
              <div className="space-y-1.5">
                {lastSale.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 flex-1 min-w-0">
                      <span className="block truncate">{item.name}</span>
                      <span className="text-xs text-gray-400">{item.qty} x {fmt(item.price)}</span>
                    </span>
                    <span className="font-semibold text-gray-800 ml-2">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed" style={{ borderColor: '#D1D5DB' }} />

              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-800">Total</span>
                <span className="text-lg font-bold" style={{ color: '#DC2626' }}>
                  {fmt(lastSale.total ?? cartTotal)}
                </span>
              </div>

              {/* Payment */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Payment</span>
                <span className="font-semibold text-gray-800">{lastSale.paymentMethod || paymentMethod}</span>
              </div>

              <div className="border-t border-dashed" style={{ borderColor: '#D1D5DB' }} />

              <p className="text-center text-xs text-gray-400">Thank you for your purchase!</p>
            </div>

            <div className="px-5 py-4 border-t" style={{ borderColor: '#E5E1DB' }}>
              <button
                onClick={() => { setReceiptModal(false); setLastSale(null) }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#DC2626' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}