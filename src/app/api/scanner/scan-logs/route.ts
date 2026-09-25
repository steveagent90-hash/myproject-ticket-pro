import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin', 'scanner']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '30', 10));
  const eventId = searchParams.get('eventId');

  initDatabase();
  const db = getDb();

  let query = `
    SELECT sl.id, sl.ticket_id, sl.user_id, sl.event_id, sl.qr_data, sl.result, sl.ip_address, sl.created_at,
           t.serial_number, u.name as user_name, e.name as event_name
    FROM scan_logs sl
    LEFT JOIN tickets t ON sl.ticket_id = t.id
    LEFT JOIN users u ON sl.user_id = u.id
    LEFT JOIN events e ON sl.event_id = e.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    query += ' AND e.org_id = ?';
    params.push(auth.user.orgId);
  }

  if (eventId) {
    query += ' AND sl.event_id = ?';
    params.push(Number(eventId));
  }

  query += ` ORDER BY sl.created_at DESC LIMIT ${limit}`;

  const logs = db.prepare(query).all(...params);

  let statsQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'valid' THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN result = 'used' THEN 1 ELSE 0 END) as used,
      SUM(CASE WHEN result = 'invalid' THEN 1 ELSE 0 END) as invalid
    FROM scan_logs sl
    LEFT JOIN events e ON sl.event_id = e.id
    WHERE 1=1
  `;
  const statsParams: (string | number)[] = [];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    statsQuery += ' AND e.org_id = ?';
    statsParams.push(auth.user.orgId);
  }

  const stats = db.prepare(statsQuery).get(...statsParams) as {
    total: number;
    valid: number;
    used: number;
    invalid: number;
  };

  return Response.json({ logs, stats });
}
