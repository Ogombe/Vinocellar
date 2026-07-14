'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { User } from '@/lib/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
  Users,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/use-mobile'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT = '#7C3AED'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' '
    + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

/* ------------------------------------------------------------------ */
/*  Form types                                                         */
/* ------------------------------------------------------------------ */

interface StaffAddForm {
  name: string
  email: string
  pin: string
  password: string
  role: 'staff' | 'manager'
}

interface StaffEditForm {
  name: string
  role: 'staff' | 'manager'
  is_active: boolean
}

const emptyAddForm: StaffAddForm = {
  name: '',
  email: '',
  pin: '',
  password: '',
  role: 'staff',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StaffPage() {
  const isMobile = useIsMobile()
  const { appUser, organisation } = useAuth()
  const queryClient = useQueryClient()

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null)
  const [addForm, setAddForm] = useState<StaffAddForm>(emptyAddForm)
  const [editForm, setEditForm] = useState<StaffEditForm>({ name: '', role: 'staff', is_active: true })

  /* ── Data fetching ────────────────────────────────────────────── */

  const { data: staff = [], isLoading } = useQuery({
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

  /* ── Add staff mutation (Edge Function) ────────────────────────── */

  const addMutation = useMutation({
    mutationFn: async (values: StaffAddForm) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/addstaff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: values.email || `${values.name.trim().toLowerCase().replace(/\s+/g, '.')}@staff.vinocellar.app`,
          password: values.password,
          name: values.name,
          pin: values.pin,
          role: values.role,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to add staff member')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      handleCloseAddDialog()
    },
  })

  /* ── Edit staff mutation ───────────────────────────────────────── */

  const editMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: StaffEditForm }) => {
      const { error } = await supabase
        .from('users')
        .update({
          name: form.name,
          role: form.role,
          is_active: form.is_active,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      handleCloseEditDialog()
    },
  })

  /* ── Delete staff mutation ─────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setDeleteDialogOpen(false)
      setSelectedStaff(null)
    },
  })

  /* ── Access guard (after all hooks) ────────────────────────────── */

  if (appUser?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <ShieldOff className="mb-4 h-16 w-16 opacity-30" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="mt-1 text-sm">Only managers can manage staff members.</p>
      </div>
    )
  }

  /* ── Dialog helpers ────────────────────────────────────────────── */

  const handleOpenAddDialog = () => {
    setAddForm(emptyAddForm)
    setAddDialogOpen(true)
  }

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false)
    setAddForm(emptyAddForm)
  }

  const handleOpenEditDialog = (member: User) => {
    setSelectedStaff(member)
    setEditForm({
      name: member.name,
      role: member.role as 'staff' | 'manager',
      is_active: member.is_active,
    })
    setEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setSelectedStaff(null)
  }

  const handleOpenDeleteDialog = (member: User) => {
    setSelectedStaff(member)
    setDeleteDialogOpen(true)
  }

  const handleAddSave = () => {
    if (!addForm.name.trim() || !addForm.pin || !addForm.password) return
    if (addForm.pin.length !== 4) return
    addMutation.mutate(addForm)
  }

  const handleEditSave = () => {
    if (!selectedStaff || !editForm.name.trim()) return
    editMutation.mutate({ id: selectedStaff.id, form: editForm })
  }

  /* ── Loading skeleton ──────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  /* ── Role badge helper ─────────────────────────────────────────── */

  const RoleBadge = ({ role }: { role: string }) => {
    if (role === 'manager') {
      return (
        <Badge
          variant="outline"
          className="border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-700"
        >
          <ShieldCheck className="mr-1 h-3 w-3" />
          Manager
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600"
      >
        Staff
      </Badge>
    )
  }

  /* ── Render: Mobile cards ──────────────────────────────────────── */

  const renderMobileCards = () => (
    <div className="grid gap-3">
      {staff.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">No staff members yet</p>
          <p className="text-xs">Add your first team member to get started</p>
        </div>
      )}
      {staff.map((member) => (
        <Card key={member.id} className="overflow-hidden border border-border/60 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <RoleBadge role={member.role} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                <p className={`text-xs font-semibold ${member.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                  {member.is_active ? '● Active' : '● Inactive'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Login</p>
                <p className="text-xs text-muted-foreground">{formatDate(member.last_login_at)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => handleOpenEditDialog(member)}
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleOpenDeleteDialog(member)}
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
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Login</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Users className="mb-3 h-12 w-12 opacity-40" />
                      <p className="text-sm font-medium">No staff members yet</p>
                      <p className="text-xs">Add your first team member to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {staff.map((member) => (
                <TableRow key={member.id} className="border-border/40 transition-colors hover:bg-muted/30">
                  <TableCell className="pl-4">
                    <span className="text-sm font-medium">{member.name}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="text-center">
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-semibold ${member.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                      {member.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(member.last_login_at)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEditDialog(member)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit {member.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => handleOpenDeleteDialog(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {member.name}</span>
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staff.length} team member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={handleOpenAddDialog}
          className="shrink-0 shadow-md transition-all hover:shadow-lg"
          style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* Staff list */}
      {isMobile ? renderMobileCards() : renderDesktopTable()}

      {/* ── Add Staff dialog ──────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) handleCloseAddDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Staff Member</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="staff-name" className="text-xs font-medium text-muted-foreground">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="staff-name"
                placeholder="e.g. John Kamau"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="staff-email" className="text-xs font-medium text-muted-foreground">
                Email <span className="text-xs text-muted-foreground font-normal">(optional — auto-generated if blank)</span>
              </Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="e.g. john@store.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* PIN & Password row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="staff-pin" className="text-xs font-medium text-muted-foreground">
                  PIN (4 digits) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="staff-pin"
                  type="password"
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={addForm.pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setAddForm((f) => ({ ...f, pin: v }))
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-password" className="text-xs font-medium text-muted-foreground">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="staff-password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as 'staff' | 'manager' }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
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
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={handleCloseAddDialog}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
              onClick={handleAddSave}
              disabled={
                addMutation.isPending ||
                !addForm.name.trim() ||
                !addForm.pin ||
                addForm.pin.length !== 4 ||
                !addForm.password ||
                addForm.password.length < 6
              }
            >
              {addMutation.isPending ? 'Adding…' : 'Add Staff Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Staff dialog ─────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) handleCloseEditDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit Staff Member</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-xs font-medium text-muted-foreground">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as 'staff' | 'manager' }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Active Status</p>
                <p className="text-xs text-muted-foreground">
                  {editForm.is_active ? 'Staff member can log in and perform duties' : 'Staff member is suspended'}
                </p>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, is_active: checked }))}
                style={{ '--ring-color': ACCENT } as React.CSSProperties}
              />
            </div>

            {editMutation.isError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {editMutation.error instanceof Error ? editMutation.error.message : 'Failed to update staff member'}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-3 pt-2 sm:justify-end">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={handleCloseEditDialog}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              style={{ backgroundColor: ACCENT, borderColor: ACCENT }}
              onClick={handleEditSave}
              disabled={editMutation.isPending || !editForm.name.trim()}
            >
              {editMutation.isPending ? 'Saving…' : 'Update Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedStaff?.name}</strong>? This action
              cannot be undone. The staff member will lose access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (selectedStaff) deleteMutation.mutate(selectedStaff.id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}