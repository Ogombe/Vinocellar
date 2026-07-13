import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = { organisationId: auth.orgId }
  if (storeId) where.storeId = storeId
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }

  const expenses = await db.expense.findMany({
    where, include: { recorder: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(expenses)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { date, category, description, amount, storeId } = body
  const sid = storeId || auth.storeId

  if (!date || !category || !amount) return NextResponse.json({ error: 'Date, category, amount required' }, { status: 400 })

  const expense = await db.expense.create({
    data: { date, category, description: description || '', amount, organisationId: auth.orgId, storeId: sid, recordedBy: auth.userId },
    include: { recorder: { select: { name: true } } }
  })

  await auditLog({ action: 'expense.created', entity: 'Expense', entityId: expense.id, afterValue: { amount, category }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(expense, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const expense = await db.expense.update({ where: { id }, data })
  await auditLog({ action: 'expense.updated', entity: 'Expense', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(expense)
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await db.expense.delete({ where: { id } })
  await auditLog({ action: 'expense.deleted', entity: 'Expense', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}