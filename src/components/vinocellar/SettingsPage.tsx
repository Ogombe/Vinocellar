'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Store, Organisation } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
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
  Store as StoreIcon,
  Building2,
  Shield,
  CalendarClock,
  MapPin,
  Save,
  Trash2,
  Pencil,
  X,
  Crown,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

const PLAN_STYLES: Record<string, string> = {
  trial: 'border-amber-200 bg-amber-50 text-amber-700',
  starter: 'border-sky-200 bg-sky-50 text-sky-700',
  professional: 'border-purple-200 bg-purple-50 text-purple-700',
  enterprise: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { store, appUser, organisation, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  const isManager = appUser?.role === 'manager' || appUser?.role === 'super_admin'

  // Edit state for store info
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  /* ── Fetch store details (fresh) ────────────────────────────────── */

  const { data: storeData, isLoading: storeLoading } = useQuery<Store>({
    queryKey: ['settings-store', store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('id', store!.id)
        .single()
      return data as Store
    },
    enabled: !!store?.id,
  })

  /* ── Fetch org details (fresh) ──────────────────────────────────── */

  const { data: orgData, isLoading: orgLoading } = useQuery<Organisation>({
    queryKey: ['settings-org', organisation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisation!.id)
        .single()
      return data as Organisation
    },
    enabled: !!organisation?.id,
  })

  const isLoading = storeLoading || orgLoading

  const currentStore = storeData || store
  const currentOrg = orgData || organisation

  /* ── Edit handlers ──────────────────────────────────────────────── */

  const handleStartEdit = () => {
    if (!currentStore) return
    setEditName(currentStore.name)
    setEditLocation(currentStore.location)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName('')
    setEditLocation('')
  }

  /* ── Update store mutation ──────────────────────────────────────── */

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!currentStore || !editName.trim()) throw new Error('Store name is required')
      const { error } = await supabase
        .from('stores')
        .update({
          name: editName.trim(),
          location: editLocation.trim(),
        })
        .eq('id', currentStore.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-store'] })
      refreshProfile()
      setIsEditing(false)
    },
  })

  /* ── Delete store mutation ──────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentStore) throw new Error('No store selected')
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', currentStore.id)
      if (error) throw error
    },
    onSuccess: () => {
      // Force a page reload after deletion
      window.location.href = '/app'
    },
  })

  /* ── Loading skeleton ──────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  /* ── Main render ───────────────────────────────────────────────── */

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your store and account settings
        </p>
      </div>

      {/* ── Store Info Section ─────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${ACCENT}14` }}
              >
                <StoreIcon className="h-4 w-4" style={{ color: ACCENT }} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Store Information</CardTitle>
                <CardDescription className="text-xs">Your store&apos;s details</CardDescription>
              </div>
            </div>
            {isManager && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleStartEdit}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing && isManager ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="store-name" className="text-xs font-medium text-muted-foreground">
                  Store Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="store-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. VinoCellar Westlands"
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="store-location" className="text-xs font-medium text-muted-foreground">
                  Location
                </Label>
                <Input
                  id="store-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Westlands, Nairobi"
                  className="h-10"
                />
              </div>
              <div className="flex items-center gap-3 pt-2 sm:col-span-2">
                <Button
                  className="shadow-md transition-all hover:shadow-lg"
                  style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !editName.trim()}
                >
                  {updateMutation.isPending ? 'Saving…' : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} disabled={updateMutation.isPending}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
              {updateMutation.isError && (
                <p className="sm:col-span-2 text-xs text-red-600">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update store'}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Store Name</p>
                <p className="text-sm font-semibold text-foreground">{currentStore?.name ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-foreground">{currentStore?.location || 'Not set'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Store ID</p>
                <p className="truncate text-xs font-mono text-muted-foreground">{currentStore?.id ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="text-sm text-muted-foreground">{formatDate(currentStore?.created_at ?? null)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Organisation Info Section ──────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Building2 className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Organisation</CardTitle>
              <CardDescription className="text-xs">Your business account details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Business Name</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{currentOrg?.name ?? '—'}</p>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">read-only</Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${PLAN_STYLES[currentOrg?.plan ?? 'trial'] ?? PLAN_STYLES.trial}`}
                >
                  <Crown className="mr-1 h-3 w-3" />
                  {PLAN_LABELS[currentOrg?.plan ?? 'trial'] ?? 'Trial'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Trial Expires</p>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-foreground">
                  {currentOrg?.trial_ends_at ? formatDate(currentOrg.trial_ends_at) : 'N/A'}
                </p>
                {currentOrg?.trial_ends_at && new Date(currentOrg.trial_ends_at) < new Date() && (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">
                    Expired
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subscription Period</p>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-foreground">
                  {currentOrg?.current_period_end
                    ? formatDate(currentOrg.current_period_end)
                    : currentOrg?.plan === 'trial' ? 'In trial' : 'N/A'}
                </p>
                {currentOrg?.current_period_end && new Date(currentOrg.current_period_end) < new Date() && (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px]">
                    Expired
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organisation ID</p>
              <p className="truncate text-xs font-mono text-muted-foreground">{currentOrg?.id ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
              <Badge
                variant="outline"
                className={
                  currentOrg?.is_active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }
              >
                {currentOrg?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Your Account Section ───────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Your Account</CardTitle>
              <CardDescription className="text-xs">Your user profile</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</p>
              <p className="text-sm font-semibold text-foreground">{appUser?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="text-sm text-foreground">{appUser?.email ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</p>
              <Badge
                variant="outline"
                className={
                  appUser?.role === 'super_admin'
                    ? 'border-purple-200 bg-purple-50 text-purple-700'
                    : appUser?.role === 'manager'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                }
              >
                {appUser?.role === 'super_admin' ? 'Super Admin' : appUser?.role === 'manager' ? 'Manager' : 'Staff'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</p>
              <p className="text-sm text-muted-foreground">
                {appUser?.last_login_at ? formatDate(appUser.last_login_at) : 'First time'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Danger Zone ────────────────────────────────────────────── */}
      {isManager && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-red-700">Danger Zone</CardTitle>
                <CardDescription className="text-xs">Irreversible and destructive actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-red-100 bg-red-50/50 p-4">
              <div>
                <p className="text-sm font-medium text-red-800">Delete Store</p>
                <p className="text-xs text-red-600/80">
                  Permanently delete &ldquo;{currentStore?.name}&rdquo; and all its data. This cannot be undone.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-red-300 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 sm:ml-4"
                onClick={() => {
                  setDeleteConfirmText('')
                  setDeleteDialogOpen(true)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Store
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Delete Store Permanently</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete <strong>{currentStore?.name}</strong> and all associated data
                  including products, sales, expenses, and stock history.
                </p>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium text-red-700">
                    Type <strong>&ldquo;{currentStore?.name}&rdquo;</strong> to confirm
                  </Label>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={currentStore?.name}
                    className="border-red-200 focus-visible:ring-red-500"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
              disabled={
                deleteMutation.isPending ||
                deleteConfirmText !== currentStore?.name
              }
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Store Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}