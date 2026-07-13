'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

/* ─── Constants ─────────────────────────────────────────────────────── */

const CATEGORY_COLOURS: Record<string, string> = {
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

const SIZE_OPTIONS = [
  '750ml',
  '1L',
  '700ml',
  '375ml',
  '1.75L',
  '330ml',
  '500ml',
  '50ml',
]

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  size: string
  openingStock: number
  currentStock: number
  reorderLevel: number
  costPrice: number
  sellPrice: number
  supplierId?: string
  storeId?: string
}

interface Category {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function generateSKU() {
  const prefix = 'VC'
  const ts = Date.now().toString(36).toUpperCase().slice(-6)
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5)
  return `${prefix}-${ts}${rand}`
}

function generateBarcode() {
  let barcode = '60'
  for (let i = 0; i < 11; i++) {
    barcode += Math.floor(Math.random() * 10)
  }
  return barcode
}

function formatKSh(n: number) {
  return `KSh ${Number(n || 0).toLocaleString('en-KE')}`
}

function getMargin(cost: number, sell: number) {
  if (!sell || sell <= 0) return '0.0%'
  return ((sell - cost) / sell * 100).toFixed(1) + '%'
}

function getCategoryColor(cat: string) {
  return CATEGORY_COLOURS[cat] || CATEGORY_COLOURS.Other
}

/* ─── Icon components (inline SVG, no emoji) ────────────────────────── */

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  )
}

function PackageIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ─── Skeleton Loader ───────────────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] p-4 flex items-center gap-4"
          style={{ boxShadow: '0 4px 12px rgba(31,17,41,.06)' }}
        >
          <Skeleton className="h-4 w-32 flex-shrink-0" />
          <Skeleton className="h-4 w-20 flex-shrink-0" />
          <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
          <Skeleton className="h-4 w-14 flex-shrink-0 hidden md:block" />
          <Skeleton className="h-4 w-10 flex-shrink-0" />
          <Skeleton className="h-4 w-16 flex-shrink-0 hidden lg:block" />
          <Skeleton className="h-4 w-16 flex-shrink-0 hidden lg:block" />
          <Skeleton className="h-4 w-12 flex-shrink-0 hidden lg:block" />
          <div className="ml-auto flex gap-2 flex-shrink-0">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Empty State ───────────────────────────────────────────────────── */

function EmptyState({ isManager, onAdd }: { isManager: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(220,38,38,0.06)' }}
      >
        <PackageIcon size={36} />
      </div>
      <h3 className="text-lg font-semibold text-[#1F1129] mb-2">
        No products yet
      </h3>
      <p className="text-sm text-[#6B7280] text-center max-w-sm mb-6">
        Start building your inventory by adding your first product. You can organize
        products by category, track stock levels, and manage pricing.
      </p>
      {isManager && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white transition-colors cursor-pointer hover:opacity-90"
          style={{ background: '#DC2626' }}
        >
          <PlusIcon />
          Add Your First Product
        </button>
      )}
    </div>
  )
}

/* ─── Product Form Modal ────────────────────────────────────────────── */

const EMPTY_FORM = {
  name: '',
  sku: '',
  barcode: '',
  category: '',
  size: '750ml',
  openingStock: 0,
  reorderLevel: 5,
  costPrice: 0,
  sellPrice: 0,
  supplierId: '',
}

