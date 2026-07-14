'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { User } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Plus, Edit, Trash2, Users, ShieldCheck, ShieldOff,
  FileDown, ClipboardCheck, BarChart3, RefreshCw,
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ═══════════════════════════════════════════════════════════════ */
/*  Constants                                                    */
/* ═══════════════════════════════════════════════════════════════ */

const ACCENT = '#7C3AED'

function formatKES(n: number) {
  return 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Form Types                                                   */
/* ═══════════════════════════════════════════════════════════════ */

interface StaffAddForm { name: string; email: string; pin: string; password: string; role: 'staff' | 'manager' }
interface StaffEditForm { name: string; role: 'staff' | 'manager'; is_active: boolean }

const emptyAdd: StaffAddForm = { name: '', email: '', pin: '', password: '', role: 'staff' }

/* ═══════════════════════════════════════════════════════════════ */
/*  CSV Download Helper                                          */
/* ═══════════════════════════════════════════════════════════════ */

async function downloadCSV(type: string, label: string) {
  const { data: session } = await supabase.auth.getSession()
  const token = session?.session?.access_token
  if (!token) return alert('Not authenticated')

  const res = await fetch(`/api/reports?storeId=${supabase.auth.getUser().then(() => '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type }),
  })
  if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Export failed'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${label}-${todayStr()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main Component                                               */
/* ═══════════════════════════════════════════════════════════════ */

export default function StaffPage() {
  const isMobile = useIsMobile()
  const { appUser, organisation } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('staff')

  // ── Shared state ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<User | null>(null)
  const [addForm, setAddForm] = useState<StaffAddForm>(emptyAdd)
  const [editForm, setEditForm] = useState<StaffEditForm>({ name: '', role: 'staff', is_active: true })

  // ── Reconciliation state ───────────────────────────────────
  const [reconDate, setReconDate] = useState(todayStr())

  /* ════════════════════════════════════════════════════════════════
     STAFF TAB: Queries & Mutations
     ════════════════════════════════════════════════════════════════ */

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('organisation_id', organisation!.id)
        .neq('id', appUser!.id)
        .order('created_at', { ascending: false })
      return (data as User[]) || []
    },
    enabled: !!organisation?.id && appUser?.role === 'manager',
  })

  const addMutation = useMutation({
    mutationFn: async (v: StaffAddForm) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: v.name,
          email: v.email.trim() || undefined,
          password: v.password,
          pin: v.pin,
          role: v.role,
        }),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'Failed to add staff')
      return r
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); closeAdd() },
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: StaffEditForm }) => {
      const { error } = await supabase.from('users').update({ name: form.name, role: form.role, is_active: form.is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); closeEdit() },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDeleteOpen(false); setSelected(null) },
  })

  /* ════════════════════════════════════════════════════════════════
     RECONCILIATION TAB: Queries & Mutations
     ════════════════════════════════════════════════════════════════ */

  const { data: reconData, isLoading: reconLoading, refetch: refetchRecon } = useQuery({
    queryKey: ['reconciliation', organisation?.id, reconDate],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return null
      const res = await fetch(`/api/reconciliation?date=${reconDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error)
      return r
    },
    enabled: !!organisation?.id,
  })

  const saveReconMutation = useMutation({
    mutationFn: async ({ items }: { items: any[] }) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: reconDate, items }),
      })
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'Failed to save reconciliation')
      return r
    },
    onSuccess: () => { refetchRecon() },
  })

  /* ════════════════════════════════════════════════════════════════
     HELPERS
     ════════════════════════════════════════════════════════════════ */

  const openAdd = () => { setAddForm(emptyAdd); setAddOpen(true) }
  const closeAdd = () => { setAddOpen(false); setAddForm(emptyAdd) }
  const openEdit = (m: User) => { setSelected(m); setEditForm({ name: m.name, role: m.role as any, is_active: m.is_active }); setEditOpen(true) }
  const closeEdit = () => { setEditOpen(false); setSelected(null) }

  const handleAdd = () => {
    if (!addForm.name.trim() || !addForm.pin || addForm.pin.length !== 4 || !addForm.password || addForm.password.length < 6) return
    addMutation.mutate(addForm)
  }

  const handleEdit = () => {
    if (!selected || !editForm.name.trim()) return
    editMutation.mutate({ id: selected.id, form: editForm })
  }

  // Update actual closing stock in reconciliation
  const updateActualClosing = (product_id: string, value: number) => {
    if (!reconData?.items) return
    const updated = reconData.items.map((item: any) => {
      if (item.product_id === product_id) {
        const expected = item.expected_closing || 0
        const variance = expected - value
        return { ...item, actual_closing: value, variance, value_lost: variance > 0 ? variance * (item.cost_price || 0) : 0 }
      }
      return item
    })
    queryClient.setQueryData(['reconciliation', organisation?.id, reconDate], { ...reconData, items: updated })
  }

  const handleSaveRecon = () => {
    if (!reconData?.items) return
    const itemsWithActual = reconData.items.map((item: any) => ({
      ...item,
      actual_closing: item.actual_closing ?? item.expected_closing ?? 0,
      cost_price: item.cost_price || 0,
    }))
    saveReconMutation.mutate({ items: itemsWithActual })
  }

  /* ════════════════════════════════════════════════════════════════
     ACCESS GUARD
     ════════════════════════════════════════════════════════════════ */

  if (appUser?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <ShieldOff className="mb-4 h-16 w-16 opacity-30" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="mt-1 text-sm">Only managers can access this section.</p>
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════
     RECONCILIATION COMPUTED VALUES
     ════════════════════════════════════════════════════════════════ */

  const reconItems = (reconData?.items || []) as any[]
  const reconStats = reconItems.reduce((acc, item) => {
    const variance = item.variance ?? 0
    const valueLost = item.value_lost ?? 0
    acc.totalExpected += item.expected_closing || 0
    acc.totalActual += (item.actual_closing ?? item.expected_closing) || 0
    acc.totalSold += item.sales_today || 0
    acc.totalAdded += item.stock_added || 0
    acc.totalVariance += variance
    acc.totalValueLost += valueLost
    if (variance > 0) acc.shrinkageCount += 1
    if (variance < 0) acc.surplusCount += 1
    return acc
  }, { totalExpected: 0, totalActual: 0, totalSold: 0, totalAdded: 0, totalVariance: 0, totalValueLost: 0, shrinkageCount: 0, surplusCount: 0 })

  /* ════════════════════════════════════════════════════════════════
     ROLE BADGE
     ════════════════════════════════════════════════════════════════ */

  const RoleBadge = ({ role }: { role: string }) => role === 'manager' ? (
    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-700">
      <ShieldCheck className="mr-1 h-3 w-3" />Manager
    </Badge>
  ) : (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">Staff</Badge>
  )

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Operations Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === 'staff' && `${staff.length} team member${staff.length !== 1 ? 's' : ''}`}
            {activeTab === 'reconciliation' && 'Daily stock verification'}
            {activeTab === 'reports' && 'Export data as CSV'}
          </p>
        </div>
        {activeTab === 'staff' && (
          <Button onClick={openAdd} className="shrink-0 shadow-md" style={{ backgroundColor: ACCENT, borderColor: ACCENT }}>
            <Plus className="mr-2 h-4 w-4" />Add Staff
          </Button>
        )}
        {activeTab === 'reports' && (
          <div className="flex gap-2">
            <Input type="date" value={reconDate} onChange={e => setReconDate(e.target.value)} className="h-10 w-auto" />
          </div>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="staff" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-4 w-4" />Staff
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-1.5 text-xs sm:text-sm">
            <ClipboardCheck className="h-4 w-4" />Reconciliation
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
            <FileDown className="h-4 w-4" />Reports
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════
            TAB 1: STAFF MANAGEMENT
            ════════════════════════════════════════════════════════ */}
        <TabsContent value="staff" className="space-y-4 pt-4">
          {staffLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : staff.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="mb-3 h-12 w-12 opacity-40" />
                <p className="text-sm font-medium">No staff members yet</p>
                <p className="text-xs">Add your first team member to get started</p>
              </CardContent>
            </Card>
          ) : isMobile ? (
            /* Mobile cards */
            <div className="grid gap-3">
              {staff.map((m) => (
                <Card key={m.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.email || '\u2014'}</p>
                      </div>
                      <RoleBadge role={m.role} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                        <p className={`text-xs font-semibold ${m.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.is_active ? '\u25CF Active' : '\u25CF Inactive'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Login</p>
                        <p className="text-xs text-muted-foreground">{formatDate(m.last_login_at)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => openEdit(m)}>
                        <Edit className="mr-1.5 h-3.5 w-3.5" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-red-600 hover:bg-red-50" onClick={() => { setSelected(m); setDeleteOpen(true) }}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />Deactivate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop table */
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Last Login</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((m) => (
                      <TableRow key={m.id} className="border-border/40 hover:bg-muted/30">
                        <TableCell className="pl-4 text-sm font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.email || '\u2014'}</TableCell>
                        <TableCell className="text-center"><RoleBadge role={m.role} /></TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs font-semibold ${m.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.is_active ? '\u25CF Active' : '\u25CF Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.last_login_at)}</TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                              <Edit className="h-4 w-4" /><span className="sr-only">Edit</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => { setSelected(m); setDeleteOpen(true) }}>
                              <Trash2 className="h-4 w-4" /><span className="sr-only">Deactivate</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════
            TAB 2: DAILY RECONCILIATION
            ════════════════════════════════════════════════════════ */}
        <TabsContent value="reconciliation" className="space-y-4 pt-4">
          {/* Date picker + actions */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium whitespace-nowrap">Reconciliation Date</Label>
                <Input type="date" value={reconDate} onChange={e => setReconDate(e.target.value)} className="h-10 w-auto" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchRecon()} disabled={reconLoading}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${reconLoading ? 'animate-spin' : ''}`} />Refresh
                </Button>
                <Button size="sm" style={{ backgroundColor: ACCENT, borderColor: ACCENT }} onClick={handleSaveRecon} disabled={saveReconMutation.isPending || !reconData?.items?.length}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  {saveReconMutation.isPending ? 'Saving...' : 'Save Reconciliation'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          {reconItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Sold Today</p>
                  <p className="mt-1 text-2xl font-bold">{reconStats.totalSold}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock Added</p>
                  <p className="mt-1 text-2xl font-bold">{reconStats.totalAdded}</p>
                  <p className="text-xs text-muted-foreground">units received</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Variance</p>
                  <p className={`mt-1 text-2xl font-bold ${reconStats.totalVariance > 0 ? 'text-red-600' : reconStats.totalVariance < 0 ? 'text-emerald-600' : ''}`}>
                    {reconStats.totalVariance > 0 ? '+' : ''}{reconStats.totalVariance}
                  </p>
                  <p className="text-xs text-muted-foreground">{reconStats.shrinkageCount} shrinkage, {reconStats.surplusCount} surplus</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value at Risk</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{formatKES(reconStats.totalValueLost)}</p>
                  <p className="text-xs text-muted-foreground">if variance is loss</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reconciliation table */}
          {reconLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : reconItems.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
                <ClipboardCheck className="mb-3 h-12 w-12 opacity-40" />
                <p className="text-sm font-medium">No products found for this date</p>
                <p className="text-xs">Add products to inventory first, or select a different date</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Stock Reconciliation — {reconDate}
                  {reconData?.status && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {reconData.status === 'completed' ? (
                        <><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />Completed</>
                      ) : (
                        <><AlertTriangle className="mr-1 h-3 w-3 text-amber-600" />Draft</>
                      )}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="pl-4 text-xs">Product</TableHead>
                        <TableHead className="text-center text-xs">Opening</TableHead>
                        <TableHead className="text-center text-xs">Sold</TableHead>
                        <TableHead className="text-center text-xs">Added</TableHead>
                        <TableHead className="text-center text-xs">Expected</TableHead>
                        <TableHead className="pr-4 text-xs">Actual Count</TableHead>
                        <TableHead className="text-center text-xs">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconItems.map((item: any) => {
                        const variance = item.variance ?? 0
                        return (
                          <TableRow key={item.product_id} className="border-border/40 hover:bg-muted/30">
                            <TableCell className="pl-4 text-sm font-medium">{item.product?.name || 'Unknown'}</TableCell>
                            <TableCell className="text-center text-sm">{item.opening_stock || 0}</TableCell>
                            <TableCell className="text-center text-sm text-red-600">-{item.sales_today || 0}</TableCell>
                            <TableCell className="text-center text-sm text-emerald-600">+{item.stock_added || 0}</TableCell>
                            <TableCell className="text-center text-sm font-medium">{item.expected_closing || 0}</TableCell>
                            <TableCell className="pr-4">
                              <Input
                                type="number"
                                min={0}
                                value={item.actual_closing ?? ''}
                                onChange={e => updateActualClosing(item.product_id, parseInt(e.target.value) || 0)}
                                placeholder={String(item.expected_closing || 0)}
                                className="h-8 w-20 text-center text-sm"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {variance !== 0 && (
                                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {variance > 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                  {variance > 0 ? '+' : ''}{variance}
                                </span>
                              )}
                              {variance === 0 && <span className="text-xs text-muted-foreground">0</span>}
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

          {saveReconMutation.isError && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-xs text-red-600">
              {saveReconMutation.error instanceof Error ? saveReconMutation.error.message : 'Failed to save reconciliation'}
            </div>
          )}
          {saveReconMutation.isSuccess && (
            <div className="rounded-md bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />Reconciliation saved successfully
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════
            TAB 3: REPORTS & CSV EXPORT
            ════════════════════════════════════════════════════════ */}
        <TabsContent value="reports" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { type: 'sales', icon: BarChart3, title: 'Sales Report', desc: 'All transactions with items, staff, and payment methods', colour: 'text-blue-600 bg-blue-50 border-blue-200' },
              { type: 'inventory', icon: PackageIcon, title: 'Inventory Report', desc: 'Complete product list with stock levels, costs, and values', colour: 'text-amber-600 bg-amber-50 border-amber-200' },
              { type: 'profit-loss', icon: TrendingUp, title: 'Profit & Loss', desc: 'Revenue, COGS, expenses, and net profit summary', colour: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { type: 'expenses', icon: ReceiptIcon, title: 'Expense Report', desc: 'All expenses grouped by date and category', colour: 'text-red-600 bg-red-50 border-red-200' },
              { type: 'reconciliation', icon: ClipboardCheck, title: 'Reconciliation Report', desc: 'Stock variance history with opening, closing, and shrinkage', colour: 'text-purple-600 bg-purple-50 border-purple-200' },
              { type: 'staff-performance', icon: Users, title: 'Staff Performance', desc: 'Sales count and revenue generated per staff member', colour: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            ].map((r) => (
              <Card key={r.type} className="border-border/60 shadow-sm transition-shadow hover:shadow-md cursor-pointer group" onClick={() => downloadCSV(r.type, r.title)}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${r.colour}`}>
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>
                      <FileDown className="h-3.5 w-3.5" />Download CSV
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════
          ADD STAFF DIALOG
          ══════════════════════════════════════════════════════════ */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) closeAdd() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. John Kamau" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input type="email" placeholder="e.g. john@store.com" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground">PIN (4 digits) <span className="text-red-500">*</span></Label>
                <Input type="password" maxLength={4} placeholder="e.g. 1234" value={addForm.pin}
                  onChange={e => setAddForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Password <span className="text-red-500">*</span></Label>
                <Input type="password" placeholder="Min. 6 characters" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Role</Label>
              <Select value={addForm.role} onValueChange={v => setAddForm(f => ({ ...f, role: v as any }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addMutation.isError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {addMutation.error instanceof Error ? addMutation.error.message : 'Failed to add staff member'}
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-3 pt-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={closeAdd} disabled={addMutation.isPending}>Cancel</Button>
            <Button className="flex-1 sm:flex-none" style={{ backgroundColor: ACCENT, borderColor: ACCENT }} onClick={handleAdd}
              disabled={addMutation.isPending || !addForm.name.trim() || addForm.pin.length !== 4 || addForm.password.length < 6}>
              {addMutation.isPending ? 'Adding...' : 'Add Staff Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          EDIT STAFF DIALOG
          ══════════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) closeEdit() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Role</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as any }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Active Status</Label>
              <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))} />
            </div>
            {editMutation.isError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {editMutation.error instanceof Error ? editMutation.error.message : 'Update failed'}
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-3 pt-2 sm:justify-end">
            <Button variant="outline" onClick={closeEdit} disabled={editMutation.isPending}>Cancel</Button>
            <Button style={{ backgroundColor: ACCENT, borderColor: ACCENT }} onClick={handleEdit} disabled={editMutation.isPending || !editForm.name.trim()}>
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          DELETE CONFIRMATION DIALOG
          ══════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {selected?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the staff member. They won&apos;t be able to log in, but their sales history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selected && deleteMutation.mutate(selected.id)} className="bg-red-600 text-white hover:bg-red-700" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ─── Stub icons for report cards (avoid adding new imports) ─── */
function PackageIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" /><line x1="12" x2="12" y1="22" y2="12" />
    </svg>
  )
}

function ReceiptIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" />
    </svg>
  )
}