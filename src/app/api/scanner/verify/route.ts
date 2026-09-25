import { getDb, initDatabase } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

import { extractTokenFromScanData } from '@/lib/qr-utils';

export async function POST(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin', 'scanner']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { qrToken } = body;

    if (!qrToken) {
      return Response.json({ error: 'QR token is required' }, { status: 400 });
    }

    const token = extractTokenFromScanData(qrToken);

    const ticket = db
      .prepare(
        `
      SELECT t.id, t.serial_number, t.qr_token, t.status, t.scanned_at, t.event_id,
             e.name as event_name, e.venue, e.org_id,
             u.name as scanned_by_name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      LEFT JOIN users u ON t.scanned_by = u.id
      WHERE t.qr_token = ?
    `
      )
      .get(token) as
      | {
          id: number;
          serial_number: string;
          qr_token: string;
          status: string;
          scanned_at: string | null;
          event_id: number;
          event_name: string;
          venue: string;
          org_id: number;
          scanned_by_name: string | null;
        }
      | undefined;

    if (!ticket) {
      db.prepare('INSERT INTO scan_logs (qr_data, result, created_at) VALUES (?, ?, ?)').run(
        token,
        'invalid',
        new Date().toISOString()
      );

      return Response.json(
        {
          valid: false,
          status: 'invalid',
          message: 'Ticket not found in database',
        },
        { status: 404 }
      );
    }

    if (auth.user.role !== 'super_admin' && auth.user.orgId !== ticket.org_id) {
      return Response.json(
        { error: 'Ticket does not belong to your organization' },
        { status: 403 }
      );
    }

    const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '')
      .split(',')[0]
      .trim();

    if (ticket.status === 'used') {
      db.prepare(
        'INSERT INTO scan_logs (ticket_id, user_id, event_id, qr_data, result, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        ticket.id,
        auth.user.id,
        ticket.event_id,
        token,
        'used',
        ip || null,
        new Date().toISOString()
      );

      return Response.json({
        valid: false,
        status: 'used',
        message: 'Ticket has already been scanned',
        ticket: {
          id: ticket.id,
          serial: ticket.serial_number,
          event: ticket.event_name,
          venue: ticket.venue,
          scannedAt: ticket.scanned_at,
          scannedBy: ticket.scanned_by_name,
        },
      });
    }

    if (ticket.status === 'invalid') {
      db.prepare(
        'INSERT INTO scan_logs (ticket_id, user_id, event_id, qr_data, result, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        ticket.id,
        auth.user.id,
        ticket.event_id,
        token,
        'invalid',
        ip || null,
        new Date().toISOString()
      );

      return Response.json(
        {
          valid: false,
          status: 'invalid',
          message: 'Ticket is marked as invalid',
          ticket: {
            id: ticket.id,
            serial: ticket.serial_number,
            event: ticket.event_name,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO scan_logs (ticket_id, user_id, event_id, qr_data, result, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(ticket.id, auth.user.id, ticket.event_id, token, 'valid', ip || null, now);

    return Response.json({
      valid: true,
      status: 'valid',
      message: 'Ticket validated successfully',
      ticket: {
        id: ticket.id,
        serial: ticket.serial_number,
        event: ticket.event_name,
        venue: ticket.venue,
        scannedAt: now,
        scannedBy: auth.user.name,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(['super_admin', 'admin', 'scanner']);
  if ('error' in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  initDatabase();
  const db = getDb();

  try {
    const body = await request.json();
    const { qrToken } = body;

    if (!qrToken) {
      return Response.json({ error: 'QR token is required' }, { status: 400 });
    }

    const token = extractTokenFromScanData(qrToken);

    const ticket = db
      .prepare(
        `
      SELECT t.id, t.status, t.event_id, e.org_id
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.qr_token = ?
    `
      )
      .get(token) as { id: number; status: string; event_id: number; org_id: number } | undefined;

    if (!ticket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (auth.user.role !== 'super_admin' && auth.user.orgId !== ticket.org_id) {
      return Response.json(
        { error: 'Ticket does not belong to your organization' },
        { status: 403 }
      );
    }

    if (ticket.status !== 'valid') {
      return Response.json({ error: 'Ticket is not in valid state' }, { status: 400 });
    }

    const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '')
      .split(',')[0]
      .trim();

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE tickets SET status = 'used', scanned_at = ?, scanned_by = ? WHERE id = ?"
    ).run(now, auth.user.id, ticket.id);

    db.prepare(
      'INSERT INTO scan_logs (ticket_id, user_id, event_id, qr_data, result, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(ticket.id, auth.user.id, ticket.event_id, qrToken, 'valid', ip || null, now);

    return Response.json({
      success: true,
      message: 'Ticket marked as scanned',
    });
  } catch (error) {
    console.error('Confirm scan error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
