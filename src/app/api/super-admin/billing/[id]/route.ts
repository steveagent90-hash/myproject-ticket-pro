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
    const { status, paidAt, dueDate } = body;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    if (paidAt !== undefined) {
      updates.push('paid_at = ?');
      values.push(paidAt);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(dueDate);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(
      `UPDATE billing SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update billing error:', error);
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

  db.prepare('DELETE FROM billing WHERE id = ?').run(Number(id));
  return Response.json({ success: true, deleted: Number(id) });
}
