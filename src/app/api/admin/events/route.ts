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
    SELECT e.id, e.name, e.description, e.event_date, e.venue, e.poster_image, e.status, e.created_at, e.updated_at,
           (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) as ticket_count,
           (SELECT COUNT(*) FROM tickets WHERE event_id = e.id AND scanned_at IS NOT NULL) as scanned_count
    FROM events e
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    query += ' AND e.org_id = ?';
    params.push(auth.user.orgId);
  }

  query += ' ORDER BY e.created_at DESC';

  const events = db.prepare(query).all(...params);

  return Response.json({ events });
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
    const { name, description, eventDate, venue, status, posterImage, orgId } = body;

    if (!name) {
      return Response.json({ error: 'Event name is required' }, { status: 400 });
    }

    const targetOrgId =
      auth.user.role === 'super_admin' ? (orgId ?? auth.user.orgId) : auth.user.orgId;

    if (!targetOrgId) {
      return Response.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    if (auth.user.role === 'admin' && auth.user.orgId) {
      const org = db
        .prepare('SELECT max_events, status FROM organizations WHERE id = ?')
        .get(auth.user.orgId) as { max_events: number; status: string } | undefined;

      if (!org || org.status !== 'active') {
        return Response.json({ error: 'Organization is not active' }, { status: 400 });
      }

      if (org.max_events > 0) {
        const eventCount = db
          .prepare('SELECT COUNT(*) as cnt FROM events WHERE org_id = ?')
          .get(auth.user.orgId) as { cnt: number };

        if (eventCount.cnt >= org.max_events) {
          return Response.json(
            {
              error: `Event limit reached. Your plan allows ${org.max_events} events.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const info = db
      .prepare(
        'INSERT INTO events (org_id, name, description, event_date, venue, poster_image, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        targetOrgId,
        name,
        description,
        eventDate,
        venue,
        posterImage ?? null,
        status ?? 'draft'
      );

    return Response.json(
      {
        success: true,
        event: {
          id: info.lastInsertRowid,
          orgId: targetOrgId,
          name,
          description,
          eventDate,
          venue,
          posterImage: posterImage ?? null,
          status: status ?? 'draft',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create event error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
