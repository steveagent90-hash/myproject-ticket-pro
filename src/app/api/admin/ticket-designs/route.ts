import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  let query = `
    SELECT d.id, d.name, d.page_size, d.background_image, d.config, d.created_at, d.updated_at,
           e.name as event_name
    FROM ticket_designs d
    LEFT JOIN events e ON d.event_id = e.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    query += ' AND d.org_id = ?';
    params.push(auth.user.orgId);
  }

  query += ' ORDER BY d.created_at DESC';

  const designs = db.prepare(query).all(...params);

  return Response.json({ designs });
}

export async function POST(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { name, pageSize, backgroundImage, config, eventId } = body;

    if (!name || !config) {
      return Response.json({ error: 'Name and config are required' }, { status: 400 });
    }

    const orgId =
      auth.user.role === 'super_admin' ? (body.orgId ?? auth.user.orgId) : auth.user.orgId;

    if (!orgId) {
      return Response.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const info = db
      .prepare(
        'INSERT INTO ticket_designs (org_id, event_id, name, page_size, background_image, config) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        orgId,
        eventId ?? null,
        name,
        pageSize ?? 'A4',
        backgroundImage ?? null,
        JSON.stringify(config)
      );

    return Response.json(
      {
        success: true,
        design: { id: info.lastInsertRowid, name, pageSize: pageSize ?? 'A4' },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Save design error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
