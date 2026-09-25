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
    const { status, orgId, planId, startsAt, endsAt } = body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (orgId !== undefined) {
      updates.push('org_id = ?');
      values.push(Number(orgId));
    }
    if (planId !== undefined) {
      updates.push('plan_id = ?');
      values.push(Number(planId));
    }
    if (startsAt !== undefined) {
      updates.push('starts_at = ?');
      values.push(startsAt);
    }
    if (endsAt !== undefined) {
      updates.push('ends_at = ?');
      values.push(endsAt);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(
      `UPDATE subscriptions SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update subscription error:', error);
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

  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(Number(id));
  return Response.json({ success: true, deleted: Number(id) });
}
