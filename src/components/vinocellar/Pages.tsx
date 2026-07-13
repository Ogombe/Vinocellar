'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'

/* ═══════════════════════════════════════════════════════════════════════
   SHARED HELPERS & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

const fmt = (n: number) => 'KSh ' + n.toLocaleString('en-KE')

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '14px',
  boxShadow: '0 4px 12px rgba(31,17,41,.06)',
}

const CHART_COLORS = ['#DC2626', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']

const inputCls = 'w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]'

const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[.98] disabled:opacity-60 cursor-pointer'
const btnSecondary = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 hover:bg-[#FAF7F2] active:scale-[.98] disabled:opacity-60 cursor-pointer'
const btnDanger = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#DC2626] border border-[#FECACA] bg-white transition-all duration-150 hover:bg-[#FEF2F2] active:scale-[.98] cursor-pointer'

/* ── Spinner ── */
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none" style={{ color: '#DC2626' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  )
}

/* ── No Store Selected ── */
function NoStore() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <svg className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="#8B7FA0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7v14M21 7v14M6 11h4v4H6zM10 3h4l6 4H4l6-4z" />
      </svg>
      <p className="text-lg font-semibold" style={{ color: '#1F1129' }}>No Store Selected</p>
      <p className="text-sm mt-1" style={{ color: '#8B7FA0' }}>Please select a store from the sidebar to view this page.</p>
    </div>
  )
}

