import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'
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
    const { data: sales } = await supabaseServer
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
    const { data: products } = await supabaseServer
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
    const { data: sales } = await supabaseServer
      .from('sales')
      .select('*, sale_items(*)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', startDate)

    const revenue = (sales || []).reduce((s, sale) => s + Number(sale.total), 0)
    const allItems = (sales || []).flatMap((s: any) => s.sale_items || [])
    const cogs = allItems.reduce((s, item) => s + Number(item.cost) * item.qty, 0)

    const { data: expenses } = await supabaseServer
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
    const { data: expenses } = await supabaseServer
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
    const { data: stockTakes } = await supabaseServer
      .from('stock_takes')
      .select('*, stock_take_items(*, product:products(name)), starter:users!started_by(name), approver:users!approved_by(name)')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .order('started_at', { ascending: false })

    return NextResponse.json({ stockTakes: stockTakes || [] })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}