'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useAppStore } from '@/lib/store'
import {
  Building2, Users, Package, ShoppingCart, DollarSign, TrendingUp,
  Activity, Eye, Ban, CheckCircle2, Trash2, ArrowLeft, Search,
  BarChart3, Store, AlertTriangle, Shield, Clock, UserCheck, X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrgSummary {
  totalOrganisations: number
  activeSubscriptions: number
  trialAccounts: number
  totalUsers: number
  totalProducts: number
  totalSales: number
  totalStores: number
  monthlyRevenue: number
}

interface OrgEnriched {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  trial_ends_at: string | null
  max_stores: number
  max_staff: number
  max_products: number
  created_at: string
  userCount: number
  productCount: number
  storeCount: number
  saleCount: number
  manager: { id: string; name: string; email: string; last_login_at: string; is_active: boolean } | null
  latestSale: string | null
}

interface OrgUser {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  last_login_at: string | null
  store_id: string | null
  created_at: string
}

interface OrgStore {
  id: string
  name: string
  location: string
  created_at: string
}

interface OrgDetail {
  org: OrgEnriched
  users: OrgUser[]
  stores: OrgStore[]
  productCount: number
  saleCount: number
  expenseCount: number
  recentSales: Array<{ id: string; total: number; payment_method: string; created_at: string; staff: { name: string } | null }>
  totalRevenue: number
}

interface AuditLog {
  id: string
  action: string
  entity: string
  details: string
  created_at: string
  user: { name: string; email: string } | null
}

/* ------------------------------------------------------------------ */
/*  Helper: fetch with auth                                            */
/* ------------------------------------------------------------------ */

async function saFetch(action: string, opts?: RequestInit) {
  // Get token from Supabase auth session stored in localStorage
  let token = ''
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      'https://rnllkgdsnbybjgvbgagp.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'
    )
    const { data } = await sb.auth.getSession()
    token = data.session?.access_token || ''
  } catch {
    // fallback: try reading from localStorage directly
    try {
      const stored = localStorage.getItem('sb-rnllkgdsnbybjgvbgagp-auth-token')
      if (stored) {
        const parsed = JSON.parse(stored)
        token = parsed?.access_token || ''
      }
    } catch { /* ignore */ }
  }

  const url = `/api/super-admin${action ? `?action=${action}` : ''}`

  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