/* ── Reusable Modal ── */
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[14px] shadow-xl w-full max-h-[90vh] overflow-y-auto" style={{ maxWidth: wide ? '720px' : '480px', boxShadow: '0 20px 60px rgba(31,17,41,.18)' }}>
        <div className="sticky top-0 bg-white border-b border-[#E8E0F0] px-6 py-4 flex items-center justify-between rounded-t-[14px] z-10">
          <h3 className="text-base font-bold" style={{ color: '#1F1129' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F5F0EB] transition cursor-pointer" aria-label="Close">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="#8B7FA0"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

/* ── Confirm Dialog ── */
function ConfirmDialog({ open, title, message, onConfirm, onCancel }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-[14px] p-6 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(31,17,41,.18)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: '#1F1129' }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: '#6B5E7A' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Cancel</button>
          <button onClick={onConfirm} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

/* ── Error Banner ── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
      {message}
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={cardStyle} className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: color || '#1F1129' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#6B5E7A' }}>{sub}</p>}
    </div>
  )
}

/* ── Status Badge ── */
function Badge({ children, variant }: { children: React.ReactNode; variant: 'amber' | 'blue' | 'green' | 'red' | 'gray' | 'purple' }) {
  const colors: Record<string, { bg: string; text: string }> = {
    amber: { bg: '#FEF3C7', text: '#92400E' },
    blue: { bg: '#DBEAFE', text: '#1E40AF' },
    green: { bg: '#D1FAE5', text: '#065F46' },
    red: { bg: '#FEE2E2', text: '#991B1B' },
    gray: { bg: '#F3F4F6', text: '#374151' },
    purple: { bg: '#EDE9FE', text: '#5B21B6' },
  }
  const c = colors[variant] || colors.gray
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   1. STOCK TAKE PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function StockTakePage() {
  const { storeId, isManager, user } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stockTakes, setStockTakes] = useState<any[]>([])
  const [activeCount, setActiveCount] = useState<any>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchStockTakes = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.getStockTakes('storeId=' + storeId)
      const list = Array.isArray(data) ? data : data.stockTakes || data.items || []
      setStockTakes(list)
      const active = list.find((st: any) => st.status === 'in_progress')
      if (active) {
        setActiveCount(active)
        const initCounts: Record<string, number> = {}
        ;(active.items || []).forEach((item: any) => {
          initCounts[item.productId] = item.counted ?? item.expected ?? 0
        })
        setCounts(initCounts)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stock takes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStockTakes() }, [storeId])

  const handleStart = async () => {
    if (!storeId) return
    setSubmitting(true)
    setError('')
    try {
      const data = await api.createStockTake(storeId)
      const newSt = data.stockTake || data
      setActiveCount(newSt)
      setCounts({})
      setStockTakes([newSt, ...stockTakes])
    } catch (err: any) {
      setError(err.message || 'Failed to start stock take')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!activeCount) return
    setSubmitting(true)
    setError('')
    try {
      const items = (activeCount.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        counted: counts[item.productId] ?? item.expected ?? 0,
      }))
      await api.updateStockTake({ stockTakeId: activeCount.id, items, action: 'submit' })
      await fetchStockTakes()
      setActiveCount(null)
      setCounts({})
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock take')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (st: any) => {
    setSubmitting(true)
    setError('')
    try {
      await api.updateStockTake({ stockTakeId: st.id, items: st.items || [], action: 'approve' })
      await fetchStockTakes()
    } catch (err: any) {
      setError(err.message || 'Failed to approve stock take')
    } finally {
      setSubmitting(false)
    }
  }

  if (!storeId) return <NoStore />

  if (loading) return <Spinner />

  const filteredItems = (activeCount?.items || []).filter((item: any) =>
    (item.product?.name || item.productName || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (status: string) => {
    if (status === 'in_progress') return <Badge variant="amber">In Progress</Badge>
    if (status === 'pending') return <Badge variant="blue">Pending</Badge>
    if (status === 'approved') return <Badge variant="green">Approved</Badge>
    return <Badge variant="gray">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Stock Counting</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Conduct physical stock counts and reconcile with system records</p>
        </div>
        {!activeCount && (
          <button onClick={handleStart} disabled={submitting} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Start New Count
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Active Count View ── */}
      {activeCount && (
        <div style={cardStyle} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: '#1F1129' }}>Active Stock Count</h2>
            <Badge variant="amber">In Progress</Badge>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls}
              style={{ borderColor: '#E8E0F0' }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E0F0]">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Product</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Expected</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Counted</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item: any) => (
                  <tr key={item.productId} className="border-b border-[#F5F0EB] last:border-0">
                    <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{item.product?.name || item.productName || item.name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{item.expected ?? 0}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={counts[item.productId] ?? ''}
                        onChange={(e) => setCounts({ ...counts, [item.productId]: parseInt(e.target.value) || 0 })}
                        className="w-20 text-right px-2 py-1 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]"
                        style={{ borderColor: '#E8E0F0' }}
                      />
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-4">
            <button onClick={handleSubmit} disabled={submitting || filteredItems.length === 0} className={btnPrimary} style={{ backgroundColor: '#F59E0B' }}>
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      )}

      {/* ── Pending notice for staff ── */}
      {!activeCount && stockTakes.some((st: any) => st.status === 'pending') && !isManager && (
        <div style={cardStyle} className="p-5 text-center">
          <svg className="w-10 h-10 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          <h3 className="text-base font-bold mb-1" style={{ color: '#1F1129' }}>Awaiting Manager Approval</h3>
          <p className="text-sm" style={{ color: '#8B7FA0' }}>Your stock count has been submitted and is waiting for a manager to review and approve it.</p>
        </div>
      )}

      {/* ── History ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Stock Count History</h2>
        <div className="space-y-2">
          {stockTakes.map((st: any) => (
            <div key={st.id} className="rounded-xl border border-[#E8E0F0] overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === st.id ? null : st.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FAF7F2] transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {statusBadge(st.status)}
                  <span className="text-sm font-medium" style={{ color: '#1F1129' }}>
                    {st.createdAt ? new Date(st.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                  </span>
                  <span className="text-xs" style={{ color: '#8B7FA0' }}>
                    {(st.items || []).length} items
                  </span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${expandedId === st.id ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="#8B7FA0"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
              {expandedId === st.id && (
                <div className="border-t border-[#E8E0F0] px-4 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F5F0EB]">
                        <th className="text-left py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Product</th>
                        <th className="text-right py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Expected</th>
                        <th className="text-right py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Counted</th>
                        <th className="text-right py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(st.items || []).map((item: any) => {
                        const variance = (item.countedQty ?? 0) - (item.expectedQty ?? 0)
                        return (
                          <tr key={item.productId} className="border-b border-[#F5F0EB] last:border-0">
                            <td className="py-2 font-medium" style={{ color: '#1F1129' }}>{item.productName || 'Unknown'}</td>
                            <td className="py-2 text-right" style={{ color: '#6B5E7A' }}>{item.expectedQty ?? 0}</td>
                            <td className="py-2 text-right" style={{ color: '#6B5E7A' }}>{item.countedQty ?? 0}</td>
                            <td className="py-2 text-right font-semibold" style={{ color: variance === 0 ? '#059669' : variance > 0 ? '#D97706' : '#DC2626' }}>
                              {variance > 0 ? '+' : ''}{variance}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {isManager && st.status === 'pending' && (
                    <div className="flex justify-end mt-3 pt-3 border-t border-[#E8E0F0]">
                      <button onClick={() => handleApprove(st)} disabled={submitting} className={btnPrimary} style={{ backgroundColor: '#059669' }}>
                        {submitting ? 'Approving...' : 'Approve Stock Take'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {stockTakes.length === 0 && !activeCount && (
            <p className="text-center text-sm py-8" style={{ color: '#8B7FA0' }}>No stock counts have been recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   2. RECONCILIATION PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function ReconciliationPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [recon, setRecon] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const fetchRecon = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.getReconciliation('storeId=' + storeId + '&date=' + date)
      const r = data.reconciliation || data
      setRecon(r)
      setItems((r.items || []).map((item: any) => ({
        ...item,
        stockAdded: item.stockAdded ?? 0,
        actualClosing: item.actualClosing ?? (item.openingQty - item.salesToday + (item.stockAdded ?? 0)),
      })))
    } catch (err: any) {
      setError(err.message || 'Failed to load reconciliation data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecon() }, [storeId, date])

  const handleSave = async () => {
    if (!recon) return
    setSaving(true)
    setError('')
    try {
      await api.updateReconciliation({ id: recon.id, items })
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to save reconciliation')
    } finally {
      setSaving(false)
    }
  }

  const updateItem = (idx: number, field: string, value: number) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  if (!storeId) return <NoStore />
  if (loading) return <Spinner />

  const totalVariance = items.reduce((sum, item) => {
    const expected = (item.openingQty || 0) - (item.salesToday || 0) + (item.stockAdded || 0)
    return sum + ((item.actualClosing || 0) - expected)
  }, 0)

  const varianceColor = (v: number) => {
    if (v === 0) return '#059669'
    if (Math.abs(v) <= 2) return '#059669'
    if (Math.abs(v) <= 5) return '#D97706'
    return '#DC2626'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Daily Reconciliation</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Track and reconcile daily stock movements against sales</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
            style={{ borderColor: '#E8E0F0' }}
          />
          <button onClick={handleSave} disabled={saving || items.length === 0} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div style={cardStyle} className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0F0]">
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Product</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Opening</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Sales Today</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Stock Added</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Expected</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Actual</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const expected = (item.openingQty || 0) - (item.salesToday || 0) + (item.stockAdded || 0)
                const variance = (item.actualClosing || 0) - expected
                return (
                  <tr key={item.productId || idx} className="border-b border-[#F5F0EB] last:border-0">
                    <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{item.productName || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{item.openingQty ?? 0}</td>
                    <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{item.salesToday ?? 0}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.stockAdded ?? 0}
                        onChange={(e) => updateItem(idx, 'stockAdded', parseInt(e.target.value) || 0)}
                        className="w-20 text-right px-2 py-1 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]"
                        style={{ borderColor: '#E8E0F0' }}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{expected}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.actualClosing ?? ''}
                        onChange={(e) => updateItem(idx, 'actualClosing', parseInt(e.target.value) || 0)}
                        className="w-20 text-right px-2 py-1 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626]"
                        style={{ borderColor: '#E8E0F0' }}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold" style={{ color: varianceColor(variance) }}>
                      {variance > 0 ? '+' : ''}{variance}
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No reconciliation data for this date</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {items.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#E8E0F0]">
            <span className="text-sm font-semibold" style={{ color: '#8B7FA0' }}>Total Variance</span>
            <span className="text-lg font-bold" style={{ color: varianceColor(totalVariance) }}>
              {totalVariance > 0 ? '+' : ''}{totalVariance}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   3. SUPPLIERS PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function SuppliersPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', productTypes: '' })

  const fetchSuppliers = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getSuppliers()
      setSuppliers(Array.isArray(data) ? data : data.suppliers || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSuppliers() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', contact: '', phone: '', email: '', productTypes: '' })
    setModalOpen(true)
  }

  const openEdit = (s: any) => {
    setEditing(s)
    setForm({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', email: s.email || '', productTypes: typeof s.productTypes === 'string' ? s.productTypes : (s.productTypes || []).join(', ') })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, productTypes: form.productTypes }
      if (editing) {
        await api.updateSupplier({ ...payload, id: editing.id })
      } else {
        await api.createSupplier(payload)
      }
      setModalOpen(false)
      await fetchSuppliers()
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      await api.deleteSupplier(deleteTarget.id)
      setConfirmOpen(false)
      setDeleteTarget(null)
      await fetchSuppliers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete supplier')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Suppliers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Manage your supplier contacts and product sources</p>
        </div>
        <button onClick={openAdd} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
          Add Supplier
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div style={cardStyle} className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0F0]">
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#8B7FA0' }}>Contact</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#8B7FA0' }}>Phone</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#8B7FA0' }}>Email</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#8B7FA0' }}>Product Types</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Items</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s: any) => (
                <tr key={s.id} className="border-b border-[#F5F0EB] last:border-0">
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{s.name}</td>
                  <td className="py-2.5 px-3 hidden md:table-cell" style={{ color: '#6B5E7A' }}>{s.contact || '-'}</td>
                  <td className="py-2.5 px-3 hidden lg:table-cell" style={{ color: '#6B5E7A' }}>{s.phone || '-'}</td>
                  <td className="py-2.5 px-3 hidden lg:table-cell" style={{ color: '#6B5E7A' }}>{s.email || '-'}</td>
                  <td className="py-2.5 px-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(typeof s.productTypes === 'string' ? s.productTypes.split(',').map((t: string) => t.trim()) : (s.productTypes || [])).map((t: string, i: number) => (
                        <Badge key={i} variant="purple">{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{s._count?.products ?? 0}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(s)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A', padding: '4px 10px', fontSize: '12px' }}>Edit</button>
                      <button onClick={() => { setDeleteTarget(s); setConfirmOpen(true) }} className={btnDanger}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No suppliers added yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Supplier name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Contact Person</label>
            <input type="text" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Contact person" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Email address" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Product Types</label>
            <input type="text" value={form.productTypes} onChange={(e) => setForm({ ...form, productTypes: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="e.g. Wine, Spirits, Beer" />
            <p className="text-xs mt-1" style={{ color: '#8B7FA0' }}>Separate multiple types with commas</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Supplier'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} title="Delete Supplier" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`} onConfirm={handleDelete} onCancel={() => { setConfirmOpen(false); setDeleteTarget(null) }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   4. EXPENSES PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Inventory', 'Marketing', 'Maintenance', 'Other']

export function ExpensesPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expenses, setExpenses] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: 'Rent', description: '', amount: '' })

  const fetchExpenses = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.getExpenses('storeId=' + storeId)
      setExpenses(Array.isArray(data) ? data : data.expenses || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExpenses() }, [storeId])

  const handleSave = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    setError('')
    try {
      await api.createExpense({ ...form, amount: parseFloat(form.amount), storeId })
      setModalOpen(false)
      setForm({ date: new Date().toISOString().split('T')[0], category: 'Rent', description: '', amount: '' })
      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      await api.deleteExpense(deleteTarget.id)
      setConfirmOpen(false)
      setDeleteTarget(null)
      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense')
    } finally {
      setSaving(false)
    }
  }

  if (!storeId) return <NoStore />
  if (loading) return <Spinner />

  const totalThisMonth = expenses
    .filter((e: any) => { const d = new Date(e.date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((s, e) => s + (e.amount || 0), 0)

  const dailyAverage = expenses.length > 0 ? totalThisMonth / new Date().getDate() : 0

  const categoryTotals: Record<string, number> = {}
  expenses.forEach((e: any) => { categoryTotals[e.category || 'Other'] = (categoryTotals[e.category || 'Other'] || 0) + (e.amount || 0) })
  const highestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]
  const maxCategoryAmount = Math.max(...Object.values(categoryTotals), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Expenses</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Track and manage your business expenses</p>
        </div>
        <button onClick={() => { setForm({ date: new Date().toISOString().split('T')[0], category: 'Rent', description: '', amount: '' }); setModalOpen(true) }} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
          Add Expense
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="This Month Total" value={fmt(totalThisMonth)} />
        <StatCard label="Average Daily" value={fmt(dailyAverage)} />
        <StatCard label="Highest Category" value={highestCategory ? fmt(highestCategory[1]) : 'N/A'} sub={highestCategory ? highestCategory[0] : undefined} />
      </div>

      {/* ── Category Bar Chart ── */}
      {Object.keys(categoryTotals).length > 0 && (
        <div style={cardStyle} className="p-5">
          <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Expenses by Category</h2>
          <div className="space-y-3">
            {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount], idx) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium" style={{ color: '#1F1129' }}>{cat}</span>
                  <span style={{ color: '#6B5E7A' }}>{fmt(amount)}</span>
                </div>
                <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#F5F0EB' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(amount / maxCategoryAmount) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expense Table ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Expense History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0F0]">
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Date</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Category</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Description</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Amount</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-[#F5F0EB] last:border-0">
                  <td className="py-2.5 px-3" style={{ color: '#6B5E7A' }}>{e.date ? new Date(e.date).toLocaleDateString('en-KE') : 'N/A'}</td>
                  <td className="py-2.5 px-3"><Badge variant="purple">{e.category || 'Other'}</Badge></td>
                  <td className="py-2.5 px-3" style={{ color: '#1F1129' }}>{e.description || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-medium" style={{ color: '#1F1129' }}>{fmt(e.amount || 0)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => { setDeleteTarget(e); setConfirmOpen(true) }} className={btnDanger}>Delete</button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No expenses recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Brief description" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Amount (KSh)</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.amount} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} title="Delete Expense" message="Are you sure you want to delete this expense? This action cannot be undone." onConfirm={handleDelete} onCancel={() => { setConfirmOpen(false); setDeleteTarget(null) }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   5. ANALYTICS PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function AnalyticsPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState<any>(null)

  const fetchAnalytics = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const d = await api.getAnalytics('storeId=' + storeId + '&period=' + period)
      setData(d)
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnalytics() }, [storeId, period])

  if (!storeId) return <NoStore />
  if (loading) return <Spinner />
  if (error) return <div className="mt-4"><ErrorBanner message={error} /></div>

  const trend = data?.trend || []
  const categoryData = data?.byCategory || []
  const topProducts = data?.topProducts || []
  const paymentData = data?.byPayment || []
  const summary = data?.summary || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Sales Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Comprehensive view of your sales performance</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: '#F5F0EB' }}>
          {[7, 30, 90].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: period === p ? '#fff' : 'transparent', color: period === p ? '#1F1129' : '#8B7FA0', boxShadow: period === p ? '0 1px 4px rgba(31,17,41,.08)' : 'none' }}>
              {p} Days
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={fmt(summary.totalRevenue || 0)} />
        <StatCard label="Avg Daily" value={fmt(summary.avgDaily || 0)} />
        <StatCard label="Total Transactions" value={String(summary.totalTransactions || 0)} />
        <StatCard label="Avg Transaction" value={fmt(summary.avgTransaction || 0)} />
      </div>

      {/* ── Trend Line Chart ── */}
      {trend.length > 0 && (
        <div style={cardStyle} className="p-5">
          <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Revenue Trend</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#DC2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Sales by Category Donut ── */}
        {categoryData.length > 0 && (
          <div style={cardStyle} className="p-5">
            <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Sales by Category</h2>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="revenue" nameKey="category" paddingAngle={2}>
                    {categoryData.map((_: any, idx: number) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Top 10 Products Horizontal Bar ── */}
        {topProducts.length > 0 && (
          <div style={cardStyle} className="p-5">
            <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Top 10 Products</h2>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B5E7A' }} width={75} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                  <Bar dataKey="revenue" fill="#DC2626" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment Methods Pie ── */}
      {paymentData.length > 0 && (
        <div style={cardStyle} className="p-5">
          <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Payment Methods</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="method">
                  {paymentData.map((_: any, idx: number) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {trend.length === 0 && categoryData.length === 0 && (
        <div style={cardStyle} className="p-12 text-center">
          <p className="text-sm" style={{ color: '#8B7FA0' }}>No analytics data available for the selected period.</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   6. PROFIT PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function ProfitPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState<any>(null)

  const fetchProfit = async () => {
    if (!storeId) return
    setLoading(true)
    setError('')
    try {
      const d = await api.getAnalytics('storeId=' + storeId + '&period=' + period)
      setData(d)
    } catch (err: any) {
      setError(err.message || 'Failed to load profit data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfit() }, [storeId, period])

  if (!storeId) return <NoStore />
  if (loading) return <Spinner />

  const profitSummary = data?.profitSummary || {}
  const dailyProfit = data?.dailyProfit || []
  const topByProfit = data?.topByProfit || []
  const productPL = data?.productPL || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Profit Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Detailed profit and loss analysis</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: '#F5F0EB' }}>
          {[7, 30, 90].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: period === p ? '#fff' : 'transparent', color: period === p ? '#1F1129' : '#8B7FA0', boxShadow: period === p ? '0 1px 4px rgba(31,17,41,.08)' : 'none' }}>
              {p} Days
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Gross Profit" value={fmt(profitSummary.grossProfit || 0)} color="#059669" />
        <StatCard label="Revenue" value={fmt(profitSummary.revenue || 0)} />
        <StatCard label="COGS" value={fmt(profitSummary.cogs || 0)} color="#DC2626" />
        <StatCard label="Operating Expenses" value={fmt(profitSummary.operatingExpenses || 0)} color="#D97706" />
        <StatCard label="Net Profit" value={fmt(profitSummary.netProfit || 0)} color={(profitSummary.netProfit || 0) >= 0 ? '#059669' : '#DC2626'} />
      </div>

      {/* ── Daily Profit Bar Chart ── */}
      {dailyProfit.length > 0 && (
        <div style={cardStyle} className="p-5">
          <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Daily Profit</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={dailyProfit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {dailyProfit.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={(entry.profit || 0) >= 0 ? '#059669' : '#DC2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Top 10 by Profit ── */}
        {topByProfit.length > 0 && (
          <div style={cardStyle} className="p-5">
            <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Top 10 by Profit</h2>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={topByProfit} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8B7FA0' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B5E7A' }} width={75} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E8E0F0', fontSize: '12px' }} />
                  <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
                    {topByProfit.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={(entry.profit || 0) >= 0 ? '#059669' : '#DC2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Per-Product P&L Table ── */}
        <div style={cardStyle} className="p-5">
          <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Product Profit & Loss</h2>
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#E8E0F0]">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Product</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Revenue</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Cost</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Profit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {productPL.map((p: any, idx: number) => {
                  const margin = p.revenue > 0 ? ((p.profit || 0) / p.revenue * 100) : 0
                  return (
                    <tr key={idx} className="border-b border-[#F5F0EB] last:border-0">
                      <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{p.name || 'Unknown'}</td>
                      <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{fmt(p.revenue || 0)}</td>
                      <td className="py-2.5 px-3 text-right" style={{ color: '#6B5E7A' }}>{fmt(p.cost || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold" style={{ color: (p.profit || 0) >= 0 ? '#059669' : '#DC2626' }}>{fmt(p.profit || 0)}</td>
                      <td className="py-2.5 px-3 text-right" style={{ color: margin >= 30 ? '#059669' : margin >= 15 ? '#D97706' : '#DC2626' }}>{margin.toFixed(1)}%</td>
                    </tr>
                  )
                })}
                {productPL.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No product data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   7. REPORTS PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
const REPORT_TYPES = [
  { type: 'sales', title: 'Sales Report', description: 'Comprehensive sales data with trends and breakdowns', color: '#DC2626', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { type: 'inventory', title: 'Inventory Report', description: 'Current stock levels, values, and product details', color: '#3B82F6', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm14 3a3 3 0 11-6 0 3 3 0 016 0z' },
  { type: 'profit_loss', title: 'Profit & Loss', description: 'Revenue, costs, and net profit analysis', color: '#059669', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.59l-3.3-3.3-1.4 1.42L12 20.4l5.71-5.71-1.42-1.4L13 16.59V6h-2v10.59z' },
  { type: 'expenses', title: 'Expense Report', description: 'All expenses categorized with totals', color: '#D97706', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 13h12M6 17h12M6 9h3' },
  { type: 'reconciliation', title: 'Daily Reconciliation', description: 'Stock reconciliation with variance analysis', color: '#8B5CF6', icon: 'M12 3v18M3 7l4-4 4 4M21 17l-4 4-4-4M7 8a4 4 0 018 0M17 16a4 4 0 01-8 0' },
  { type: 'stock_audit', title: 'Stock Count Audit', description: 'Historical stock take records and adjustments', color: '#EC4899', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
]

export function ReportsPage() {
  const { storeId } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const generateReport = async (type: string) => {
    if (!storeId) return
    setLoading(true)
    setError('')
    setActiveReport(type)
    try {
      const d = await api.getReport(type, 'storeId=' + storeId)
      setReportData(d)
      setModalOpen(true)
    } catch (err: any) {
      setError(err.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!reportData || !activeReport) return
    const reportConfig = REPORT_TYPES.find((r) => r.type === activeReport)
    const title = reportConfig?.title || 'Report'
    const items = reportData.items || reportData.rows || []
    const summary = reportData.summary || {}
    const columns = reportData.columns || (items.length > 0 ? Object.keys(items[0]) : [])

    const summaryHtml = Object.entries(summary).map(([key, val]: [string, any]) =>
      `<div style="flex:1;min-width:120px;padding:8px 12px;background:#FAF7F2;border-radius:8px;">
        <div style="font-size:11px;color:#8B7FA0;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
        <div style="font-size:18px;font-weight:700;color:#1F1129;margin-top:4px;">${typeof val === 'number' ? 'KSh ' + val.toLocaleString('en-KE') : val}</div>
      </div>`
    ).join('')

    const tableRows = items.map((row: any) => {
      const cells = columns.map((col: string) =>
        `<td style="padding:10px 12px;border-bottom:1px solid #E8E0F0;color:#1F1129;font-size:13px;">${row[col] ?? '-'}</td>`
      ).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    const headerCells = columns.map((col: string) =>
      `<th style="padding:10px 12px;border-bottom:2px solid #E8E0F0;text-align:left;font-size:11px;color:#8B7FA0;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${col.replace(/([A-Z])/g, ' $1').trim()}</th>`
    ).join('')

    const html = `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#FAF7F2;padding:32px;color:#1F1129}
  @media print{body{padding:16px}}
  .header{margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #DC2626}
  .header h1{font-size:24px;font-weight:700}
  .header p{font-size:13px;color:#8B7FA0;margin-top:4px}
  .summary{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(31,17,41,.06)}
  th,td{text-align:left}
  tr:nth-child(even){background:#FAF7F2}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#8B7FA0}
</style>
</head><body>
<div class="header">
  <h1>VinoCellar Pro - ${title}</h1>
  <p>Generated: ${new Date().toLocaleString('en-KE')} | Store: ${storeId}</p>
</div>
${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ''}
<table><thead><tr>${headerCells}</tr></thead><tbody>${tableRows}</tbody></table>
<div class="footer">VinoCellar Pro - Wine & Spirits Inventory Management</div>
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.print() }, 500)
    }
  }

  if (!storeId) return <NoStore />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>PDF Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Generate and export business reports for analysis and record-keeping</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((r) => (
          <div key={r.type} style={cardStyle} className="p-5 flex flex-col">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: r.color + '15' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#1F1129' }}>{r.title}</h3>
            <p className="text-sm flex-1 mb-4" style={{ color: '#8B7FA0' }}>{r.description}</p>
            <button
              onClick={() => generateReport(r.type)}
              disabled={loading}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[.98] disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: r.color }}
            >
              {loading && activeReport === r.type ? 'Generating...' : 'Generate'}
            </button>
          </div>
        ))}
      </div>

      {/* ── Report Modal ── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setReportData(null) }} title={REPORT_TYPES.find((r) => r.type === activeReport)?.title || 'Report'} wide>
        {reportData && (
          <div className="space-y-4">
            {/* Summary Box */}
            {reportData.summary && Object.keys(reportData.summary).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl" style={{ backgroundColor: '#FAF7F2' }}>
                {Object.entries(reportData.summary).map(([key, val]: [string, any]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-lg font-bold" style={{ color: '#1F1129' }}>{typeof val === 'number' ? fmt(val) : val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Report Table */}
            {(reportData.items || reportData.rows || []).length > 0 && (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-[#E8E0F0]">
                      {(reportData.columns || Object.keys((reportData.items || reportData.rows || [])[0] || {})).map((col: string) => (
                        <th key={col} className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>
                          {col.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.items || reportData.rows || []).map((row: any, idx: number) => (
                      <tr key={idx} className="border-b border-[#F5F0EB] last:border-0">
                        {(reportData.columns || Object.keys(row)).map((col: string) => (
                          <td key={col} className="py-2.5 px-3" style={{ color: '#1F1129' }}>
                            {typeof row[col] === 'number' && col.toLowerCase().includes('amount') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('cost') || col.toLowerCase().includes('profit') || col.toLowerCase().includes('price')
                              ? fmt(row[col])
                              : row[col] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-[#E8E0F0]">
              <button onClick={() => { setModalOpen(false); setReportData(null) }} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Close</button>
              <button onClick={handlePrint} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
                Print / Export PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   8. STAFF PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function StaffPage() {
  const { storeId, user, stores } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({ name: '', email: '', password: '', pin: '', role: 'staff', storeId: '' })

  const fetchStaff = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getStaff()
      setStaff(Array.isArray(data) ? data : data.staff || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', email: '', password: '', pin: '', role: 'staff', storeId: storeId || '' })
    setModalOpen(true)
  }

  const openEdit = (s: any) => {
    setEditing(s)
    setForm({ name: s.name || '', email: s.email || '', password: '', pin: s.pin || '', role: s.role || 'staff', storeId: s.storeId || '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload: any = { name: form.name.trim(), email: form.email.trim(), role: form.role, storeId: form.storeId }
      if (form.pin) payload.pin = form.pin
      if (form.password) payload.password = form.password
      if (editing) {
        await api.updateStaff({ ...payload, id: editing.id })
      } else {
        if (!form.password || !form.pin) {
          setError('Password and PIN are required for new staff')
          setSaving(false)
          return
        }
        await api.createStaff(payload)
      }
      setModalOpen(false)
      await fetchStaff()
    } catch (err: any) {
      setError(err.message || 'Failed to save staff member')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      await api.deleteStaff(deleteTarget.id)
      setConfirmOpen(false)
      setDeleteTarget(null)
      await fetchStaff()
    } catch (err: any) {
      setError(err.message || 'Failed to delete staff member')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Staff Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Manage staff accounts, roles, and access</p>
        </div>
        <button onClick={openAdd} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
          Add Staff
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div style={cardStyle} className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0F0]">
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#8B7FA0' }}>Email</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Role</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#8B7FA0' }}>PIN</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#8B7FA0' }}>Store</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#8B7FA0' }}>Sales</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#8B7FA0' }}>Status</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.id} className="border-b border-[#F5F0EB] last:border-0">
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{s.name}</td>
                  <td className="py-2.5 px-3 hidden md:table-cell" style={{ color: '#6B5E7A' }}>{s.email}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={s.role === 'manager' ? 'amber' : 'blue'}>{s.role}</Badge>
                  </td>
                  <td className="py-2.5 px-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm" style={{ color: '#6B5E7A' }}>
                        {visiblePins[s.id] ? (s.pin || '----') : '****'}
                      </span>
                      <button onClick={() => setVisiblePins({ ...visiblePins, [s.id]: !visiblePins[s.id] })} className="p-0.5 hover:bg-[#F5F0EB] rounded cursor-pointer" aria-label="Toggle PIN visibility">
                        {visiblePins[s.id] ? (
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="#8B7FA0"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="#8B7FA0"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 hidden lg:table-cell" style={{ color: '#6B5E7A' }}>{s.storeName || s.storeId || '-'}</td>
                  <td className="py-2.5 px-3 text-right hidden md:table-cell" style={{ color: '#6B5E7A' }}>{s.salesCount ?? 0}</td>
                  <td className="py-2.5 px-3 hidden lg:table-cell">
                    <Badge variant={s.isActive !== false ? 'green' : 'red'}>{s.isActive !== false ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(s)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A', padding: '4px 10px', fontSize: '12px' }}>Edit</button>
                      {s.id !== user?.id && (
                        <button onClick={() => { setDeleteTarget(s); setConfirmOpen(true) }} className={btnDanger}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No staff members added yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Staff Member' : 'Add Staff Member'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="Email address" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Password {editing && <span style={{ color: '#8B7FA0', fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder={editing ? 'Leave blank to keep current' : 'Password'} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>PIN (4 digits)</label>
            <input type="text" inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={inputCls} style={{ borderColor: '#E8E0F0', letterSpacing: '0.35em' }} placeholder="4-digit PIN" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Store</label>
            <select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }}>
              <option value="">Select store</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim()} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Staff'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} title="Delete Staff Member" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`} onConfirm={handleDelete} onCancel={() => { setConfirmOpen(false); setDeleteTarget(null) }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   9. STORES PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function StoresPage() {
  const { storeId, setStoreId } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', location: '' })

  const fetchStores = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getStores()
      setStores(Array.isArray(data) ? data : data.stores || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStores() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', location: '' })
    setModalOpen(true)
  }

  const openEdit = (s: any) => {
    setEditing(s)
    setForm({ name: s.name || '', location: s.location || '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.updateStore({ ...form, id: editing.id })
      } else {
        await api.createStore(form)
      }
      setModalOpen(false)
      await fetchStores()
    } catch (err: any) {
      setError(err.message || 'Failed to save store')
    } finally {
      setSaving(false)
    }
  }

  const handleSwitch = async (s: any) => {
    if (s.id === storeId) return
    try {
      await api.switchStore(s.id)
      setStoreId(s.id)
    } catch (err: any) {
      setError(err.message || 'Failed to switch store')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Multi-Store</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Manage multiple store locations</p>
        </div>
        <button onClick={openAdd} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
          Add Store
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((s: any) => {
          const isActive = s.id === storeId
          return (
            <div
              key={s.id}
              className="p-5 cursor-pointer transition-all duration-200 hover:shadow-lg relative"
              style={{
                ...cardStyle,
                borderColor: isActive ? '#059669' : 'transparent',
                borderWidth: '2px',
                borderStyle: 'solid',
              }}
              onClick={() => handleSwitch(s)}
            >
              {isActive && (
                <div className="absolute top-3 right-3">
                  <Badge variant="green">Active</Badge>
                </div>
              )}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: isActive ? '#05966915' : '#F5F0EB' }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#059669' : '#8B7FA0'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 7v14M21 7v14M6 11h4v4H6zM10 3h4l6 4H4l6-4z" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: '#1F1129' }}>{s.name}</h3>
              <p className="text-sm mb-3" style={{ color: '#8B7FA0' }}>{s.location || 'No location set'}</p>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#E8E0F0]">
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color: '#1F1129' }}>{s.productCount ?? 0}</p>
                  <p className="text-xs" style={{ color: '#8B7FA0' }}>Products</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color: '#1F1129' }}>{s.stockValue ? fmt(s.stockValue) : '0'}</p>
                  <p className="text-xs" style={{ color: '#8B7FA0' }}>Stock Value</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color: '#1F1129' }}>{s.salesCount ?? 0}</p>
                  <p className="text-xs" style={{ color: '#8B7FA0' }}>Sales</p>
                </div>
              </div>
              <div className="flex justify-end mt-3" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(s)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A', padding: '4px 12px', fontSize: '12px' }}>Edit</button>
              </div>
            </div>
          )
        })}
        {stores.length === 0 && (
          <div className="col-span-full" style={cardStyle}>
            <div className="p-12 text-center">
              <p className="text-sm" style={{ color: '#8B7FA0' }}>No stores configured. Click "Add Store" to create your first store location.</p>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Store' : 'Add Store'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Store Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="e.g. Downtown Branch" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3D2E50' }}>Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} style={{ borderColor: '#E8E0F0' }} placeholder="e.g. Nairobi CBD" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className={btnSecondary} style={{ borderColor: '#E8E0F0', color: '#6B5E7A' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className={btnPrimary} style={{ backgroundColor: '#DC2626' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Store'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   10. SETTINGS PAGE (Manager Only)
   ═══════════════════════════════════════════════════════════════════════ */
export function SettingsPage() {
  const { org } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, logs] = await Promise.all([api.getSettings(), api.getAuditLogs()])
      setSettings(s)
      setAuditLogs(Array.isArray(logs) ? logs.slice(0, 20) : (logs.auditLogs || logs.items || []).slice(0, 20))
    } catch (err: any) {
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <Spinner />

  const orgData = settings?.org || org || {}
  const dataSummary = settings?.dataSummary || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1F1129' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: '#8B7FA0' }}>Organisation settings and system configuration</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ── Organisation Info ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Organisation Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Business Name</p>
            <p className="text-sm font-medium" style={{ color: '#1F1129' }}>{orgData.name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Plan</p>
            <Badge variant="purple">{orgData.plan || 'Trial'}</Badge>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Status</p>
            <Badge variant={orgData.isActive !== false ? 'green' : 'red'}>{orgData.isActive !== false ? 'Active' : 'Inactive'}</Badge>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Trial Ends</p>
            <p className="text-sm font-medium" style={{ color: '#1F1129' }}>{orgData.trialEndsAt ? new Date(orgData.trialEndsAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* ── Data Summary ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Data Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Products" value={String(dataSummary.totalProducts || 0)} />
          <StatCard label="Total Sales" value={String(dataSummary.totalSales || 0)} />
          <StatCard label="Total Staff" value={String(dataSummary.totalStaff || 0)} />
        </div>
      </div>

      {/* ── Subscription Readiness ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Subscription Readiness</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #E8E0F0' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Current Plan</p>
            <p className="text-base font-bold" style={{ color: '#1F1129' }}>{orgData.plan || 'Trial'}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #E8E0F0' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Trial Period</p>
            <p className="text-base font-bold" style={{ color: '#1F1129' }}>14 Days</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #E8E0F0' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Active Status</p>
            <p className="text-base font-bold" style={{ color: orgData.isActive !== false ? '#059669' : '#DC2626' }}>{orgData.isActive !== false ? 'Yes' : 'No'}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #E8E0F0' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8B7FA0' }}>Renewal Date</p>
            <p className="text-base font-bold" style={{ color: '#1F1129' }}>{orgData.trialEndsAt ? new Date(orgData.trialEndsAt).toLocaleDateString('en-KE') : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* ── Audit Log ── */}
      <div style={cardStyle} className="p-5">
        <h2 className="text-base font-bold mb-4" style={{ color: '#1F1129' }}>Audit Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0F0]">
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>User</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Action</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#8B7FA0' }}>Entity</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7FA0' }}>Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log: any, idx: number) => (
                <tr key={idx} className="border-b border-[#F5F0EB] last:border-0">
                  <td className="py-2.5 px-3 font-medium" style={{ color: '#1F1129' }}>{log.userName || log.user || '-'}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={log.action?.includes('delete') ? 'red' : log.action?.includes('create') ? 'green' : 'blue'}>
                      {log.action || '-'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell" style={{ color: '#6B5E7A' }}>{log.entity || log.entityType || '-'}</td>
                  <td className="py-2.5 px-3 text-sm" style={{ color: '#8B7FA0' }}>{log.createdAt ? new Date(log.createdAt).toLocaleString('en-KE') : '-'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-sm" style={{ color: '#8B7FA0' }}>No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   11. SUPER ADMIN PAGE (super_admin only)
   ═══════════════════════════════════════════════════════════════════════ */
export function SuperAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      setError('')
      try {
        const d = await api.getSuperAdmin()
        setData(d)
      } catch (err: any) {
        setError(err.message || 'Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0A1A' }}>
      <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none" style={{ color: '#F59E0B' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  )

  const summary = data?.summary || {}
  const organisations = (data?.organisations || data?.recentOrgs || []).map((org: any) => ({
    ...org,
    userCount: org._count?.users ?? org.userCount ?? 0,
    productCount: org._count?.products ?? org.productCount ?? 0,
  }))

  const saCard: React.CSSProperties = {
    backgroundColor: '#1A1225',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 12px rgba(0,0,0,.3)',
  }

  const saTableCard: React.CSSProperties = {
    backgroundColor: '#1A1225',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 12px rgba(0,0,0,.3)',
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F0A1A' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>System-wide management and monitoring</p>
        </div>

        {error && (
          <div className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.3)' }}>
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Orgs</p>
            <p className="text-2xl font-bold text-white">{summary.totalOrganisations ?? 0}</p>
          </div>
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Active Subs</p>
            <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{summary.activeSubscriptions ?? 0}</p>
          </div>
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Trial Accounts</p>
            <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{summary.trialAccounts ?? 0}</p>
          </div>
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Users</p>
            <p className="text-2xl font-bold text-white">{summary.totalUsers ?? 0}</p>
          </div>
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Products</p>
            <p className="text-2xl font-bold text-white">{summary.totalProducts ?? 0}</p>
          </div>
          <div style={saCard} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Sales</p>
            <p className="text-2xl font-bold text-white">{summary.totalSales ?? 0}</p>
          </div>
        </div>

        {/* ── Organisations Table ── */}
        <div style={saTableCard} className="p-5">
          <h2 className="text-base font-bold text-white mb-4">Recent Organisations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Plan</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>Users</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>Products</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {organisations.map((org: any, idx: number) => (
                  <tr key={org.id || idx} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 px-3 font-medium text-white">{org.name || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#C4B5FD' }}>
                        {org.plan || 'Trial'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: org.isActive !== false ? 'rgba(16,185,129,0.2)' : 'rgba(220,38,38,0.2)', color: org.isActive !== false ? '#6EE7B7' : '#FCA5A5' }}>
                        {org.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.6)' }}>{org.userCount ?? 0}</td>
                    <td className="py-2.5 px-3 text-right hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.6)' }}>{org.productCount ?? 0}</td>
                    <td className="py-2.5 px-3 hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {org.createdAt ? new Date(org.createdAt).toLocaleDateString('en-KE') : '-'}
                    </td>
                  </tr>
                ))}
                {organisations.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No organisations found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}