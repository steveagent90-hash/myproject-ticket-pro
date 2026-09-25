import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface TicketItem {
  serialNumber?: string;
  qrToken?: string;
  eventId?: number;
}

export async function GET(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const status = searchParams.get('status');

  initDatabase();
  const db = getDb();

  let query = `
    SELECT t.id, t.serial_number, t.qr_token, t.status, t.scanned_at, t.created_at,
           u.name as scanned_by_name, e.org_id
    FROM tickets t
    LEFT JOIN users u ON t.scanned_by = u.id
    JOIN events e ON t.event_id = e.id
    WHERE t.event_id = ?
  `;
  const params: (string | number)[] = [Number(eventId)];

  if (auth.user.role !== 'super_admin' && auth.user.orgId) {
    query += ' AND e.org_id = ?';
    params.push(auth.user.orgId);
  }

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.created_at DESC';

  const tickets = db.prepare(query).all(...params);

  return Response.json({ tickets });
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
    const { eventId, prefix, startNumber, count } = body as {
      eventId: number;
      prefix: string;
      startNumber: number;
      count: number;
    };

    if (!eventId || !prefix || !count) {
      return Response.json({ error: 'eventId, prefix, and count are required' }, { status: 400 });
    }

    const event = db.prepare('SELECT id, org_id FROM events WHERE id = ?').get(eventId) as
      { id: number; org_id: number } | undefined;

    if (!event) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    if (auth.user.role !== 'super_admin' && event.org_id !== auth.user.orgId) {
      return Response.json(
        { error: 'Event does not belong to your organization' },
        { status: 403 }
      );
    }

    if (auth.user.role === 'admin' && auth.user.orgId) {
      const org = db
        .prepare('SELECT max_tickets FROM organizations WHERE id = ?')
        .get(auth.user.orgId) as { max_tickets: number } | undefined;

      const currentCount = db
        .prepare('SELECT COUNT(*) as cnt FROM tickets WHERE event_id = ?')
        .get(eventId) as { cnt: number };

      if (org && org.max_tickets > 0) {
        const totalTickets = db
          .prepare(
            'SELECT COUNT(*) as cnt FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.org_id = ?'
          )
          .get(auth.user.orgId) as { cnt: number };

        if (totalTickets.cnt + count > org.max_tickets) {
          return Response.json(
            {
              error: `Ticket limit exceeded. Your plan allows ${org.max_tickets} tickets. You currently have ${totalTickets.cnt}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const insert = db.prepare(
      'INSERT INTO tickets (event_id, serial_number, qr_token, status) VALUES (?, ?, ?, ?)'
    );
    const insertMany = db.transaction((tickets: TicketItem[]) => {
      for (const t of tickets) insert.run(t.eventId, t.serialNumber, t.qrToken, 'valid');
    });

    const tickets: TicketItem[] = [];
    for (let i = 0; i < count; i++) {
      const num = String((startNumber || 0) + i).padStart(4, '0');
      const serial = `${prefix.toUpperCase()}-${num}`;
      const qrToken = `TICKETQR:${serial}:EVT-${new Date().getFullYear()}`;
      tickets.push({ serialNumber: serial, qrToken: qrToken, eventId: Number(eventId) });
    }

    insertMany(tickets);

    return Response.json(
      {
        success: true,
        generated: tickets.length,
        sampleSerial: tickets[0]?.serialNumber,
        sampleQr: tickets[0]?.qrToken,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Generate tickets error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
