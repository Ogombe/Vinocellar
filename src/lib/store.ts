import { create } from 'zustand'

export interface User {
  id: string; email: string; name: string; role: string; pin?: string; storeId?: string | null
}
export interface Org {
  id: string; name: string; slug: string; plan: string; isActive: boolean; trialEndsAt?: string | null
}
export interface Store {
  id: string; name: string; location?: string
}

interface AppState {
  // Auth
  user: User | null
  org: Org | null
  stores: Store[]
  storeId: string | null
  isAuthenticated: boolean
  isManager: boolean

  // UI
  currentPage: string
  sidebarOpen: boolean
  loading: boolean

  // Data
  products: any[]
  categories: any[]
  suppliers: any[]
  staff: any[]
  sales: any[]
  expenses: any[]
  stockTakes: any[]
  dashboardData: any

  // Actions
  setAuth: (user: User, org: Org, stores: Store[], storeId: string | null) => void
  clearAuth: () => void
  setPage: (page: string) => void
  setSidebarOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void
  setStoreId: (id: string) => void
  setData: (key: string, data: any) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null, org: null, stores: [], storeId: null,
  isAuthenticated: false, isManager: false,
  currentPage: 'dashboard', sidebarOpen: true, loading: false,
  products: [], categories: [], suppliers: [], staff: [], sales: [], expenses: [], stockTakes: [], dashboardData: null,

  setAuth: (user, org, stores, storeId) => set({
    user, org, stores, storeId,
    isAuthenticated: true,
    isManager: user.role === 'manager',
    currentPage: user.role === 'manager' ? 'dashboard' : 'inventory'
  }),
  clearAuth: () => set({
    user: null, org: null, stores: [], storeId: null,
    isAuthenticated: false, isManager: false,
    currentPage: 'login', products: [], categories: [], suppliers: [],
    staff: [], sales: [], expenses: [], stockTakes: [], dashboardData: null
  }),
  setPage: (page) => set({ currentPage: page, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setLoading: (loading) => set({ loading }),
  setStoreId: (id) => set({ storeId: id }),
  setData: (key, data) => set({ [key]: data } as any),
}))