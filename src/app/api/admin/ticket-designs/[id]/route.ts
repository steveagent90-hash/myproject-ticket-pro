import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  const design = db
    .prepare(
      `
    SELECT d.id, d.name, d.page_size, d.background_image, d.config, d.created_at, d.updated_at, e.name as event_name
    FROM ticket_designs d
    LEFT JOIN events e ON d.event_id = e.id
    WHERE d.id = ? AND d.org_id = ?
  `
    )
    .get(Number(id), auth.user.orgId ?? 1) as Record<string, unknown> | undefined;

  if (!design) {
    return Response.json({ error: 'Design not found' }, { status: 404 });
  }

  return Response.json({ design });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { name, pageSize, backgroundImage, config, eventId } = body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (pageSize !== undefined) {
      updates.push('page_size = ?');
      values.push(pageSize);
    }
    if (backgroundImage !== undefined) {
      updates.push('background_image = ?');
      values.push(backgroundImage);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(config));
    }
    if (eventId !== undefined) {
      updates.push('event_id = ?');
      values.push(eventId);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(
      `UPDATE ticket_designs SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND org_id = ?`
    ).run(...values, auth.user.orgId ?? 1);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update design error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
