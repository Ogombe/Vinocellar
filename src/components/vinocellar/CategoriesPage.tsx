'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Category, Product } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import {
  Plus,
  Edit,
  Trash2,
  LayoutGrid,
  Check,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

const COLOR_OPTIONS = [
  { name: 'Red', value: '#DC2626' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Slate', value: '#475569' },
] as const

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CategoriesPage() {
  const isMobile = useIsMobile()
  const { organisation } = useAuth()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value)

  /* ── Fetch categories ─────────────────────────────────────────── */

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('organisation_id', organisation!.id)
        .order('name')
      return (data as Category[]) || []
    },
    enabled: !!organisation?.id,
  })

  /* ── Fetch product counts per category ─────────────────────────── */

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-count-by-cat', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, category_id')
        .eq('organisation_id', organisation!.id)
      return (data as Product[]) || []
    },
    enabled: !!organisation?.id,
  })

  const productCountMap: Record<string, number> = {}
  for (const p of products) {
    if (p.category_id) {
      productCountMap[p.category_id] = (productCountMap[p.category_id] || 0) + 1
    }
  }

  /* ── Save mutation (add / edit) ────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formName.trim()) throw new Error('Name is required')

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({ name: formName.trim(), colour: formColor })
          .eq('id', editingCategory.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert({
          name: formName.trim(),
          colour: formColor,
          organisation_id: organisation!.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['products-count-by-cat'] })
      handleCloseDialog()
    },
  })

  /* ── Delete mutation ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['products-count-by-cat'] })
      setDeleteDialogOpen(false)
      setSelectedCategory(null)
    },
  })

  /* ── Dialog helpers ────────────────────────────────────────────── */

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setFormName('')
    setFormColor(COLOR_OPTIONS[0].value)
    setDialogOpen(true)
  }

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat)
    setFormName(cat.name)
    setFormColor(cat.colour)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCategory(null)
    setFormName('')
  }

  const handleOpenDelete = (cat: Category) => {
    setSelectedCategory(cat)
    setDeleteDialogOpen(true)
  }

  /* ── Helpers for text contrast ─────────────────────────────────── */

  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.55 ? '#1F1129' : '#FFFFFF'
  }

  /* ── Loading skeleton ──────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  /* ── Main render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} &middot; Organize your products
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="shrink-0 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${ACCENT}14` }}
            >
              <LayoutGrid className="h-8 w-8" style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-foreground">No categories yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create categories to organize your wine and liquor inventory by type.
            </p>
            <Button
              onClick={handleOpenCreate}
              className="mt-4"
              style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Category
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category cards grid */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((cat) => {
            const count = productCountMap[cat.id] || 0
            const textColor = getContrastColor(cat.colour)
            const isEditing = editingCategory?.id === cat.id

            return (
              <Card
                key={cat.id}
                className="group relative overflow-hidden border-0 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ backgroundColor: cat.colour }}
              >
                <CardContent className="flex h-full min-h-[120px] flex-col justify-between p-4">
                  {/* Top: name */}
                  <div className="flex items-start justify-between">
                    <h3
                      className="text-sm font-bold leading-tight"
                      style={{ color: textColor }}
                    >
                      {cat.name}
                    </h3>
                  </div>

                  {/* Bottom: count + actions */}
                  <div className="flex items-end justify-between mt-2">
                    <span
                      className="text-xs font-medium opacity-80"
                      style={{ color: textColor }}
                    >
                      {count} product{count !== 1 ? 's' : ''}
                    </span>

                    {/* Action buttons - show on hover for desktop, always on mobile */}
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="rounded-md p-1.5 transition-colors hover:bg-white/20"
                        aria-label="Edit category"
                      >
                        <Edit className="h-3.5 w-3.5" style={{ color: textColor }} />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(cat)}
                        className="rounded-md p-1.5 transition-colors hover:bg-white/20"
                        aria-label="Delete category"
                      >
                        <Trash2 className="h-3.5 w-3.5" style={{ color: textColor }} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Name input */}
            <div className="grid gap-2">
              <Label htmlFor="cat-name" className="text-xs font-medium text-muted-foreground">
                Category Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cat-name"
                placeholder="e.g. Red Wine"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveMutation.mutate() }}
                autoFocus
              />
            </div>

            {/* Color picker */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Color <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormColor(color.value)}
                    className="group/color relative flex h-10 w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: color.value,
                      borderColor: formColor === color.value ? '#1F1129' : 'transparent',
                      boxShadow: formColor === color.value
                        ? '0 0 0 2px white, 0 0 0 4px #1F1129'
                        : 'none',
                    }}
                    title={color.name}
                  >
                    {formColor === color.value && (
                      <Check className="h-4 w-4 text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="mt-2 rounded-lg border border-border/60 overflow-hidden">
                <div
                  className="flex items-center justify-center px-4 py-3"
                  style={{ backgroundColor: formColor }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ color: getContrastColor(formColor) }}
                  >
                    {formName || 'Category Name'}
                  </span>
                </div>
              </div>
            </div>

            {saveMutation.isError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {saveMutation.error instanceof Error ? saveMutation.error.message : 'An error occurred'}
              </div>
            )}
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
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formName.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : editingCategory ? 'Update' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{selectedCategory?.name}&rdquo;?
              {selectedCategory && (productCountMap[selectedCategory.id] || 0) > 0 && (
                <span className="mt-2 block font-medium text-amber-600">
                  This category has {productCountMap[selectedCategory.id]} product(s). Those products will become uncategorized.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (selectedCategory) deleteMutation.mutate(selectedCategory.id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}