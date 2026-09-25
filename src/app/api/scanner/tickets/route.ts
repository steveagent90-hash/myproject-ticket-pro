import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin', 'scanner']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  initDatabase();
  const db = getDb();

  let query = `
    SELECT t.id, t.serial_number, t.qr_token, t.status, t.scanned_at, t.created_at,
           e.name as event_name
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    query += ' AND e.org_id = ?';
    params.push(auth.user.orgId);
  }

  if (eventId) {
    query += ' AND t.event_id = ?';
    params.push(Number(eventId));
  }

  query += ' ORDER BY t.created_at DESC LIMIT 100';

  const tickets = db.prepare(query).all(...params);

  return Response.json({ tickets });
}
