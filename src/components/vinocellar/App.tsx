'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'
import { LoginPage, RegisterPage, ResetPasswordPage } from './AuthPages'
import DashboardPage from './DashboardPage'
import InventoryPage from './InventoryPage'
import POSPage from './POSPage'
import StaffPage from './StaffPage'
import SuppliersPage from './SuppliersPage'
import ExpensesPage from './ExpensesPage'
import CategoriesPage from './CategoriesPage'
import StockCountPage from './StockCountPage'
import ReportsPage from './ReportsPage'
import SettingsPage from './SettingsPage'
import SuperAdminPage from './SuperAdminPage'
import BillingPage from './BillingPage'
import { Menu, Bell, AlertTriangle, CreditCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const PAGE_MAP: Record<string, React.FC> = {
  dashboard: DashboardPage,
  inventory: InventoryPage,
  pos: POSPage,
  staff: StaffPage,
  suppliers: SuppliersPage,
  expenses: ExpensesPage,
  categories: CategoriesPage,
  'stock-count': StockCountPage,
  reports: ReportsPage,
  settings: SettingsPage,
  'super-admin': SuperAdminPage,
  billing: BillingPage,
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  pos: 'Point of Sale',
  staff: 'Staff Management',
  suppliers: 'Suppliers',
  expenses: 'Expenses',
  categories: 'Categories',
  'stock-count': 'Stock Count',
  reports: 'Reports',
  settings: 'Settings',
  'super-admin': 'Super Admin',
  billing: 'Billing',
}

export default function VinoCellarApp() {
  const { currentPage, setSidebarOpen } = useAppStore()
  const { session, appUser, organisation, loading, signOut } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [showResetPassword, setShowResetPassword] = useState(false)

  // Detect password recovery redirect from email link
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      // Check if this is a password recovery flow
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPassword(true)
        }
      })
      // Also check current session for recovery type
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) {
          // If session exists from recovery, we still need the form
          setShowResetPassword(true)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (session && !PAGE_MAP[useAppStore.getState().currentPage]) {
      useAppStore.getState().setCurrentPage('dashboard')
    }
  }, [session])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (showResetPassword) {
    return <ResetPasswordPage onComplete={() => setShowResetPassword(false)} />
  }

  if (!session || !appUser) {
    return (
      <div className="min-h-screen">
        {authMode === 'login'
          ? <LoginPage onSwitch={() => setAuthMode('register')} />
          : <RegisterPage onSwitch={() => setAuthMode('login')} />
        }
      </div>
    )
  }

  const PageComponent = PAGE_MAP[currentPage] || DashboardPage
  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard'
  const initials = appUser.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // ── Trial / Subscription expiry check ──
  const isSuperAdmin = appUser.role === 'super_admin'
  const isTrial = organisation?.plan === 'trial'
  const isPaid = organisation?.plan !== 'trial' && organisation?.plan !== undefined
  const trialExpired = isTrial && organisation?.trial_ends_at && new Date(organisation.trial_ends_at) < new Date()
  const subscriptionExpired = isPaid && organisation?.current_period_end && new Date(organisation.current_period_end) < new Date()
  const isSuspended = !isSuperAdmin && !organisation?.is_active && currentPage !== 'billing'
  const isExpired = !isSuperAdmin && !isSuspended && (trialExpired || subscriptionExpired) && currentPage !== 'billing'

  if (isExpired || isSuspended) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {isSuspended ? 'Account Suspended' : isTrial ? 'Trial Expired' : 'Subscription Expired'}
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              {isSuspended
                ? 'Your account has been suspended. Please contact support.'
                : `Your ${isTrial ? 'trial' : 'subscription'} has ended. Upgrade to continue using VinoCellar.`
              }
            </p>
            <Button
              onClick={() => useAppStore.getState().setCurrentPage('billing')}
              className="bg-purple-600 hover:bg-purple-700 mb-3"
            >
              <CreditCard className="h-4 w-4 mr-2" /> Upgrade Plan
            </Button>
            <div>
              <button
                onClick={signOut}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Trial warning (7 days or less) ──
  const showTrialWarning = !isSuperAdmin && isTrial && organisation?.trial_ends_at
  const trialDaysLeft = showTrialWarning
    ? Math.max(0, Math.ceil((new Date(organisation.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 99

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => useAppStore.getState().setCurrentPage(page)}
        onLogout={signOut}
        userName={appUser.name}
        orgName={organisation?.name || ''}
        role={appUser.role}
      />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Trial warning banner */}
        {showTrialWarning && trialDaysLeft <= 7 && currentPage !== 'billing' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800">
                {trialDaysLeft === 0
                  ? 'Your trial expires today!'
                  : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial`}
              </span>
            </div>
            <button
              onClick={() => useAppStore.getState().setCurrentPage('billing')}
              className="text-sm font-medium text-purple-700 hover:text-purple-800 whitespace-nowrap"
            >
              Upgrade now
            </button>
          </div>
        )}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-xs font-medium text-purple-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {organisation?.name}
            </span>
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-500" />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <PageComponent />
        </main>
      </div>
    </div>
  )
}