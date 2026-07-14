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
import { Menu, Bell } from 'lucide-react'

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