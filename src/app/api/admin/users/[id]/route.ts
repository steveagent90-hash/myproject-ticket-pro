import { getDb, initDatabase } from '@/lib/db';
import { requireAuth, jsonResponse } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = Number(id);

  if (!userId || isNaN(userId)) {
    return jsonResponse({ error: 'Invalid user ID' }, 400);
  }

  initDatabase();
  const db = getDb();

  const targetUser = db.prepare('SELECT id, role, org_id FROM users WHERE id = ?').get(userId) as
    { id: number; role: string; org_id: number | null } | undefined;

  if (!targetUser) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  if (targetUser.role === 'super_admin') {
    return jsonResponse({ error: 'Cannot delete super admin users' }, 403);
  }

  if (auth.user.role === 'admin') {
    if (targetUser.org_id !== auth.user.orgId) {
      return jsonResponse({ error: 'Cannot delete users from other organizations' }, 403);
    }

    if (targetUser.id === auth.user.id) {
      return jsonResponse({ error: 'Cannot delete your own account' }, 400);
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return jsonResponse({ success: true, message: 'User deleted successfully' });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = Number(id);

  if (!userId || isNaN(userId)) {
    return jsonResponse({ error: 'Invalid user ID' }, 400);
  }

  initDatabase();
  const db = getDb();

  const targetUser = db.prepare('SELECT id, role, org_id FROM users WHERE id = ?').get(userId) as
    { id: number; role: string; org_id: number | null } | undefined;

  if (!targetUser) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  if (auth.user.role === 'admin' && targetUser.org_id !== auth.user.orgId) {
    return jsonResponse({ error: 'Cannot modify users from other organizations' }, 403);
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      return jsonResponse({ error: 'Invalid status' }, 400);
    }

    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
      status,
      new Date().toISOString(),
      userId
    );

    return jsonResponse({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Update user error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