function timeAgo(d: string | null): string {
  if (!d) return 'Never'
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`
  return formatDate(d)
}

const planColors: Record<string, string> = {
  trial: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  starter: 'bg-blue-100 text-blue-800 border-blue-300',
  professional: 'bg-purple-100 text-purple-800 border-purple-300',
  enterprise: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SuperAdminPage() {
  const { appUser } = useAuth()
  const { setCurrentPage } = useAppStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  // Data states
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [organisations, setOrganisations] = useState<OrgEnriched[]>([])
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null)
  const [orgDetailLoading, setOrgDetailLoading] = useState(false)

  // Dialogs
  const [planDialog, setPlanDialog] = useState<{ open: boolean; org: OrgEnriched | null }>({ open: false, org: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; org: OrgEnriched | null }>({ open: false, org: null })
  const [newPlan, setNewPlan] = useState('')

  const loading = !summary

  // ── Fetch data ──
  const loadSummary = useCallback(async () => {
    try {
      const res = await saFetch('summary')
      const data = await res.json()
      setSummary(data.summary)
    } catch (e) {
      console.error('loadSummary error:', e)
      setRenderError('Failed to load summary')
    }
  }, [])

  const loadOrganisations = useCallback(async () => {
    try {
      const res = await saFetch('organisations')
      const data = await res.json()
      setOrganisations(data.organisations || [])
    } catch (e) {
      console.error('loadOrganisations error:', e)
    }
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const res = await saFetch('activity&limit=100')
      const data = await res.json()
      setActivityLogs(data.logs || [])
    } catch (e) {
      console.error('loadActivity error:', e)
    }
  }, [])

  useEffect(() => {
    loadSummary()
    loadOrganisations()
    loadActivity()
  }, [loadSummary, loadOrganisations, loadActivity])

  // ── Actions ──
  const toggleOrg = async (org: OrgEnriched) => {
    await saFetch('', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle-org', orgId: org.id, is_active: !org.is_active }),
    })
    loadOrganisations()
    loadSummary()
    if (selectedOrg?.org.id === org.id) loadOrgDetail(org.id)
  }

  const changePlan = async () => {
    if (!planDialog.org || !newPlan) return
    await saFetch('', {
      method: 'POST',
      body: JSON.stringify({ action: 'change-plan', orgId: planDialog.org.id, plan: newPlan }),
    })
    setPlanDialog({ open: false, org: null })
    loadOrganisations()
  }

  const deleteOrg = async () => {
    if (!deleteDialog.org) return
    await saFetch('', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete-org', orgId: deleteDialog.org.id }),
    })
    setDeleteDialog({ open: false, org: null })
    setSelectedOrg(null)
    loadOrganisations()
    loadSummary()
  }

  const toggleUser = async (userId: string, is_active: boolean) => {
    await saFetch('', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle-user', userId, is_active: !is_active }),
    })
    if (selectedOrg) loadOrgDetail(selectedOrg.org.id)
  }

  const loadOrgDetail = async (orgId: string) => {
    setOrgDetailLoading(true)
    setActiveTab('org-detail')
    const res = await saFetch(`org-detail&orgId=${orgId}`)
    const data = await res.json()
    setSelectedOrg(data)
    setOrgDetailLoading(false)
  }

  // ── Filtered orgs ──
  const filteredOrgs = organisations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.manager?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.manager?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Not super admin guard ──
  if (appUser && appUser.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <Shield className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Access denied. Super admin privileges required.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert className="max-w-md border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {renderError}. Check that RLS policies allow super_admin access to all tables.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Super Admin</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage all organisations, users, and platform data</p>
        </div>
        <Badge className="self-start bg-red-100 text-red-700 border-red-300 px-3 py-1 text-xs font-semibold">
          <Shield className="h-3 w-3 mr-1" /> SUPER ADMIN
        </Badge>
      </div>

      {activeTab === 'org-detail' && selectedOrg ? (
        /* ── Organisation Detail View ── */
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setActiveTab('overview'); setSelectedOrg(null) }} className="gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to all organisations
          </Button>

          {orgDetailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : (
            <>
              {/* Org Header Card */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-xl font-bold">
                        {selectedOrg.org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{selectedOrg.org.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{selectedOrg.org.manager?.email || 'No manager email'}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={planColors[selectedOrg.org.plan] || planColors.trial}>
                            {selectedOrg.org.plan.toUpperCase()}
                          </Badge>
                          <Badge variant={selectedOrg.org.is_active ? 'default' : 'destructive'} className="text-xs">
                            {selectedOrg.org.is_active ? 'Active' : 'Suspended'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">Created {formatDate(selectedOrg.org.created_at)}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setPlanDialog({ open: true, org: selectedOrg.org }); setNewPlan(selectedOrg.org.plan) }}>
                        Change Plan
                      </Button>
                      <Button variant={selectedOrg.org.is_active ? 'destructive' : 'default'} size="sm" className="gap-1.5" onClick={() => toggleOrg(selectedOrg.org)}>
                        {selectedOrg.org.is_active ? <><Ban className="h-3.5 w-3.5" /> Suspend</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate</>}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Org Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard icon={Users} label="Users" value={selectedOrg.users.length} color="bg-blue-500" />
                <StatCard icon={Store} label="Stores" value={selectedOrg.stores.length} color="bg-indigo-500" />
                <StatCard icon={Package} label="Products" value={selectedOrg.productCount} color="bg-amber-500" />
                <StatCard icon={ShoppingCart} label="Sales" value={selectedOrg.saleCount} color="bg-emerald-500" />
                <StatCard icon={DollarSign} label="Revenue" value={formatCurrency(selectedOrg.totalRevenue)} color="bg-green-600" />
                <StatCard icon={Receipt} label="Expenses" value={selectedOrg.expenseCount} color="bg-rose-500" />
              </div>

              {/* Users Tab + Recent Sales */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-500" /> Users ({selectedOrg.users.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2">
                      {selectedOrg.users.map(u => (
                        <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                              <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5">{u.role}</Badge>
                            <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-[10px] px-1.5">
                              {u.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              onClick={() => toggleUser(u.id, u.is_active)}
                              title={u.is_active ? 'Deactivate user' : 'Activate user'}
                            >
                              {u.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {selectedOrg.users.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No users found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-slate-500" /> Recent Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-2">
                      {selectedOrg.recentSales.map(s => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{formatCurrency(s.total)}</p>
                            <p className="text-xs text-slate-500">{s.staff?.name || 'Unknown'} — {timeAgo(s.created_at)}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{s.payment_method}</Badge>
                        </div>
                      ))}
                      {selectedOrg.recentSales.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No sales yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ── Main Overview ── */
        <>
          {/* Stat Cards */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard icon={Building2} label="Organisations" value={summary!.totalOrganisations} sub={`${summary!.activeSubscriptions} active`} color="bg-purple-600" />
              <StatCard icon={TrendingUp} label="Active Plans" value={summary!.activeSubscriptions} sub={`${summary!.trialAccounts} on trial`} color="bg-emerald-600" />
              <StatCard icon={Users} label="Total Users" value={summary!.totalUsers} color="bg-blue-600" />
              <StatCard icon={Package} label="Products" value={summary!.totalProducts} color="bg-amber-500" />
              <StatCard icon={ShoppingCart} label="Total Sales" value={summary!.totalSales} color="bg-indigo-600" />
              <StatCard icon={Store} label="Stores" value={summary!.totalStores || 0} color="bg-teal-600" />
              <StatCard icon={DollarSign} label="Monthly Revenue" value={formatCurrency(summary!.monthlyRevenue)} color="bg-green-600" />
              <StatCard icon={BarChart3} label="Avg per Org" value={summary!.totalOrganisations > 0 ? Math.round(summary!.totalSales / summary!.totalOrganisations) : 0} sub="sales per org" color="bg-rose-500" />
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border shadow-sm">
              <TabsTrigger value="overview" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Organisations</TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</TabsTrigger>
            </TabsList>

            {/* ── Organisations Tab ── */}
            <TabsContent value="overview" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  {/* Search */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search organisations, managers, emails..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto -mx-4 px-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-100">
                          <TableHead className="text-xs font-semibold text-slate-500">ORGANISATION</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">MANAGER</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">PLAN</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 text-center">USERS</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 text-center">SALES</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">LAST ACTIVITY</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">STATUS</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 text-right">ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrgs.map(org => (
                          <TableRow key={org.id} className="border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => loadOrgDetail(org.id)}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 text-sm font-bold">
                                  {org.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                                  <p className="text-xs text-slate-400">Created {formatDate(org.created_at)}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm text-slate-700">{org.manager?.name || '—'}</p>
                                <p className="text-xs text-slate-400">{org.manager?.email || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={planColors[org.plan] || planColors.trial}>
                                {org.plan}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-medium text-slate-700">{org.userCount}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-medium text-slate-700">{org.saleCount}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock className="h-3 w-3" />
                                {timeAgo(org.latestSale)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={org.is_active ? 'default' : 'destructive'} className="text-[10px]">
                                {org.is_active ? 'Active' : 'Suspended'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => loadOrgDetail(org.id)} title="View details">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => toggleOrg(org)}
                                  title={org.is_active ? 'Suspend' : 'Activate'}
                                >
                                  {org.is_active ? <Ban className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => { setPlanDialog({ open: true, org }); setNewPlan(org.plan) }}
                                  title="Change plan"
                                >
                                  <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setDeleteDialog({ open: true, org })}
                                  title="Delete organisation"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredOrgs.length === 0 && !loading && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                              {searchQuery ? 'No organisations match your search' : 'No organisations yet. Clients will appear here when they sign up.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Activity Tab ── */}
            <TabsContent value="activity" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {activityLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-slate-50 border-b border-slate-50 last:border-0">
                        <Activity className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">{log.user?.name || 'Unknown'}</span>{' '}
                            <span className="text-slate-500">{log.action}</span>{' '}
                            <span className="font-medium">{log.entity}</span>
                          </p>
                          {log.details && <p className="text-xs text-slate-400 mt-0.5 truncate">{log.details}</p>}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{timeAgo(log.created_at)}</span>
                      </div>
                    ))}
                    {activityLogs.length === 0 && (
                      <p className="text-center py-12 text-slate-400">No activity logs yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Change Plan Dialog ── */}
      <Dialog open={planDialog.open} onOpenChange={(o) => setPlanDialog({ open: o, org: planDialog.org })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>Update the subscription plan for <strong>{planDialog.org?.name}</strong></DialogDescription>
          </DialogHeader>
          <Select value={newPlan} onValueChange={setNewPlan}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">Trial (Free)</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog({ open: false, org: null })}>Cancel</Button>
            <Button onClick={changePlan}>Update Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Organisation Dialog ── */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, org: deleteDialog.org })}>
        <DialogContent className="border-red-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Delete Organisation
            </DialogTitle>
            <DialogDescription>
              This will <strong>permanently delete</strong> {deleteDialog.org?.name} and ALL of its data including users, sales, products, and expenses. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, org: null })}>Cancel</Button>
            <Button variant="destructive" onClick={deleteOrg}>Delete Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Need Receipt icon for stat card
function Receipt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  )
}