const BASE = ''

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  register: (data: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  switchStore: (storeId: string) => request('/api/auth/switch-store', { method: 'POST', body: JSON.stringify({ storeId }) }),

  // Products
  getProducts: (params?: string) => request(`/api/products${params ? '?' + params : ''}`),
  createProduct: (data: any) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (data: any) => request('/api/products', { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request(`/api/products?id=${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: () => request('/api/suppliers'),
  createSupplier: (data: any) => request('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (data: any) => request('/api/suppliers', { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request(`/api/suppliers?id=${id}`, { method: 'DELETE' }),

  // Staff
  getStaff: () => request('/api/staff'),
  createStaff: (data: any) => request('/api/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (data: any) => request('/api/staff', { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => request(`/api/staff?id=${id}`, { method: 'DELETE' }),

  // Stores
  getStores: () => request('/api/stores'),
  createStore: (data: any) => request('/api/stores', { method: 'POST', body: JSON.stringify(data) }),
  updateStore: (data: any) => request('/api/stores', { method: 'PUT', body: JSON.stringify(data) }),

  // Sales
  getSales: (params?: string) => request(`/api/sales${params ? '?' + params : ''}`),
  createSale: (data: any) => request('/api/sales', { method: 'POST', body: JSON.stringify(data) }),

  // Stock Takes
  getStockTakes: (params?: string) => request(`/api/stock-takes${params ? '?' + params : ''}`),
  createStockTake: (storeId: string) => request('/api/stock-takes', { method: 'POST', body: JSON.stringify({ storeId }) }),
  updateStockTake: (data: any) => request('/api/stock-takes', { method: 'PUT', body: JSON.stringify(data) }),

  // Reconciliation
  getReconciliation: (params?: string) => request(`/api/reconciliation${params ? '?' + params : ''}`),
  updateReconciliation: (data: any) => request('/api/reconciliation', { method: 'PUT', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: (params?: string) => request(`/api/expenses${params ? '?' + params : ''}`),
  createExpense: (data: any) => request('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (data: any) => request('/api/expenses', { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request(`/api/expenses?id=${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params?: string) => request(`/api/dashboard${params ? '?' + params : ''}`),

  // Analytics
  getAnalytics: (params?: string) => request(`/api/analytics${params ? '?' + params : ''}`),

  // Reports
  getReport: (type: string, params?: string) => request(`/api/reports?type=${type}${params ? '&' + params : ''}`),

  // Audit Logs
  getAuditLogs: (params?: string) => request(`/api/audit-logs${params ? '?' + params : ''}`),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (data: any) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Categories
  getCategories: () => request('/api/categories'),

  // Purchases / Stock Receive
  receiveStock: (data: any) => request('/api/purchases', { method: 'POST', body: JSON.stringify(data) }),
  getStockReceives: (params?: string) => request(`/api/purchases${params ? '?' + params : ''}`),

  // Super Admin
  getSuperAdmin: () => request('/api/super-admin'),
}