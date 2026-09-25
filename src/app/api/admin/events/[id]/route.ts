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

  const event = db
    .prepare(
      `
    SELECT e.id, e.name, e.description, e.event_date, e.venue, e.poster_image, e.status, e.created_at, e.updated_at, e.org_id,
           o.name as org_name
    FROM events e
    JOIN organizations o ON e.org_id = o.id
    WHERE e.id = ?
  `
    )
    .get(Number(id)) as Record<string, unknown> | undefined;

  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  return Response.json({ event });
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
    const { name, description, eventDate, venue, posterImage, status } = body;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (eventDate !== undefined) {
      updates.push('event_date = ?');
      values.push(eventDate);
    }
    if (venue !== undefined) {
      updates.push('venue = ?');
      values.push(venue);
    }
    if (posterImage !== undefined) {
      updates.push('poster_image = ?');
      values.push(posterImage ?? null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(Number(id));
    db.prepare(
      `UPDATE events SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update event error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
