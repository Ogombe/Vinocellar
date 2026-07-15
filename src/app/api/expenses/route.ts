import { NextRequest, NextResponse } from 'next/server'
import { withAuth, checkSubscription, subscriptionErrorResponse } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = auth.db
    .from('expenses')
    .select('*, recorder:users!recorded_by(name)')
    .eq('organisation_id', auth.orgId)

  if (storeId) query = query.eq('store_id', storeId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  query = query.order('created_at', { ascending: false })

  const { data: expenses, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (expenses || []).map((e: any) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
    organisationId: e.organisation_id,
    storeId: e.store_id,
    recordedBy: e.recorded_by,
    createdAt: e.created_at,
    recorder: e.recorder ? { name: e.recorder.name } : null,
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { date, category, description, amount, storeId } = body
  const sid = storeId || auth.storeId

  if (!date || !category || !amount) {
    return NextResponse.json({ error: 'Date, category, amount required' }, { status: 400 })
  }

  const { data: expense, error } = await auth.db
    .from('expenses')
    .insert({
      id: uuidv4(),
      date,
      category,
      description: description || '',
      amount,
      organisation_id: auth.orgId,
      store_id: sid,
      recorded_by: auth.userId,
    })
    .select('*, recorder:users!recorded_by(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'expense.created', entity: 'Expense', entityId: expense.id,
    afterValue: { amount, category }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({
    id: expense.id,
    date: expense.date,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    recorder: expense.recorder ? { name: expense.recorder.name } : null,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const updateData: any = {}
  if (data.date) updateData.date = data.date
  if (data.category) updateData.category = data.category
  if (data.description !== undefined) updateData.description = data.description
  if (data.amount) updateData.amount = data.amount

  const { error } = await auth.db
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'expense.updated', entity: 'Expense', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await auth.db
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'expense.deleted', entity: 'Expense', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}