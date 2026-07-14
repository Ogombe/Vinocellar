import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { daysAgo, todayStr } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const type = searchParams.get('type') || 'sales'
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const startDate = daysAgo(30).toISOString()

  if (type === 'sales') {
    const { data: sales } = await auth.db
      .from('sales')
      .select('*, sale_items(*), staff:users!staff_id(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    const mapped = (sales || []).map((s: any) => ({
      id: s.id, total: s.total, paymentMethod: s.payment_method,
      createdAt: s.created_at,
      staff: s.staff ? { name: s.staff.name } : null,
      items: (s.sale_items || []).map((si: any) => ({
        id: si.id, name: si.name, qty: si.qty, price: si.price, cost: si.cost,
        productId: si.product_id,
      })),
    }))

    const total = mapped.reduce((s, sale) => s + sale.total, 0)
    return NextResponse.json({ sales: mapped, total, count: mapped.length })
  }

  if (type === 'inventory') {
    const { data: products } = await auth.db
      .from('products')
      .select('*, category:categories(name, colour), supplier:suppliers(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)

    const mapped = (products || []).map((p: any) => ({
      id: p.id, name: p.name, sku: p.sku, barcode: p.barcode,
      currentStock: p.current_stock, costPrice: p.cost_price, sellPrice: p.sell_price,
      category: p.category?.name || 'Other',
      supplier: p.supplier?.name || null,
    }))

    const totalValue = mapped.reduce((s, p) => s + p.currentStock * p.costPrice, 0)
    return NextResponse.json({ products: mapped, totalValue, count: mapped.length })
  }

  if (type === 'profit-loss') {
    const { data: sales } = await auth.db
      .from('sales')
      .select('*, sale_items(*)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', startDate)

    const revenue = (sales || []).reduce((s, sale) => s + Number(sale.total), 0)
    const allItems = (sales || []).flatMap((s: any) => s.sale_items || [])
    const cogs = allItems.reduce((s, item) => s + Number(item.cost) * item.qty, 0)

    const { data: expenses } = await auth.db
      .from('expenses')
      .select('*')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('date', daysAgo(30).toISOString().split('T')[0])

    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)

    return NextResponse.json({
      revenue, cogs, grossProfit: revenue - cogs,
      expenses: expenses || [], totalExpenses,
      netProfit: revenue - cogs - totalExpenses,
      period: 'Last 30 Days'
    })
  }

  if (type === 'expense') {
    const { data: expenses } = await auth.db
      .from('expenses')
      .select('*')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('date', daysAgo(30).toISOString().split('T')[0])
      .order('date', { ascending: false })

    const byCategory: Record<string, number> = {}
    for (const e of (expenses || [])) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
    }

    return NextResponse.json({
      expenses: expenses || [],
      byCategory,
      total: (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
    })
  }

  if (type === 'stock-audit') {
    const { data: stockTakes } = await auth.db
      .from('stock_takes')
      .select('*, stock_take_items(*, product:products(name)), starter:users!started_by(name), approver:users!approved_by(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .order('started_at', { ascending: false })

    return NextResponse.json({ stockTakes: stockTakes || [] })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}

// ─── CSV Export ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const { type, startDate, endDate } = await request.json()
  const start = startDate || daysAgo(30).toISOString()
  const end = endDate || new Date().toISOString()

  let csv = ''
  let filename = 'report'

  if (type === 'sales') {
    const { data: sales } = await auth.db
      .from('sales')
      .select('*, sale_items(*), staff:users!staff_id(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })

    csv = 'Date,Receipt #,Staff,Items,Total,Payment Method\n'
    for (const s of (sales || []) as any[]) {
      const d = new Date(s.created_at).toLocaleString('en-KE')
      const items = (s.sale_items || []).map((si: any) => `${si.name} x${si.qty}`).join('; ')
      csv += `"${d}","${s.id.slice(0, 8)}","${s.staff?.name || 'N/A'}","${items}",${s.total},"${s.payment_method || ''}"\n`
    }
    filename = `sales-report-${todayStr()}`

  } else if (type === 'inventory') {
    const { data: products } = await auth.db
      .from('products')
      .select('*, category:categories(name), supplier:suppliers(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)

    csv = 'Name,SKU,Category,Supplier,Current Stock,Cost Price,Sell Price,Stock Value\n'
    for (const p of (products || []) as any[]) {
      const val = (p.current_stock || 0) * (p.cost_price || 0)
      csv += `"${p.name}","${p.sku || ''}","${p.category?.name || 'Other'}","${p.supplier?.name || ''}",${p.current_stock || 0},${p.cost_price || 0},${p.sell_price || 0},${val.toFixed(2)}\n`
    }
    filename = `inventory-report-${todayStr()}`

  } else if (type === 'profit-loss') {
    const { data: sales } = await auth.db
      .from('sales')
      .select('*, sale_items(*)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', start)
      .lte('created_at', end)

    const revenue = (sales || []).reduce((s: number, sale: any) => s + Number(sale.total), 0)
    const allItems = (sales || []).flatMap((s: any) => s.sale_items || [])
    const cogs = allItems.reduce((s: number, item: any) => s + Number(item.cost) * item.qty, 0)

    const { data: expenses } = await auth.db
      .from('expenses')
      .select('*')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0])

    const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0)

    csv = 'Profit & Loss Report\n'
    csv += `Period,${start.split('T')[0]} to ${end.split('T')[0]}\n\n`
    csv += 'Category,Amount\n'
    csv += `Revenue,${revenue.toFixed(2)}\n`
    csv += `Cost of Goods Sold,${cogs.toFixed(2)}\n`
    csv += `Gross Profit,${(revenue - cogs).toFixed(2)}\n`
    csv += `Total Expenses,${totalExpenses.toFixed(2)}\n`
    csv += `Net Profit,${(revenue - cogs - totalExpenses).toFixed(2)}\n`
    filename = `profit-loss-${todayStr()}`

  } else if (type === 'expenses') {
    const { data: expenses } = await auth.db
      .from('expenses')
      .select('*')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0])
      .order('date', { ascending: false })

    csv = 'Date,Category,Description,Amount\n'
    for (const e of (expenses || []) as any[]) {
      csv += `"${e.date}","${e.category || ''}","${e.description || ''}",${Number(e.amount).toFixed(2)}\n`
    }
    filename = `expenses-report-${todayStr()}`

  } else if (type === 'reconciliation') {
    const { data: recs } = await auth.db
      .from('reconciliations')
      .select('*, reconciliation_items(*, product:products(name, sku))')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .limit(30)

    csv = 'Date,Product,SKU,Opening Stock,Sales,Stock Added,Expected Closing,Actual Closing,Variance,Value Lost\n'
    for (const r of (recs || []) as any[]) {
      for (const item of (r.reconciliation_items || [])) {
        const pName = item.product?.name || 'Unknown'
        const pSku = item.product?.sku || ''
        csv += `"${r.date}","${pName}","${pSku}",${item.opening_stock || 0},${item.sales_today || 0},${item.stock_added || 0},${item.expected_closing || 0},${item.actual_closing ?? ''},${item.variance ?? ''},${item.value_lost?.toFixed(2) ?? ''}\n`
      }
    }
    filename = `reconciliation-report-${todayStr()}`

  } else if (type === 'staff-performance') {
    const { data: staffList } = await auth.db
      .from('users')
      .select('id, name, role, is_active')
      .eq('organisation_id', auth.orgId)
      .in('role', ['manager', 'staff'])

    csv = 'Staff Name,Role,Status,Total Sales,Sales Amount\n'
    for (const u of (staffList || []) as any[]) {
      const { data: sales } = await auth.db
        .from('sales')
        .select('total')
        .eq('staff_id', u.id)
        .eq('organisation_id', auth.orgId)
        .gte('created_at', start)

      const count = (sales || []).length
      const total = (sales || []).reduce((s: number, sale: any) => s + Number(sale.total), 0)
      csv += `"${u.name}","${u.role}","${u.is_active ? 'Active' : 'Inactive'}",${count},${total.toFixed(2)}\n`
    }
    filename = `staff-performance-${todayStr()}`

  } else {
    return NextResponse.json({ error: 'Unknown report type for CSV' }, { status: 400 })
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}