'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Supplier } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
  Truck,
  Phone,
  Mail,
  User,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

/* ------------------------------------------------------------------ */
/*  Form type                                                          */
/* ------------------------------------------------------------------ */

interface SupplierForm {
  name: string
  contact_person: string
  phone: string
  email: string
  product_types: string
}

const emptyForm: SupplierForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  product_types: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SuppliersPage() {
  const isMobile = useIsMobile()
  const { organisation } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)

  /* ── Data fetching ────────────────────────────────────────────── */

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organisation_id', organisation!.id)
        .order('name')
      return (data as Supplier[]) || []
    },
    enabled: !!organisation?.id,
  })

  /* ── Filtered list ─────────────────────────────────────────────── */

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Save mutation (add / edit) ────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (values: SupplierForm) => {
      const row = {
        name: values.name,
        contact_person: values.contact_person,
        phone: values.phone,
        email: values.email,
        product_types: values.product_types,
        organisation_id: organisation!.id,
      }

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(row)
          .eq('id', editingSupplier.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('suppliers').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      handleCloseDialog()
    },
  })

  /* ── Delete mutation ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleteDialogOpen(false)
      setSelectedSupplier(null)
    },
  })

  /* ── Dialog helpers ────────────────────────────────────────────── */

  const handleOpenCreate = () => {
    setEditingSupplier(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      product_types: supplier.product_types,
    })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSupplier(null)
    setForm(emptyForm)
  }

  const handleOpenDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setDeleteDialogOpen(true)
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
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  /* ── Render: Mobile cards ──────────────────────────────────────── */

  const renderMobileCards = () => (
    <div className="grid gap-3">
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Truck className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">No suppliers found</p>
          <p className="text-xs">{search ? 'Try a different search term' : 'Add your first supplier to get started'}</p>
        </div>
      )}
      {filtered.map((supplier) => (
        <Card key={supplier.id} className="overflow-hidden border border-border/60 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
                {supplier.contact_person && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    {supplier.contact_person}
                  </p>
                )}
              </div>
              {supplier.product_types && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-purple-200 bg-purple-50 text-[10px] font-medium text-purple-700"
                >
                  {supplier.product_types}
                </Badge>
              )}
            </div>

            <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
              {supplier.phone && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  {supplier.phone}
                </p>
              )}
              {supplier.email && (
                <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  {supplier.email}
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => handleOpenEdit(supplier)}
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleOpenDelete(supplier)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
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
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Person</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Types</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Truck className="mb-3 h-12 w-12 opacity-40" />
                      <p className="text-sm font-medium">No suppliers found</p>
                      <p className="text-xs">{search ? 'Try a different search term' : 'Add your first supplier to get started'}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((supplier) => (
                <TableRow key={supplier.id} className="border-border/40 transition-colors hover:bg-muted/30">
                  <TableCell className="pl-4">
                    <span className="text-sm font-medium">{supplier.name}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.contact_person || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.phone || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.email || '—'}
                  </TableCell>
                  <TableCell>
                    {supplier.product_types ? (
                      <Badge
                        variant="outline"
                        className="border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-700"
                      >
                        {supplier.product_types}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit {supplier.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => handleOpenDelete(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {supplier.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} &middot;{' '}
            {filtered.length} shown
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="shrink-0 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search suppliers by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      {/* Suppliers list */}
      {isMobile ? renderMobileCards() : renderDesktopTable()}

      {/* ── Add / Edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="supplier-name" className="text-xs font-medium text-muted-foreground">
                Supplier Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="supplier-name"
                placeholder="e.g. Kenya Wine Agencies"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Contact Person */}
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact" className="text-xs font-medium text-muted-foreground">
                Contact Person
              </Label>
              <Input
                id="supplier-contact"
                placeholder="e.g. Jane Wanjiku"
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
              />
            </div>

            {/* Phone & Email row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supplier-phone" className="text-xs font-medium text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="supplier-phone"
                  placeholder="e.g. 0712345678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier-email" className="text-xs font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="supplier-email"
                  type="email"
                  placeholder="e.g. info@supplier.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Product Types */}
            <div className="grid gap-2">
              <Label htmlFor="supplier-types" className="text-xs font-medium text-muted-foreground">
                Product Types
              </Label>
              <Input
                id="supplier-types"
                placeholder="e.g. Wines, Spirits, Beer"
                value={form.product_types}
                onChange={(e) => setForm((f) => ({ ...f, product_types: e.target.value }))}
              />
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
              onClick={handleSave}
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (selectedSupplier) deleteMutation.mutate(selectedSupplier.id)
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