import { getDb, initDatabase, hashPassword } from '@/lib/db';
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
    const { name, email, role, orgId, status, password } = body;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (orgId !== undefined) {
      updates.push('org_id = ?');
      values.push(orgId);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (password) {
      updates.push('password_hash = ?');
      values.push(hashPassword(password));
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(
      `UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
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

  db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return Response.json({ success: true, deleted: Number(id) });
}
