'use client'

import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'

/* ─── Minimal inline SVG icon map ──────────────────────────────────── */
const iconPaths: Record<string, string> = {
  dashboard:
    'M3 12l4-8 4 5 5-7 5 7 4-5v10H3V12z',
  inventory:
    'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm14 3a3 3 0 11-6 0 3 3 0 016 0z',
  pos:
    'M3 4h18v3H3V4zm2 3v11a2 2 0 002 2h10a2 2 0 002-2V7H5zm4 3h2v5H9v-5zm4 0h2v5h-2v-5z',
  stocktaking:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  reconciliation:
    'M12 3v18M3 7l4-4 4 4M21 17l-4 4-4-4M7 8a4 4 0 018 0M17 16a4 4 0 01-8 0',
  suppliers:
    'M1 3h15v13H1zM16 8h4l3 4v4h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  expenses:
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 13h12M6 17h12M6 9h3',
  staff:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  stores:
    'M3 21h18M3 7v14M21 7v14M6 11h4v4H6zM10 3h4l6 4H4l6-4z',
  analytics:
    'M4 20V10M9 20V4M14 20v-8M19 20v-4',
  profit:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.59l-3.3-3.3-1.4 1.42L12 20.4l5.71-5.71-1.42-1.4L13 16.59V6h-2v10.59z',
  reports:
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8M8 11h1M12 11h1M8 19h1M12 19h1',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1.08z',
  logout:
    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  audit:
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const d = iconPaths[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

/* ─── Menu section definition ──────────────────────────────────────── */
interface MenuItem {
  id: string
  label: string
  icon: string
  managerOnly?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
  managerOnly?: boolean
  superAdminOnly?: boolean
}

const sections: MenuSection[] = [
  {
    title: 'OVERVIEW',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard', managerOnly: true }],
  },
  {
    title: 'OPERATIONS',
    items: [
      { id: 'inventory', label: 'Inventory', icon: 'inventory' },
      { id: 'pos', label: 'Point of Sale', icon: 'pos' },
      { id: 'stocktaking', label: 'Stock Counting', icon: 'stocktaking' },
      { id: 'reconciliation', label: 'Daily Reconciliation', icon: 'reconciliation' },
    ],
  },
  {
    title: 'MANAGEMENT',
    managerOnly: true,
    items: [
      { id: 'suppliers', label: 'Suppliers', icon: 'suppliers' },
      { id: 'expenses', label: 'Expenses', icon: 'expenses' },
      { id: 'staff', label: 'Staff Management', icon: 'staff' },
      { id: 'stores', label: 'Multi-Store', icon: 'stores' },
    ],
  },
  {
    title: 'INSIGHTS',
    managerOnly: true,
    items: [
      { id: 'analytics', label: 'Sales Analytics', icon: 'analytics' },
      { id: 'profit', label: 'Profit Analytics', icon: 'profit' },
      { id: 'reports', label: 'PDF Reports', icon: 'reports' },
    ],
  },
  {
    title: 'SYSTEM',
    managerOnly: true,
    items: [{ id: 'settings', label: 'Settings', icon: 'settings' }],
  },
  {
    title: 'PLATFORM',
    superAdminOnly: true,
    items: [{ id: 'superadmin', label: 'Super Admin', icon: 'settings' }],
  },
]

/* ─── Wine glass logo SVG ──────────────────────────────────────────── */
function WineGlassIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 2h8l-1 9a5 5 0 01-10 0L8 2z"
        stroke="#F59E0B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 16v3M9 22h6"
        stroke="#F59E0B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ─── Helpers ──────────────────────────────────────────────────────── */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/* ─── Sidebar Component ────────────────────────────────────────────── */
export function Sidebar() {
  const {
    user,
    isManager,
    currentPage,
    sidebarOpen,
    setPage,
    setSidebarOpen,
    clearAuth,
  } = useAppStore()

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      /* ignore network errors on logout */
    }
    clearAuth()
  }

  const handleNavClick = (pageId: string) => {
    setPage(pageId)
  }

  return (
    <>
      {/* ── Mobile backdrop overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: '260px',
          minWidth: '260px',
          background: '#1F1129',
        }}
      >
        {/* ── Logo ── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <WineGlassIcon />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold text-white tracking-wide">
              VinoCellar
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: '#F59E0B' }}
            >
              Pro Edition
            </span>
          </div>
        </div>

        {/* ── Navigation sections ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-thin">
          {sections.map((section) => {
            if (section.managerOnly && !isManager) return null
            if (section.superAdminOnly && user?.role !== 'super_admin') return null
            const visibleItems = section.items.filter(
              (item) => !item.managerOnly || isManager,
            )
            if (visibleItems.length === 0) return null

            return (
              <div key={section.title} className="mb-4">
                <div
                  className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: 'rgba(167, 139, 250, 0.45)' }}
                >
                  {section.title}
                </div>
                {visibleItems.map((item) => {
                  const isActive = currentPage === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                        transition-all duration-150 ease-in-out cursor-pointer
                        focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50
                        ${isActive ? '' : 'hover:bg-[#2D1A3D]'}
                      `}
                      style={{
                        borderLeft: isActive ? '3px solid #F59E0B' : '3px solid transparent',
                        background: isActive ? 'rgba(245, 158, 11, 0.08)' : undefined,
                        color: isActive ? '#F59E0B' : '#a78bfa',
                        paddingLeft: isActive ? '9px' : '12px',
                      }}
                    >
                      <span className={isActive ? 'text-amber-400' : 'text-purple-300/70'}>
                        <Icon name={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* ── Footer: user info + logout ── */}
        <div
          className="border-t border-white/5 px-4 py-4"
        >
          {user && (
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar */}
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-bold text-white flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #DC2626)',
                }}
              >
                {getInitials(user.name)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-white truncate">
                  {user.name}
                </span>
                <span
                  className="text-[11px] capitalize"
                  style={{ color: '#a78bfa' }}
                >
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                       text-purple-300/70 hover:text-red-400 hover:bg-[#2D1A3D]
                       transition-all duration-150 cursor-pointer
                       focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400/50"
          >
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}