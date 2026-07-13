'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Expense } from '@/lib/types'
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
  Edit,
  Trash2,
  Receipt,
  TrendingDown,
  Filter,
  CalendarDays,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Inventory',
  'Marketing',
  'Maintenance',
  'Other',
] as const

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

const CATEGORY_STYLES: Record<string, string> = {
  Rent: 'border-purple-200 bg-purple-50 text-purple-700',
  Utilities: 'border-sky-200 bg-sky-50 text-sky-700',
  Salaries: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Inventory: 'border-amber-200 bg-amber-50 text-amber-700',
  Marketing: 'border-pink-200 bg-pink-50 text-pink-700',
  Maintenance: 'border-orange-200 bg-orange-50 text-orange-700',
  Other: 'border-slate-200 bg-slate-50 text-slate-600',
}

const formatKES = (amount: number): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

/* ------------------------------------------------------------------ */
/*  Form type                                                          */
/* ------------------------------------------------------------------ */

interface ExpenseForm {
  date: string
  category: ExpenseCategory
  description: string
  amount: string
}

const emptyForm: ExpenseForm = {
  date: todayISO(),
  category: 'Rent',
  description: '',
  amount: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ExpensesPage() {
  const isMobile = useIsMobile()
  const { store, appUser } = useAuth()
  const queryClient = useQueryClient()

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)

  /* ── Data fetching ────────────────────────────────────────────── */

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', store!.id)
        .order('created_at', { ascending: false })
      return (data as Expense[]) || []
    },
    enabled: !!store?.id,
  })

  /* ── Computed: this month's total ──────────────────────────────── */

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTotal = expenses
    .filter((e) => {
      const d = new Date(e.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((sum, e) => sum + e.amount, 0)

  /* ── Filtered list ─────────────────────────────────────────────── */

  const filtered = expenses.filter((e) =>
    categoryFilter === 'all' || e.category === categoryFilter
  )

  /* ── Save mutation (add / edit) ────────────────────────────────── */

  const saveMutation = useMutation({
    mutationFn: async (values: ExpenseForm) => {
      const row = {
        date: values.date,
        category: values.category,
        description: values.description,
        amount: parseFloat(values.amount) || 0,
        organisation_id: store!.organisation_id,
        store_id: store!.id,
        recorded_by: appUser!.id,
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            date: row.date,
            category: row.category,
            description: row.description,
            amount: row.amount,
          })
          .eq('id', editingExpense.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('expenses').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      handleCloseDialog()
    },
  })

  /* ── Delete mutation ───────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteDialogOpen(false)
      setSelectedExpense(null)
    },
  })

  /* ── Dialog helpers ────────────────────────────────────────────── */

  const handleOpenCreate = () => {
    setEditingExpense(null)
    setForm({ ...emptyForm, date: todayISO() })
    setDialogOpen(true)
  }

  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setForm({
      date: expense.date,
      category: expense.category as ExpenseCategory,
      description: expense.description,
      amount: String(expense.amount),
    })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingExpense(null)
    setForm(emptyForm)
  }

  const handleOpenDelete = (expense: Expense) => {
    setSelectedExpense(expense)
    setDeleteDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.date || !form.description.trim() || !form.amount) return
    if (parseFloat(form.amount) <= 0) return
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
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  /* ── Render: Mobile cards ──────────────────────────────────────── */

  const renderMobileCards = () => (
    <div className="grid gap-3">
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Receipt className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">No expenses found</p>
          <p className="text-xs">
            {categoryFilter !== 'all'
              ? 'Try a different category filter'
              : 'Record your first expense to get started'}
          </p>
        </div>
      )}
      {filtered.map((expense) => (
        <Card key={expense.id} className="overflow-hidden border border-border/60 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{expense.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${CATEGORY_STYLES[expense.category] || CATEGORY_STYLES.Other}`}
                  >
                    {expense.category}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(expense.date)}
                  </span>
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
                {formatKES(expense.amount)}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => handleOpenEdit(expense)}
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleOpenDelete(expense)}
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
                <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (KES)</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Receipt className="mb-3 h-12 w-12 opacity-40" />
                      <p className="text-sm font-medium">No expenses found</p>
                      <p className="text-xs">
                        {categoryFilter !== 'all'
                          ? 'Try a different category filter'
                          : 'Record your first expense to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((expense) => (
                <TableRow key={expense.id} className="border-border/40 transition-colors hover:bg-muted/30">
                  <TableCell className="pl-4 text-sm text-muted-foreground">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${CATEGORY_STYLES[expense.category] || CATEGORY_STYLES.Other}`}
                    >
                      {expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm">{expense.description}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                    {formatKES(expense.amount)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(expense)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit expense</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => handleOpenDelete(expense)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete expense</span>
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded &middot;{' '}
            {filtered.length} shown
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="shrink-0 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Summary card */}
      <Card
        className="border-border/60 shadow-sm"
        style={{ borderLeftWidth: '4px', borderLeftColor: ACCENT }}
      >
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${ACCENT}14` }}
          >
            <TrendingDown className="h-6 w-6" style={{ color: ACCENT }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              This Month&apos;s Expenses
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: ACCENT }}>
              {formatKES(thisMonthTotal)}
            </p>
          </div>
          <div className="ml-auto hidden sm:block">
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="relative w-full sm:w-52">
        <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 pl-10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expenses list */}
      {isMobile ? renderMobileCards() : renderDesktopTable()}

      {/* ── Add / Edit dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingExpense ? 'Edit Expense' : 'Record New Expense'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="expense-date" className="text-xs font-medium text-muted-foreground">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="expense-desc" className="text-xs font-medium text-muted-foreground">
                Description <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expense-desc"
                placeholder="e.g. Monthly shop rent payment"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="expense-amount" className="text-xs font-medium text-muted-foreground">
                Amount (KES) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
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
              disabled={
                saveMutation.isPending ||
                !form.date ||
                !form.description.trim() ||
                !form.amount ||
                parseFloat(form.amount) <= 0
              }
            >
              {saveMutation.isPending ? 'Saving…' : editingExpense ? 'Update Expense' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the expense &ldquo;{selectedExpense?.description}&rdquo; for{' '}
              <strong>{selectedExpense ? formatKES(selectedExpense.amount) : ''}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (selectedExpense) deleteMutation.mutate(selectedExpense.id)
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