function ProductModal({
  open,
  onClose,
  editing,
  categories,
  suppliers,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  editing: Product | null
  categories: Category[]
  suppliers: Supplier[]
  onSave: (data: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isNew = !editing

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '',
          sku: editing.sku || '',
          barcode: editing.barcode || '',
          category: editing.category || '',
          size: editing.size || '750ml',
          openingStock: editing.openingStock || 0,
          reorderLevel: editing.reorderLevel ?? 5,
          costPrice: editing.costPrice || 0,
          sellPrice: editing.sellPrice || 0,
          supplierId: editing.supplierId || '',
        })
      } else {
        setForm({ ...EMPTY_FORM, sku: generateSKU(), barcode: generateBarcode() })
      }
      setShowDeleteConfirm(false)
    }
  }, [open, editing])

  const updateField = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...(editing ? { id: editing.id } : {}),
        ...form,
        currentStock: isNew ? form.openingStock : undefined,
      })
      onClose()
    } catch {
      /* handled silently - API layer throws */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    setDeleting(true)
    try {
      await onDelete(editing.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch {
      /* handled silently */
    } finally {
      setDeleting(false)
    }
  }

  const fieldClass =
    'w-full h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB] bg-white text-[#1F1129] outline-none transition-colors focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/10'
  const labelClass = 'block text-xs font-medium text-[#374151] mb-1.5'
  const selectClass =
    'w-full h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB] bg-white text-[#1F1129] outline-none transition-colors focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/10 appearance-none cursor-pointer'

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent
          className="bg-white sm:max-w-[560px] p-0 overflow-hidden max-h-[90vh] flex flex-col rounded-[14px]"
          style={{ boxShadow: '0 20px 60px rgba(31,17,41,.15)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#F3F0EB]">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base font-semibold text-[#1F1129]">
                {isNew ? 'Add New Product' : 'Edit Product'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280] mt-0.5">
                {isNew
                  ? 'Fill in the product details below to add it to your inventory.'
                  : 'Update product information. Changes are saved immediately.'}
              </DialogDescription>
            </DialogHeader>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#1F1129] hover:bg-[#F3F0EB] transition-colors cursor-pointer"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className={labelClass}>Product Name *</label>
              <input
                className={fieldClass}
                placeholder="e.g. Jameson Irish Whisky"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            {/* SKU & Barcode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>SKU</label>
                <div className="flex items-center gap-1.5">
                  <input
                    className={`${fieldClass} bg-[#FAF7F2] text-[#6B7280]`}
                    value={form.sku}
                    readOnly
                  />
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => updateField('sku', generateSKU())}
                      className="p-2 rounded-[8px] text-[#6B7280] hover:text-[#1F1129] hover:bg-[#F3F0EB] transition-colors cursor-pointer flex-shrink-0"
                      title="Regenerate SKU"
                    >
                      <RefreshIcon />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>Barcode</label>
                <div className="flex items-center gap-1.5">
                  <input
                    className={`${fieldClass} bg-[#FAF7F2] text-[#6B7280]`}
                    value={form.barcode}
                    readOnly
                  />
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => updateField('barcode', generateBarcode())}
                      className="p-2 rounded-[8px] text-[#6B7280] hover:text-[#1F1129] hover:bg-[#F3F0EB] transition-colors cursor-pointer flex-shrink-0"
                      title="Regenerate Barcode"
                    >
                      <RefreshIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category & Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Category *</label>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Size</label>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.size}
                    onChange={(e) => updateField('size', e.target.value)}
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{isNew ? 'Opening Stock' : 'Opening Stock'}</label>
                <input
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.openingStock}
                  onChange={(e) => updateField('openingStock', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={labelClass}>Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.reorderLevel}
                  onChange={(e) => updateField('reorderLevel', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={labelClass}>Supplier</label>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.supplierId}
                    onChange={(e) => updateField('supplierId', e.target.value)}
                  >
                    <option value="">None</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>
            </div>

            {/* Price fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cost Price (KSh)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass}
                  placeholder="0.00"
                  value={form.costPrice || ''}
                  onChange={(e) => updateField('costPrice', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={labelClass}>Sell Price (KSh)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass}
                  placeholder="0.00"
                  value={form.sellPrice || ''}
                  onChange={(e) => updateField('sellPrice', Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#F3F0EB]">
            {editing ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/5 transition-colors cursor-pointer"
              >
                <TrashIcon />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-[#374151] hover:bg-[#F3F0EB] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#DC2626' }}
              >
                {saving ? 'Saving...' : isNew ? 'Add Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white rounded-[14px]" style={{ boxShadow: '0 20px 60px rgba(31,17,41,.15)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1F1129]">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              Are you sure you want to delete &quot;{editing?.name}&quot;? This action cannot be undone and will
              permanently remove the product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[#E5E7EB] text-[#374151] hover:bg-[#F3F0EB] rounded-[8px] cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#DC2626] text-white hover:bg-[#B91C1C] rounded-[8px] cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ─── Quick Reorder Modal ───────────────────────────────────────────── */

function ReorderModal({
  open,
  onClose,
  product,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  product: Product | null
  onConfirm: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  if (!product) return null

  const suggestedQty = (product.reorderLevel || 5) * 2
  const estimatedCost = suggestedQty * (product.costPrice || 0)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm({
        id: product.id,
        currentStock: (product.currentStock || 0) + suggestedQty,
        openingStock: suggestedQty,
      })
      onClose()
    } catch {
      /* handled silently */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="bg-white sm:max-w-[400px] p-0 overflow-hidden rounded-[14px]"
        style={{ boxShadow: '0 20px 60px rgba(31,17,41,.15)' }}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#F3F0EB]">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold text-[#1F1129]">
              Quick Reorder
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280] mt-0.5">
              Confirm the reorder quantity for this product.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-[10px] p-4 space-y-3" style={{ background: '#FAF7F2' }}>
            <div>
              <div className="text-xs text-[#6B7280]">Product</div>
              <div className="text-sm font-semibold text-[#1F1129]">{product.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#6B7280]">Current Stock</div>
                <div className="text-sm font-medium text-[#DC2626]">{product.currentStock || 0}</div>
              </div>
              <div>
                <div className="text-xs text-[#6B7280]">Reorder Level</div>
                <div className="text-sm font-medium text-[#F59E0B]">{product.reorderLevel || 0}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-[#E5E7EB] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#374151]">Suggested Quantity</span>
              <span className="text-sm font-bold text-[#1F1129]">{suggestedQty} units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#374151]">Estimated Cost</span>
              <span className="text-sm font-bold" style={{ color: '#DC2626' }}>
                {formatKSh(estimatedCost)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F3F0EB]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-[#374151] hover:bg-[#F3F0EB] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
            style={{ background: '#10B981' }}
          >
            {saving ? 'Processing...' : 'Confirm Reorder'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Inventory Page ───────────────────────────────────────────── */

export function InventoryPage() {
  const { isManager, storeId, suppliers: storeSuppliers } = useAppStore()

  // Local state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null)

  // Fetch data
  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.getProducts(storeId ? `storeId=${storeId}` : '')
      setProducts(Array.isArray(data) ? data : data?.products || [])
    } catch {
      setProducts([])
    }
  }, [storeId])

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.getCategories()
      setCategories(Array.isArray(data) ? data : data?.categories || [])
    } catch {
      setCategories([])
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api.getSuppliers()
      const list = Array.isArray(data) ? data : data?.suppliers || []
      setSuppliers(list)
    } catch {
      setSuppliers([])
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [prodData, catData, supData] = await Promise.all([
          api.getProducts(storeId ? `storeId=${storeId}` : ''),
          api.getCategories(),
          api.getSuppliers(),
        ])
        if (!mounted) return
        setProducts(Array.isArray(prodData) ? prodData : prodData?.products || [])
        setCategories(Array.isArray(catData) ? catData : catData?.categories || [])
        const supList = Array.isArray(supData) ? supData : supData?.suppliers || []
        setSuppliers(supList)
      } catch {
        if (mounted) {
          setProducts([])
          setCategories([])
          setSuppliers([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [storeId])

  // Use store suppliers if local fetch is empty (fallback)
  const effectiveSuppliers = suppliers.length > 0 ? suppliers : (storeSuppliers || [])

  // Filter products
  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    const matchesCategory = !categoryFilter || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // CRUD handlers
  const handleSave = async (data: any) => {
    if (data.id) {
      await api.updateProduct(data)
    } else {
      await api.createProduct({ ...data, storeId })
    }
    await fetchProducts()
  }

  const handleDelete = async (id: string) => {
    await api.deleteProduct(id)
    await fetchProducts()
  }

  const handleReorder = async (data: any) => {
    await api.updateProduct(data)
    await fetchProducts()
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setModalOpen(true)
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setModalOpen(true)
  }

  // Stock status helpers
  const getStockColor = (current: number, reorder: number) => {
    if (current <= 0) return '#DC2626'
    if (current <= (reorder || 0)) return '#F59E0B'
    return '#10B981'
  }

  const getStockLabel = (current: number, reorder: number) => {
    if (current <= 0) return 'Out of stock'
    if (current <= (reorder || 0)) return 'Low stock'
    return 'In stock'
  }

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#FAF7F2' }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1F1129]">Inventory</h1>
            <span
              className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ background: '#DC2626' }}
            >
              {filtered.length}
            </span>
          </div>
          {isManager && (
            <div className="flex gap-2 self-start sm:self-auto">
              <button
                onClick={() => setReceiveModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-[#065F46] border border-[#D1FAE5] bg-[#ECFDF5] transition-colors cursor-pointer hover:bg-[#D1FAE5] self-start sm:self-auto"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/></svg>
                Receive Stock
              </button>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-white transition-colors cursor-pointer hover:opacity-90 self-start sm:self-auto"
                style={{ background: '#DC2626' }}
              >
                <PlusIcon />
                Add Product
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div
          className="bg-white rounded-[14px] p-4 mb-5 flex flex-col sm:flex-row gap-3"
          style={{ boxShadow: '0 4px 12px rgba(31,17,41,.06)' }}
        >
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-[8px] border border-[#E5E7EB] bg-[#FAF7F2] text-[#1F1129] placeholder:text-[#9CA3AF] outline-none transition-colors focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/10"
            />
          </div>
          <div className="relative sm:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB] bg-[#FAF7F2] text-[#1F1129] outline-none transition-colors appearance-none cursor-pointer focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/10"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
              <ChevronDownIcon />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div
            className="bg-white rounded-[14px]"
            style={{ boxShadow: '0 4px 12px rgba(31,17,41,.06)' }}
          >
            <EmptyState isManager={isManager} onAdd={openAddModal} />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div
              className="hidden lg:block bg-white rounded-[14px] overflow-hidden"
              style={{ boxShadow: '0 4px 12px rgba(31,17,41,.06)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F0EB]">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Category
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Size
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Sell
                      </th>
                      <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Margin
                      </th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F0EB]">
                    {filtered.map((product) => {
                      const stockColor = getStockColor(
                        product.currentStock || 0,
                        product.reorderLevel || 0,
                      )
                      const catColor = getCategoryColor(product.category || '')
                      const margin = getMargin(
                        product.costPrice || 0,
                        product.sellPrice || 0,
                      )
                      const isLowStock =
                        product.currentStock > 0 &&
                        product.currentStock <= (product.reorderLevel || 0)

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-[#FAF7F2]/60 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-[#1F1129]">{product.name}</div>
                          </td>
                          <td className="px-4 py-3.5 text-[#6B7280] font-mono text-xs">
                            {product.sku}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                              style={{ background: catColor }}
                            >
                              {product.category || 'Other'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[#374151]">{product.size}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1F1129]">
                                {product.currentStock || 0}
                              </span>
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  color: stockColor,
                                  background: `${stockColor}12`,
                                }}
                              >
                                {getStockLabel(product.currentStock || 0, product.reorderLevel || 0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right text-[#374151]">
                            {formatKSh(product.costPrice || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-[#374151]">
                            {formatKSh(product.sellPrice || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-[#1F1129]">
                            {margin}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {isManager && isLowStock && (
                                <button
                                  onClick={() => setReorderProduct(product)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11px] font-semibold text-[#059669] hover:bg-[#10B981]/8 transition-colors cursor-pointer"
                                  title="Quick reorder"
                                >
                                  <RefreshIcon />
                                  Reorder
                                </button>
                              )}
                              {isManager && (
                                <button
                                  onClick={() => openEditModal(product)}
                                  className="p-1.5 rounded-[6px] text-[#6B7280] hover:text-[#1F1129] hover:bg-[#F3F0EB] transition-colors cursor-pointer"
                                  title="Edit product"
                                >
                                  <EditIcon />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {filtered.map((product) => {
                const stockColor = getStockColor(
                  product.currentStock || 0,
                  product.reorderLevel || 0,
                )
                const catColor = getCategoryColor(product.category || '')
                const margin = getMargin(
                  product.costPrice || 0,
                  product.sellPrice || 0,
                )
                const isLowStock =
                  product.currentStock > 0 &&
                  product.currentStock <= (product.reorderLevel || 0)

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-[14px] p-4"
                    style={{ boxShadow: '0 4px 12px rgba(31,17,41,.06)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#1F1129] text-sm truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-[#9CA3AF] font-mono mt-0.5">
                          {product.sku}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        {isManager && (
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-[6px] text-[#6B7280] hover:text-[#1F1129] hover:bg-[#F3F0EB] transition-colors cursor-pointer"
                          >
                            <EditIcon />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{ background: catColor }}
                      >
                        {product.category || 'Other'}
                      </span>
                      <span className="text-xs text-[#6B7280]">{product.size}</span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ml-auto"
                        style={{
                          color: stockColor,
                          background: `${stockColor}12`,
                        }}
                      >
                        {product.currentStock || 0} in stock
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center py-2.5 border-t border-[#F3F0EB]">
                      <div>
                        <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-0.5">
                          Cost
                        </div>
                        <div className="text-xs font-medium text-[#374151]">
                          {formatKSh(product.costPrice || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-0.5">
                          Sell
                        </div>
                        <div className="text-xs font-medium text-[#374151]">
                          {formatKSh(product.sellPrice || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-0.5">
                          Margin
                        </div>
                        <div className="text-xs font-bold text-[#1F1129]">{margin}</div>
                      </div>
                    </div>

                    {isManager && isLowStock && (
                      <div className="mt-3 pt-3 border-t border-[#F3F0EB]">
                        <button
                          onClick={() => setReorderProduct(product)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-[#059669] border border-[#10B981]/20 hover:bg-[#10B981]/5 transition-colors cursor-pointer"
                        >
                          <RefreshIcon />
                          Reorder Stock
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Product Add/Edit Modal */}
      {isManager && (
        <ProductModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editing={editingProduct}
          categories={categories}
          suppliers={effectiveSuppliers}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* Quick Reorder Modal */}
      {isManager && (
        <ReorderModal
          open={!!reorderProduct}
          onClose={() => setReorderProduct(null)}
          product={reorderProduct}
          onConfirm={handleReorder}
        />
      )}

      {/* Receive Stock Modal */}
      <ReceiveStockModal
        open={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        products={products}
        onReceived={() => { fetchProducts(); setReceiveModalOpen(false) }}
      />
    </div>
  )
}

/* ─── Receive Stock Modal ─── */
function ReceiveStockModal({ open, onClose, products, onReceived }: {
  open: boolean
  onClose: () => void
  products: Product[]
  onReceived: () => void
}) {
  const [receiveItems, setReceiveItems] = useState<{ productId: string; qty: number; costPrice: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const storeId = useAppStore(s => s.storeId)

  const addProduct = (product: Product) => {
    if (receiveItems.find(i => i.productId === product.id)) return
    setReceiveItems([...receiveItems, { productId: product.id, qty: 1, costPrice: product.costPrice || 0 }])
  }

  const removeProduct = (productId: string) => {
    setReceiveItems(receiveItems.filter(i => i.productId !== productId))
  }

  const updateQty = (productId: string, qty: number) => {
    setReceiveItems(receiveItems.map(i => i.productId === productId ? { ...i, qty: Math.max(0, qty) } : i))
  }

  const updateCost = (productId: string, costPrice: number) => {
    setReceiveItems(receiveItems.map(i => i.productId === productId ? { ...i, costPrice: Math.max(0, costPrice) } : i))
  }

  const handleReceive = async () => {
    if (receiveItems.length === 0) return
    setSaving(true)
    setError('')
    try {
      await api.receiveStock({ storeId, items: receiveItems })
      onReceived()
    } catch (err: any) {
      setError(err.message || 'Failed to receive stock')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const availableProducts = products.filter(p =>
    !receiveItems.find(i => i.productId === p.id) &&
    (p.name + p.sku + p.barcode).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ boxShadow: '0 20px 60px rgba(31,17,41,.18)' }}>
        <div className="sticky top-0 bg-white border-b border-[#E8E0F0] px-6 py-4 flex items-center justify-between rounded-t-[14px] z-10">
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1F1129' }}>Receive Stock</h3>
            <p className="text-xs mt-0.5" style={{ color: '#8B7FA0' }}>Add stock received from suppliers</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F0EB] transition cursor-pointer" aria-label="Close">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="#8B7FA0"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</div>
          )}

          {/* Search products */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search products to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-[8px] border border-[#E8E0F0] bg-[#FAF7F2] text-[#1F1129] placeholder:text-[#9CA3AF] outline-none focus:border-[#DC2626]/40 focus:ring-2 focus:ring-[#DC2626]/10"
            />
          </div>

          {search && (
            <div className="max-h-40 overflow-y-auto border border-[#E8E0F0] rounded-lg divide-y divide-[#F5F0EB]">
              {availableProducts.slice(0, 10).map(p => (
                <button
                  key={p.id}
                  onClick={() => { addProduct(p); setSearch('') }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#FAF7F2] transition cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-medium text-[#1F1129]">{p.name}</div>
                    <div className="text-xs text-[#8B7FA0]">{p.category} · {p.size} · Current: {p.currentStock}</div>
                  </div>
                  <svg className="w-4 h-4 text-[#8B7FA0]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                </button>
              ))}
              {availableProducts.length === 0 && (
                <div className="px-3 py-3 text-sm text-[#8B7FA0] text-center">No products found</div>
              )}
            </div>
          )}

          {/* Items to receive */}
          {receiveItems.length > 0 && (
            <div className="border border-[#E8E0F0] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2]">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#8B7FA0]">Product</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#8B7FA0] w-24">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#8B7FA0] w-28">Unit Cost</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map(item => {
                    const product = products.find(p => p.id === item.productId)
                    return (
                      <tr key={item.productId} className="border-t border-[#F5F0EB]">
                        <td className="py-2 px-3">
                          <div className="text-sm font-medium text-[#1F1129]">{product?.name || 'Unknown'}</div>
                          <div className="text-xs text-[#8B7FA0]">Current: {product?.currentStock || 0}</div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 rounded-lg border border-[#E8E0F0] text-sm outline-none focus:border-[#DC2626]/40"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={item.costPrice || ''}
                            onChange={(e) => updateCost(item.productId, parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 rounded-lg border border-[#E8E0F0] text-sm outline-none focus:border-[#DC2626]/40"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <button onClick={() => removeProduct(item.productId)} className="p-1 rounded hover:bg-[#FEF2F2] transition cursor-pointer">
                            <svg className="w-4 h-4 text-[#DC2626]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-[#FAF7F2] text-xs text-[#8B7FA0]">
                {receiveItems.reduce((s, i) => s + i.qty, 0)} total units to add
              </div>
            </div>
          )}

          {receiveItems.length === 0 && (
            <div className="text-center py-10">
              <svg className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V5c0-1.1-1-3-2-3zm-5 12H9v-2h6v2zm5-7H4V5h16v2z"/></svg>
              <p className="text-sm text-[#8B7FA0]">Search and add products to receive stock</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E8E0F0] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E8E0F0] text-[#6B5E7A] hover:bg-[#FAF7F2] transition cursor-pointer">Cancel</button>
          <button
            onClick={handleReceive}
            disabled={saving || receiveItems.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{ backgroundColor: '#059669' }}
          >
            {saving ? 'Receiving...' : `Receive ${receiveItems.length} Items`}
          </button>
        </div>
      </div>
    </div>
  )
}