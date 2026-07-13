'use client'
import { useEffect, useState, useRef, useSyncExternalStore } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Sidebar } from './Sidebar'
import { LoginPage, RegisterPage } from './AuthPages'
import { DashboardPage } from './DashboardPage'
import { InventoryPage } from './InventoryPage'
import { POSPage } from './POSPage'
import { StockTakePage, ReconciliationPage, SuppliersPage, ExpensesPage, AnalyticsPage, ProfitPage, ReportsPage, StaffPage, StoresPage, SettingsPage, SuperAdminPage } from './Pages'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

const PAGE_MAP: Record<string, React.FC> = {
  dashboard: DashboardPage,
  inventory: InventoryPage,
  pos: POSPage,
  stocktaking: StockTakePage,
  reconciliation: ReconciliationPage,
  suppliers: SuppliersPage,
  expenses: ExpensesPage,
  analytics: AnalyticsPage,
  profit: ProfitPage,
  reports: ReportsPage,
  staff: StaffPage,
  stores: StoresPage,
  settings: SettingsPage,
  superadmin: SuperAdminPage,
  audit: SettingsPage,
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  pos: 'Point of Sale',
  stocktaking: 'Stock Counting',
  reconciliation: 'Daily Reconciliation',
  suppliers: 'Suppliers',
  expenses: 'Expenses',
  analytics: 'Sales Analytics',
  profit: 'Profit Analytics',
  reports: 'PDF Reports',
  staff: 'Staff Management',
  stores: 'Multi-Store',
  settings: 'Settings',
  superadmin: 'Super Admin',
}

export default function VinoCellarApp() {
  const { isAuthenticated, currentPage, user, org, stores, storeId, setAuth, clearAuth, setPage, setSidebarOpen, sidebarOpen, isManager } = useAppStore()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const mounted = useMounted()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    api.me().then(data => {
      if (data.user && data.org) {
        setAuth(data.user, data.org, data.stores || [], data.storeId)
      }
    }).catch(() => { /* Not authenticated */ })
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Auth pages
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        {authMode === 'login'
          ? <LoginPage onSwitchToRegister={() => setAuthMode('register')} />
          : <RegisterPage onSwitchToLogin={() => setAuthMode('login')} />
        }
      </div>
    )
  }

  // Main app
  const PageComponent = PAGE_MAP[currentPage] || DashboardPage
  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard'

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#E5DDD0] px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-[#F3EEE6] transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F1129" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-[#1F1129]">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Store selector (if multiple stores) */}
            {stores.length > 1 && isManager && (
              <select
                value={storeId || ''}
                onChange={async (e) => {
                  try {
                    await api.switchStore(e.target.value)
                    useAppStore.getState().setStoreId(e.target.value)
                    window.location.reload()
                  } catch (err: any) { alert(err.message) }
                }}
                className="text-sm border border-[#E5DDD0] rounded-lg px-3 py-1.5 bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {/* Org badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F1129]/5 text-xs font-medium text-[#1F1129]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {org?.name}
            </span>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}>
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <PageComponent />
        </main>
      </div>
    </div>
  )
}