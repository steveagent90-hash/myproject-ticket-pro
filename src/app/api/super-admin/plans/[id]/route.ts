import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const {
      name,
      description,
      price,
      currency,
      billingCycle,
      maxEvents,
      maxTickets,
      features,
      isActive,
    } = body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (price !== undefined) {
      updates.push('price_cents = ?');
      values.push(Number(price) * 100);
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      values.push(currency);
    }
    if (billingCycle !== undefined) {
      updates.push('billing_cycle = ?');
      values.push(billingCycle);
    }
    if (maxEvents !== undefined) {
      updates.push('max_events = ?');
      values.push(Number(maxEvents));
    }
    if (maxTickets !== undefined) {
      updates.push('max_tickets = ?');
      values.push(Number(maxTickets));
    }
    if (features !== undefined) {
      updates.push('features = ?');
      values.push(typeof features === 'string' ? features : JSON.stringify(features));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update plan error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  db.prepare('UPDATE plans SET is_active = 0 WHERE id = ?').run(Number(id));
  return Response.json({ success: true, deleted: Number(id) });
}
