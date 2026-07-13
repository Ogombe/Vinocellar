'use client'

import { useAppStore } from '@/lib/store'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Receipt,
  Tag,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
  Grape,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  onLogout: () => void
  userName: string
  orgName: string
  role: string
}

interface NavItem {
  label: string
  page: string
  icon: React.ElementType
  managerOnly?: boolean
}

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */

const navItems: NavItem[] = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Inventory', page: 'inventory', icon: Package },
  { label: 'POS / Sales', page: 'pos', icon: ShoppingCart },
  { label: 'Staff', page: 'staff', icon: Users, managerOnly: true },
  { label: 'Suppliers', page: 'suppliers', icon: Truck },
  { label: 'Expenses', page: 'expenses', icon: Receipt },
  { label: 'Categories', page: 'categories', icon: Tag },
  { label: 'Stock Count', page: 'stock-count', icon: ClipboardCheck },
  { label: 'Reports', page: 'reports', icon: BarChart3 },
  { label: 'Settings', page: 'settings', icon: Settings },
]

/* ------------------------------------------------------------------ */
/*  Sidebar content (shared between mobile & desktop)                  */
/* ------------------------------------------------------------------ */

function SidebarContent({
  currentPage,
  onNavigate,
  onLogout,
  userName,
  orgName,
  role,
}: SidebarProps) {
  const visibleItems = navItems.filter(
    (item) => !item.managerOnly || role === 'manager',
  )

  const handleNav = (page: string) => {
    onNavigate(page)
  }

  return (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600">
          <Grape className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold tracking-wide">
            VinoCellar Pro
          </span>
          <span className="text-[11px] font-medium text-slate-400 truncate max-w-[160px]">
            {orgName}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1" role="list">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.page

            return (
              <li key={item.page}>
                <button
                  type="button"
                  onClick={() => handleNav(item.page)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60',
                    'cursor-pointer text-left',
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── User section ── */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-sm font-bold uppercase">
            {userName.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {userName}
            </span>
            <Badge
              variant="secondary"
              className="mt-0.5 w-fit bg-purple-600/20 text-purple-300 border-purple-500/30 text-[10px] px-1.5 py-0"
            >
              {role}
            </Badge>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
            'text-slate-400 hover:bg-slate-800 hover:text-red-400',
            'transition-colors duration-150 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60',
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Sidebar component                                          */
/* ------------------------------------------------------------------ */

export function Sidebar(props: SidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  const handleMobileNav = (page: string) => {
    props.onNavigate(page)
    setSidebarOpen(false)
  }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:z-30">
        <SidebarContent {...props} />
      </aside>

      {/* ── Mobile sidebar (sheet) ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 border-r border-white/10 bg-slate-900 [&>button.absolute]:hidden"
        >
          <SheetContent
            currentPage={props.currentPage}
            onNavigate={handleMobileNav}
            onLogout={props.onLogout}
            userName={props.userName}
            orgName={props.orgName}
            role={props.role}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}